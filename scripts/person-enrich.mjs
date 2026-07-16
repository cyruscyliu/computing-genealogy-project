import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./common/cache-paths.mjs";
import { withFileLock } from "./common/file-lock.mjs";
import { normalizeInstitution } from "./common/institution-normalization.mjs";
import { sanitizeDerivedAdvisorLabel } from "./common/advisor-label.mjs";
import { normalizePeopleRawSchema, normalizePersonRawSchema } from "./common/raw-schema-normalization.mjs";
import {
  buildCsrankingsSource,
  loadCsrankingsIndex,
  resolveCsrankingsEntry,
} from "./tools/csrankings.mjs";
import {
  buildOrcidSearchSource,
  buildOrcidSource,
  chooseCurrentEmployment,
  chooseDoctoralEducation,
  chooseInstitutionFromExpandedSearch,
  chooseOrcidByExactName,
  fetchOrcidSignals,
  searchOrcidByName,
  validOrcid,
} from "./tools/orcid.mjs";
import {
  buildHomepageSource,
  resolveHomepageAffiliation,
  resolveHomepageProfileSignals,
} from "./tools/homepage.mjs";
import { lookupMgpProfileForPerson, lookupMgpSearchMatchForPerson } from "./tools/mgp.mjs";

const rawDir = path.join(appRoot, "data", "raw");
const cacheDir = path.join(cacheDirs.resolution, "person-enrich");
const CACHE_SCHEMA_VERSION = 30;
const DEFAULT_CONCURRENCY = 12;
const HOMEPAGE_PROFILE_TIMEOUT_MS = 15000;
const HOMEPAGE_AFFILIATION_TIMEOUT_MS = 10000;
const MAX_ENRICH_ATTEMPTS = 3;
const COVERAGE_FIELDS = [
  "work",
  "undergraduate",
  "masters",
  "phdSchool",
  "phdAdvisor",
  "phdGraduationYear",
  "postdocSchool",
  "postdocAdvisor",
];

function parseArgs(argv) {
  const options = {
    limit: null,
    concurrency: DEFAULT_CONCURRENCY,
    force: false,
    ids: [],
    all: false,
    random: false,
    requireImprovement: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] ?? 0) || null;
      index += 1;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[index + 1] ?? 0) || DEFAULT_CONCURRENCY);
      index += 1;
      continue;
    }
    if (arg === "--id") {
      const value = argv[index + 1] ?? "";
      if (value) {
        options.ids.push(value);
      }
      index += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--all") {
      options.all = true;
      continue;
    }
    if (arg === "--random") {
      options.random = true;
      continue;
    }
    if (arg === "--require-improvement") {
      options.requireImprovement = true;
      continue;
    }
  }

  return options;
}

async function loadPeopleWithFiles() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const rows = [];

  for (const fileName of files) {
    const filePath = path.join(rawDir, fileName);
    const people = normalizePeopleRawSchema(JSON.parse(await readFile(filePath, "utf8")));
    people.forEach((person) => {
      rows.push({ person, filePath });
    });
  }

  return rows;
}

function sourceExists(person, kind, url = null) {
  return (person.sources ?? []).some(
    (source) => source.kind === kind && (url === null || source.url === url)
  );
}

function snapshotCoverage(person) {
  return {
    work: Boolean(person.work?.institution),
    undergraduate: Boolean(person.stages?.undergraduate?.school),
    masters: Boolean(person.stages?.masters?.school),
    phdSchool: Boolean(person.stages?.phd?.school),
    phdAdvisor: Boolean(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel),
    phdGraduationYear: person.stages?.phd?.graduationYear != null,
    postdocSchool: Boolean(person.stages?.postdoc?.school),
    postdocAdvisor: Boolean(
      person.stages?.postdoc?.advisorPersonId || person.stages?.postdoc?.advisorLabel
    ),
  };
}

function ratioFromCoverage(coverage) {
  const filled = COVERAGE_FIELDS.filter((field) => coverage[field]).length;
  return filled / COVERAGE_FIELDS.length;
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const otherIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[otherIndex]] = [items[otherIndex], items[index]];
  }
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractPhdSchoolFromText(text) {
  const patterns = [
    /\b(?:earned|received|completed|obtained)\s+(?:his|her|their|a)?\s*ph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)\s+(?:his|her|their|a)?\s*ph\.?d(?:[^.]{0,80})?\s+at\s+([^.;]+)/i,
    /\bholds?\s+(?:his|her|their|a)?\s*ph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,80})?\s+at\s+([^.;]+)/i,
    /\bph\.?d\.?\s+student\s+at\s+([^.;]+?)\s+(?:under\s+(?:the\s+)?supervision|supervised by|advised by)\b/i,
    /\bph\.?d\.?\s+(?:student|candidate)\s+in\s+([^.;]+?)\s+(?:under\s+(?:the\s+)?supervision|supervised by|advised by)\b/i,
    /\bdoctoral\s+(?:student|candidate)\s+(?:in|at)\s+([^.;]+?)\s+(?:under\s+(?:the\s+)?supervision|supervised by|advised by)\b/i,
    /\bcompleted\s+(?:his|her|their|a)?\s*ph\.?d\s+thesis\s+at\s+([^.;]+)/i,
    /\bdoctoral (?:degree|dissertation)(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\bms and ph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1]
        .trim()
        .replace(/,$/, "")
        .replace(
          /\s+in\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19[5-9]\d|20[0-3]\d)\b.*$/i,
          ""
        )
        .replace(
          /,\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19[5-9]\d|20[0-3]\d)\b.*$/i,
          ""
        )
        .trim();
    }
  }
  return null;
}

function extractPhdAdvisorFromText(text) {
  const patterns = [
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?\s+under\s+(?:the\s+)?supervision of\s+[^.;]*?\badvisor,\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?\s+under\s+(?:the\s+)?direction of\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?\s+advised by\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?\s+supervised by\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?\s+advisors?\s+were\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained)(?:[^.]{0,120})?\bph\.?d(?:[^.]{0,120})?,\s+working with\s+([^.;]+)/i,
    /\bph\.?d\.?\s+student\s+at\s+[^.;]+?\s+supervised by\s+([^.;]+)/i,
    /\bph\.?d\.?\s+student\s+at\s+[^.;]+?\s+advised by\s+([^.;]+)/i,
    /\bph\.?d\.?\s+student\s+at\s+[^.;]+?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\bph\.?d\.?\s+(?:student|candidate)\s+in\s+[^.;]+?\s+supervised by\s+([^.;]+)/i,
    /\bph\.?d\.?\s+(?:student|candidate)\s+in\s+[^.;]+?\s+advised by\s+([^.;]+)/i,
    /\bph\.?d\.?\s+(?:student|candidate)\s+in\s+[^.;]+?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\bdoctoral\s+(?:student|candidate)\s+(?:in|at)\s+[^.;]+?\s+supervised by\s+([^.;]+)/i,
    /\bdoctoral\s+(?:student|candidate)\s+(?:in|at)\s+[^.;]+?\s+advised by\s+([^.;]+)/i,
    /\bdoctoral\s+(?:student|candidate)\s+(?:in|at)\s+[^.;]+?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,120})?\s+with advisors?\s+([^.;]+)/i,
    /\bph\.?d\s+thesis(?:[^.]{0,120})?\s+advisors?:\s*([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,120})?\s+advisors?\s+were\s+([^.;]+)/i,
    /\b(?:his|her|their)\s+ph\.?d(?:[^.]{0,120})?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\b(?:his|her|their)\s+ph\.?d(?:[^.]{0,120})?\s+advised by\s+([^.;]+)/i,
  ];
  const candidateSentences = String(text)
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  for (const sentence of candidateSentences) {
    if (!/\bph\.?d\b|doctor(?:ate|al)/i.test(sentence)) {
      continue;
    }
    const clippedSentence = sentence
      .replace(/\b(?:later|afterwards?|subsequently|then)\b.*$/i, "")
      .replace(
        /\b(?:postdoc|postdoctoral|post-doctoral|fellow(?:ship)?|internship|research assistant|postdoctoral scholar|worked as a postdoctoral|held a postdoctoral)\b.*$/i,
        ""
      );
    for (const pattern of patterns) {
      const match = clippedSentence.match(pattern);
      if (match?.[1]) {
        return match[1].trim().replace(/,$/, "");
      }
    }
  }
  return null;
}

function isLikelySelfPhdEvidenceText(text) {
  if (!text) {
    return false;
  }
  return /\b(received|earned|completed|obtained|holds?|graduated|doctoral (?:degree|dissertation)|ph\.?d thesis|dissertation)\b/i.test(
    text
  );
}

function sanitizeDerivedPhdSchool(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim().replace(/,$/, "");
  if (
    !trimmed ||
    /advised by|co-?advised|under the supervision|advisor|supervis|mentor|email:|@/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function sanitizeResolution(resolution) {
  if (!resolution || typeof resolution !== "object") {
    return resolution;
  }

  const sanitizedSchool = resolution.phdSchool ? sanitizeDerivedPhdSchool(resolution.phdSchool) : null;
  const sanitizedAffiliation = resolution.affiliation
    ? normalizeInstitution(resolution.affiliation, resolution.affiliation)
    : null;

  return {
    ...resolution,
    affiliation: sanitizedAffiliation,
    phdSchool: sanitizedSchool ? normalizeInstitution(sanitizedSchool, sanitizedSchool) : null,
    phdAdvisorLabel: resolution.phdAdvisorLabel
      ? sanitizeDerivedAdvisorLabel(resolution.phdAdvisorLabel)
      : null,
  };
}

function dropConflictingHomepagePhdSignals(person, resolution) {
  if (!resolution || typeof resolution !== "object") {
    return resolution;
  }
  if (resolution.phdSource !== "homepage" || !resolution.profileSourceUrl) {
    return resolution;
  }

  const existingSchool = person.stages?.phd?.school
    ? normalizeInstitution(person.stages.phd.school, person.stages.phd.school)
    : null;
  const resolvedSchool = resolution.phdSchool
    ? normalizeInstitution(resolution.phdSchool, resolution.phdSchool)
    : null;

  if (!existingSchool || !resolvedSchool || schoolsLikelyEquivalent(existingSchool, resolvedSchool)) {
    return resolution;
  }

  return {
    ...resolution,
    phdSchool: null,
    phdAdvisorLabel: null,
    phdGraduationYear: null,
    phdSource: null,
    profileSourceUrl: null,
  };
}

function simplifySchoolForComparison(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  return raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[–—-]/g, " ")
    .replace(/^the\s+/i, "")
    .replace(/^(?:department|school|faculty|college|institute|center|centre|programme|program)\s+of\s+.+?\s+at\s+/i, "")
    .replace(/^(?:computer science|electrical and computer engineering|computer engineering|informatics)\s+department\s+at\s+/i, "")
    .replace(/\buniversity of california,\s*berkeley\b/g, "uc berkeley")
    .replace(/\buniversity of california at berkeley\b/g, "uc berkeley")
    .replace(/\bweizmann institute of science\b/g, "weizmann institute")
    .replace(/\bgeorgia institute of technology\b/g, "georgia tech")
    .replace(/\bga tech\b/g, "georgia tech")
    .replace(/\bnorth carolina state university\b/g, "north carolina state")
    .replace(/\buniversity of wisconsin madison\b/g, "university of wisconsin madison")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function schoolsLikelyEquivalent(left, right) {
  const normalizedLeft = left ? normalizeInstitution(left, left) : null;
  const normalizedRight = right ? normalizeInstitution(right, right) : null;
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const simplifiedLeft = simplifySchoolForComparison(normalizedLeft);
  const simplifiedRight = simplifySchoolForComparison(normalizedRight);
  if (!simplifiedLeft || !simplifiedRight) {
    return false;
  }

  return (
    simplifiedLeft === simplifiedRight ||
    simplifiedLeft.includes(simplifiedRight) ||
    simplifiedRight.includes(simplifiedLeft)
  );
}

export function mgpCandidateConflictsWithKnownPhd({
  profileSchool = null,
  profileYear = null,
  searchSchool = null,
  searchYear = null,
  knownSchool = null,
  knownYear = null,
}) {
  const schoolConflicts = [profileSchool, searchSchool].some(
    (school) => Boolean(school) && Boolean(knownSchool) && !schoolsLikelyEquivalent(school, knownSchool)
  );
  const yearConflicts = [profileYear, searchYear].some(
    (year) => year != null && knownYear != null && Math.abs(year - knownYear) > 2
  );
  return schoolConflicts || yearConflicts;
}

function mgpNoteMentionsField(note, field) {
  if (!note || !/^Mathematics Genealogy Project\b/i.test(note)) {
    return false;
  }
  if (field === "school") {
    return /Mathematics Genealogy Project lists .* as the PhD school/i.test(note);
  }
  if (field === "advisor") {
    return /Mathematics Genealogy Project lists advisor\(s\):/i.test(note);
  }
  if (field === "graduationYear") {
    return /Mathematics Genealogy Project lists PhD graduation year/i.test(note);
  }
  return false;
}

function mergeHomepagePhdEvidenceNote(currentNote, noteParts) {
  const prefix = "Homepage or hosted CV lists ";
  const priorParts = String(currentNote ?? "")
    .split(/\.\s*/)
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));
  const mergedParts = [...priorParts];
  for (const part of noteParts) {
    if (!mergedParts.includes(part)) {
      mergedParts.push(part);
    }
  }
  return mergedParts.length > 0 ? `${mergedParts.join(". ")}.` : null;
}

function extractPhdSchoolFromSourceNote(note) {
  const patterns = [
    /^The official (.+?) dissertation PDF states [`"]?Doctor of Philosophy/i,
    /^The official (.+?) dissertation PDF identifies .*Doctor of Philosophy/i,
    /^The official (.+?)-hosted PhD page lists .*PhD supervisor/i,
    /^The official (.+?) thesis page lists .*PhD supervisor/i,
  ];
  for (const pattern of patterns) {
    const match = note.match(pattern);
    if (match?.[1]) {
      return normalizeInstitution(match[1].replace(/-hosted$/i, "").trim(), match[1].trim());
    }
  }
  return null;
}

function derivePhdSignalsFromExistingText(person) {
  const texts = unique([
    person.summary,
    ...(person.sources ?? []).map((source) => source.note),
  ]);

  const schools = [];
  const advisors = [];

  for (const text of texts) {
    if (!isLikelySelfPhdEvidenceText(text)) {
      continue;
    }
    const school = sanitizeDerivedPhdSchool(extractPhdSchoolFromText(text));
    if (school) {
      schools.push(normalizeInstitution(school, school));
    }
    const advisor = sanitizeDerivedAdvisorLabel(extractPhdAdvisorFromText(text));
    if (advisor) {
      advisors.push(advisor);
    }
  }

  for (const source of person.sources ?? []) {
    const school = extractPhdSchoolFromSourceNote(source.note || "");
    if (school) {
      schools.push(school);
    }
  }

  return {
    phdSchool: unique(schools)[0] ?? null,
    phdAdvisorLabel: unique(advisors)[0] ?? null,
  };
}

function summarizeCoverage(rows, snapshots) {
  const fieldCounts = Object.fromEntries(COVERAGE_FIELDS.map((field) => [field, 0]));
  let totalRatio = 0;

  rows.forEach((row) => {
    const coverage = snapshots.get(row.person.id);
    if (!coverage) {
      return;
    }
    COVERAGE_FIELDS.forEach((field) => {
      if (coverage[field]) {
        fieldCounts[field] += 1;
      }
    });
    totalRatio += ratioFromCoverage(coverage);
  });

  return {
    fieldCounts,
    averageCoverage: rows.length === 0 ? 0 : totalRatio / rows.length,
  };
}

function hasMissingCoverageField(person) {
  const coverage = snapshotCoverage(person);
  return COVERAGE_FIELDS.some((field) => !coverage[field]);
}

function hasResolvableCoverageGap(person) {
  return (
    !person.work?.institution ||
    !person.stages?.phd?.school ||
    !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel)
  );
}

function hasPersonEnrichTargetGap(person) {
  return (
    !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel) ||
    person.stages?.phd?.graduationYear == null
  );
}

function applyAnalyzedAt(person, analyzedAt) {
  if (!analyzedAt) {
    return false;
  }
  person.tracking ??= { status: "seed", priority: 0, note: null, analyzedAt: null };
  if (person.tracking.analyzedAt === analyzedAt) {
    return false;
  }
  person.tracking.analyzedAt = analyzedAt;
  return true;
}

function applyResolution(person, resolution) {
  let changed = false;
  let gainedCoreLineage = false;
  let addedPhdSchool = false;
  let addedPhdAdvisor = false;
  let addedPhdGraduationYear = false;
  let replacedPhdSchool = false;
  let replacedPhdAdvisor = false;
  let replacedPhdGraduationYear = false;
  const sources = Array.isArray(person.sources) ? [...person.sources] : [];
  const needsWork = !person.work?.institution;

  if (
    resolution.csrankingsEntry &&
    needsWork &&
    !sourceExists(person, "csrankings-discovery", "https://csrankings.org/")
  ) {
    sources.push(buildCsrankingsSource(resolution.csrankingsEntry));
    changed = true;
  }

  if (
    resolution.orcid &&
    needsWork &&
    resolution.affiliationSource === "orcid" &&
    !sourceExists(person, "orcid", `https://orcid.org/${resolution.orcid}`)
  ) {
    sources.push(buildOrcidSource(resolution.orcid, resolution.affiliation));
    changed = true;
  }

  if (
    resolution.orcid &&
    needsWork &&
    resolution.affiliationSource === "orcid-search" &&
    !sourceExists(person, "orcid", `https://orcid.org/${resolution.orcid}`)
  ) {
    sources.push(buildOrcidSearchSource(resolution.orcid, resolution.affiliation));
    changed = true;
  }

  if (
    resolution.homepageUsed &&
    needsWork &&
    resolution.affiliationSource === "homepage" &&
    !sourceExists(person, "homepage", resolution.homepageUsed)
  ) {
    sources.push(buildHomepageSource(resolution.homepageUsed, resolution.affiliation));
    changed = true;
  }

  if (sources.length > 0) {
    person.sources = sources;
  }

  if (!person.work) {
    person.work = { institution: null, note: null };
  }

  const nextInstitution = needsWork ? (resolution.affiliation ?? person.work.institution ?? null) : person.work.institution;
  const nextNote = !needsWork
    ? person.work.note
    : resolution.affiliationSource === "orcid"
      ? "Current affiliation confirmed from public ORCID employment data discovered during person-enrich."
      : resolution.affiliationSource === "orcid-search"
        ? "Current affiliation inferred conservatively from a unique exact-name ORCID expanded-search institution match."
        : resolution.affiliationSource === "homepage"
          ? "Current affiliation confirmed from a homepage lead discovered during person-enrich."
          : resolution.affiliationSource === "csrankings"
            ? "Current affiliation imported from the exact CSrankings row matched by dblpAuthorId."
            : person.work.note;

  if (person.work.institution !== nextInstitution) {
    person.work.institution = nextInstitution;
    changed = true;
  }

  if (nextNote && person.work.note !== nextNote) {
    person.work.note = nextNote;
    changed = true;
  }

  if (
    resolution.phdSchool ||
    resolution.phdAdvisorLabel ||
    resolution.phdGraduationYear != null
  ) {
    person.stages ??= {};
    person.stages.phd ??= {
      school: null,
      graduationYear: null,
      advisorPersonId: null,
      advisorLabel: null,
      status: null,
      note: null,
    };

    const currentPhdNote = person.stages.phd.note ?? null;
    const canReplaceMgpDerivedPhdFields =
      resolution.phdSource && resolution.phdSource !== "mgp" && /^Mathematics Genealogy Project\b/i.test(currentPhdNote ?? "");

    if (
      canReplaceMgpDerivedPhdFields &&
      mgpNoteMentionsField(currentPhdNote, "school") &&
      resolution.phdSchool &&
      person.stages.phd.school &&
      person.stages.phd.school !== resolution.phdSchool
    ) {
      person.stages.phd.school = resolution.phdSchool;
      changed = true;
      gainedCoreLineage = true;
      replacedPhdSchool = true;
    }

    if (
      canReplaceMgpDerivedPhdFields &&
      mgpNoteMentionsField(currentPhdNote, "graduationYear") &&
      resolution.phdGraduationYear != null &&
      person.stages.phd.graduationYear !== resolution.phdGraduationYear
    ) {
      person.stages.phd.graduationYear = resolution.phdGraduationYear;
      changed = true;
      replacedPhdGraduationYear = true;
    }

    if (
      canReplaceMgpDerivedPhdFields &&
      mgpNoteMentionsField(currentPhdNote, "advisor") &&
      resolution.phdAdvisorLabel &&
      person.stages.phd.advisorLabel &&
      person.stages.phd.advisorLabel !== resolution.phdAdvisorLabel
    ) {
      person.stages.phd.advisorLabel = resolution.phdAdvisorLabel;
      changed = true;
      gainedCoreLineage = true;
      replacedPhdAdvisor = true;
    }

    if (!person.stages.phd.school && resolution.phdSchool) {
      person.stages.phd.school = resolution.phdSchool;
      changed = true;
      gainedCoreLineage = true;
      addedPhdSchool = true;
    }

    if (person.stages.phd.graduationYear == null && resolution.phdGraduationYear != null) {
      person.stages.phd.graduationYear = resolution.phdGraduationYear;
      changed = true;
      addedPhdGraduationYear = true;
    }

    if (!person.stages.phd.advisorLabel && resolution.phdAdvisorLabel) {
      person.stages.phd.advisorLabel = resolution.phdAdvisorLabel;
      changed = true;
      gainedCoreLineage = true;
      addedPhdAdvisor = true;
    }

    if (
      (resolution.phdSchool ||
        resolution.phdAdvisorLabel ||
        resolution.phdGraduationYear != null) &&
      !person.stages.phd.status
    ) {
      person.stages.phd.status = resolution.phdIsOngoing ? "PhD student" : "PhD";
      changed = true;
    }

    if (
      resolution.mgpProfileUrl &&
      (addedPhdSchool ||
        addedPhdAdvisor ||
        addedPhdGraduationYear ||
        replacedPhdSchool ||
        replacedPhdAdvisor ||
        replacedPhdGraduationYear)
    ) {
      const noteParts = [];
      if ((addedPhdSchool || replacedPhdSchool) && resolution.phdSchool) {
        noteParts.push(`Mathematics Genealogy Project lists ${resolution.phdSchool} as the PhD school`);
      }
      if ((addedPhdAdvisor || replacedPhdAdvisor) && resolution.phdAdvisorLabel) {
        noteParts.push(`Mathematics Genealogy Project lists advisor(s): ${resolution.phdAdvisorLabel}`);
      }
      if ((addedPhdGraduationYear || replacedPhdGraduationYear) && resolution.phdGraduationYear != null) {
        noteParts.push(`Mathematics Genealogy Project lists PhD graduation year ${resolution.phdGraduationYear}`);
      }
      const nextPhdNote = `${noteParts.join(". ")}.`;
      if (nextPhdNote && person.stages.phd.note !== nextPhdNote) {
        person.stages.phd.note = nextPhdNote;
        changed = true;
      }
      if (!sourceExists(person, "genealogy", resolution.mgpProfileUrl)) {
        sources.push({
          kind: "genealogy",
          url: resolution.mgpProfileUrl,
          confidence: "high",
          note: "Mathematics Genealogy Project profile used to fill missing PhD lineage fields during person-enrich.",
        });
        person.sources = sources;
        changed = true;
      }
    } else if (
      resolution.profileSourceUrl &&
      (resolution.phdSource === "homepage" ||
        addedPhdSchool ||
        addedPhdAdvisor ||
        addedPhdGraduationYear ||
        replacedPhdSchool ||
        replacedPhdAdvisor ||
        replacedPhdGraduationYear)
    ) {
      const noteParts = [];
      if (resolution.phdSchool) {
        noteParts.push(`Homepage or hosted CV lists ${resolution.phdSchool} as the PhD school`);
      }
      if (resolution.phdGraduationYear != null) {
        noteParts.push(`Homepage or hosted CV lists PhD graduation year ${resolution.phdGraduationYear}`);
      }
      if (resolution.phdAdvisorLabel) {
        noteParts.push(`Homepage or hosted CV lists advisor(s): ${resolution.phdAdvisorLabel}`);
      }
      const nextPhdNote = mergeHomepagePhdEvidenceNote(currentPhdNote, noteParts);
      if (nextPhdNote && person.stages.phd.note !== nextPhdNote) {
        person.stages.phd.note = nextPhdNote;
        changed = true;
      }
      if (!sourceExists(person, "homepage", resolution.profileSourceUrl)) {
        sources.push({
          kind: "homepage",
          url: resolution.profileSourceUrl,
          confidence: "high",
          note: "Homepage or hosted CV used to fill missing PhD lineage fields during person-enrich.",
        });
        person.sources = sources;
        changed = true;
      }
    } else if (
      resolution.phdSource === "orcid" &&
      (addedPhdSchool || addedPhdGraduationYear || replacedPhdSchool || replacedPhdGraduationYear)
    ) {
      const noteParts = [];
      if ((addedPhdSchool || replacedPhdSchool) && resolution.phdSchool) {
        noteParts.push(`Public ORCID education data lists ${resolution.phdSchool} as the PhD school`);
      }
      if ((addedPhdGraduationYear || replacedPhdGraduationYear) && resolution.phdGraduationYear != null) {
        noteParts.push(`Public ORCID education data lists PhD graduation year ${resolution.phdGraduationYear}`);
      }
      const nextPhdNote = noteParts.length > 0 ? `${noteParts.join(". ")}.` : null;
      if (nextPhdNote && person.stages.phd.note !== nextPhdNote) {
        person.stages.phd.note = nextPhdNote;
        changed = true;
      }
      if (!sourceExists(person, "orcid", `https://orcid.org/${resolution.orcid}`)) {
        sources.push({
          kind: "orcid",
          url: `https://orcid.org/${resolution.orcid}`,
          confidence: "medium",
          note: "Public ORCID education data used to fill missing PhD lineage fields during person-enrich.",
        });
        person.sources = sources;
        changed = true;
      }
    }
  }

  if (gainedCoreLineage && person.tracking?.status === "seed") {
    person.tracking.status = "active";
    person.tracking.note =
      "Promoted from ranking seed after person-enrich added core PhD lineage fields.";
    changed = true;
  }

  return changed;
}

async function readCache(cachePath) {
  try {
    const payload = JSON.parse(await readFile(cachePath, "utf8"));
    if (payload?.schemaVersion !== CACHE_SCHEMA_VERSION) {
      return null;
    }
    if (payload?.resolution) {
      payload.resolution = sanitizeResolution(payload.resolution);
    }
    payload.attemptCount = Number.isInteger(payload.attemptCount)
      ? payload.attemptCount
      : 1;
    return payload;
  } catch {
    return null;
  }
}

async function writeCache(cachePath, payload) {
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runWorker())
  );
  return results;
}

async function withAbortableTimeout(task, timeoutMs, fallbackValue = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      task(controller.signal),
      new Promise((resolve) => {
        controller.signal.addEventListener("abort", () => resolve(fallbackValue), {
          once: true,
        });
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
    controller.abort();
  }
}

async function persistChanges(rows, changedIds) {
  const byFile = new Map();
  rows.forEach((row) => {
    if (!byFile.has(row.filePath)) {
      byFile.set(row.filePath, new Map());
    }
    byFile.get(row.filePath).set(row.person.id, row.person);
  });

  await withFileLock("raw-data-write", async () => {
    for (const [filePath, updatedPeople] of byFile.entries()) {
      const hasChanges = Array.from(updatedPeople.keys()).some((personId) =>
        changedIds.has(personId)
      );
      if (!hasChanges) {
        continue;
      }

      const existingPeople = JSON.parse(await readFile(filePath, "utf8"));
      const merged = existingPeople.map((person) => updatedPeople.get(person.id) ?? person);
      normalizePeopleRawSchema(merged);
      merged.sort((left, right) => left.name.localeCompare(right.name));
      await writeFile(filePath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    }
  });
}

async function runCsrankingsTool(person, csrankingsIndex) {
  return resolveCsrankingsEntry(person, csrankingsIndex);
}

async function runOrcidTool(person, csrankingsEntry) {
  const searchedOrcids = !validOrcid(csrankingsEntry?.orcid)
    ? await searchOrcidByName(person.name)
    : [];
  const orcid =
    (validOrcid(csrankingsEntry?.orcid) ? csrankingsEntry.orcid : null) ??
    chooseOrcidByExactName(person.name, searchedOrcids);
  const signals = await fetchOrcidSignals(orcid);
  const currentEmployment = chooseCurrentEmployment(signals.employments);
  const doctoralEducation = chooseDoctoralEducation(signals.educations);
  const expandedSearchInstitution = chooseInstitutionFromExpandedSearch(
    person.name,
    searchedOrcids
  );

  return {
    orcid,
    homepageLeads: signals.homepageLeads,
    currentEmployment,
    doctoralEducation,
    expandedSearchInstitution,
  };
}

async function runHomepageTool(homepageLeads, signal = null) {
  return resolveHomepageAffiliation(homepageLeads, signal);
}

function collectHomepageCandidates(person, csrankingsHomepage, homepageLeads = []) {
  const sourcePriorityKinds = new Set(["homepage", "cv"]);
  const candidates = [
    csrankingsHomepage,
    ...homepageLeads,
    ...(person.sources ?? [])
      .filter((source) => sourcePriorityKinds.has(source.kind))
      .map((source) => source.url),
  ].filter(Boolean);

  return [...new Set(candidates)];
}

async function runMgpTool(person) {
  const profile = await lookupMgpProfileForPerson(person, { force: false });
  const searchMatch = await lookupMgpSearchMatchForPerson(person, { force: false });
  return {
    profile: profile ?? null,
    searchMatch: searchMatch ?? null,
  };
}

async function runMgpToolFromCache(person) {
  const profile = await lookupMgpProfileForPerson(person, {
    force: false,
    cacheOnly: true,
  });
  const searchMatch = await lookupMgpSearchMatchForPerson(person, {
    force: false,
    cacheOnly: true,
  });
  return {
    profile: profile ?? null,
    searchMatch: searchMatch ?? null,
  };
}

async function resolvePerson(person, csrankingsIndex, options = {}) {
  const targetPhdOnly = Boolean(options.targetPhdOnly);
  const csrankingsEntry = await runCsrankingsTool(person, csrankingsIndex);
  const [orcidResult, mgpResult] = await Promise.all([
    runOrcidTool(person, csrankingsEntry),
    runMgpTool(person),
  ]);
  const homepageCandidates = collectHomepageCandidates(
    person,
    csrankingsEntry?.homepage ?? null,
    orcidResult.homepageLeads
  );
  const homepageProfilePromise = withAbortableTimeout(
    (signal) => resolveHomepageProfileSignals(homepageCandidates, person.name, signal),
    HOMEPAGE_PROFILE_TIMEOUT_MS,
    null
  );
  const needsHomepageAffiliation =
    !orcidResult.currentEmployment && !(orcidResult.expandedSearchInstitution && orcidResult.orcid);
  const homepageAffiliationPromise = needsHomepageAffiliation
    ? withAbortableTimeout(
        (signal) => runHomepageTool(homepageCandidates, signal),
        HOMEPAGE_AFFILIATION_TIMEOUT_MS,
        null
      )
    : Promise.resolve(null);
  const homepageProfile = await homepageProfilePromise;
  const homepagePhdSchool = homepageProfile?.phdSchool
    ? normalizeInstitution(homepageProfile.phdSchool, homepageProfile.phdSchool)
    : null;
  const homepagePhdYear =
    homepageProfile?.phdGraduationYear != null ? Number(homepageProfile.phdGraduationYear) : null;
  const existingPhdYear =
    person.stages?.phd?.graduationYear != null ? Number(person.stages.phd.graduationYear) : null;
  const existingPhdSchool = person.stages?.phd?.school
    ? normalizeInstitution(person.stages.phd.school, person.stages.phd.school)
    : null;
  const orcidPhdSchool = orcidResult.doctoralEducation
    ? normalizeInstitution(orcidResult.doctoralEducation.organizationName)
    : null;
  const currentYear = new Date().getUTCFullYear();
  const orcidPhdEndYear = orcidResult.doctoralEducation?.endYear
    ? Number(orcidResult.doctoralEducation.endYear)
    : null;
  const orcidPhdYear =
    orcidPhdEndYear != null && orcidPhdEndYear <= currentYear ? orcidPhdEndYear : null;
  const orcidPhdIsOngoing = orcidPhdEndYear != null && orcidPhdEndYear > currentYear;
  const mgpProfileSchool = mgpResult.profile?.phdSchool
    ? normalizeInstitution(mgpResult.profile.phdSchool, mgpResult.profile.phdSchool)
    : null;
  const mgpSearchSchool = mgpResult.searchMatch?.school
    ? normalizeInstitution(mgpResult.searchMatch.school, mgpResult.searchMatch.school)
    : null;
  const mgpProfileYear = mgpResult.profile?.phdYear ? Number(mgpResult.profile.phdYear) : null;
  const mgpSearchYear = mgpResult.searchMatch?.year ? Number(mgpResult.searchMatch.year) : null;
  const knownNonMgpPhdSchool = homepagePhdSchool ?? orcidPhdSchool ?? existingPhdSchool ?? null;
  const knownNonMgpPhdYear = homepagePhdYear ?? orcidPhdYear ?? existingPhdYear ?? null;
  // Search and profile records describe the same MGP candidate. Reject the whole
  // candidate when either source conflicts with verified PhD evidence.
  const mgpCandidateConflicts = mgpCandidateConflictsWithKnownPhd({
    profileSchool: mgpProfileSchool,
    profileYear: mgpProfileYear,
    searchSchool: mgpSearchSchool,
    searchYear: mgpSearchYear,
    knownSchool: knownNonMgpPhdSchool,
    knownYear: knownNonMgpPhdYear,
  });
  const effectiveMgpProfile = mgpCandidateConflicts ? null : mgpResult.profile;
  const effectiveMgpSearchMatch = mgpCandidateConflicts ? null : mgpResult.searchMatch;
  const nonHomepagePhdSchool =
    effectiveMgpProfile?.phdSchool ??
    (effectiveMgpSearchMatch?.school
      ? normalizeInstitution(effectiveMgpSearchMatch.school, effectiveMgpSearchMatch.school)
      : null) ??
    (orcidResult.doctoralEducation
      ? normalizeInstitution(orcidResult.doctoralEducation.organizationName)
      : null) ??
    existingPhdSchool;
  const homepageProfileConflictsWithKnownSchool =
    Boolean(homepagePhdSchool) &&
    Boolean(nonHomepagePhdSchool) &&
    !schoolsLikelyEquivalent(homepagePhdSchool, nonHomepagePhdSchool);
  const effectiveHomepageProfile = homepageProfileConflictsWithKnownSchool ? null : homepageProfile;

  const resolution = {
    csrankingsEntry: csrankingsEntry ?? null,
    orcid: orcidResult.orcid,
    homepage: csrankingsEntry?.homepage ?? null,
    homepageLeads: orcidResult.homepageLeads,
    homepageProfileChecked: homepageCandidates.length > 0,
    homepageUsed: null,
    affiliation: null,
    affiliationSource: null,
    phdSchool: (
      effectiveMgpProfile?.phdSchool ??
      (effectiveMgpSearchMatch?.school
        ? normalizeInstitution(effectiveMgpSearchMatch.school, effectiveMgpSearchMatch.school)
        : null) ??
      (orcidResult.doctoralEducation
        ? normalizeInstitution(orcidResult.doctoralEducation.organizationName)
        : null)
    ) ?? effectiveHomepageProfile?.phdSchool ?? null,
    phdGraduationYear:
      (effectiveMgpProfile?.phdYear ? Number(effectiveMgpProfile.phdYear) : null) ??
      (effectiveMgpSearchMatch?.year ? Number(effectiveMgpSearchMatch.year) : null) ??
      (orcidResult.doctoralEducation?.endYear
        ? Number(orcidResult.doctoralEducation.endYear)
        : null) ??
      (effectiveHomepageProfile?.phdGraduationYear ?? null),
    phdAdvisorLabel:
      effectiveMgpProfile?.advisors?.length > 0
        ? effectiveMgpProfile.advisors.map((advisor) => advisor.name).join("; ")
        : (effectiveHomepageProfile?.phdAdvisorLabel ?? null),
    phdIsOngoing: !effectiveMgpProfile && !effectiveMgpSearchMatch && !effectiveHomepageProfile && orcidPhdIsOngoing,
    phdSource:
      effectiveMgpProfile?.phdSchool ||
      effectiveMgpProfile?.phdYear ||
      (effectiveMgpProfile?.advisors?.length ?? 0) > 0
        ? "mgp"
        : effectiveHomepageProfile?.phdSchool || effectiveHomepageProfile?.phdAdvisorLabel || effectiveHomepageProfile?.phdGraduationYear != null
          ? "homepage"
          : orcidResult.doctoralEducation
            ? "orcid"
            : null,
    mgpProfileUrl: effectiveMgpProfile?.profileUrl ?? null,
    profileSourceUrl: effectiveHomepageProfile?.homepage ?? null,
  };

  if (targetPhdOnly) {
    return sanitizeResolution(resolution);
  }

  if (orcidResult.currentEmployment) {
    resolution.affiliation = normalizeInstitution(
      orcidResult.currentEmployment.organizationName
    );
    resolution.affiliationSource = "orcid";
    return sanitizeResolution(resolution);
  }

  if (orcidResult.expandedSearchInstitution && resolution.orcid) {
    resolution.affiliation = orcidResult.expandedSearchInstitution;
    resolution.affiliationSource = "orcid-search";
    return sanitizeResolution(resolution);
  }

  const homepageAffiliation = await homepageAffiliationPromise;
  if (homepageAffiliation) {
    resolution.affiliation = homepageAffiliation.affiliation;
    resolution.affiliationSource = "homepage";
    resolution.homepageUsed = homepageAffiliation.homepage;
    return sanitizeResolution(resolution);
  }

  if (csrankingsEntry?.affiliation) {
    resolution.affiliation = normalizeInstitution(csrankingsEntry.affiliation);
    resolution.affiliationSource = "csrankings";
  }

  return dropConflictingHomepagePhdSignals(person, sanitizeResolution(resolution));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCacheDirs();
  await mkdir(cacheDir, { recursive: true });

  let rows = await loadPeopleWithFiles();
  if (!options.all) {
    rows = rows.filter((row) => hasMissingCoverageField(row.person));
  }
  if (options.ids.length > 0) {
    const wanted = new Set(options.ids);
    rows = rows.filter((row) => wanted.has(row.person.id));
  }
  rows.sort((left, right) => left.person.name.localeCompare(right.person.name));
  if (options.random) {
    shuffleInPlace(rows);
  }

  const beforeCoverage = new Map(
    rows.map((row) => [row.person.id, snapshotCoverage(structuredClone(row.person))])
  );

  const csrankingsIndex = await loadCsrankingsIndex();
  const changedIds = new Set();
  let skippedAfterAttempts = 0;
  if (options.requireImprovement) {
    const candidateStates = await mapWithConcurrency(
      rows.filter((row) => hasPersonEnrichTargetGap(row.person)),
      Math.max(1, Math.min(options.concurrency, 24)),
      async (row) => {
        const cached = !options.force
          ? await readCache(path.join(cacheDir, `${row.person.id}.json`))
          : null;
        return { row, attemptCount: cached?.attemptCount ?? 0 };
      }
    );

    skippedAfterAttempts = candidateStates.filter(
      (entry) => entry.attemptCount >= MAX_ENRICH_ATTEMPTS
    ).length;
    rows = candidateStates
      .filter((entry) => entry.attemptCount < MAX_ENRICH_ATTEMPTS)
      .sort((left, right) => {
        const leftMissingAdvisor = !(left.row.person.stages?.phd?.advisorPersonId || left.row.person.stages?.phd?.advisorLabel);
        const rightMissingAdvisor = !(right.row.person.stages?.phd?.advisorPersonId || right.row.person.stages?.phd?.advisorLabel);
        if (leftMissingAdvisor !== rightMissingAdvisor) {
          return rightMissingAdvisor ? 1 : -1;
        }
        if (left.attemptCount !== right.attemptCount) {
          return left.attemptCount - right.attemptCount;
        }

        const leftMissingYear = left.row.person.stages?.phd?.graduationYear == null;
        const rightMissingYear = right.row.person.stages?.phd?.graduationYear == null;
        if (leftMissingYear !== rightMissingYear) {
          return rightMissingYear ? 1 : -1;
        }

        const leftAnalyzedAt = left.row.person.tracking?.analyzedAt ?? null;
        const rightAnalyzedAt = right.row.person.tracking?.analyzedAt ?? null;
        if (leftAnalyzedAt !== rightAnalyzedAt) {
          if (!leftAnalyzedAt) return -1;
          if (!rightAnalyzedAt) return 1;
          return leftAnalyzedAt.localeCompare(rightAnalyzedAt);
        }
        return left.row.person.name.localeCompare(right.row.person.name);
      })
      .map((entry) => entry.row);
  }
  if (options.limit != null) {
    rows = rows.slice(0, options.limit);
  }

  const results = await mapWithConcurrency(rows, options.concurrency, async (row) => {
    const cachePath = path.join(cacheDir, `${row.person.id}.json`);
    let cached = null;
    let analyzedAt = null;
    if (!options.force) {
      cached = await readCache(cachePath);
      analyzedAt = cached?.generatedAt ?? null;
    }

    const previousAttemptCount = cached?.attemptCount ?? 0;
    const refreshTarget =
      options.requireImprovement &&
      previousAttemptCount > 0 &&
      previousAttemptCount < MAX_ENRICH_ATTEMPTS;
    if (refreshTarget) {
      cached = null;
    }

    let resolution = cached?.resolution ?? null;
    let resolvedNow = false;
    if (!resolution) {
      resolution = await resolvePerson(row.person, csrankingsIndex, {
        targetPhdOnly: options.requireImprovement,
      });
      analyzedAt = new Date().toISOString();
      resolvedNow = true;
    }

    if (!cached || options.force) {
      analyzedAt ??= new Date().toISOString();
      await writeCache(cachePath, {
        schemaVersion: CACHE_SCHEMA_VERSION,
        generatedAt: analyzedAt,
        attemptCount: resolvedNow ? previousAttemptCount + 1 : previousAttemptCount,
        id: row.person.id,
        dblpAuthorId: row.person.dblpAuthorId ?? null,
        resolution,
      });
    }

    const changed = applyResolution(row.person, resolution);
    if (changed) {
      applyAnalyzedAt(row.person, analyzedAt);
    }
    normalizePersonRawSchema(row.person);
    if (changed) {
      changedIds.add(row.person.id);
    }

    return {
      id: row.person.id,
      affiliation: resolution.affiliation,
      source: resolution.affiliationSource,
      homepage: resolution.homepage,
      homepageLeads: resolution.homepageLeads,
      orcid: resolution.orcid,
      mgp: Boolean(resolution.mgpProfileUrl),
      cached: Boolean(cached && !options.force),
    };
  });

  await persistChanges(rows, changedIds);

  const afterCoverage = new Map(rows.map((row) => [row.person.id, snapshotCoverage(row.person)]));
  const beforeSummary = summarizeCoverage(rows, beforeCoverage);
  const afterSummary = summarizeCoverage(rows, afterCoverage);
  const deltaFieldCounts = Object.fromEntries(
    COVERAGE_FIELDS.map((field) => [
      field,
      afterSummary.fieldCounts[field] - beforeSummary.fieldCounts[field],
    ])
  );
  const improvedPeople = rows
    .map((row) => {
      const before = beforeCoverage.get(row.person.id);
      const after = afterCoverage.get(row.person.id);
      const deltaFields = COVERAGE_FIELDS.filter((field) => !before[field] && after[field]);
      if (deltaFields.length === 0) {
        return null;
      }
      return {
        id: row.person.id,
        gainedFields: deltaFields,
      };
    })
    .filter(Boolean);

  const summary = {
    total: rows.length,
    changed: changedIds.size,
    resolvedAffiliation: results.filter((entry) => entry.affiliation).length,
    orcid: results.filter((entry) => entry.source === "orcid").length,
    orcidSearch: results.filter((entry) => entry.source === "orcid-search").length,
    homepage: results.filter((entry) => entry.source === "homepage").length,
    csrankings: results.filter((entry) => entry.source === "csrankings").length,
    mgp: results.filter((entry) => entry.mgp).length,
    homepageLeads: results.filter((entry) => (entry.homepageLeads?.length ?? 0) > 0).length,
    unresolved: results.filter((entry) => !entry.affiliation).length,
    cached: results.filter((entry) => entry.cached).length,
    skippedAfterAttempts,
    coverage: {
      before: {
        average: Number(beforeSummary.averageCoverage.toFixed(4)),
        fieldCounts: beforeSummary.fieldCounts,
      },
      after: {
        average: Number(afterSummary.averageCoverage.toFixed(4)),
        fieldCounts: afterSummary.fieldCounts,
      },
      delta: {
        average: Number((afterSummary.averageCoverage - beforeSummary.averageCoverage).toFixed(4)),
        fieldCounts: deltaFieldCounts,
      },
      improvedPeopleCount: improvedPeople.length,
    },
  };

  console.log(
    JSON.stringify(
      { summary, improvedPeople: improvedPeople.slice(0, 50), sample: results.slice(0, 50) },
      null,
      2
    )
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./common/cache-paths.mjs";
import { withFileLock } from "./common/file-lock.mjs";
import { normalizeInstitution } from "./common/institution-normalization.mjs";
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
const CACHE_SCHEMA_VERSION = 12;
const DEFAULT_CONCURRENCY = 12;
const HOMEPAGE_PROFILE_TIMEOUT_MS = 15000;
const HOMEPAGE_AFFILIATION_TIMEOUT_MS = 10000;
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
    probeWindow: 40,
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
    if (arg === "--probe-window") {
      options.probeWindow = Math.max(1, Number(argv[index + 1] ?? options.probeWindow) || options.probeWindow);
      index += 1;
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

function predictedCoverageGains(person, resolution) {
  const gains = [];
  if (!person.work?.institution && resolution.affiliation) {
    gains.push("work");
  }
  if (!person.stages?.phd?.school && resolution.phdSchool) {
    gains.push("phdSchool");
  }
  if (
    !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel) &&
    resolution.phdAdvisorLabel
  ) {
    gains.push("phdAdvisor");
  }
  if (person.stages?.phd?.graduationYear == null && resolution.phdGraduationYear != null) {
    gains.push("phdGraduationYear");
  }
  return gains;
}

function predictedCorePhdLineageGains(person, resolution) {
  const gains = [];
  if (!person.stages?.phd?.school && resolution.phdSchool) {
    gains.push("phdSchool");
  }
  if (
    !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel) &&
    resolution.phdAdvisorLabel
  ) {
    gains.push("phdAdvisor");
  }
  return gains;
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

function sanitizeDerivedAdvisorLabel(value) {
  if (!value) {
    return null;
  }
  const normalized = value
    .trim()
    .replace(/,$/, "")
    .replace(/\b(?:Profs?|Professors?|Drs?)\.?\s+/gi, "")
    .replace(
      /,\s+(?=[A-Z][A-Za-z.'()&-]+(?:\s+(?:[A-Z][A-Za-z.'()&-]+|of|at|the|for|and)){0,8}\s+(?:University|College|Institute|School|Laboratory|Lab|Center|Centre)\b).*$/i,
      ""
    )
    .replace(/\s*,\s+and\s+(?=(?:ten\s+months|six\s+months|a\s+year|two\s+years|completed|followed by|spent|now\b))/i, "")
    .replace(/\s+and\s+(?=(?:ten\s+months|six\s+months|a\s+year|two\s+years|completed|followed by|spent|now\b))/i, "")
    .replace(/[;,]?\s+(?:followed by|and completed|and spent|spent|during|while|where|now\b|as well as)\b.*$/i, "")
    .replace(/\s+in\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const trimmed = normalized
    .replace(/\s+and\s+/g, "; ")
    .replace(/\s*;\s*/g, "; ")
    .trim();

  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(trimmed);
  if (
    !trimmed ||
    (!hasCjk && trimmed.length < 4) ||
    /^(?:prof|professor|dr|profs?)\.?$/i.test(trimmed) ||
    /^(?:by|with|under)\b/i.test(trimmed) ||
    /\b(?:at|from)\s+[A-Z]/.test(trimmed) ||
    /\b(?:advisor|committee|student|students|faculty|postdoc|postdoctoral|visiting researcher|descendants|multiple students)\b/i.test(trimmed) ||
    /\b(19|20)\d{2}\b/.test(trimmed)
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

  if (!existingSchool || !resolvedSchool || existingSchool === resolvedSchool) {
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
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .replace(/^(?:department|school|faculty|college|institute|center|centre|programme|program)\s+of\s+.+?\s+at\s+/i, "")
    .replace(/^(?:computer science|electrical and computer engineering|computer engineering|informatics)\s+department\s+at\s+/i, "")
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

function homepageNoteMentionsField(note, field) {
  if (!note || !/^Homepage or hosted CV lists\b/i.test(note)) {
    return false;
  }
  if (field === "school") {
    return /Homepage or hosted CV lists .* as the PhD school/i.test(note);
  }
  if (field === "advisor") {
    return /Homepage or hosted CV lists advisor\(s\):/i.test(note);
  }
  if (field === "graduationYear") {
    return /Homepage or hosted CV lists PhD graduation year/i.test(note);
  }
  return false;
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

function clearStaleHomepageDerivedPhdFields(person, resolution) {
  const phd = person.stages?.phd;
  if (!phd || !resolution?.homepageProfileChecked) {
    return false;
  }

  let changed = false;
  const note = phd.note ?? null;
  const hasHomepageSchoolNote = homepageNoteMentionsField(note, "school");
  const hasHomepageAdvisorNote = homepageNoteMentionsField(note, "advisor");
  const hasHomepageGraduationYearNote = homepageNoteMentionsField(note, "graduationYear");

  if (hasHomepageSchoolNote && !resolution.phdSchool && phd.school) {
    phd.school = null;
    changed = true;
  }
  if (hasHomepageAdvisorNote && !resolution.phdAdvisorLabel && phd.advisorLabel) {
    phd.advisorLabel = null;
    changed = true;
  }
  if (hasHomepageGraduationYearNote && resolution.phdGraduationYear == null && phd.graduationYear != null) {
    phd.graduationYear = null;
    changed = true;
  }

  if (changed && /^Homepage or hosted CV lists\b/i.test(note ?? "")) {
    const noteParts = [];
    if (hasHomepageSchoolNote && resolution.phdSchool) {
      noteParts.push(`Homepage or hosted CV lists ${resolution.phdSchool} as the PhD school`);
    }
    if (hasHomepageGraduationYearNote && resolution.phdGraduationYear != null) {
      noteParts.push(`Homepage or hosted CV lists PhD graduation year ${resolution.phdGraduationYear}`);
    }
    if (hasHomepageAdvisorNote && resolution.phdAdvisorLabel) {
      noteParts.push(`Homepage or hosted CV lists advisor(s): ${resolution.phdAdvisorLabel}`);
    }
    phd.note = noteParts.length > 0 ? `${noteParts.join(". ")}.` : null;
  }

  return changed;
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

async function probePersonForImprovement(person, csrankingsIndex, options = {}) {
  const needsPhdSchool = !person.stages?.phd?.school;
  const needsPhdAdvisor = !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel);
  const needsPhdGraduationYear = person.stages?.phd?.graduationYear == null;

  const resolution = {
    csrankingsEntry: null,
    orcid: null,
    homepage: null,
    homepageLeads: [],
    homepageUsed: null,
    affiliation: null,
    affiliationSource: null,
    phdSchool: null,
    phdGraduationYear: null,
    phdAdvisorLabel: null,
    phdSource: null,
    mgpProfileUrl: null,
    profileSourceUrl: null,
  };

  const derived = derivePhdSignalsFromExistingText(person);
  if (needsPhdSchool && derived.phdSchool) {
    resolution.phdSchool = derived.phdSchool;
  }
  if (needsPhdAdvisor && derived.phdAdvisorLabel) {
    resolution.phdAdvisorLabel = derived.phdAdvisorLabel;
  }
  let sanitizedResolution = sanitizeResolution(resolution);
  if (predictedCorePhdLineageGains(person, sanitizedResolution).length > 0) {
    return sanitizedResolution;
  }

  let csrankingsEntry = null;
  if (needsPhdSchool || needsPhdAdvisor || needsPhdGraduationYear) {
    csrankingsEntry = await runCsrankingsTool(person, csrankingsIndex);
    resolution.csrankingsEntry = csrankingsEntry ?? null;
    resolution.homepage = csrankingsEntry?.homepage ?? null;
  }

  if (needsPhdSchool || needsPhdAdvisor || needsPhdGraduationYear) {
    const mgpResult = await runMgpToolFromCache(person);
    if (mgpResult.profile) {
      resolution.phdSchool = mgpResult.profile.phdSchool ?? null;
      resolution.phdGraduationYear = mgpResult.profile.phdYear ? Number(mgpResult.profile.phdYear) : null;
      resolution.phdAdvisorLabel =
        mgpResult.profile.advisors?.length > 0
          ? mgpResult.profile.advisors.map((advisor) => advisor.name).join("; ")
          : null;
      if (resolution.phdSchool || resolution.phdGraduationYear != null || resolution.phdAdvisorLabel) {
        resolution.phdSource = "mgp";
      }
      resolution.mgpProfileUrl = mgpResult.profile.profileUrl ?? null;
    }
    if (!resolution.phdSchool && mgpResult.searchMatch?.school) {
      resolution.phdSchool = normalizeInstitution(
        mgpResult.searchMatch.school,
        mgpResult.searchMatch.school
      );
    }
    if (resolution.phdGraduationYear == null && mgpResult.searchMatch?.year) {
      resolution.phdGraduationYear = Number(mgpResult.searchMatch.year);
    }

    sanitizedResolution = sanitizeResolution(resolution);
    if (predictedCorePhdLineageGains(person, sanitizedResolution).length > 0) {
      return sanitizedResolution;
    }

    return sanitizedResolution;
  }

  sanitizedResolution = sanitizeResolution(resolution);

  if (predictedCoverageGains(person, sanitizedResolution).length > 0) {
    return sanitizedResolution;
  }

  return sanitizedResolution;
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

function predictedTargetFieldGains(person, resolution) {
  const gains = [];
  if (
    !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel) &&
    resolution?.phdAdvisorLabel
  ) {
    gains.push("phdAdvisor");
  }
  if (person.stages?.phd?.graduationYear == null && resolution?.phdGraduationYear != null) {
    gains.push("phdGraduationYear");
  }
  return gains;
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
    resolution.orcid &&
    resolution.phdSource === "orcid" &&
    (resolution.phdSchool || resolution.phdGraduationYear != null) &&
    !sourceExists(person, "orcid", `https://orcid.org/${resolution.orcid}`)
  ) {
    sources.push({
      kind: "orcid",
      url: `https://orcid.org/${resolution.orcid}`,
      confidence: "medium",
      note: "Public ORCID education data used to fill missing PhD lineage fields during person-enrich.",
    });
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

  if (
    resolution.profileSourceUrl &&
    (resolution.phdSchool || resolution.phdAdvisorLabel || resolution.phdGraduationYear != null) &&
    !sourceExists(person, "homepage", resolution.profileSourceUrl)
  ) {
    sources.push({
      kind: "homepage",
      url: resolution.profileSourceUrl,
      confidence: "high",
      note: "Homepage or hosted CV used to fill missing PhD lineage fields during person-enrich.",
    });
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

    if (clearStaleHomepageDerivedPhdFields(person, resolution)) {
      changed = true;
    }

    const currentPhdNote = person.stages.phd.note ?? null;
    const canReplaceMgpDerivedPhdFields =
      resolution.phdSource && resolution.phdSource !== "mgp" && /^Mathematics Genealogy Project\b/i.test(currentPhdNote ?? "");
    const canReconcileHomepageDerivedPhdFields =
      resolution.profileSourceUrl && /^Homepage or hosted CV\b/i.test(currentPhdNote ?? "");

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

    if (
      canReconcileHomepageDerivedPhdFields &&
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
      canReconcileHomepageDerivedPhdFields &&
      resolution.phdGraduationYear != null &&
      person.stages.phd.graduationYear !== resolution.phdGraduationYear
    ) {
      person.stages.phd.graduationYear = resolution.phdGraduationYear;
      changed = true;
      replacedPhdGraduationYear = true;
    }

    if (
      canReconcileHomepageDerivedPhdFields &&
      resolution.phdAdvisorLabel &&
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
      person.stages.phd.status = "PhD";
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
      (addedPhdSchool ||
        addedPhdAdvisor ||
        addedPhdGraduationYear ||
        replacedPhdSchool ||
        replacedPhdAdvisor ||
        replacedPhdGraduationYear)
    ) {
      const noteParts = [];
      if ((addedPhdSchool || replacedPhdSchool) && resolution.phdSchool) {
        noteParts.push(`Homepage or hosted CV lists ${resolution.phdSchool} as the PhD school`);
      }
      if ((addedPhdGraduationYear || replacedPhdGraduationYear) && resolution.phdGraduationYear != null) {
        noteParts.push(`Homepage or hosted CV lists PhD graduation year ${resolution.phdGraduationYear}`);
      }
      if ((addedPhdAdvisor || replacedPhdAdvisor) && resolution.phdAdvisorLabel) {
        noteParts.push(`Homepage or hosted CV lists advisor(s): ${resolution.phdAdvisorLabel}`);
      }
      const nextPhdNote = noteParts.length > 0 ? `${noteParts.join(". ")}.` : null;
      if (nextPhdNote && person.stages.phd.note !== nextPhdNote) {
        person.stages.phd.note = nextPhdNote;
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

function scoreAdvisorPotential(person, resolution) {
  const homepageCandidates = collectHomepageCandidates(
    person,
    resolution?.homepage ?? null,
    resolution?.homepageLeads ?? []
  );
  const sourceKinds = new Set((person.sources ?? []).map((source) => source.kind));
  let score = 0;

  if (!(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel)) {
    score += 100;
  }
  if (!person.stages?.phd?.school) {
    score += 10;
  }
  if (resolution?.homepage) {
    score += 40;
  }
  if ((resolution?.homepageLeads?.length ?? 0) > 0) {
    score += 20;
  }
  if (homepageCandidates.length > 0) {
    score += 25;
  }
  if (sourceKinds.has("homepage")) {
    score += 20;
  }
  if (sourceKinds.has("cv")) {
    score += 18;
  }
  if (sourceKinds.has("faculty")) {
    score += 12;
  }
  if (sourceKinds.has("bio")) {
    score += 8;
  }

  return score;
}

function scoreAdvisorEvidenceRichness(person, resolution) {
  const sourceKinds = new Set((person.sources ?? []).map((source) => source.kind));
  let score = 0;

  if (resolution?.homepage) {
    score += 60;
  }
  if ((resolution?.homepageLeads?.length ?? 0) > 0) {
    score += 35;
  }
  if (resolution?.orcid) {
    score += 12;
  }
  if (resolution?.mgpProfileUrl) {
    score += 8;
  }
  if (sourceKinds.has("homepage")) {
    score += 40;
  }
  if (sourceKinds.has("cv")) {
    score += 30;
  }
  if (sourceKinds.has("bio")) {
    score += 16;
  }
  if (sourceKinds.has("faculty")) {
    score += 6;
  }
  if (sourceKinds.has("news")) {
    score += 2;
  }

  return score;
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
  const orcidPhdYear = orcidResult.doctoralEducation?.endYear
    ? Number(orcidResult.doctoralEducation.endYear)
    : null;
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
  const mgpProfileConflictsWithKnownSchool =
    Boolean(mgpProfileSchool) &&
    Boolean(knownNonMgpPhdSchool) &&
    !schoolsLikelyEquivalent(mgpProfileSchool, knownNonMgpPhdSchool);
  const mgpProfileConflictsWithKnownYear =
    mgpProfileYear != null &&
    knownNonMgpPhdYear != null &&
    Math.abs(mgpProfileYear - knownNonMgpPhdYear) > 2;
  const mgpSearchConflictsWithKnownSchool =
    Boolean(mgpSearchSchool) &&
    Boolean(knownNonMgpPhdSchool) &&
    !schoolsLikelyEquivalent(mgpSearchSchool, knownNonMgpPhdSchool);
  const mgpSearchConflictsWithKnownYear =
    mgpSearchYear != null &&
    knownNonMgpPhdYear != null &&
    Math.abs(mgpSearchYear - knownNonMgpPhdYear) > 2;
  const effectiveMgpProfile =
    mgpProfileConflictsWithKnownSchool || mgpProfileConflictsWithKnownYear ? null : mgpResult.profile;
  const effectiveMgpSearchMatch =
    mgpSearchConflictsWithKnownSchool || mgpSearchConflictsWithKnownYear ? null : mgpResult.searchMatch;
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
  const preResolved = new Map();

  if (options.requireImprovement) {
    const candidateRows = rows.filter((row) => hasPersonEnrichTargetGap(row.person));
    const candidateStates = await mapWithConcurrency(
      candidateRows,
      Math.max(1, Math.min(options.concurrency, 12)),
      async (row) => {
        const cachePath = path.join(cacheDir, `${row.person.id}.json`);
        const cached = !options.force ? await readCache(cachePath) : null;
        if (cached?.resolution) {
          preResolved.set(row.person.id, cached.resolution);
        }
        const resolution = cached?.resolution ?? null;
        const targetGains = cached?.resolution
          ? predictedTargetFieldGains(row.person, cached.resolution)
          : [];
        const missingAdvisor = !(row.person.stages?.phd?.advisorPersonId || row.person.stages?.phd?.advisorLabel);
        const missingYear = row.person.stages?.phd?.graduationYear == null;
        const knownNoop = Boolean(cached && targetGains.length === 0);
        return {
          row,
          missingAdvisor,
          missingYear,
          knownNoop,
          evidenceScore: scoreAdvisorEvidenceRichness(row.person, resolution),
          analyzedAt: row.person.tracking?.analyzedAt ?? null,
        };
      }
    );

    rows = candidateStates
      .sort((left, right) => {
        if (left.knownNoop !== right.knownNoop) {
          return left.knownNoop ? 1 : -1;
        }
        if (left.missingAdvisor !== right.missingAdvisor) {
          return right.missingAdvisor ? 1 : -1;
        }
        if (left.evidenceScore !== right.evidenceScore) {
          return right.evidenceScore - left.evidenceScore;
        }
        if (left.missingYear !== right.missingYear) {
          return right.missingYear ? 1 : -1;
        }
        if (left.analyzedAt !== right.analyzedAt) {
          if (!left.analyzedAt) return -1;
          if (!right.analyzedAt) return 1;
          return left.analyzedAt.localeCompare(right.analyzedAt);
        }
        return left.row.person.name.localeCompare(right.row.person.name);
      })
      .map((entry) => entry.row);

    if (options.limit != null) {
      rows = rows.slice(0, options.limit);
    }
  } else if (options.limit != null) {
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

    let resolution = preResolved.get(row.person.id) ?? cached?.resolution ?? null;

    if (!resolution) {
      resolution = await resolvePerson(row.person, csrankingsIndex, {
        targetPhdOnly: options.requireImprovement,
      });
      analyzedAt = new Date().toISOString();
    }

    if (!cached || options.force) {
      analyzedAt ??= new Date().toISOString();
      await writeCache(cachePath, {
        schemaVersion: CACHE_SCHEMA_VERSION,
        generatedAt: analyzedAt,
        id: row.person.id,
        dblpAuthorId: row.person.dblpAuthorId ?? null,
        resolution,
      });
    }

    const changed =
      applyResolution(row.person, resolution) || applyAnalyzedAt(row.person, analyzedAt);
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

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });

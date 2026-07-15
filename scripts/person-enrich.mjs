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
} from "./tools/homepage.mjs";
import { lookupMgpProfileForPerson } from "./tools/mgp.mjs";

const rawDir = path.join(appRoot, "data", "raw");
const cacheDir = path.join(cacheDirs.resolution, "person-enrich");
const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_CONCURRENCY = 12;
const COVERAGE_FIELDS = [
  "work",
  "undergraduate",
  "masters",
  "phdSchool",
  "phdAdvisor",
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
    probeWindow: 100,
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
  return gains;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function extractPhdSchoolFromText(text) {
  const patterns = [
    /\b(?:earned|received|completed|obtained)\s+(?:his|her|their|a)?\s*ph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\bdoctoral (?:degree|dissertation)(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
    /\bms and ph\.?d(?:[^.]{0,80})?\s+from\s+([^.;]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/,$/, "");
    }
  }
  return null;
}

function extractPhdAdvisorFromText(text) {
  const patterns = [
    /\bph\.?d(?:[^.]{0,100})?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,100})?\s+under\s+(?:the\s+)?direction of\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,100})?\s+advised by\s+([^.;]+)/i,
    /\bunder\s+(?:the\s+)?supervision of\s+([^.;]+)(?:[^.]{0,80})?\bph\.?d/i,
    /\badvised by\s+([^.;]+)(?:[^.]{0,80})?\bph\.?d/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/,$/, "");
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
    const school = extractPhdSchoolFromText(text);
    if (school) {
      schools.push(normalizeInstitution(school, school));
    }
    const advisor = extractPhdAdvisorFromText(text);
    if (advisor) {
      advisors.push(advisor);
    }
  }

  return {
    phdSchool: unique(schools)[0] ?? null,
    phdAdvisorLabel: unique(advisors)[0] ?? null,
  };
}

async function probePersonForImprovement(person, csrankingsIndex, options = {}) {
  const needsWork = !person.work?.institution;
  const needsPhdSchool = !person.stages?.phd?.school;
  const needsPhdAdvisor = !(person.stages?.phd?.advisorPersonId || person.stages?.phd?.advisorLabel);

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
    mgpProfileUrl: null,
  };

  const derived = derivePhdSignalsFromExistingText(person);
  if (needsPhdSchool && derived.phdSchool) {
    resolution.phdSchool = derived.phdSchool;
  }
  if (needsPhdAdvisor && derived.phdAdvisorLabel) {
    resolution.phdAdvisorLabel = derived.phdAdvisorLabel;
  }

  if (needsPhdSchool || needsPhdAdvisor) {
    const mgpProfile = await runMgpTool(person);
    if (mgpProfile) {
      resolution.phdSchool = mgpProfile.phdSchool ?? null;
      resolution.phdGraduationYear = mgpProfile.phdYear ? Number(mgpProfile.phdYear) : null;
      resolution.phdAdvisorLabel =
        mgpProfile.advisors?.length > 0
          ? mgpProfile.advisors.map((advisor) => advisor.name).join("; ")
          : null;
      resolution.mgpProfileUrl = mgpProfile.profileUrl ?? null;
    }
  }

  if (predictedCoverageGains(person, resolution).length > 0) {
    return resolution;
  }

  if (needsWork) {
    const csrankingsEntry = await runCsrankingsTool(person, csrankingsIndex);
    const orcidResult = await runOrcidTool(person, csrankingsEntry);
    resolution.csrankingsEntry = csrankingsEntry ?? null;
    resolution.orcid = orcidResult.orcid;
    resolution.homepage = csrankingsEntry?.homepage ?? null;
    resolution.homepageLeads = orcidResult.homepageLeads;

    if (orcidResult.currentEmployment) {
      resolution.affiliation = normalizeInstitution(
        orcidResult.currentEmployment.organizationName
      );
      resolution.affiliationSource = "orcid";
    } else if (orcidResult.expandedSearchInstitution && resolution.orcid) {
      resolution.affiliation = orcidResult.expandedSearchInstitution;
      resolution.affiliationSource = "orcid-search";
    } else if (csrankingsEntry?.affiliation) {
      resolution.affiliation = normalizeInstitution(csrankingsEntry.affiliation);
      resolution.affiliationSource = "csrankings";
    }
  }

  return resolution;
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

function applyResolution(person, resolution) {
  let changed = false;
  let gainedCoreLineage = false;
  const sources = Array.isArray(person.sources) ? [...person.sources] : [];

  if (
    resolution.csrankingsEntry &&
    !sourceExists(person, "csrankings-discovery", "https://csrankings.org/")
  ) {
    sources.push(buildCsrankingsSource(resolution.csrankingsEntry));
    changed = true;
  }

  if (
    resolution.orcid &&
    resolution.affiliationSource === "orcid" &&
    !sourceExists(person, "orcid", `https://orcid.org/${resolution.orcid}`)
  ) {
    sources.push(buildOrcidSource(resolution.orcid, resolution.affiliation));
    changed = true;
  }

  if (
    resolution.orcid &&
    resolution.affiliationSource === "orcid-search" &&
    !sourceExists(person, "orcid", `https://orcid.org/${resolution.orcid}`)
  ) {
    sources.push(buildOrcidSearchSource(resolution.orcid, resolution.affiliation));
    changed = true;
  }

  if (
    resolution.homepageUsed &&
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

  const nextInstitution = resolution.affiliation ?? person.work.institution ?? null;
  const nextNote =
    resolution.affiliationSource === "orcid"
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

  if (resolution.phdSchool || resolution.phdAdvisorLabel) {
    person.stages ??= {};
    person.stages.phd ??= {
      school: null,
      graduationYear: null,
      advisorPersonId: null,
      advisorLabel: null,
      status: null,
      note: null,
    };

    if (!person.stages.phd.school && resolution.phdSchool) {
      person.stages.phd.school = resolution.phdSchool;
      changed = true;
      gainedCoreLineage = true;
    }

    if (person.stages.phd.graduationYear == null && resolution.phdGraduationYear != null) {
      person.stages.phd.graduationYear = resolution.phdGraduationYear;
      changed = true;
      gainedCoreLineage = true;
    }

    if (!person.stages.phd.advisorLabel && resolution.phdAdvisorLabel) {
      person.stages.phd.advisorLabel = resolution.phdAdvisorLabel;
      changed = true;
      gainedCoreLineage = true;
    }

    if ((resolution.phdSchool || resolution.phdAdvisorLabel) && !person.stages.phd.status) {
      person.stages.phd.status = "PhD";
      changed = true;
    }

    if (resolution.mgpProfileUrl) {
      const noteParts = [];
      if (resolution.phdSchool) {
        noteParts.push(`Mathematics Genealogy Project lists ${resolution.phdSchool} as the PhD school`);
      }
      if (resolution.phdAdvisorLabel) {
        noteParts.push(`Mathematics Genealogy Project lists advisor(s): ${resolution.phdAdvisorLabel}`);
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
    return payload?.schemaVersion === CACHE_SCHEMA_VERSION ? payload : null;
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

async function runHomepageTool(homepageLeads) {
  return resolveHomepageAffiliation(homepageLeads);
}

async function runMgpTool(person) {
  const profile = await lookupMgpProfileForPerson(person, { force: false });
  return profile ?? null;
}

async function resolvePerson(person, csrankingsIndex) {
  const csrankingsEntry = await runCsrankingsTool(person, csrankingsIndex);
  const orcidResult = await runOrcidTool(person, csrankingsEntry);
  const mgpProfile = await runMgpTool(person);

  const resolution = {
    csrankingsEntry: csrankingsEntry ?? null,
    orcid: orcidResult.orcid,
    homepage: csrankingsEntry?.homepage ?? null,
    homepageLeads: orcidResult.homepageLeads,
    homepageUsed: null,
    affiliation: null,
    affiliationSource: null,
    phdSchool:
      mgpProfile?.phdSchool ??
      (orcidResult.doctoralEducation
        ? normalizeInstitution(orcidResult.doctoralEducation.organizationName)
        : null),
    phdGraduationYear:
      (mgpProfile?.phdYear ? Number(mgpProfile.phdYear) : null) ??
      (orcidResult.doctoralEducation?.endYear
        ? Number(orcidResult.doctoralEducation.endYear)
        : null),
    phdAdvisorLabel:
      mgpProfile?.advisors?.length > 0
        ? mgpProfile.advisors.map((advisor) => advisor.name).join("; ")
        : null,
    mgpProfileUrl: mgpProfile?.profileUrl ?? null,
  };

  if (orcidResult.currentEmployment) {
    resolution.affiliation = normalizeInstitution(
      orcidResult.currentEmployment.organizationName
    );
    resolution.affiliationSource = "orcid";
    return resolution;
  }

  if (orcidResult.expandedSearchInstitution && resolution.orcid) {
    resolution.affiliation = orcidResult.expandedSearchInstitution;
    resolution.affiliationSource = "orcid-search";
    return resolution;
  }

  const homepageAffiliation = await runHomepageTool([
    resolution.homepage,
    ...resolution.homepageLeads,
  ]);
  if (homepageAffiliation) {
    resolution.affiliation = homepageAffiliation.affiliation;
    resolution.affiliationSource = "homepage";
    resolution.homepageUsed = homepageAffiliation.homepage;
    return resolution;
  }

  if (csrankingsEntry?.affiliation) {
    resolution.affiliation = normalizeInstitution(csrankingsEntry.affiliation);
    resolution.affiliationSource = "csrankings";
  }

  return resolution;
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
    const wanted = options.limit ?? rows.length;
    const selectedRows = [];
    const seenIds = new Set();
    const initialWindow = Math.max(wanted * 5, options.probeWindow);
    let cursor = 0;

    while (cursor < rows.length && selectedRows.length < wanted) {
      const probeRows = rows.slice(cursor, Math.min(rows.length, cursor + initialWindow));
      cursor += probeRows.length;
      const probed = await mapWithConcurrency(probeRows, options.concurrency, async (row) => {
        const cachePath = path.join(cacheDir, `${row.person.id}.json`);
        const cached = !options.force ? await readCache(cachePath) : null;
        const resolution =
          cached?.resolution ?? (await probePersonForImprovement(row.person, csrankingsIndex, options));
        const gains = predictedCoverageGains(row.person, resolution);
        return { row, resolution, gains };
      });

      for (const entry of probed) {
        if (entry.gains.length === 0 || seenIds.has(entry.row.person.id)) {
          continue;
        }
        seenIds.add(entry.row.person.id);
        preResolved.set(entry.row.person.id, entry.resolution);
        selectedRows.push(entry.row);
        if (selectedRows.length >= wanted) {
          break;
        }
      }
    }
    rows = selectedRows;
  } else if (options.limit != null) {
    rows = rows.slice(0, options.limit);
  }

  const results = await mapWithConcurrency(rows, options.concurrency, async (row) => {
    const cachePath = path.join(cacheDir, `${row.person.id}.json`);
    let cached = null;
    if (!options.force) {
      cached = await readCache(cachePath);
    }

    const resolution =
      preResolved.get(row.person.id) ?? cached?.resolution ?? (await resolvePerson(row.person, csrankingsIndex));

    if (!cached || options.force) {
      await writeCache(cachePath, {
        schemaVersion: CACHE_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        id: row.person.id,
        dblpAuthorId: row.person.dblpAuthorId ?? null,
        resolution,
      });
    }

    const changed = applyResolution(row.person, resolution);
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

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

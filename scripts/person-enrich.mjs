import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./common/cache-paths.mjs";
import { withFileLock } from "./common/file-lock.mjs";
import { normalizeInstitution } from "./common/institution-normalization.mjs";
import {
  buildCsrankingsSource,
  loadCsrankingsIndex,
  resolveCsrankingsEntry,
} from "./tools/csrankings.mjs";
import {
  buildOrcidSearchSource,
  buildOrcidSource,
  chooseCurrentEmployment,
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

const rawDir = path.join(appRoot, "data", "raw");
const cacheDir = path.join(cacheDirs.resolution, "person-enrich");
const CACHE_SCHEMA_VERSION = 1;
const DEFAULT_CONCURRENCY = 12;

function parseArgs(argv) {
  const options = {
    limit: null,
    concurrency: DEFAULT_CONCURRENCY,
    force: false,
    ids: [],
    all: false,
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
    }
  }

  return options;
}

async function loadPeopleWithFiles() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const rows = [];

  for (const fileName of files) {
    const filePath = path.join(rawDir, fileName);
    const people = JSON.parse(await readFile(filePath, "utf8"));
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

function applyResolution(person, resolution) {
  let changed = false;
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
  const expandedSearchInstitution = chooseInstitutionFromExpandedSearch(
    person.name,
    searchedOrcids
  );

  return {
    orcid,
    homepageLeads: signals.homepageLeads,
    currentEmployment,
    expandedSearchInstitution,
  };
}

async function runHomepageTool(homepageLeads) {
  return resolveHomepageAffiliation(homepageLeads);
}

async function resolvePerson(person, csrankingsIndex) {
  const csrankingsEntry = await runCsrankingsTool(person, csrankingsIndex);
  const orcidResult = await runOrcidTool(person, csrankingsEntry);

  const resolution = {
    csrankingsEntry: csrankingsEntry ?? null,
    orcid: orcidResult.orcid,
    homepage: csrankingsEntry?.homepage ?? null,
    homepageLeads: orcidResult.homepageLeads,
    homepageUsed: null,
    affiliation: null,
    affiliationSource: null,
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
    rows = rows.filter((row) => !row.person.work?.institution);
  }
  if (options.ids.length > 0) {
    const wanted = new Set(options.ids);
    rows = rows.filter((row) => wanted.has(row.person.id));
  }
  rows.sort((left, right) => left.person.name.localeCompare(right.person.name));
  if (options.limit != null) {
    rows = rows.slice(0, options.limit);
  }

  const csrankingsIndex = await loadCsrankingsIndex();
  const changedIds = new Set();

  const results = await mapWithConcurrency(rows, options.concurrency, async (row) => {
    const cachePath = path.join(cacheDir, `${row.person.id}.json`);
    let cached = null;
    if (!options.force) {
      cached = await readCache(cachePath);
    }

    const resolution =
      cached?.resolution ?? (await resolvePerson(row.person, csrankingsIndex));

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
      cached: Boolean(cached && !options.force),
    };
  });

  await persistChanges(rows, changedIds);

  const summary = {
    total: rows.length,
    changed: changedIds.size,
    resolvedAffiliation: results.filter((entry) => entry.affiliation).length,
    orcid: results.filter((entry) => entry.source === "orcid").length,
    orcidSearch: results.filter((entry) => entry.source === "orcid-search").length,
    homepage: results.filter((entry) => entry.source === "homepage").length,
    csrankings: results.filter((entry) => entry.source === "csrankings").length,
    homepageLeads: results.filter((entry) => (entry.homepageLeads?.length ?? 0) > 0).length,
    unresolved: results.filter((entry) => !entry.affiliation).length,
    cached: results.filter((entry) => entry.cached).length,
  };

  console.log(JSON.stringify({ summary, sample: results.slice(0, 50) }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";
import { normalizeInstitution } from "./institution-normalization.mjs";
import { namesLikelySamePerson } from "./mgp-leads.mjs";
import { fetchAndCacheSnapshot } from "./source-snapshot-utils.mjs";

const rawDir = path.join(appRoot, "data", "raw");
const csrankingsDir = cacheDirs.csrankings;
const resolutionCacheDir = cacheDirs.homepageResolution;

function parseArgs(argv) {
  const options = {
    missingPhdAdvisor: false,
    institution: null,
    limit: null,
    concurrency: 6,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--missing-phd-advisor") {
      options.missingPhdAdvisor = true;
      continue;
    }
    if (arg === "--institution") {
      options.institution = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[i + 1] ?? 0) || null;
      i += 1;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[i + 1] ?? 0) || options.concurrency);
      i += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
    }
  }

  return options;
}

function normalize(value) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNumericSuffix(value) {
  return value.replace(/\s+\d{4}$/, "").trim();
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

async function loadPeople() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const people = [];

  for (const fileName of files) {
    const parsed = JSON.parse(await readFile(path.join(rawDir, fileName), "utf8"));
    for (const person of parsed) {
      people.push(person);
    }
  }

  return people;
}

async function loadCsrankingsEntries() {
  const files = (await readdir(csrankingsDir))
    .filter((name) => /^csrankings-[a-z]\.csv$/.test(name))
    .sort();
  const entries = [];

  for (const fileName of files) {
    const lines = (await readFile(path.join(csrankingsDir, fileName), "utf8")).split(/\r?\n/);
    for (const line of lines.slice(1)) {
      if (!line.trim()) {
        continue;
      }
      const [name, affiliation, homepage, scholarid, orcid] = splitCsvLine(line);
      entries.push({ name, affiliation, homepage, scholarid, orcid, fileName });
    }
  }

  return entries;
}

function scoreEntry(entry, person) {
  let score = 0;
  let matchedIdentity = false;
  let matchedDblp = false;
  let matchedAffiliation = false;
  const entryName = normalize(entry.name);
  const strippedEntryName = normalize(stripNumericSuffix(entry.name));
  const entryAffiliation = normalize(entry.affiliation);
  const personName = normalize(person.name);
  const personAffiliation = normalize(normalizeInstitution(person.work?.institution ?? ""));
  const personDblp = normalize(person.dblpAuthorId);

  if (personDblp) {
    if (entryName === personDblp) {
      score += 160;
      matchedIdentity = true;
      matchedDblp = true;
    } else if (strippedEntryName === personDblp) {
      score += 120;
      matchedIdentity = true;
      matchedDblp = true;
    }
  }

  if (entryName === personName || strippedEntryName === personName) {
    score += 100;
    matchedIdentity = true;
  } else if (namesLikelySamePerson(entry.name, person.name)) {
    score += 50;
    matchedIdentity = true;
  }

  if (!matchedIdentity) {
    return null;
  }

  if (personAffiliation) {
    if (entryAffiliation === personAffiliation) {
      score += 40;
      matchedAffiliation = true;
    } else if (entryAffiliation.includes(personAffiliation) || personAffiliation.includes(entryAffiliation)) {
      score += 20;
      matchedAffiliation = true;
    }
  }

  return { score, matchedDblp, matchedAffiliation };
}

function chooseBestHomepage(entries, person) {
  const ranked = entries
    .map((entry) => {
      const scored = scoreEntry(entry, person);
      return scored ? { ...entry, ...scored } : null;
    })
    .filter(Boolean)
    .filter((entry) => entry.matchedAffiliation || entry.matchedDblp)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  return ranked[0] ?? null;
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker()));
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCacheDirs();

  let people = await loadPeople();
  if (options.missingPhdAdvisor) {
    people = people.filter((person) => !person?.stages?.phd?.advisorLabel);
  }
  if (options.institution) {
    const wanted = normalize(normalizeInstitution(options.institution));
    people = people.filter((person) => normalize(normalizeInstitution(person.work?.institution ?? "")) === wanted);
  }
  people.sort((a, b) => {
    const inst = normalize(normalizeInstitution(a.work?.institution ?? "")).localeCompare(
      normalize(normalizeInstitution(b.work?.institution ?? "")),
    );
    return inst || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
  if (options.limit != null) {
    people = people.slice(0, options.limit);
  }

  const csrankingsEntries = await loadCsrankingsEntries();
  const results = await mapWithConcurrency(people, options.concurrency, async (person) => {
    try {
      const cachePath = path.join(resolutionCacheDir, `${person.id}.json`);
      if (!options.force) {
        try {
          const cached = JSON.parse(await readFile(cachePath, "utf8"));
          return { id: person.id, status: "cached", resolved: cached.resolved, homepage: cached.homepage };
        } catch {}
      }

      const best = chooseBestHomepage(csrankingsEntries, person);
      const payload = {
        id: person.id,
        name: person.name,
        dblpAuthorId: person.dblpAuthorId,
        affiliation: normalizeInstitution(person.work?.institution ?? null),
        resolutionStrategy: "csrankings-first",
        resolved: Boolean(best),
        homepage: best?.homepage ?? null,
        source: best
          ? {
              kind: "csrankings-discovery",
              fileName: best.fileName,
              matchedName: best.name,
              matchedAffiliation: best.affiliation,
              scholarid: best.scholarid,
              orcid: best.orcid,
              score: best.score,
              matchedDblp: best.matchedDblp,
              matchedAffiliationFlag: best.matchedAffiliation,
            }
          : null,
        snapshot: null,
      };

      if (best?.homepage) {
        payload.snapshot = await fetchAndCacheSnapshot(best.homepage, {
          bucket: "homepage-resolution",
          force: options.force,
        });
      }

      await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
      return {
        id: person.id,
        status: "resolved",
        resolved: payload.resolved,
        homepage: payload.homepage,
        cacheHit: payload.snapshot?.cacheHit ?? null,
      };
    } catch (error) {
      return {
        id: person.id,
        status: "error",
        resolved: false,
        homepage: null,
        error: error.message,
      };
    }
  });

  const summary = {
    total: people.length,
    resolved: results.filter((entry) => entry?.resolved).length,
    cached: results.filter((entry) => entry?.status === "cached").length,
    errors: results.filter((entry) => entry?.status === "error").length,
    unresolved: results.filter((entry) => entry && !entry.resolved).length,
  };

  console.log(JSON.stringify({ summary, results: results.slice(0, 100) }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

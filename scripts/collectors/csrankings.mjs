import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs } from "../common/cache-paths.mjs";
import { fetchAndCacheSnapshot } from "../common/source-snapshot-utils.mjs";
import { splitCsvLine } from "../common/text-utils.mjs";

const csrankingsFile = `${cacheDirs.csrankings}/csrankings.csv`;
const dblpAliasesFile = `${cacheDirs.csrankings}/dblp-aliases.csv`;
const DEFAULT_PREFETCH_CONCURRENCY = 16;
const DEFAULT_PREFETCH_TIMEOUT_MS = 12000;

// DBLP labels are identities, not display names. Preserve suffixes and diacritics.
export function dblpIdentityKey(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function parseCsrankingsRows(text) {
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [name, affiliation, homepage, scholarid, orcid] = splitCsvLine(line);
      return { name, affiliation, homepage, scholarid, orcid };
    });
}

function parseDblpAliases(text) {
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [alias, name] = splitCsvLine(line);
      return { alias, name };
    })
    .filter((entry) => entry.alias && entry.name);
}

function addUniqueEntry(index, key, entry) {
  if (!key) return;
  const existing = index.get(key);
  if (existing === undefined) {
    index.set(key, entry);
  } else if (existing !== entry) {
    index.set(key, null);
  }
}

export function buildCsrankingsIndex(rows, aliases = []) {
  const aliasesByIdentity = new Map();
  for (const { alias, name } of aliases) {
    const aliasKey = dblpIdentityKey(alias);
    const nameKey = dblpIdentityKey(name);
    if (aliasKey && nameKey && aliasKey !== nameKey) {
      aliasesByIdentity.set(aliasKey, nameKey);
    }
  }

  function canonicalIdentity(identity) {
    let current = dblpIdentityKey(identity);
    const seen = new Set();
    while (current && aliasesByIdentity.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliasesByIdentity.get(current);
    }
    return current;
  }

  const entriesByIdentity = new Map();
  const entriesByCanonicalIdentity = new Map();
  for (const entry of rows) {
    const identity = dblpIdentityKey(entry.name);
    addUniqueEntry(entriesByIdentity, identity, entry);
    addUniqueEntry(entriesByCanonicalIdentity, canonicalIdentity(identity), entry);
  }

  return {
    rows,
    aliasesByIdentity,
    entriesByIdentity,
    entriesByCanonicalIdentity,
    canonicalIdentity,
  };
}

export async function loadCsrankingsIndex(options = {}) {
  const {
    csrankingsPath = csrankingsFile,
    dblpAliasesPath = dblpAliasesFile,
  } = options;
  const [rowsText, aliasesText] = await Promise.all([
    readFile(csrankingsPath, "utf8"),
    readFile(dblpAliasesPath, "utf8"),
  ]);
  return buildCsrankingsIndex(parseCsrankingsRows(rowsText), parseDblpAliases(aliasesText));
}

export function resolveCsrankingsEntryDetailed(person, csrankingsIndex) {
  const identity = dblpIdentityKey(person?.dblpAuthorId);
  if (!identity) {
    return { entry: null, match: "missing-dblp-identity" };
  }

  const direct = csrankingsIndex.entriesByIdentity.get(identity);
  if (direct) {
    return { entry: direct, match: "exact-dblp-identity" };
  }
  if (direct === null) {
    return { entry: null, match: "ambiguous-dblp-identity" };
  }

  const canonicalIdentity = csrankingsIndex.canonicalIdentity(identity);
  if (canonicalIdentity === identity) {
    return { entry: null, match: "not-in-csrankings" };
  }
  const canonical = csrankingsIndex.entriesByCanonicalIdentity.get(canonicalIdentity);
  if (canonical) {
    return { entry: canonical, match: "dblp-alias" };
  }
  return {
    entry: null,
    match: canonical === null ? "ambiguous-dblp-alias" : "not-in-csrankings",
  };
}

export function resolveCsrankingsEntry(person, csrankingsIndex) {
  return resolveCsrankingsEntryDetailed(person, csrankingsIndex).entry;
}

export function buildCsrankingsSource(entry) {
  return {
    kind: "csrankings-discovery",
    url: "https://csrankings.org/",
    confidence: "medium",
    note: `CSrankings lists current working place ${entry.affiliation}${entry.homepage ? ` and homepage ${entry.homepage}` : ""}.`,
  };
}

async function loadPersonById(personId) {
  const rawDir = path.join(appRoot, "data", "raw");
  const bucket = personId?.[0]?.toLowerCase();
  if (!bucket) return null;

  try {
    const people = JSON.parse(await readFile(path.join(rawDir, `people-${bucket}.json`), "utf8"));
    return people.find((person) => person.id === personId) ?? null;
  } catch {
    return null;
  }
}

async function loadAllPeople() {
  const rawDir = path.join(appRoot, "data", "raw");
  const files = (await readdir(rawDir)).filter((file) => /^people-.*\.json$/.test(file));
  const groups = await Promise.all(files.map((file) => readFile(path.join(rawDir, file), "utf8")));
  return groups.flatMap((text) => JSON.parse(text));
}

function parseArgs(argv) {
  const options = {
    id: null,
    dblpAuthorId: null,
    prefetchHomepages: false,
    concurrency: DEFAULT_PREFETCH_CONCURRENCY,
    timeoutMs: DEFAULT_PREFETCH_TIMEOUT_MS,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--id") {
      options.id = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--dblp-author-id") {
      options.dblpAuthorId = argv[index + 1] ?? null;
      index += 1;
    } else if (arg === "--prefetch-homepages") {
      options.prefetchHomepages = true;
    } else if (arg === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[index + 1]) || DEFAULT_PREFETCH_CONCURRENCY);
      index += 1;
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Math.max(1000, Number(argv[index + 1]) || DEFAULT_PREFETCH_TIMEOUT_MS);
      index += 1;
    } else if (arg === "--limit") {
      options.limit = Math.max(1, Number(argv[index + 1]) || 0) || null;
      index += 1;
    }
  }
  return options;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function prefetchHomepages(index, options) {
  const people = await loadAllPeople();
  const resolved = people.map((person) => ({ person, resolution: resolveCsrankingsEntryDetailed(person, index) }));
  const byHomepage = new Map();
  for (const { resolution } of resolved) {
    if (resolution.entry?.homepage) byHomepage.set(resolution.entry.homepage, resolution.entry);
  }
  const homepages = [...byHomepage.keys()].sort();
  const selected = options.limit ? homepages.slice(0, options.limit) : homepages;
  const outcomes = await mapWithConcurrency(selected, options.concurrency, async (url) => {
    try {
      const snapshot = await fetchAndCacheSnapshot(url, {
        bucket: "profile-homepage",
        timeoutMs: options.timeoutMs,
        allowFallbacks: false,
      });
      return { url, cacheHit: snapshot.cacheHit, failed: false };
    } catch (error) {
      return { url, cacheHit: false, failed: true, error: String(error.message ?? error) };
    }
  });
  const matchCounts = Object.groupBy(resolved, ({ resolution }) => resolution.match);
  const summary = {
    people: people.length,
    exactDblpIdentityMatches: matchCounts["exact-dblp-identity"]?.length ?? 0,
    dblpAliasMatches: matchCounts["dblp-alias"]?.length ?? 0,
    notInCsrankings: matchCounts["not-in-csrankings"]?.length ?? 0,
    ambiguous: (matchCounts["ambiguous-dblp-identity"]?.length ?? 0) + (matchCounts["ambiguous-dblp-alias"]?.length ?? 0),
    missingDblpIdentity: matchCounts["missing-dblp-identity"]?.length ?? 0,
    uniqueHomepageUrls: homepages.length,
    attempted: selected.length,
    cacheHits: outcomes.filter((outcome) => outcome.cacheHit).length,
    fetched: outcomes.filter((outcome) => !outcome.cacheHit && !outcome.failed).length,
    failed: outcomes.filter((outcome) => outcome.failed).length,
  };
  console.log(JSON.stringify({ summary, failures: outcomes.filter((outcome) => outcome.failed).slice(0, 100) }, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const index = await loadCsrankingsIndex();
  if (options.prefetchHomepages) {
    await prefetchHomepages(index, options);
    return;
  }

  let resolution = null;
  if (options.id) {
    const person = await loadPersonById(options.id);
    resolution = person ? resolveCsrankingsEntryDetailed(person, index) : { entry: null, match: "unknown-person" };
  } else if (options.dblpAuthorId) {
    resolution = resolveCsrankingsEntryDetailed({ dblpAuthorId: options.dblpAuthorId }, index);
  } else {
    throw new Error("Usage: node scripts/collectors/csrankings.mjs --id <person-id> | --dblp-author-id <dblp-author-id> | --prefetch-homepages [--concurrency <n>] [--timeout-ms <n>] [--limit <n>]");
  }
  console.log(JSON.stringify(resolution, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

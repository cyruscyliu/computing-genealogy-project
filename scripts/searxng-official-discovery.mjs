import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const cacheDir = cacheDirs.searxng;

const institutionAliases = new Map([
  ["Massachusetts Inst. of Technology", "Massachusetts Institute of Technology"],
  ["Univ. of California - Berkeley", "University of California, Berkeley"],
  ["Univ. of Illinois at Urbana-Champaign", "University of Illinois Urbana-Champaign"],
  ["CISPA Helmholtz Center", "CISPA Helmholtz Center for Information Security"],
]);

function normalizeInstitution(name) {
  return institutionAliases.get(name) ?? name;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv) {
  const options = {
    institution: null,
    domain: null,
    limit: 24,
    concurrency: 6,
    force: false,
    maxAgeHours: 168,
    names: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--institution") {
      options.institution = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--domain") {
      options.domain = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] ?? options.limit);
      index += 1;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = Number(argv[index + 1] ?? options.concurrency);
      index += 1;
      continue;
    }
    if (arg === "--max-age-hours") {
      options.maxAgeHours = Number(argv[index + 1] ?? options.maxAgeHours);
      index += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }

    options.names.push(arg);
  }

  return options;
}

async function loadPeople() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const people = [];

  for (const fileName of files) {
    const parsed = JSON.parse(await readFile(path.join(rawDir, fileName), "utf8"));
    for (const person of parsed) {
      people.push({ ...person, _file: fileName });
    }
  }

  return people;
}

async function loadTargets(options) {
  const people = await loadPeople();

  if (options.names.length > 0) {
    return people.filter((person) => options.names.includes(person.name));
  }

  if (!options.institution) {
    throw new Error("Pass names directly or use --institution.");
  }

  const institution = normalizeInstitution(options.institution);

  return people
    .filter(
      (person) => person.tracking.status === "seed" && normalizeInstitution(person.work.institution) === institution
    )
    .sort(
      (left, right) =>
        left.tracking.priority - right.tracking.priority || left.name.localeCompare(right.name)
    )
    .slice(0, options.limit);
}

function buildQuery(person, domain) {
  const parts = [];
  if (domain) {
    parts.push(`site:${domain}`);
  }
  parts.push(`\"${person.name}\"`);

  if (person.work.institution) {
    parts.push(`\"${normalizeInstitution(person.work.institution)}\"`);
  }

  parts.push("(cv OR bio OR homepage OR profile OR faculty)");

  return parts.join(" ");
}

async function readFreshCache(cachePath, maxAgeHours) {
  try {
    const cacheStat = await stat(cachePath);
    const ageMs = Date.now() - cacheStat.mtimeMs;
    if (ageMs > maxAgeHours * 60 * 60 * 1000) {
      return null;
    }
    return JSON.parse(await readFile(cachePath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchJson(baseUrl, query) {
  const url = new URL("/search", baseUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "computing-genealogy-project/seed-discovery",
    },
  });

  if (!response.ok) {
    throw new Error(`SearXNG request failed with ${response.status} for ${url}`);
  }

  return response.json();
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }

  const concurrency = Math.max(1, Math.min(limit, items.length || 1));
  await Promise.all(Array.from({ length: concurrency }, () => runner()));
  return results;
}

function summarize(person, payload, domain) {
  const results = Array.isArray(payload.results) ? payload.results : [];
  const filtered = domain
    ? results.filter((result) => {
        try {
          return new URL(result.url).hostname.includes(domain);
        } catch {
          return false;
        }
      })
    : results;

  return {
    person: person.name,
    id: person.id,
    query: payload.query,
    hits: filtered.slice(0, 5).map((result) => ({
      title: result.title,
      url: result.url,
    })),
  };
}

async function main() {
  const baseUrl = process.env.SEARXNG_BASE_URL;
  if (!baseUrl) {
    throw new Error("Set SEARXNG_BASE_URL to a running SearXNG instance.");
  }

  const options = parseArgs(process.argv.slice(2));
  const targets = await loadTargets(options);

  await ensureCacheDirs();

  const summaries = await runWithConcurrency(targets, options.concurrency, async (person) => {
    const cachePath = path.join(cacheDir, `${slugify(person.id)}.json`);
    let payload = null;

    if (!options.force) {
      payload = await readFreshCache(cachePath, options.maxAgeHours);
    }

    if (!payload) {
      const query = buildQuery(person, options.domain);
      payload = await fetchJson(baseUrl, query);
      payload.query = query;
      await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    }

    return summarize(person, payload, options.domain);
  });

  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

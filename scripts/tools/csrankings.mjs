import { readFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs } from "../common/cache-paths.mjs";
import { normalize, splitCsvLine } from "../common/text-utils.mjs";

const csrankingsFile = `${cacheDirs.csrankings}/csrankings.csv`;

export async function loadCsrankingsIndex() {
  const lines = (await readFile(csrankingsFile, "utf8")).split(/\r?\n/);
  const rows = lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [name, affiliation, homepage, scholarid, orcid] = splitCsvLine(line);
      return { name, affiliation, homepage, scholarid, orcid };
    });

  return new Map(rows.map((row) => [normalize(row.name), row]));
}

export function resolveCsrankingsEntry(person, csrankingsIndex) {
  return csrankingsIndex.get(normalize(person.dblpAuthorId ?? "")) ?? null;
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
  if (!bucket) {
    return null;
  }

  try {
    const people = JSON.parse(
      await readFile(path.join(rawDir, `people-${bucket}.json`), "utf8")
    );
    return people.find((person) => person.id === personId) ?? null;
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const options = {
    id: null,
    dblpAuthorId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--id") {
      options.id = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--dblp-author-id") {
      options.dblpAuthorId = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const index = await loadCsrankingsIndex();

  let entry = null;
  if (options.id) {
    const person = await loadPersonById(options.id);
    entry = person ? resolveCsrankingsEntry(person, index) : null;
  } else if (options.dblpAuthorId) {
    entry = index.get(normalize(options.dblpAuthorId));
  } else {
    throw new Error("Usage: node scripts/tools/csrankings.mjs --id <person-id> | --dblp-author-id <dblp-author-id>");
  }

  console.log(JSON.stringify({ entry }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

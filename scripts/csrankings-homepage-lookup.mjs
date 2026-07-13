import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const csrankingsDir = path.join(appRoot, ".cache", "csrankings");

function parseArgs(argv) {
  const options = {
    name: null,
    dblp: null,
    affiliation: null,
    limit: 10,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--name") {
      options.name = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--dblp") {
      options.dblp = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--affiliation") {
      options.affiliation = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[i + 1] ?? options.limit);
      i += 1;
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

async function loadEntries() {
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

function score(entry, nameQuery, dblpQuery, affiliationQuery) {
  let total = 0;
  const name = normalize(entry.name);
  const strippedName = normalize(stripNumericSuffix(entry.name));
  const affiliation = normalize(entry.affiliation);

  if (dblpQuery) {
    if (name === dblpQuery) {
      total += 140;
    } else if (strippedName === dblpQuery) {
      total += 90;
    } else {
      return -1;
    }
  }

  if (nameQuery) {
    if (name === nameQuery || strippedName === nameQuery) {
      total += 100;
    } else if (
      name.includes(nameQuery) ||
      nameQuery.includes(name) ||
      strippedName.includes(nameQuery) ||
      nameQuery.includes(strippedName)
    ) {
      total += 60;
    } else {
      return -1;
    }
  }

  if (affiliationQuery) {
    if (affiliation === affiliationQuery) {
      total += 40;
    } else if (affiliation.includes(affiliationQuery) || affiliationQuery.includes(affiliation)) {
      total += 20;
    }
  }

  return total;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.name && !options.dblp && !options.affiliation) {
    throw new Error("Pass --name, --dblp, and/or --affiliation.");
  }

  const nameQuery = normalize(options.name);
  const dblpQuery = normalize(options.dblp);
  const affiliationQuery = normalize(options.affiliation);
  const entries = await loadEntries();

  const matches = entries
    .map((entry) => ({ ...entry, score: score(entry, nameQuery, dblpQuery, affiliationQuery) }))
    .filter((entry) => entry.score >= 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, options.limit);

  console.log(JSON.stringify(matches, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

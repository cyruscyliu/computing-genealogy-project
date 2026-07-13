import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const csrankingsDir = path.join(appRoot, ".cache", "csrankings");
const resolutionCacheDir = path.join(appRoot, ".cache", "homepage-resolution");

function parseArgs(argv) {
  const options = {
    id: null,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--id") {
      options.id = argv[i + 1] ?? null;
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

function normalizeInstitution(name) {
  const aliases = new Map([
    ["Massachusetts Inst. of Technology", "Massachusetts Institute of Technology"],
    ["Univ. of California - Berkeley", "University of California, Berkeley"],
    ["Univ. of Illinois at Urbana-Champaign", "University of Illinois Urbana-Champaign"],
    ["CISPA Helmholtz Center", "CISPA Helmholtz Center for Information Security"],
  ]);
  return aliases.get(name) ?? name;
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
  const personAffiliation = normalize(normalizeInstitution(person.work.institution));
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
  } else if (
    entryName.includes(personName) ||
    personName.includes(entryName) ||
    strippedEntryName.includes(personName) ||
    personName.includes(strippedEntryName)
  ) {
    score += 50;
    matchedIdentity = true;
  }

  if (!matchedIdentity) {
    return -1;
  }

  if (personAffiliation) {
    if (entryAffiliation === normalize(personAffiliation)) {
      score += 40;
      matchedAffiliation = true;
    } else if (
      entryAffiliation.includes(normalize(personAffiliation)) ||
      normalize(personAffiliation).includes(entryAffiliation)
    ) {
      score += 20;
      matchedAffiliation = true;
    }
  }

  return {
    score,
    matchedDblp,
    matchedAffiliation,
  };
}

function chooseBestHomepage(entries, person) {
  const ranked = entries
    .map((entry) => ({ ...entry, ...scoreEntry(entry, person) }))
    .filter((entry) => entry.score >= 0)
    .filter((entry) => entry.matchedAffiliation || entry.matchedDblp)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  return ranked[0] ?? null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.id) {
    throw new Error("Pass --id.");
  }

  const people = await loadPeople();
  const person = people.find((candidate) => candidate.id === options.id);
  if (!person) {
    throw new Error(`No dataset record found for id ${options.id}`);
  }

  await mkdir(resolutionCacheDir, { recursive: true });
  const cachePath = path.join(resolutionCacheDir, `${person.id}.json`);

  if (!options.force) {
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      console.log(JSON.stringify(cached, null, 2));
      return;
    } catch {}
  }

  const csrankingsEntries = await loadCsrankingsEntries();
  const best = chooseBestHomepage(csrankingsEntries, person);

  const payload = {
    id: person.id,
    name: person.name,
    dblpAuthorId: person.dblpAuthorId,
    affiliation: normalizeInstitution(person.work.institution),
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
  };

  await writeFile(cachePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

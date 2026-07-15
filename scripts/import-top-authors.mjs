import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const DEFAULT_SOURCE_URL = "https://nebelwelt.net/pubstats/top-authors-sys_sec.html";

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractRows(html) {
  const rows = [];
  const rowRegex =
    /<td class="name">([^<]+)<\/td>\s*<td class="name">([^<]*)<\/td>/g;
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const dblpAuthorId = decodeHtml(match[1]).trim();
    const workInstitution = decodeHtml(match[2]).trim();
    if (!dblpAuthorId) {
      continue;
    }

    rows.push({
      dblpAuthorId,
      workInstitution: workInstitution || null,
      displayName: displayNameFromDblpAuthorId(dblpAuthorId),
    });
  }

  return dedupeRows(rows);
}

function displayNameFromDblpAuthorId(dblpAuthorId) {
  return dblpAuthorId.replace(/\s+\d{4}$/, "").replace(/\s+\d{3}$/, "");
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&eacute;/g, "é")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&auml;/g, "ä");
}

function dedupeRows(rows) {
  const byId = new Map();
  rows.forEach((row) => {
    if (!byId.has(row.dblpAuthorId)) {
      byId.set(row.dblpAuthorId, row);
    }
  });
  return Array.from(byId.values());
}

function nextPriority(existingPeople) {
  return (
    existingPeople.reduce(
      (highest, person) => Math.max(highest, person.tracking?.priority ?? 0),
      0
    ) + 1
  );
}

function defaultStages() {
  return {
    undergraduate: {
      school: null,
      note: "Pending scan.",
    },
    masters: {
      school: null,
      note: "Pending scan.",
    },
    phd: {
      school: null,
      graduationYear: null,
      advisorPersonId: null,
      advisorLabel: null,
      status: null,
      note: "Pending scan.",
    },
    postdoc: {
      school: null,
      advisorPersonId: null,
      advisorLabel: null,
      status: null,
      note: "Pending scan.",
    },
  };
}

function workNote(row) {
  if (row.workInstitution) {
    return "Imported from the current affiliation shown on the top-authors ranking page.";
  }

  return "The ranking page lists this person but does not provide a current work institution.";
}

function buildSeedPerson(row, priority, sourceUrl) {
  return {
    id: slugify(row.displayName),
    name: row.displayName,
    dblpAuthorId: row.dblpAuthorId,
    aliases: [],
    work: {
      institution: row.workInstitution,
      note: workNote(row),
    },
    tracking: {
      status: "seed",
      priority,
      note: "Imported from the top-authors system security ranking page.",
    },
    source: {
      label: "Top Authors Ranking",
      url: sourceUrl,
    },
    sources: [
      {
        kind: "ranking",
        url: sourceUrl,
        confidence: "medium",
        note: "Ranking page provides a DBLP author id and a current affiliation, but no lineage details.",
      },
    ],
    summary:
      "Imported as a ranking-page seed with DBLP identity and current work institution. Lineage details remain to be scanned from official sources.",
    stages: defaultStages(),
  };
}

async function readPeopleFile(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function writePeopleFile(filePath, people) {
  const sortedPeople = [...people].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  await writeFile(filePath, `${JSON.stringify(sortedPeople, null, 2)}\n`, "utf8");
}

function targetFileForName(name) {
  const firstLetter = slugify(name).charAt(0) || "other";
  const safeLetter = /^[a-z]$/.test(firstLetter) ? firstLetter : "other";
  return path.join(rawDir, `people-${safeLetter}.json`);
}

async function loadExistingPeople() {
  const files = (await readFileList(rawDir)).filter((fileName) =>
    fileName.endsWith(".json")
  );
  const people = [];

  for (const fileName of files) {
    const filePath = path.join(rawDir, fileName);
    const parsed = await readPeopleFile(filePath);
    people.push(...parsed);
  }

  return people;
}

async function readFileList(directoryPath) {
  const { readdir } = await import("node:fs/promises");
  return readdir(directoryPath);
}

async function persistPeopleByLetter(newPeople) {
  const groups = new Map();

  newPeople.forEach((person) => {
    const filePath = targetFileForName(person.name);
    if (!groups.has(filePath)) {
      groups.set(filePath, []);
    }
    groups.get(filePath).push(person);
  });

  for (const [filePath, peopleToAdd] of groups.entries()) {
    const existing = await readPeopleFile(filePath);
    await writePeopleFile(filePath, [...existing, ...peopleToAdd]);
  }
}

async function main() {
  const sourceUrl = process.argv[2] ?? DEFAULT_SOURCE_URL;
  const limitArg = process.argv[3];
  const limit = limitArg === undefined ? null : Number.parseInt(limitArg, 10);

  if (limitArg !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error("Limit must be a positive integer when provided.");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ranking page: ${response.status}`);
  }

  const html = await response.text();
  const allRows = extractRows(html);
  const rows = limit === null ? allRows : allRows.slice(0, limit);
  const existingPeople = await loadExistingPeople();
  const existingIds = new Set(existingPeople.map((person) => person.id));
  const existingDblpIds = new Set(
    existingPeople.map((person) => person.dblpAuthorId).filter(Boolean)
  );

  const candidateRows = [];

  for (const row of rows) {
    const candidateId = slugify(row.displayName);
    if (existingIds.has(candidateId) || existingDblpIds.has(row.dblpAuthorId)) {
      continue;
    }
    candidateRows.push(row);
    existingIds.add(candidateId);
    existingDblpIds.add(row.dblpAuthorId);
  }

  const startingPriority = nextPriority(existingPeople);
  const newPeople = candidateRows.map((row, index) =>
    buildSeedPerson(row, startingPriority + index, sourceUrl)
  );

  await persistPeopleByLetter(newPeople);
  console.log(
    `Imported ${newPeople.length} ranking-page seeds from ${sourceUrl} (scanned ${rows.length} rows out of ${allRows.length}).`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

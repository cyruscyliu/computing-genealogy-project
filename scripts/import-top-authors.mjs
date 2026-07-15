import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const csrankingsFile = path.join(
  appRoot,
  ".cache",
  "datasets",
  "csrankings",
  "csrankings.csv"
);

const DEFAULT_SOURCE_URL = "https://nebelwelt.net/pubstats/top-authors-sys_sec.html";
const FETCH_TIMEOUT_MS = 3000;
const ENRICH_CONCURRENCY = 32;

function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

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

function normalize(value) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripNumericSuffix(value) {
  return value.replace(/\s+\d{4}$/, "").replace(/\s+\d{3}$/, "").trim();
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

function noteForMissingAffiliation(enrichment) {
  if (enrichment.csrankingsAffiliation) {
    return "The ranking page omitted a current affiliation; it was supplemented from CSrankings discovery data.";
  }
  if (enrichment.orcidEducationEntries.length > 0) {
    return "The ranking page omitted a current affiliation and no CSrankings match was found; public ORCID education data was used to seed lineage fields.";
  }
  return "The ranking page lists this person but does not provide a current work institution.";
}

function workNote(row, enrichment, workInstitution) {
  if (row.workInstitution) {
    return "Imported from the current affiliation shown on the top-authors ranking page.";
  }

  if (enrichment.csrankingsAffiliation && workInstitution) {
    return "The ranking page omitted a current affiliation; it was supplemented from CSrankings discovery data.";
  }

  return noteForMissingAffiliation(enrichment);
}

function inferEducationStage(entry, totalCount, index) {
  const text = normalize(
    [entry.roleTitle, entry.departmentName, entry.organizationName].filter(Boolean).join(" ")
  );

  if (
    /(phd|ph\.d|doctor|doctoral|dphil|dr\.|drtechn|dr techn|doctorat)/.test(text)
  ) {
    return "phd";
  }

  if (/(master|m\.s|msc|m\.sc|meng|m\.eng|ma\b|m\.a\b|magister)/.test(text)) {
    return "masters";
  }

  if (
    /(bachelor|b\.s|bsc|b\.sc|be\b|b\.e\b|beng|b\.eng|undergraduate|licen|laurea)/.test(text)
  ) {
    return "undergraduate";
  }

  if (totalCount === 1) {
    return null;
  }

  if (totalCount === 2) {
    return index === 0 ? "undergraduate" : "masters";
  }

  if (totalCount >= 3) {
    if (index === 0) {
      return "undergraduate";
    }
    if (index === totalCount - 1) {
      return "phd";
    }
    return "masters";
  }

  return null;
}

function applyOrcidEducation(stages, educationEntries) {
  if (educationEntries.length === 0) {
    return false;
  }

  const sortedEntries = [...educationEntries].sort((left, right) => {
    const leftYear = Number.parseInt(left.endYear ?? left.startYear ?? "0", 10);
    const rightYear = Number.parseInt(right.endYear ?? right.startYear ?? "0", 10);
    return leftYear - rightYear;
  });

  let applied = false;

  sortedEntries.forEach((entry, index) => {
    const stageKey = inferEducationStage(entry, sortedEntries.length, index);
    if (!stageKey) {
      return;
    }

    if (stageKey === "phd") {
      stages.phd.school = entry.organizationName;
      stages.phd.status = entry.roleTitle || "Education entry from ORCID";
      stages.phd.note = `Public ORCID education data lists ${entry.roleTitle || "a doctoral-stage record"} at ${entry.organizationName}${entry.endYear ? `, ending in ${entry.endYear}` : ""}.`;
      applied = true;
      return;
    }

    stages[stageKey].school = entry.organizationName;
    stages[stageKey].note = `Public ORCID education data lists ${entry.roleTitle || "an education record"} at ${entry.organizationName}${entry.endYear ? `, ending in ${entry.endYear}` : ""}.`;
    applied = true;
  });

  return applied;
}

function summarizeSeed(row, enrichment, stagesApplied) {
  if (enrichment.csrankingsAffiliation && stagesApplied) {
    return "Imported from the top-authors ranking page with current affiliation supplemented from CSrankings and education details supplemented from public ORCID data.";
  }
  if (enrichment.csrankingsAffiliation) {
    return "Imported from the top-authors ranking page with current affiliation supplemented from CSrankings.";
  }
  if (stagesApplied) {
    return "Imported from the top-authors ranking page; public ORCID education data supplemented the seed record.";
  }
  return "Imported as a ranking-page seed with DBLP identity and current work institution. Lineage details remain to be scanned from official sources.";
}

function buildSeedPerson(row, priority, sourceUrl, enrichment) {
  const stages = defaultStages();
  const stagesApplied = applyOrcidEducation(stages, enrichment.orcidEducationEntries);
  const workInstitution = row.workInstitution ?? enrichment.csrankingsAffiliation ?? null;

  const sources = [
    {
      kind: "ranking",
      url: sourceUrl,
      confidence: "medium",
      note: "Ranking page provides a DBLP author id and a current affiliation, but no lineage details.",
    },
  ];

  if (enrichment.csrankingsAffiliation) {
    sources.push({
      kind: "csrankings-discovery",
      url: "https://csrankings.org/",
      confidence: "medium",
      note: `CSrankings lists ${row.displayName} with the affiliation ${enrichment.csrankingsAffiliation}.`,
    });
  }

  if (enrichment.dblpPidUrl) {
    sources.push({
      kind: "dblp-discovery",
      url: enrichment.dblpPidUrl,
      confidence: "medium",
      note: enrichment.orcid
        ? `DBLP person record links ORCID ${enrichment.orcid}.`
        : "DBLP person record was used as a discovery source for supplemental metadata.",
    });
  }

  if (enrichment.orcid && stagesApplied) {
    sources.push({
      kind: "orcid",
      url: `https://orcid.org/${enrichment.orcid}`,
      confidence: "medium",
      note: "Public ORCID record was used to supplement education fields for the seed record.",
    });
  }

  return {
    id: slugify(row.displayName),
    name: row.displayName,
    dblpAuthorId: row.dblpAuthorId,
    aliases: [],
    work: {
      institution: workInstitution,
      note: workNote(row, enrichment, workInstitution),
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
    sources,
    summary: summarizeSeed(row, enrichment, stagesApplied),
    stages,
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

async function loadCsrankingsEntries() {
  try {
    const lines = (await readFile(csrankingsFile, "utf8")).split(/\r?\n/);
    return lines
      .slice(1)
      .filter(Boolean)
      .map((line) => {
        const [name, affiliation, homepage, scholarid, orcid] = splitCsvLine(line);
        return { name, affiliation, homepage, scholarid, orcid };
      });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function chooseBestCsrankingsEntry(row, entries) {
  const personDblp = normalize(row.dblpAuthorId);
  const personName = normalize(row.displayName);

  const ranked = entries
    .map((entry) => {
      const entryName = normalize(entry.name);
      const strippedEntryName = normalize(stripNumericSuffix(entry.name));
      let score = -1;

      if (entryName === personDblp || strippedEntryName === personDblp) {
        score = 100;
      } else if (entryName === personName || strippedEntryName === personName) {
        score = 60;
      }

      return { ...entry, score };
    })
    .filter((entry) => entry.score >= 0 && entry.affiliation)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  return ranked[0] ?? null;
}

async function fetchDblpMetadata(row) {
  const query = row.dblpAuthorId || row.displayName;
  if (!query) {
    return { dblpPidUrl: null, orcid: null };
  }

  try {
    const searchUrl = `https://dblp.org/search/author/api?q=${encodeURIComponent(query)}&format=json`;
    const response = await fetchWithTimeout(searchUrl);
    if (!response.ok) {
      return { dblpPidUrl: null, orcid: null };
    }

    const payload = await response.json();
    let hits = payload?.result?.hits?.hit ?? [];
    if (!Array.isArray(hits)) {
      hits = [hits];
    }

    const matchedHit =
      hits.find((hit) => normalize(hit?.info?.author) === normalize(row.dblpAuthorId)) ??
      hits.find((hit) => normalize(stripNumericSuffix(hit?.info?.author ?? "")) === normalize(row.displayName)) ??
      null;

    if (!matchedHit?.info?.url) {
      return { dblpPidUrl: null, orcid: null };
    }

    const pidUrl = matchedHit.info.url;
    const xmlUrl = pidUrl.replace(/\.html$/, ".xml");
    const xmlResponse = await fetchWithTimeout(xmlUrl);
    if (!xmlResponse.ok) {
      return { dblpPidUrl: pidUrl, orcid: null };
    }

    const xml = await xmlResponse.text();
    const orcidMatch = xml.match(/https:\/\/orcid\.org\/(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])/i);

    return {
      dblpPidUrl: pidUrl,
      orcid: orcidMatch?.[1] ?? null,
    };
  } catch {
    return { dblpPidUrl: null, orcid: null };
  }
}

async function fetchOrcidEducationEntries(orcid) {
  if (!orcid) {
    return [];
  }

  try {
    const response = await fetchWithTimeout(`https://pub.orcid.org/v3.0/${orcid}/record`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return [];
    }

    const payload = await response.json();
    const groups = payload?.["activities-summary"]?.educations?.["affiliation-group"] ?? [];
    const entries = [];

    for (const group of groups) {
      for (const summaryWrapper of group?.summaries ?? []) {
        const summary = summaryWrapper?.["education-summary"];
        if (!summary?.organization?.name) {
          continue;
        }

        entries.push({
          organizationName: summary.organization.name,
          roleTitle: summary["role-title"] ?? null,
          departmentName: summary["department-name"] ?? null,
          startYear: summary["start-date"]?.year?.value ?? null,
          endYear: summary["end-date"]?.year?.value ?? null,
        });
      }
    }

    return entries;
  } catch {
    return [];
  }
}

async function enrichRow(row, csrankingsEntries) {
  const enrichment = {
    csrankingsAffiliation: null,
    dblpPidUrl: null,
    orcid: null,
    orcidEducationEntries: [],
  };

  if (row.workInstitution) {
    return enrichment;
  }

  const csrankingsEntry = chooseBestCsrankingsEntry(row, csrankingsEntries);
  if (csrankingsEntry?.affiliation) {
    enrichment.csrankingsAffiliation = csrankingsEntry.affiliation;
    return enrichment;
  }

  const dblpMetadata = await fetchDblpMetadata(row);
  enrichment.dblpPidUrl = dblpMetadata.dblpPidUrl;
  enrichment.orcid = dblpMetadata.orcid;
  enrichment.orcidEducationEntries = await fetchOrcidEducationEntries(dblpMetadata.orcid);
  return enrichment;
}

async function writePeopleFile(filePath, people) {
  const sortedPeople = [...people].sort((left, right) =>
    left.name.localeCompare(right.name)
  );
  await writeFile(filePath, `${JSON.stringify(sortedPeople, null, 2)}\n`, "utf8");
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

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

function targetFileForName(name) {
  const firstLetter = slugify(name).charAt(0) || "other";
  const safeLetter = /^[a-z]$/.test(firstLetter) ? firstLetter : "other";
  return path.join(rawDir, `people-${safeLetter}.json`);
}

async function main() {
  const sourceUrl = process.argv[2] ?? DEFAULT_SOURCE_URL;
  const limitArg = process.argv[3];
  const limit = limitArg === undefined ? null : Number.parseInt(limitArg, 10);

  if (limitArg !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    throw new Error("Limit must be a positive integer when provided.");
  }

  const response = await fetchWithTimeout(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ranking page: ${response.status}`);
  }

  const html = await response.text();
  const allRows = extractRows(html);
  const rows = limit === null ? allRows : allRows.slice(0, limit);
  const csrankingsEntries = await loadCsrankingsEntries();
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
  const newPeople = await mapWithConcurrency(
    candidateRows,
    ENRICH_CONCURRENCY,
    async (row, index) => {
      const enrichment = await enrichRow(row, csrankingsEntries);
      return buildSeedPerson(row, startingPriority + index, sourceUrl, enrichment);
    }
  );

  await persistPeopleByLetter(newPeople);
  console.log(
    `Imported ${newPeople.length} ranking-page seeds from ${sourceUrl} (scanned ${rows.length} rows out of ${allRows.length}).`
  );
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

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

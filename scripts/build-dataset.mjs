import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const generatedDir = path.join(appRoot, "data", "generated");
const datasetPath = path.join(generatedDir, "lineage-dataset.json");
const datasetScriptPath = path.join(generatedDir, "lineage-dataset.js");
const schemaPath = path.join(generatedDir, "lineage-schema.json");

const lineageSchema = {
  version: 6,
  person: {
    id: "string",
    name: "string",
    dblpAuthorId: "string | null",
    aliases: ["string"],
    work: {
      institution: "string | null",
      note: "string | null",
    },
    tracking: {
      status: '"active" | "seed" | "stub"',
      priority: "number",
      note: "string | null",
    },
    source: {
      label: "string",
      url: "string",
    },
    sources: [
      {
        kind: "string",
        url: "string",
        confidence: '"high" | "medium" | "low"',
        note: "string | null",
      },
    ],
    summary: "string",
    coverage: {
      filled: "number",
      total: "number",
      ratio: "number",
    },
    stages: {
      undergraduate: {
        school: "string | null",
        note: "string | null",
      },
      masters: {
        school: "string | null",
        note: "string | null",
      },
      phd: {
        school: "string | null",
        graduationYear: "number | null",
        advisorPersonId: "string | null",
        advisorLabel: "string | null",
        status: "string | null",
        note: "string | null",
      },
      postdoc: {
        school: "string | null",
        advisorPersonId: "string | null",
        advisorLabel: "string | null",
        status: "string | null",
        note: "string | null",
      },
    },
  },
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isNullableString(value) {
  return value === null || typeof value === "string";
}

function isNullableYear(value) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "number" && Number.isInteger(value) && value >= 1800 && value <= 2100)
  );
}

function validateStage(stageName, stage, expectsAdvisorFields) {
  assert(stage && typeof stage === "object", `${stageName} must be an object`);
  assert(isNullableString(stage.school), `${stageName}.school must be string or null`);
  assert(isNullableString(stage.note), `${stageName}.note must be string or null`);

  if (expectsAdvisorFields) {
    assert(isNullableYear(stage.graduationYear), `${stageName}.graduationYear must be integer year or null`);
    assert(
      isNullableString(stage.advisorPersonId),
      `${stageName}.advisorPersonId must be string or null`
    );
    assert(
      isNullableString(stage.advisorLabel),
      `${stageName}.advisorLabel must be string or null`
    );
    assert(isNullableString(stage.status), `${stageName}.status must be string or null`);
  }
}

function validatePerson(person, seenIds) {
  assert(person && typeof person === "object", "Each person must be an object");
  assert(typeof person.id === "string" && person.id.length > 0, "person.id is required");
  assert(!seenIds.has(person.id), `Duplicate person id: ${person.id}`);
  seenIds.add(person.id);

  assert(typeof person.name === "string" && person.name.length > 0, `${person.id}: name is required`);
  assert(isNullableString(person.dblpAuthorId), `${person.id}: dblpAuthorId must be string or null`);
  assert(Array.isArray(person.aliases), `${person.id}: aliases must be an array`);
  assert(person.work && typeof person.work === "object", `${person.id}: work is required`);
  assert(isNullableString(person.work.institution), `${person.id}: work.institution must be string or null`);
  assert(isNullableString(person.work.note), `${person.id}: work.note must be string or null`);
  assert(person.tracking && typeof person.tracking === "object", `${person.id}: tracking is required`);
  assert(
    ["active", "seed", "stub"].includes(person.tracking.status),
    `${person.id}: tracking.status is invalid`
  );
  assert(
    typeof person.tracking.priority === "number" && Number.isFinite(person.tracking.priority),
    `${person.id}: tracking.priority must be a finite number`
  );
  assert(isNullableString(person.tracking.note), `${person.id}: tracking.note must be string or null`);

  assert(person.source && typeof person.source === "object", `${person.id}: source is required`);
  assert(typeof person.source.label === "string", `${person.id}: source.label must be string`);
  assert(typeof person.source.url === "string", `${person.id}: source.url must be string`);
  assert(Array.isArray(person.sources), `${person.id}: sources must be an array`);
  assert(typeof person.summary === "string", `${person.id}: summary must be string`);
  assert(person.stages && typeof person.stages === "object", `${person.id}: stages is required`);

  validateStage(`${person.id}.stages.undergraduate`, person.stages.undergraduate, false);
  validateStage(`${person.id}.stages.masters`, person.stages.masters, false);
  validateStage(`${person.id}.stages.phd`, person.stages.phd, true);
  validateStage(`${person.id}.stages.postdoc`, person.stages.postdoc, true);
}

function validateReferences(people) {
  const ids = new Set(people.map((person) => person.id));

  for (const person of people) {
    for (const stageName of ["phd", "postdoc"]) {
      const advisorPersonId = person.stages[stageName].advisorPersonId;
      if (advisorPersonId !== null) {
        assert(
          ids.has(advisorPersonId),
          `${person.id}: ${stageName}.advisorPersonId references unknown person ${advisorPersonId}`
        );
      }
    }
  }
}

function hasAdvisor(stage) {
  return Boolean(stage.advisorPersonId || stage.advisorLabel);
}

function computeCoverage(person) {
  const checks = [
    Boolean(person.work.institution),
    Boolean(person.stages.undergraduate.school),
    Boolean(person.stages.masters.school),
    Boolean(person.stages.phd.school),
    hasAdvisor(person.stages.phd),
    Boolean(person.stages.postdoc.school),
    hasAdvisor(person.stages.postdoc),
  ];

  const filled = checks.filter(Boolean).length;
  const total = checks.length;
  return {
    filled,
    total,
    ratio: total === 0 ? 0 : filled / total,
  };
}

function buildStats(people) {
  const trackingCounts = people.reduce(
    (accumulator, person) => {
      accumulator[person.tracking.status] += 1;
      return accumulator;
    },
    { active: 0, seed: 0, stub: 0 }
  );

  const stageCoverage = {
    work: people.filter((person) => person.work.institution).length,
    undergraduate: people.filter((person) => person.stages.undergraduate.school).length,
    masters: people.filter((person) => person.stages.masters.school).length,
    phdSchool: people.filter((person) => person.stages.phd.school).length,
    phdAdvisor: people.filter(
      (person) => person.stages.phd.advisorPersonId || person.stages.phd.advisorLabel
    ).length,
    postdocSchool: people.filter((person) => person.stages.postdoc.school).length,
    postdocAdvisor: people.filter(
      (person) => person.stages.postdoc.advisorPersonId || person.stages.postdoc.advisorLabel
    ).length,
  };

  return {
    peopleCount: people.length,
    trackingCounts,
    stageCoverage,
    averageCoverage:
      people.length === 0
        ? 0
        : people.reduce((sum, person) => sum + (person.coverage?.ratio ?? 0), 0) / people.length,
  };
}

async function main() {
  const rawFiles = await collectJsonFiles(rawDir);
  assert(rawFiles.length > 0, "No raw JSON files found");

  const raw = [];
  for (const filePath of rawFiles) {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    assert(Array.isArray(parsed), `${path.relative(appRoot, filePath)} must be an array`);
    raw.push(...parsed);
  }

  const seenIds = new Set();
  raw.forEach((person) => validatePerson(person, seenIds));
  validateReferences(raw);

  const people = raw.map((person) => ({
    ...person,
    coverage: computeCoverage(person),
  })).sort(
    (left, right) =>
      left.tracking.priority - right.tracking.priority || left.name.localeCompare(right.name)
  );

  const payload = {
    schemaVersion: lineageSchema.version,
    generatedAt: new Date().toISOString(),
    stats: buildStats(people),
    people,
  };

  await mkdir(generatedDir, { recursive: true });
  await writeFile(datasetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(
    datasetScriptPath,
    `window.__LINEAGE_DATASET__ = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8"
  );
  await writeFile(schemaPath, `${JSON.stringify(lineageSchema, null, 2)}\n`, "utf8");

  console.log(
    `Built dataset with ${payload.stats.peopleCount} people from ${rawFiles.length} raw files into ${path.relative(appRoot, datasetPath)}`
  );
}

async function collectJsonFiles(directoryPath) {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertValidProfileSchema,
  PROFILE_SCHEMA_ID,
  PROFILE_SCHEMA_VERSION,
} from "./common/profile-schema.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const generatedDir = path.join(appRoot, "data", "generated");
const datasetPath = path.join(generatedDir, "lineage-dataset.json");
const datasetScriptPath = path.join(generatedDir, "lineage-dataset.js");
const schemaPath = path.join(generatedDir, "lineage-schema.json");
const siteBuildMetaScriptPath = path.join(generatedDir, "site-build-meta.js");

const lineageSchema = {
  version: 8,
  rawProfileSchema: {
    id: PROFILE_SCHEMA_ID,
    version: PROFILE_SCHEMA_VERSION,
  },
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
      analyzedAt: "string | null",
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
        advisorPersonId: "string | null | omitted",
        advisorLabel: "string | null | omitted",
        status: "string | null | omitted",
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

function validatePerson(person, seenIds) {
  assertValidProfileSchema(person);
  assert(typeof person.id === "string" && person.id.length > 0, "person.id is required");
  assert(!seenIds.has(person.id), `Duplicate person id: ${person.id}`);
  seenIds.add(person.id);
}

function validateReferences(people) {
  const ids = new Set(people.map((person) => person.id));

  for (const person of people) {
    for (const stageName of ["masters", "phd", "postdoc"]) {
      const advisorPersonId = person.stages[stageName].advisorPersonId;
      if (typeof advisorPersonId === "string" && advisorPersonId.length > 0) {
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
    person.stages.phd.graduationYear != null,
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
    phdGraduationYear: people.filter((person) => person.stages.phd.graduationYear != null).length,
    postdocSchool: people.filter((person) => person.stages.postdoc.school).length,
    postdocAdvisor: people.filter(
      (person) => person.stages.postdoc.advisorPersonId || person.stages.postdoc.advisorLabel
    ).length,
  };

  const analyzedAtValues = people
    .map((person) => person.tracking?.analyzedAt)
    .filter((value) => typeof value === "string" && value.length > 0)
    .sort();

  return {
    peopleCount: people.length,
    trackingCounts,
    stageCoverage,
    analysisCoverage: {
      analyzed: analyzedAtValues.length,
      unanalyzed: people.length - analyzedAtValues.length,
      oldestAnalyzedAt: analyzedAtValues[0] ?? null,
      newestAnalyzedAt: analyzedAtValues.at(-1) ?? null,
    },
    averageCoverage:
      people.length === 0
        ? 0
        : people.reduce((sum, person) => sum + (person.coverage?.ratio ?? 0), 0) / people.length,
  };
}

function getSiteBuildMeta() {
  try {
    const lastCommitDate = execFileSync("git", ["log", "-1", "--date=short", "--format=%cd"], {
      cwd: appRoot,
      encoding: "utf8",
    }).trim();
    const lastCommitHash = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: appRoot,
      encoding: "utf8",
    }).trim();

    return {
      lastCommitDate: lastCommitDate || null,
      lastCommitHash: lastCommitHash || null,
    };
  } catch {
    return {
      lastCommitDate: null,
      lastCommitHash: null,
    };
  }
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
  const siteBuildMeta = getSiteBuildMeta();

  await mkdir(generatedDir, { recursive: true });
  await writeFile(datasetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(
    datasetScriptPath,
    `window.__LINEAGE_DATASET__ = ${JSON.stringify(payload, null, 2)};\n`,
    "utf8"
  );
  await writeFile(schemaPath, `${JSON.stringify(lineageSchema, null, 2)}\n`, "utf8");
  await writeFile(
    siteBuildMetaScriptPath,
    `window.__LINEAGE_BUILD_META__ = ${JSON.stringify(siteBuildMeta, null, 2)};\n`,
    "utf8"
  );

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

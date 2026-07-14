import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";
import { normalizeInstitution } from "./institution-normalization.mjs";

const rawDir = path.join(appRoot, "data", "raw");
const mgpActiveDir = path.join(cacheDirs.discovery, "mgp-active");
const defaultJsonlPath = path.join(cacheDirs.discovery, "mgp-enrich-candidates.jsonl");
const defaultSummaryPath = path.join(cacheDirs.discovery, "mgp-enrich-summary.json");

function parseArgs(argv) {
  const options = {
    ids: [],
    onlyActionable: true,
    limit: null,
    jsonlPath: defaultJsonlPath,
    summaryPath: defaultSummaryPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--id") {
      options.ids.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] ?? 0) || null;
      index += 1;
      continue;
    }
    if (arg === "--all") {
      options.onlyActionable = false;
      continue;
    }
    if (arg === "--jsonl") {
      options.jsonlPath = argv[index + 1] ?? options.jsonlPath;
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      options.summaryPath = argv[index + 1] ?? options.summaryPath;
      index += 1;
    }
  }

  return options;
}

async function loadPeople() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const people = new Map();

  for (const fileName of files) {
    const parsed = JSON.parse(await readFile(path.join(rawDir, fileName), "utf8"));
    for (const person of parsed) {
      people.set(person.id, { ...person, _file: fileName });
    }
  }

  return people;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function currentStageSnapshot(person) {
  return {
    undergraduate: person.stages?.undergraduate?.school ?? null,
    masters: person.stages?.masters?.school ?? null,
    phdSchool: person.stages?.phd?.school ?? null,
    phdAdvisor: person.stages?.phd?.advisorLabel ?? null,
    postdocSchool: person.stages?.postdoc?.school ?? null,
    postdocAdvisor: person.stages?.postdoc?.advisorLabel ?? null,
  };
}

function buildCandidate(record, person) {
  const profile = record.payload?.profile ?? null;
  const advisors = profile?.advisors?.map((entry) => entry.name).filter(Boolean) ?? [];
  const students = profile?.students?.map((entry) => entry.name).filter(Boolean) ?? [];
  const current = currentStageSnapshot(person);

  const normalizedPhdSchool = profile?.phdSchool ? normalizeInstitution(profile.phdSchool, profile.phdSchool) : null;
  const advisorLabel = advisors.length > 0 ? advisors.join("; ") : null;

  const suggestions = [];
  if (!current.phdSchool && normalizedPhdSchool) {
    suggestions.push({
      field: "stages.phd.school",
      value: normalizedPhdSchool,
      source: profile.profileUrl,
      rationale: "MGP lists a PhD school while the dataset currently has no PhD school.",
    });
  }
  if (!current.phdAdvisor && advisorLabel) {
    suggestions.push({
      field: "stages.phd.advisorLabel",
      value: advisorLabel,
      source: profile.profileUrl,
      rationale: "MGP lists named PhD advisors while the dataset currently has no PhD advisor label.",
    });
  }
  if ((record.summary?.advisorMatches?.length ?? 0) > 0) {
    suggestions.push({
      field: "crosscheck.advisors",
      value: record.summary.advisorMatches,
      source: profile?.profileUrl ?? null,
      rationale: "MGP advisor names already match modeled people in the local dataset.",
    });
  }
  if ((record.summary?.studentMatches?.length ?? 0) > 0) {
    suggestions.push({
      field: "crosscheck.students",
      value: record.summary.studentMatches,
      source: profile?.profileUrl ?? null,
      rationale: "MGP student names already match modeled people in the local dataset.",
    });
  }

  return {
    id: person.id,
    name: person.name,
    trackingStatus: person.tracking?.status ?? null,
    workInstitution: person.work?.institution ?? null,
    file: person._file,
    mgp: {
      mgpId: profile?.mgpId ?? null,
      name: profile?.name ?? null,
      phdSchool: profile?.phdSchool ?? null,
      normalizedPhdSchool,
      phdYear: profile?.phdYear ?? null,
      thesisTitle: profile?.thesisTitle ?? null,
      advisors,
      students,
      profileUrl: profile?.profileUrl ?? null,
    },
    current,
    suggestions,
    actionable: suggestions.length > 0,
  };
}

async function loadMgpRecords() {
  const fileNames = (await readdir(mgpActiveDir)).filter((name) => name.endsWith(".json")).sort();
  const records = [];

  for (const fileName of fileNames) {
    const parsed = JSON.parse(await readFile(path.join(mgpActiveDir, fileName), "utf8"));
    records.push(parsed);
  }

  return records;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCacheDirs();
  await mkdir(path.dirname(options.jsonlPath), { recursive: true });
  await mkdir(path.dirname(options.summaryPath), { recursive: true });

  const people = await loadPeople();
  const mgpRecords = await loadMgpRecords();
  const wanted = options.ids.length > 0 ? new Set(options.ids) : null;

  let candidates = mgpRecords
    .filter((record) => people.has(record.id))
    .filter((record) => !wanted || wanted.has(record.id))
    .map((record) => buildCandidate(record, people.get(record.id)));

  if (options.onlyActionable) {
    candidates = candidates.filter((entry) => entry.actionable);
  }
  if (options.limit != null) {
    candidates = candidates.slice(0, options.limit);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceDir: mgpActiveDir,
    totalCachedRecords: mgpRecords.length,
    totalCandidates: candidates.length,
    actionableCandidates: candidates.filter((entry) => entry.actionable).length,
    bySuggestionField: candidates.reduce((acc, entry) => {
      for (const suggestion of entry.suggestions) {
        acc[suggestion.field] = (acc[suggestion.field] ?? 0) + 1;
      }
      return acc;
    }, {}),
  };

  await writeFile(
    options.jsonlPath,
    `${candidates.map((entry) => JSON.stringify(entry)).join("\n")}${candidates.length > 0 ? "\n" : ""}`,
    "utf8",
  );
  await writeFile(options.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(summary, null, 2));
  if (candidates.length > 0) {
    console.log(`Wrote candidates to ${options.jsonlPath}`);
    console.log(`Wrote summary to ${options.summaryPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

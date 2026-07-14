import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureCacheDirs } from "./cache-paths.mjs";
import { normalizeInstitution } from "./institution-normalization.mjs";
import { withFileLock } from "./file-lock.mjs";
import {
  rawDir,
  loadPeopleMap,
  mgpActiveDir,
  mgpEnrichCandidatesPath as defaultJsonlPath,
  mgpEnrichSummaryPath as defaultSummaryPath,
} from "./mgp-common.mjs";

function parseArgs(argv) {
  const options = {
    ids: [],
    onlyActionable: true,
    limit: null,
    apply: false,
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
    if (arg === "--apply") {
      options.apply = true;
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

async function loadRawFiles() {
  const fileNames = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const files = new Map();

  for (const fileName of fileNames) {
    const filePath = path.join(rawDir, fileName);
    files.set(fileName, {
      path: filePath,
      people: JSON.parse(await readFile(filePath, "utf8")),
    });
  }

  return files;
}

function ensureMgpSource(person, candidate) {
  person.sources ??= [];
  const sourceUrl = candidate.mgp.profileUrl;
  if (!sourceUrl) {
    return;
  }

  const existing = person.sources.find((entry) => entry.url === sourceUrl);
  if (existing) {
    return;
  }

  person.sources.push({
    kind: "genealogy",
    url: sourceUrl,
    confidence: "high",
    note: "Mathematics Genealogy Project cached profile used to populate missing PhD lineage fields in batch apply mode.",
  });
}

function applyCandidateToPerson(person, candidate) {
  let changed = false;
  person.stages ??= {};
  person.stages.phd ??= {
    school: null,
    advisorPersonId: null,
    advisorLabel: null,
    status: null,
    note: null,
  };

  const phdStage = person.stages.phd;

  if (!phdStage.school && candidate.mgp.normalizedPhdSchool) {
    phdStage.school = candidate.mgp.normalizedPhdSchool;
    phdStage.note = `Mathematics Genealogy Project lists ${candidate.mgp.normalizedPhdSchool} as the PhD school${candidate.mgp.phdYear ? ` (${candidate.mgp.phdYear})` : ""}.`;
    changed = true;
  }

  if (!phdStage.advisorLabel && candidate.mgp.advisors.length > 0) {
    phdStage.advisorLabel = candidate.mgp.advisors.join("; ");
    phdStage.note = phdStage.note
      ? `${phdStage.note} Mathematics Genealogy Project also lists advisor(s): ${phdStage.advisorLabel}.`
      : `Mathematics Genealogy Project lists advisor(s): ${phdStage.advisorLabel}.`;
    changed = true;
  }

  if (changed) {
    if (!phdStage.status) {
      phdStage.status = "PhD";
    }
    ensureMgpSource(person, candidate);
    if (person.tracking?.status === "seed") {
      person.tracking.status = "active";
      person.tracking.note = "MGP batch apply filled missing PhD lineage fields from cached Mathematics Genealogy Project results.";
    }
  }

  return changed;
}

async function applyCandidates(candidates) {
  const rawFiles = await loadRawFiles();
  const changedPeople = [];
  const changedFiles = new Set();

  for (const candidate of candidates) {
    if (!candidate.actionable) {
      continue;
    }
    const file = rawFiles.get(candidate.file);
    if (!file) {
      continue;
    }
    const person = file.people.find((entry) => entry.id === candidate.id);
    if (!person) {
      continue;
    }

    if (applyCandidateToPerson(person, candidate)) {
      changedPeople.push({ id: candidate.id, name: candidate.name, file: candidate.file });
      changedFiles.add(candidate.file);
    }
  }

  await withFileLock("data-raw-writer", async () => {
    for (const fileName of changedFiles) {
      const file = rawFiles.get(fileName);
      await writeFile(file.path, `${JSON.stringify(file.people, null, 2)}\n`, "utf8");
    }
  });

  return { changedPeople, changedFiles: [...changedFiles] };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCacheDirs();
  await mkdir(path.dirname(options.jsonlPath), { recursive: true });
  await mkdir(path.dirname(options.summaryPath), { recursive: true });

  const people = await loadPeopleMap();
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

  if (options.apply) {
    const applied = await applyCandidates(candidates);
    console.log(JSON.stringify({
      appliedCount: applied.changedPeople.length,
      changedFiles: applied.changedFiles,
      changedPeople: applied.changedPeople.slice(0, 50),
    }, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

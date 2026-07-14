import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";
import { buildPayload } from "./mgp-leads.mjs";

const rawDir = path.join(appRoot, "data", "raw");
const batchCacheDir = path.join(cacheDirs.discovery, "mgp-active");
const batchJsonlPath = path.join(cacheDirs.discovery, "mgp-active-crosscheck.jsonl");
const batchStatePath = path.join(cacheDirs.discovery, "mgp-active-state.json");

function parseArgs(argv) {
  const options = {
    limit: 25,
    offset: 0,
    delayMs: 1500,
    resume: false,
    force: false,
    status: "active",
    ids: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] ?? options.limit);
      index += 1;
      continue;
    }
    if (arg === "--offset") {
      options.offset = Number(argv[index + 1] ?? options.offset);
      index += 1;
      continue;
    }
    if (arg === "--delay-ms") {
      options.delayMs = Number(argv[index + 1] ?? options.delayMs);
      index += 1;
      continue;
    }
    if (arg === "--status") {
      options.status = argv[index + 1] ?? options.status;
      index += 1;
      continue;
    }
    if (arg === "--id") {
      options.ids.push(argv[index + 1] ?? "");
      index += 1;
      continue;
    }
    if (arg === "--resume") {
      options.resume = true;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
    }
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarize(payload) {
  return {
    query: payload.query,
    selectedMgpId: payload.profile?.mgpId ?? null,
    selectedName: payload.profile?.name ?? null,
    phdSchool: payload.profile?.phdSchool ?? null,
    phdYear: payload.profile?.phdYear ?? null,
    advisorCount: payload.profile?.advisors?.length ?? 0,
    studentCount: payload.profile?.students?.length ?? 0,
    datasetMatches: payload.datasetCrosscheck?.person ?? [],
    advisorMatches:
      payload.datasetCrosscheck?.advisors?.filter((entry) => entry.matches.length > 0).map((entry) => ({
        name: entry.name,
        mgpId: entry.mgpId,
        matches: entry.matches,
      })) ?? [],
    studentMatches:
      payload.datasetCrosscheck?.students?.filter((entry) => entry.matches.length > 0).map((entry) => ({
        name: entry.name,
        mgpId: entry.mgpId,
        year: entry.year,
        matches: entry.matches,
      })) ?? [],
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCacheDirs();
  await mkdir(batchCacheDir, { recursive: true });

  const allPeople = await loadPeople();
  let selected = allPeople.filter((person) => person.tracking?.status === options.status);
  if (options.ids.length > 0) {
    const wanted = new Set(options.ids);
    selected = allPeople.filter((person) => wanted.has(person.id));
  }

  selected.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  let startIndex = options.offset;
  if (options.resume) {
    const state = await readJsonIfExists(batchStatePath);
    if (state?.nextIndex != null) {
      startIndex = state.nextIndex;
    }
  }

  const batch = selected.slice(startIndex, startIndex + options.limit);
  console.log(`Scanning ${batch.length} profiles starting at index ${startIndex} with delay ${options.delayMs}ms`);

  for (let index = 0; index < batch.length; index += 1) {
    const person = batch[index];
    const absoluteIndex = startIndex + index;
    const cachePath = path.join(batchCacheDir, `${person.id}.json`);

    if (!options.force) {
      const cached = await readJsonIfExists(cachePath);
      if (cached) {
        console.log(`[skip] ${person.name} [${person.id}] cached`);
        continue;
      }
    }

    const payload = await buildPayload({ personId: person.id });
    const record = {
      id: person.id,
      name: person.name,
      workInstitution: person.work?.institution ?? null,
      trackingStatus: person.tracking?.status ?? null,
      scannedAt: new Date().toISOString(),
      payload,
      summary: summarize(payload),
    };

    await writeFile(cachePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await appendFile(batchJsonlPath, `${JSON.stringify(record.summary)}\n`, "utf8");
    await writeFile(
      batchStatePath,
      `${JSON.stringify({ nextIndex: absoluteIndex + 1, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );

    console.log(`[ok] ${person.name} [${person.id}] -> ${record.summary.selectedMgpId ?? "no unique profile"}`);

    if (index < batch.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

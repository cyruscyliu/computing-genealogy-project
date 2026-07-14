import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs } from "./cache-paths.mjs";

export const rawDir = path.join(appRoot, "data", "raw");
export const mgpActiveDir = path.join(cacheDirs.discovery, "mgp-active");
export const mgpCrosscheckJsonlPath = path.join(cacheDirs.discovery, "mgp-active-crosscheck.jsonl");
export const mgpStatePath = path.join(cacheDirs.discovery, "mgp-active-state.json");
export const mgpEnrichCandidatesPath = path.join(cacheDirs.discovery, "mgp-enrich-candidates.jsonl");
export const mgpEnrichSummaryPath = path.join(cacheDirs.discovery, "mgp-enrich-summary.json");

export async function loadPeopleArray() {
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

export async function loadPeopleMap() {
  const people = await loadPeopleArray();
  return new Map(people.map((person) => [person.id, person]));
}

export async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, cacheRoot, ensureCacheDirs, ensureProfileCacheDirs, profileCollectorPath, profileResolutionPath, profileSourcePath } from "./cache-paths.mjs";
import { buildSnapshotRelativePaths } from "./source-snapshot-utils.mjs";
import { generateCacheIndex } from "./reindex-cache.mjs";

const rawDir = path.join(appRoot, "data", "raw");
const legacyRoots = ["indexes", "resolution", "snapshots", "discovery", "sources", "homepage-resolution", "searxng", "csrankings"];

async function exists(targetPath) {
  try { await stat(targetPath); return true; } catch { return false; }
}

async function walk(dirPath) {
  if (!(await exists(dirPath))) return [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

async function loadPeople() {
  const people = [];
  for (const fileName of (await readdir(rawDir)).filter((name) => name.endsWith(".json"))) {
    people.push(...JSON.parse(await readFile(path.join(rawDir, fileName), "utf8")));
  }
  return people;
}

function profileUrls(person) {
  return new Set([person.source?.url, ...(person.sources ?? []).map((source) => source.url)].filter(Boolean));
}

async function migrateResolution(people, report, apply) {
  const root = path.join(cacheRoot, "resolution");
  for (const filePath of await walk(root)) {
    if (!filePath.endsWith(".json")) continue;
    const profileId = path.basename(filePath, ".json");
    if (!people.some((person) => person.id === profileId)) continue;
    const relativeTool = path.relative(root, path.dirname(filePath)).replaceAll(path.sep, "-") || "legacy";
    if (apply) {
      await ensureProfileCacheDirs(profileId);
      await cp(filePath, profileResolutionPath(profileId, relativeTool));
    }
    report.resolution += 1;
  }
}

async function migrateMgpScans(people, report, apply) {
  const root = path.join(cacheRoot, "snapshots", "mgp-active");
  for (const filePath of await walk(root)) {
    const profileId = path.basename(filePath, ".json");
    if (!people.some((person) => person.id === profileId)) continue;
    if (apply) {
      await ensureProfileCacheDirs(profileId);
      await cp(filePath, profileCollectorPath(profileId, "mgp", "scan.json"));
    }
    report.mgpScans += 1;
  }
}

async function migrateSources(people, report, apply) {
  const legacySources = path.join(cacheRoot, "snapshots", "sources");
  const metaFiles = (await walk(legacySources)).filter((filePath) => filePath.endsWith(".meta.json"));
  const ownersByUrl = new Map();
  for (const person of people) for (const url of profileUrls(person)) {
    if (!ownersByUrl.has(url)) ownersByUrl.set(url, []);
    ownersByUrl.get(url).push(person.id);
  }
  for (const metadataPath of metaFiles) {
    let metadata;
    try { metadata = JSON.parse(await readFile(metadataPath, "utf8")); } catch { continue; }
    const owners = [...new Set([...(ownersByUrl.get(metadata.originalUrl) ?? []), ...(ownersByUrl.get(metadata.finalUrl) ?? [])])];
    if (owners.length === 0 || !metadata.contentRelativePath) continue;
    const contentPath = path.join(legacySources, metadata.contentRelativePath);
    if (!(await exists(contentPath))) continue;
    for (const profileId of owners) {
      const paths = buildSnapshotRelativePaths(metadata.originalUrl ?? metadata.finalUrl, metadata.bucket, metadata.contentType);
      if (apply) {
        await ensureProfileCacheDirs(profileId);
        const contentTarget = profileSourcePath(profileId, paths.contentRelativePath);
        const metadataTarget = profileSourcePath(profileId, paths.metadataRelativePath);
        await mkdir(path.dirname(contentTarget), { recursive: true });
        await cp(contentPath, contentTarget);
        await writeFile(metadataTarget, `${JSON.stringify({ ...metadata, profileId, contentRelativePath: paths.contentRelativePath, metadataRelativePath: paths.metadataRelativePath, migratedAt: new Date().toISOString() }, null, 2)}\n`);
      }
      report.sourceSnapshots += 1;
    }
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  await ensureCacheDirs();
  const people = await loadPeople();
  const report = { profiles: people.length, resolution: 0, mgpScans: 0, sourceSnapshots: 0, removedLegacyRoots: [] };
  await migrateResolution(people, report, apply);
  await migrateMgpScans(people, report, apply);
  await migrateSources(people, report, apply);
  if (apply) {
    for (const name of legacyRoots) {
      const target = path.join(cacheRoot, name);
      if (await exists(target)) { await rm(target, { recursive: true, force: true }); report.removedLegacyRoots.push(name); }
    }
  }
  const index = apply ? await generateCacheIndex() : null;
  console.log(JSON.stringify({ ...report, cacheSummary: index?.summary ?? null, applied: apply }, null, 2));
  if (!apply) console.log("Preview only. Re-run with --apply to migrate profile-scoped files and remove legacy roots.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });

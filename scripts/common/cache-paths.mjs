import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(__dirname, "../..");
export const cacheRoot = path.join(appRoot, ".cache");

export const cacheDirs = {
  datasets: path.join(cacheRoot, "datasets"),
  locks: path.join(cacheRoot, "locks"),
  profiles: path.join(cacheRoot, "profiles"),
  csrankings: path.join(cacheRoot, "datasets", "csrankings"),
  dblp: path.join(cacheRoot, "datasets", "dblp"),
};

export const cacheIndexPath = path.join(cacheRoot, "profiles-index.json");

function assertProfileId(profileId) {
  if (typeof profileId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profileId)) {
    throw new Error("A normalized profile ID is required for profile cache access.");
  }
}

export function profileCacheDir(profileId) {
  assertProfileId(profileId);
  return path.join(cacheDirs.profiles, profileId);
}

export function profileCachePaths(profileId) {
  const root = profileCacheDir(profileId);
  return {
    root,
    sources: path.join(root, "sources"),
    resolution: path.join(root, "resolution"),
    collectors: path.join(root, "collectors"),
  };
}

export function profileResolutionPath(profileId, toolName) {
  return path.join(profileCachePaths(profileId).resolution, `${toolName}.json`);
}

export function profileCollectorPath(profileId, collectorName, fileName) {
  return path.join(profileCachePaths(profileId).collectors, collectorName, fileName);
}

export function profileSourcePath(profileId, relativePath) {
  return path.join(profileCachePaths(profileId).sources, relativePath);
}

export async function ensureProfileCacheDirs(profileId) {
  await Promise.all(Object.values(profileCachePaths(profileId)).map((dirPath) => mkdir(dirPath, { recursive: true })));
}

export async function ensureCacheDirs() {
  await Promise.all(Object.values(cacheDirs).map((dirPath) => mkdir(dirPath, { recursive: true })));
}

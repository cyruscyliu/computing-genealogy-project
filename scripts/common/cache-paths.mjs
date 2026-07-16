import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.resolve(__dirname, "../..");

export const cacheRoot = path.join(appRoot, ".cache");
export const cacheDirs = {
  indexes: path.join(cacheRoot, "indexes"),
  datasets: path.join(cacheRoot, "datasets"),
  csrankings: path.join(cacheRoot, "datasets", "csrankings"),
  searxng: path.join(cacheRoot, "snapshots", "searxng"),
  mgp: path.join(cacheRoot, "snapshots", "mgp"),
  mgpActive: path.join(cacheRoot, "snapshots", "mgp-active"),
  resolution: path.join(cacheRoot, "resolution"),
  homepageResolution: path.join(cacheRoot, "resolution", "homepage"),
  snapshots: path.join(cacheRoot, "snapshots"),
  sourceSnapshots: path.join(cacheRoot, "snapshots", "sources"),
};

export const cacheIndexPath = path.join(cacheDirs.indexes, "cache-index.json");

export async function ensureCacheDirs() {
  await Promise.all(
    Object.values(cacheDirs).map((dirPath) => mkdir(dirPath, { recursive: true }))
  );
}

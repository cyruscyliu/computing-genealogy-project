import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { cacheDirs, cacheIndexPath, profileCachePaths, profileCollectorPath, profileResolutionPath, profileSourcePath } from "../scripts/common/cache-paths.mjs";

test("profile cache keeps all person material under the profile ID", () => {
  const paths = profileCachePaths("dawn-song");
  assert.equal(paths.root, path.join(cacheDirs.profiles, "dawn-song"));
  assert.equal(profileResolutionPath("dawn-song", "person-enrich"), path.join(paths.resolution, "person-enrich.json"));
  assert.equal(profileCollectorPath("dawn-song", "mgp", "scan.json"), path.join(paths.collectors, "mgp", "scan.json"));
  assert.equal(profileSourcePath("dawn-song", "homepage/index.html"), path.join(paths.sources, "homepage", "index.html"));
});

test("cache root retains only shared datasets, locks, profiles, and the profile index", () => {
  assert.deepEqual(Object.keys(cacheDirs).sort(), ["csrankings", "datasets", "dblp", "locks", "profiles"]);
  assert.equal(cacheIndexPath, path.join(path.dirname(cacheDirs.profiles), "profiles-index.json"));
});

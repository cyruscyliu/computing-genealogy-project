import { cp, mkdir, rename, rm, rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, cacheRoot, ensureCacheDirs } from "./cache-paths.mjs";

const legacyToUnified = [
  {
    from: path.join(cacheRoot, "csrankings"),
    to: cacheDirs.csrankings,
  },
  {
    from: path.join(cacheRoot, "homepage-resolution"),
    to: cacheDirs.homepageResolution,
  },
  {
    from: path.join(cacheRoot, "searxng"),
    to: cacheDirs.searxng,
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp"),
    to: cacheDirs.mgp,
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp-active"),
    to: cacheDirs.mgpActive,
  },
  {
    from: path.join(cacheRoot, "discovery", "searxng"),
    to: cacheDirs.searxng,
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp-active-crosscheck.jsonl"),
    to: path.join(cacheDirs.snapshots, "mgp-active-crosscheck.jsonl"),
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp-active-state.json"),
    to: path.join(cacheDirs.snapshots, "mgp-active-state.json"),
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp-enrich-candidates.jsonl"),
    to: path.join(cacheDirs.snapshots, "mgp-enrich-candidates.jsonl"),
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp-enrich-summary.json"),
    to: path.join(cacheDirs.snapshots, "mgp-enrich-summary.json"),
  },
  {
    from: path.join(cacheRoot, "discovery", "mgp-search.cookies"),
    to: path.join(cacheDirs.mgp, "mgp-search.cookies"),
  },
  {
    from: path.join(cacheRoot, "discovery", "missing-phd-advisor-by-institution.json"),
    to: path.join(cacheDirs.snapshots, "missing-phd-advisor-by-institution.json"),
  },
  {
    from: path.join(cacheRoot, "discovery", "homepage-followup-summary.json"),
    to: path.join(cacheDirs.snapshots, "homepage-followup-summary.json"),
  },
  {
    from: path.join(cacheRoot, "sources"),
    to: cacheDirs.sourceSnapshots,
  },
];

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function migrateEntry(fromPath, toPath) {
  if (!(await pathExists(fromPath))) {
    return { fromPath, toPath, status: "missing" };
  }

  await mkdir(path.dirname(toPath), { recursive: true });

  if (!(await pathExists(toPath))) {
    await rename(fromPath, toPath);
    return { fromPath, toPath, status: "renamed" };
  }

  const sourceStat = await stat(fromPath);
  if (!sourceStat.isDirectory()) {
    await rm(fromPath, { force: true });
    return { fromPath, toPath, status: "destination-preserved" };
  }

  await cp(fromPath, toPath, { recursive: true, force: false, errorOnExist: false });
  await rm(fromPath, { recursive: true, force: true });
  return { fromPath, toPath, status: "merged" };
}

async function main() {
  await ensureCacheDirs();
  const results = [];

  for (const mapping of legacyToUnified) {
    results.push(await migrateEntry(mapping.from, mapping.to));
  }
  await rmdir(path.join(cacheRoot, "discovery")).catch(() => {});

  console.log(
    JSON.stringify(
      {
        cacheRoot: path.relative(appRoot, cacheRoot),
        results,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

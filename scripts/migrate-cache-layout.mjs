import { cp, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
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

async function isDirectoryEmpty(targetPath) {
  const entries = await readdir(targetPath);
  return entries.length === 0;
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

  await cp(fromPath, toPath, { recursive: true, force: false, errorOnExist: false });

  if (await isDirectoryEmpty(fromPath)) {
    await rm(fromPath, { recursive: true, force: true });
    return { fromPath, toPath, status: "already-empty" };
  }

  await rm(fromPath, { recursive: true, force: true });
  return { fromPath, toPath, status: "merged" };
}

async function main() {
  await ensureCacheDirs();
  const results = [];

  for (const mapping of legacyToUnified) {
    results.push(await migrateEntry(mapping.from, mapping.to));
  }

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

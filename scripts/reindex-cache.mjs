import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { cacheDirs, cacheIndexPath, cacheRoot, ensureCacheDirs } from "./cache-paths.mjs";

async function walk(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    const fileStat = await stat(fullPath);
    files.push({
      path: path.relative(cacheRoot, fullPath),
      size: fileStat.size,
      mtime: new Date(fileStat.mtimeMs).toISOString(),
      extension: path.extname(entry.name).toLowerCase(),
    });
  }

  return files;
}

async function safeReadJson(targetPath) {
  try {
    return JSON.parse(await readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

function summarize(files) {
  const byExtension = {};
  for (const file of files) {
    const key = file.extension || "<none>";
    byExtension[key] = (byExtension[key] ?? 0) + 1;
  }

  return {
    fileCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    byExtension,
  };
}

async function main() {
  await ensureCacheDirs();
  const files = await walk(cacheRoot);
  const previousIndex = await safeReadJson(cacheIndexPath);

  const payload = {
    generatedAt: new Date().toISOString(),
    root: ".cache",
    layout: Object.fromEntries(
      Object.entries(cacheDirs).map(([key, value]) => [key, path.relative(cacheRoot, value)])
    ),
    summary: summarize(files),
    previousGeneratedAt: previousIndex?.generatedAt ?? null,
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
  };

  await writeFile(cacheIndexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(payload.summary, null, 2));
  console.log(`Wrote ${path.relative(process.cwd(), cacheIndexPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

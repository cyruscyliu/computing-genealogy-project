import { createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { withFileLock } from "./file-lock.mjs";

export async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

export async function downloadDatasetIfMissing({ filePath, url, lockName }) {
  if (await fileExists(filePath)) {
    return { filePath, downloaded: false };
  }

  return withFileLock(lockName, async () => {
    if (await fileExists(filePath)) {
      return { filePath, downloaded: false };
    }

    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.partial`;
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "computing-genealogy-project/dataset-cache" },
      });
      if (!response.ok || !response.body) {
        throw new Error(`Dataset download failed with ${response.status} for ${url}`);
      }
      await pipeline(Readable.fromWeb(response.body), createWriteStream(temporaryPath));
      await rename(temporaryPath, filePath);
      return { filePath, downloaded: true };
    } finally {
      await rm(temporaryPath, { force: true });
    }
  });
}

import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { cacheDirs } from "./cache-paths.mjs";

const lockDir = cacheDirs.locks;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function lockOwnerIsRunning(lockPath) {
  try {
    const [pidText] = (await readFile(lockPath, "utf8")).split("\n");
    const pid = Number(pidText);
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

export async function withFileLock(lockName, task, options = {}) {
  const retryMs = options.retryMs ?? 250;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const startedAt = Date.now();

  await mkdir(lockDir, { recursive: true });
  const lockPath = path.join(lockDir, `${lockName}.lock`);

  while (true) {
    let handle = null;
    try {
      handle = await open(lockPath, "wx");
      await handle.writeFile(`${process.pid}\n${new Date().toISOString()}\n`, "utf8");
      try {
        return await task();
      } finally {
        await handle.close();
        await rm(lockPath, { force: true });
      }
    } catch (error) {
      if (handle) {
        await handle.close().catch(() => {});
      }
      if (error?.code !== "EEXIST") {
        throw error;
      }
      if (!(await lockOwnerIsRunning(lockPath))) {
        await rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for lock ${lockName}`);
      }
      await sleep(retryMs);
    }
  }
}

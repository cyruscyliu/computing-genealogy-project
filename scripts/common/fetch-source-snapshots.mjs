import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchAndCacheSnapshot } from "./source-snapshot-utils.mjs";
import { generateCacheIndex } from "./reindex-cache.mjs";

function parseArgs(argv) {
  const options = {
    bucket: null,
    concurrency: 8,
    file: null,
    force: false,
    profileId: null,
    timeoutMs: 30000,
    urls: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--bucket") {
      options.bucket = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--file") {
      options.file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[i + 1] ?? options.concurrency) || options.concurrency);
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1] ?? options.timeoutMs);
      i += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--profile-id") {
      options.profileId = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    options.urls.push(arg);
  }

  return options;
}

async function loadUrls(options) {
  const urls = [...options.urls];
  if (options.file) {
    const fileContents = await readFile(path.resolve(options.file), "utf8");
    for (const line of fileContents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      urls.push(trimmed);
    }
  }
  return [...new Set(urls)];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runWorker())
  );

  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const urls = await loadUrls(options);

  if (!options.profileId || urls.length === 0) {
    throw new Error("Usage: node scripts/common/fetch-source-snapshots.mjs --profile-id <id> [--bucket <kind>] <url> [...]");
  }

  const results = await mapWithConcurrency(urls, options.concurrency, async (url) => {
    try {
      const snapshot = await fetchAndCacheSnapshot(url, {
        profileId: options.profileId,
        bucket: options.bucket,
        force: options.force,
        timeoutMs: options.timeoutMs,
      });
      return { ok: true, url, snapshot };
    } catch (error) {
      return {
        ok: false,
        url,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const index = await generateCacheIndex();
  const succeeded = results.filter((entry) => entry.ok);
  const failed = results.filter((entry) => !entry.ok);
  console.log(
    JSON.stringify(
      {
        requested: urls.length,
        succeeded: succeeded.length,
        failed: failed.length,
        fetched: succeeded.map((entry) => entry.snapshot),
        failures: failed.map((entry) => ({ url: entry.url, error: entry.error })),
        cacheSummary: index.summary,
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

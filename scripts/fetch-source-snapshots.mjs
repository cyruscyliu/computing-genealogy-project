import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchAndCacheSnapshot } from "./source-snapshot-utils.mjs";
import { generateCacheIndex } from "./reindex-cache.mjs";

function parseArgs(argv) {
  const options = {
    bucket: null,
    file: null,
    force: false,
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
    if (arg === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1] ?? options.timeoutMs);
      i += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const urls = await loadUrls(options);

  if (urls.length === 0) {
    throw new Error("Pass one or more URLs or use --file.");
  }

  const results = [];
  for (const url of urls) {
    results.push(
      await fetchAndCacheSnapshot(url, {
        bucket: options.bucket,
        force: options.force,
        timeoutMs: options.timeoutMs,
      })
    );
  }

  const index = await generateCacheIndex();
  console.log(
    JSON.stringify(
      {
        fetched: results,
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

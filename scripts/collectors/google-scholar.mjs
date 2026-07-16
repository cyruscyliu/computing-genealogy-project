import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheDirs } from "../common/cache-paths.mjs";
import { fetchAndCacheSnapshot } from "../common/source-snapshot-utils.mjs";

const SCHOLAR_TIMEOUT_MS = 12000;

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseGoogleScholarProfile(html) {
  const name = decodeHtml(String(html).match(/id=["']gsc_prf_in["'][^>]*>([\s\S]*?)<\//i)?.[1] ?? "") || null;
  const website = decodeHtml(
    String(html).match(/id=["']gsc_prf_ivh["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? ""
  ) || null;
  try {
    if (website && /^https?:$/i.test(new URL(website).protocol)) {
      return { name, homepage: website };
    }
  } catch {}
  return { name, homepage: null };
}

async function readSnapshot(snapshot) {
  return readFile(path.join(cacheDirs.sourceSnapshots, snapshot.contentRelativePath), "utf8");
}

export async function fetchGoogleScholarHomepage(profileUrl) {
  if (!/^https?:\/\/scholar\.google\.com\/citations\?/i.test(profileUrl ?? "")) {
    return null;
  }
  try {
    const snapshot = await fetchAndCacheSnapshot(profileUrl, {
      bucket: "google-scholar-profile",
      timeoutMs: SCHOLAR_TIMEOUT_MS,
      allowFallbacks: false,
      userAgent: "Mozilla/5.0 (compatible; computing-genealogy-project)",
    });
    return {
      ...parseGoogleScholarProfile(await readSnapshot(snapshot)),
      profileUrl: snapshot.finalUrl,
    };
  } catch {
    return null;
  }
}

function parseArgs(argv) {
  const options = { url: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--url") {
      options.url = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.url) throw new Error("Usage: node scripts/collectors/google-scholar.mjs --url <scholar-profile-url>");
  console.log(JSON.stringify(await fetchGoogleScholarHomepage(options.url), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

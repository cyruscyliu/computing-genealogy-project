import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { appRoot, cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";
import { fetchAndCacheSnapshot } from "./source-snapshot-utils.mjs";
import { normalizeInstitution } from "./institution-normalization.mjs";

const resolutionCacheDir = cacheDirs.homepageResolution;
const rawDir = path.join(appRoot, "data", "raw");

function parseArgs(argv) {
  const options = {
    missingPhdAdvisorOnly: false,
    institution: null,
    limit: null,
    concurrency: 6,
    force: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--missing-phd-advisor-only") {
      options.missingPhdAdvisorOnly = true;
      continue;
    }
    if (arg === "--institution") {
      options.institution = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[i + 1] ?? 0) || null;
      i += 1;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[i + 1] ?? 0) || options.concurrency);
      i += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
    }
  }

  return options;
}

function normalizeHref(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function normalizeText(value) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function scoreFollowupLink({ href, label, baseUrl }) {
  let url;
  let base;
  try {
    url = new URL(href);
    base = new URL(baseUrl);
  } catch {
    return null;
  }

  const normalizedLabel = normalizeText(label);
  const pathname = normalizeText(url.pathname);
  const search = normalizeText(url.search);
  const basename = normalizeText(path.basename(url.pathname));
  const combined = `${normalizedLabel} ${basename} ${search}`;
  const labelAndBasename = `${normalizedLabel} ${basename}`;
  const baseDocument = `${base.origin}${base.pathname}${base.search}`;
  const targetDocument = `${url.origin}${url.pathname}${url.search}`;

  const isPdf = pathname.endsWith(".pdf");
  const sameHost = url.hostname === base.hostname;
  const sameRegistrableFamily =
    url.hostname === base.hostname ||
    url.hostname.endsWith(`.${base.hostname}`) ||
    base.hostname.endsWith(`.${url.hostname}`);
  const isSameDocument = targetDocument === baseDocument;

  let score = 0;

  if (!/^https?:$/i.test(url.protocol)) return null;
  if (isSameDocument) return null;
  if (normalizedLabel === "return to top" || normalizedLabel === "skip to main content") return null;
  if (!normalizedLabel) return null;
  if (/^(download|pdf|slides?|paper|here|more|read more|full text)$/i.test(normalizedLabel)) return null;
  if (/last updated/i.test(normalizedLabel)) return null;
  if (/^(javascript:|mailto:|tel:)/i.test(href)) return null;
  if (
    /(youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|bsky\.app|researchgate\.net|dl\.acm\.org|openreview\.net)/i.test(
      url.hostname,
    )
  ) {
    return null;
  }
  if (/(sharer|share|intent\/tweet)/i.test(combined)) return null;
  if (/action=download/i.test(search) && !/(cv|vita|resume|bio|biography|about|thesis|dissertation)/i.test(combined)) {
    return null;
  }
  if (isPdf && !/(cv|vita|resume|bio|biography|thesis|dissertation)/i.test(labelAndBasename)) {
    return null;
  }

  if (/(^|[^a-z])(cv|vita|resume)([^a-z]|$)/i.test(combined)) score += 120;
  if (/(curriculum vitae|biography|short bio|bio sketch)/i.test(combined)) score += 90;
  if (/^(about|about me|profile)$/i.test(normalizedLabel)) score += 70;
  if (/(^|[^a-z])(bio)([^a-z]|$)/i.test(combined)) score += 70;
  if (/(publications?)/i.test(combined)) score += 30;
  if (/(people|team|group|lab)/i.test(combined)) score += 15;
  if (isPdf) score += 40;
  if (sameHost) score += 25;
  else if (sameRegistrableFamily) score += 10;
  else score -= 25;
  if (/\/(people|team|about)(\/|$)/i.test(pathname) && !/(cv|vita|resume|bio|biography|profile)/i.test(combined)) {
    score -= 35;
  }
  if (/department|faculty|school|college|university/i.test(pathname) && !sameHost) {
    score -= 20;
  }

  if (score < 55) {
    return null;
  }

  return {
    href,
    label,
    score,
    sameHost,
    isPdf,
  };
}

function extractFollowupLinks(html, baseUrl) {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const candidates = [];
  for (const match of matches) {
    const href = normalizeHref(baseUrl, match[1]);
    if (!href) continue;
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const scored = scoreFollowupLink({ href, label, baseUrl });
    if (scored) {
      candidates.push(scored);
    }
  }
  const seen = new Set();
  return candidates
    .filter((candidate) => {
      if (seen.has(candidate.href)) return false;
      seen.add(candidate.href);
      return true;
    })
    .sort((left, right) => right.score - left.score || left.href.localeCompare(right.href));
}

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker()));
  return results;
}

async function loadPeopleById() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const peopleById = new Map();
  for (const fileName of files) {
    const people = JSON.parse(await readFile(path.join(rawDir, fileName), "utf8"));
    for (const person of people) {
      peopleById.set(person.id, person);
    }
  }
  return peopleById;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureCacheDirs();
  const files = (await readdir(resolutionCacheDir)).filter((name) => name.endsWith(".json")).sort();
  const peopleById = await loadPeopleById();

  let entries = [];
  for (const fileName of files) {
    const parsed = JSON.parse(await readFile(path.join(resolutionCacheDir, fileName), "utf8"));
    if (!parsed?.resolved || !parsed?.homepage) continue;
    entries.push(parsed);
  }

  if (options.missingPhdAdvisorOnly) {
    entries = entries.filter((entry) => {
      const person = peopleById.get(entry.id);
      return person && !person?.stages?.phd?.advisorLabel;
    });
  }

  if (options.institution) {
    const wanted = normalizeInstitution(options.institution);
    entries = entries.filter((entry) => {
      const person = peopleById.get(entry.id);
      return person && normalizeInstitution(person.work?.institution ?? "(unknown)") === wanted;
    });
  }

  if (options.limit != null) {
    entries = entries.slice(0, options.limit);
  }

  const results = await mapWithConcurrency(entries, options.concurrency, async (entry) => {
    try {
      const homepageSnapshot = await fetchAndCacheSnapshot(entry.homepage, {
        bucket: "homepage-followup",
        force: options.force,
      });
      const contentPath = path.join(cacheDirs.sourceSnapshots, homepageSnapshot.contentRelativePath);
      const html = await readFile(contentPath, "utf8");
      const links = extractFollowupLinks(html, homepageSnapshot.finalUrl);
      const fetched = [];
      for (const link of links.slice(0, 5)) {
        try {
          const snap = await fetchAndCacheSnapshot(link.href, {
            bucket: "homepage-followup",
            force: options.force,
          });
          fetched.push({
            href: link.href,
            label: link.label,
            score: link.score,
            contentType: snap.contentType,
            cacheHit: snap.cacheHit,
          });
        } catch (error) {
          fetched.push({ href: link.href, label: link.label, score: link.score, error: error.message });
        }
      }
      return { id: entry.id, homepage: entry.homepage, linksFound: links.length, fetched };
    } catch (error) {
      return { id: entry.id, homepage: entry.homepage, error: error.message };
    }
  });

  const summary = {
    total: entries.length,
    withLinks: results.filter((entry) => (entry.linksFound ?? 0) > 0).length,
    withErrors: results.filter((entry) => entry.error).length,
  };

  await writeFile(
    path.join(cacheDirs.discovery, "homepage-followup-summary.json"),
    `${JSON.stringify({ summary, results }, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify({ summary, results: results.slice(0, 100) }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

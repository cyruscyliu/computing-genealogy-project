import { readFile } from "node:fs/promises";
import path from "node:path";
import { cacheDirs } from "../common/cache-paths.mjs";
import { fetchAndCacheSnapshot } from "../common/source-snapshot-utils.mjs";

const DBLP_SEARCH_BASE_URL = "https://dblp.org/search/author/api";
const DBLP_TIMEOUT_MS = 12000;

export function dblpIdentityKey(value) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("en-US");
}

function decodeXmlText(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/gi, (_, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity.toLowerCase()])
    .replace(/\s+/g, " ")
    .trim();
}

function parseAttributes(text) {
  return Object.fromEntries(
    [...String(text).matchAll(/([\w:-]+)=(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1],
      decodeXmlText(match[2] ?? match[3] ?? ""),
    ])
  );
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isHomepageLead(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return !/(^|\.)(dblp\.org|orcid\.org|wikidata\.org|scholar\.google\.com|semanticscholar\.org|dl\.acm\.org|ieeexplore\.ieee\.org|researchgate\.net)$/.test(hostname);
  } catch {
    return false;
  }
}

export function parseDblpAuthorSearchPayload(payload, dblpAuthorId) {
  const matches = asArray(payload?.result?.hits?.hit).filter(
    (hit) => dblpIdentityKey(hit?.info?.author) === dblpIdentityKey(dblpAuthorId)
  );
  if (matches.length !== 1) return null;
  const profileUrl = matches[0]?.info?.url ?? null;
  if (!/^https:\/\/dblp\.org\/pid\/[\w/-]+$/i.test(profileUrl ?? "")) return null;
  return {
    author: matches[0].info.author,
    profileUrl,
    pid: profileUrl.replace(/^https:\/\/dblp\.org\/pid\//i, ""),
  };
}

export function parseDblpProfileXml(xml) {
  const root = String(xml).match(/<dblpperson\b([^>]*)>/i);
  const rootAttributes = parseAttributes(root?.[1] ?? "");
  const personMatch = String(xml).match(/<dblpperson\b[^>]*>\s*(<person\b[\s\S]*?<\/person>)/i);
  const personBlock = personMatch?.[1] ?? null;
  if (!personBlock) return null;

  const affiliations = [];
  const homepageLeads = [];
  const scholarLeads = [];
  const orcids = [];
  let phdSchool = null;
  let phdGraduationYear = null;

  for (const match of personBlock.matchAll(/<note\b([^>]*)>([\s\S]*?)<\/note>/gi)) {
    const attributes = parseAttributes(match[1]);
    const value = decodeXmlText(match[2]);
    if (attributes.type !== "affiliation" || !value) continue;
    affiliations.push({ value, label: attributes.label ?? null });
    const phdLabel = attributes.label?.match(/\bph\.?d\.?\s*(\d{4})?\b/i);
    if (phdLabel && !phdSchool) {
      phdSchool = value;
      phdGraduationYear = phdLabel[1] ? Number(phdLabel[1]) : null;
    }
  }

  for (const match of personBlock.matchAll(/<url>([\s\S]*?)<\/url>/gi)) {
    const url = decodeXmlText(match[1]);
    if (!url) continue;
    if (/^https?:\/\/(?:www\.)?orcid\.org\//i.test(url)) {
      orcids.push(url.replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, "").replace(/\/$/, ""));
    } else if (/^https?:\/\/scholar\.google\.com\/citations\?/i.test(url)) {
      scholarLeads.push(url);
    } else if (isHomepageLead(url)) {
      homepageLeads.push(url);
    }
  }

  const currentAffiliation = affiliations.find((entry) => !entry.label)?.value ?? null;
  return {
    author: rootAttributes.name ?? null,
    pid: rootAttributes.pid ?? null,
    currentAffiliation,
    affiliations,
    homepageLeads: [...new Set(homepageLeads)],
    scholarLeads: [...new Set(scholarLeads)],
    orcid: [...new Set(orcids)].length === 1 ? orcids[0] : null,
    phdSchool,
    phdGraduationYear,
  };
}

async function readSnapshot(snapshot) {
  return readFile(path.join(cacheDirs.sourceSnapshots, snapshot.contentRelativePath), "utf8");
}

export async function fetchDblpMetadata(dblpAuthorId) {
  if (!dblpAuthorId) return null;
  const searchUrl = `${DBLP_SEARCH_BASE_URL}?q=${encodeURIComponent(dblpAuthorId)}&format=json`;
  try {
    const searchSnapshot = await fetchAndCacheSnapshot(searchUrl, {
      bucket: "dblp-author-search",
      timeoutMs: DBLP_TIMEOUT_MS,
    });
    const match = parseDblpAuthorSearchPayload(JSON.parse(await readSnapshot(searchSnapshot)), dblpAuthorId);
    if (!match) return null;
    const xmlUrl = `${match.profileUrl}.xml`;
    const profileSnapshot = await fetchAndCacheSnapshot(xmlUrl, {
      bucket: "dblp-person-xml",
      timeoutMs: DBLP_TIMEOUT_MS,
    });
    const metadata = parseDblpProfileXml(await readSnapshot(profileSnapshot));
    if (!metadata || dblpIdentityKey(metadata.author) !== dblpIdentityKey(dblpAuthorId)) return null;
    return { ...metadata, profileUrl: match.profileUrl, xmlUrl };
  } catch {
    return null;
  }
}

export function buildDblpDiscoverySource(metadata, affiliation) {
  return {
    kind: "dblp-discovery",
    url: metadata.profileUrl,
    confidence: "medium",
    note: `Exact DBLP person profile lists current affiliation ${affiliation}.`,
  };
}

function parseArgs(argv) {
  const options = { dblpAuthorId: null };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dblp-author-id") {
      options.dblpAuthorId = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.dblpAuthorId) {
    throw new Error("Usage: node scripts/collectors/dblp.mjs --dblp-author-id <full-dblp-author-id>");
  }
  console.log(JSON.stringify(await fetchDblpMetadata(options.dblpAuthorId), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createGunzip } from "node:zlib";
import path from "node:path";
import readline from "node:readline";
import { cacheDirs, ensureCacheDirs } from "../common/cache-paths.mjs";
import { downloadDatasetIfMissing, fileExists } from "../common/dataset-download.mjs";
import { withFileLock } from "../common/file-lock.mjs";

export const DBLP_DATASET_URL = "https://dblp.uni-trier.de/xml/dblp.xml.gz";
export const dblpDatasetPath = path.join(cacheDirs.datasets, "dblp", "dblp.xml.gz");
const dblpIndexPath = path.join(cacheDirs.datasets, "dblp", "people-index.json");
const DBLP_INDEX_VERSION = 1;

// DBLP labels are identities, not display names. Preserve suffixes and diacritics.
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

function validOrcid(value) {
  return /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/i.test(value ?? "");
}

function identityFingerprint(identities) {
  return createHash("sha256").update(identities.join("\n")).digest("hex");
}

async function readLocalIndex() {
  try {
    return JSON.parse(await readFile(dblpIndexPath, "utf8"));
  } catch {
    return null;
  }
}

async function buildLocalIndex(identities, fingerprint) {
  const wanted = new Map(identities.map((identity) => [dblpIdentityKey(identity), identity]));
  const orcidsByIdentity = new Map(identities.map((identity) => [dblpIdentityKey(identity), new Set()]));
  const dump = await stat(dblpDatasetPath);
  const input = createReadStream(dblpDatasetPath).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    for (const match of line.matchAll(/<author\b([^>]*)>([\s\S]*?)<\/author>/gi)) {
      const author = decodeXmlText(match[2]);
      const key = dblpIdentityKey(author);
      if (!wanted.has(key)) continue;
      const orcid = parseAttributes(match[1]).orcid ?? null;
      if (validOrcid(orcid)) {
        orcidsByIdentity.get(key).add(orcid.toUpperCase());
      }
    }
  }

  const peopleByIdentity = Object.fromEntries(
    identities.map((identity) => {
      const orcids = [...orcidsByIdentity.get(dblpIdentityKey(identity))].sort();
      return [dblpIdentityKey(identity), {
        author: identity,
        orcid: orcids.length === 1 ? orcids[0] : null,
        ambiguousOrcid: orcids.length > 1,
      }];
    })
  );
  return {
    version: DBLP_INDEX_VERSION,
    datasetSize: dump.size,
    datasetMtimeMs: dump.mtimeMs,
    identityFingerprint: fingerprint,
    generatedAt: new Date().toISOString(),
    peopleByIdentity,
  };
}

function cachedIndexMatchesDataset(index, dump) {
  return (
    index?.version === DBLP_INDEX_VERSION &&
    index.datasetSize === dump.size &&
    index.datasetMtimeMs === dump.mtimeMs
  );
}

function indexContainsAllIdentities(index, identities) {
  return identities.every((identity) => Boolean(index?.peopleByIdentity?.[dblpIdentityKey(identity)]));
}

function mergeIndexIdentities(index, requestedIdentities) {
  return [...new Set([
    ...requestedIdentities,
    ...Object.values(index?.peopleByIdentity ?? {}).map((record) => record.author).filter(Boolean),
  ])].sort((left, right) => left.localeCompare(right));
}

export async function loadDblpLocalIndex(dblpAuthorIds = []) {
  const requestedIdentities = [...new Set(dblpAuthorIds.filter(Boolean))].sort((left, right) => left.localeCompare(right));
  await ensureCacheDirs();
  await downloadDatasetIfMissing({
    filePath: dblpDatasetPath,
    url: DBLP_DATASET_URL,
    lockName: "dataset-dblp-download",
  });
  const dump = await stat(dblpDatasetPath);
  const cached = await readLocalIndex();
  if (cachedIndexMatchesDataset(cached, dump) && indexContainsAllIdentities(cached, requestedIdentities)) {
    return cached;
  }

  return withFileLock("dataset-dblp-index", async () => {
    const lockedCached = await readLocalIndex();
    if (cachedIndexMatchesDataset(lockedCached, dump) && indexContainsAllIdentities(lockedCached, requestedIdentities)) {
      return lockedCached;
    }
    const identities = mergeIndexIdentities(lockedCached, requestedIdentities);
    await mkdir(path.dirname(dblpIndexPath), { recursive: true });
    const index = await buildLocalIndex(identities, identityFingerprint(identities));
    await writeFile(dblpIndexPath, JSON.stringify(index, null, 2) + "\n", "utf8");
    return index;
  });
}

export function metadataFromDblpLocalIndex(dblpAuthorId, localIndex) {
  const record = localIndex?.peopleByIdentity?.[dblpIdentityKey(dblpAuthorId)] ?? null;
  if (!record) return null;
  return {
    author: record.author,
    pid: null,
    currentAffiliation: null,
    affiliations: [],
    homepageLeads: [],
    scholarLeads: [],
    orcid: record.orcid,
    phdSchool: null,
    phdGraduationYear: null,
    profileUrl: null,
    xmlUrl: null,
  };
}

export async function fetchDblpMetadata(dblpAuthorId, localIndex = null) {
  if (!dblpAuthorId) return null;
  if (localIndex) {
    return metadataFromDblpLocalIndex(dblpAuthorId, localIndex);
  }
  if (!(await fileExists(dblpIndexPath))) {
    return null;
  }
  return metadataFromDblpLocalIndex(dblpAuthorId, await readLocalIndex());
}

export function buildDblpDiscoverySource(metadata, affiliation) {
  return {
    kind: "dblp-discovery",
    url: metadata.profileUrl ?? "https://dblp.org/",
    confidence: "medium",
    note: "Local DBLP dataset index lists current affiliation " + affiliation + ".",
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
  const index = await loadDblpLocalIndex([options.dblpAuthorId]);
  console.log(JSON.stringify(await fetchDblpMetadata(options.dblpAuthorId, index), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

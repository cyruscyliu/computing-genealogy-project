import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function sanitizeSegment(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "index";
}

function extensionFromContentType(contentType) {
  const normalized = (contentType ?? "").toLowerCase();
  if (normalized.includes("application/pdf")) return ".pdf";
  if (normalized.includes("text/html")) return ".html";
  if (normalized.includes("application/json")) return ".json";
  if (normalized.includes("text/plain")) return ".txt";
  if (normalized.includes("application/xml") || normalized.includes("text/xml")) return ".xml";
  return null;
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  return ext && ext.length <= 8 ? ext : null;
}

function buildRelativePaths(url, bucket = null, contentType = null) {
  const parsed = new URL(url);
  const ext = extensionFromContentType(contentType) ?? extensionFromUrl(url) ?? ".bin";
  const pathParts = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map((part) => sanitizeSegment(part));
  const baseParts = [parsed.hostname, ...(bucket ? [sanitizeSegment(bucket)] : [])];
  const fileStem =
    pathParts.length > 0
      ? pathParts.join("_")
      : "index";
  const querySuffix = parsed.search ? `__q-${shortHash(parsed.search)}` : "";
  const baseRelativeStem = path.join(...baseParts, `${fileStem}${querySuffix}`);
  const contentRelativePath = `${baseRelativeStem}${ext}`;
  const metadataRelativePath = `${baseRelativeStem}.meta.json`;
  return { contentRelativePath, metadataRelativePath };
}

async function fileExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function readSnapshotMetadata(url, options = {}) {
  const { bucket = null } = options;
  const { metadataRelativePath } = buildRelativePaths(url, bucket);
  const metadataPath = path.join(cacheDirs.sourceSnapshots, metadataRelativePath);
  if (!(await fileExists(metadataPath))) {
    return null;
  }
  return JSON.parse(await readFile(metadataPath, "utf8"));
}

export async function fetchAndCacheSnapshot(url, options = {}) {
  const {
    bucket = null,
    force = false,
    timeoutMs = 30000,
    userAgent = "computing-genealogy-project/source-snapshot",
  } = options;

  await ensureCacheDirs();

  const cached = !force ? await readSnapshotMetadata(url, { bucket }) : null;
  if (cached && cached.contentRelativePath) {
    const contentPath = path.join(cacheDirs.sourceSnapshots, cached.contentRelativePath);
    if (await fileExists(contentPath)) {
      return { ...cached, cacheHit: true };
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/pdf,application/json,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Snapshot request failed with ${response.status} for ${url}`);
  }

  const finalUrl = response.url;
  const contentType = response.headers.get("content-type");
  const body = Buffer.from(await response.arrayBuffer());
  const { contentRelativePath, metadataRelativePath } = buildRelativePaths(finalUrl, bucket, contentType);
  const contentPath = path.join(cacheDirs.sourceSnapshots, contentRelativePath);
  const metadataPath = path.join(cacheDirs.sourceSnapshots, metadataRelativePath);

  await mkdir(path.dirname(contentPath), { recursive: true });
  await writeFile(contentPath, body);

  const metadata = {
    originalUrl: url,
    finalUrl,
    bucket,
    contentType,
    fetchedAt: new Date().toISOString(),
    size: body.length,
    sha256: createHash("sha256").update(body).digest("hex"),
    contentRelativePath,
    metadataRelativePath,
  };
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return { ...metadata, cacheHit: false };
}

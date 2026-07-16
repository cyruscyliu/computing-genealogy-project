import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { cacheDirs, ensureCacheDirs } from "./cache-paths.mjs";
import { withFileLock } from "./file-lock.mjs";

const execFile = promisify(execFileCallback);

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

function buildCurlTargetUrl(url, options = {}) {
  if (options.forceHttp && /^https:/i.test(url)) {
    return url.replace(/^https:/i, "http:");
  }
  return url;
}

async function fetchViaCurl(url, options = {}) {
  const {
    timeoutMs = 30000,
    userAgent = "computing-genealogy-project/source-snapshot",
    insecureTls = false,
    forceHttp = false,
  } = options;

  const tempDir = await mkdtemp(path.join(tmpdir(), "cgp-snapshot-"));
  const bodyPath = path.join(tempDir, "body.bin");
  const headerPath = path.join(tempDir, "headers.txt");
  const targetUrl = buildCurlTargetUrl(url, { forceHttp });

  try {
    const args = [
      "-sS",
      "-L",
      "--max-time",
      String(Math.max(1, Math.ceil(timeoutMs / 1000))),
      "--connect-timeout",
      String(Math.max(5, Math.min(15, Math.ceil(timeoutMs / 1000)))),
      "-A",
      userAgent,
      "-D",
      headerPath,
      "-o",
      bodyPath,
      "-w",
      "%{url_effective}\n%{content_type}\n%{http_code}",
    ];
    if (insecureTls) {
      args.push("-k");
    }
    args.push(targetUrl);

    const { stdout } = await execFile("curl", args, {
      maxBuffer: 4 * 1024 * 1024,
    });
    const [finalUrl = targetUrl, contentType = "", statusCode = ""] = stdout.trim().split(/\n/);
    if (!/^2\d\d$/.test(statusCode)) {
      throw new Error(`Snapshot request failed with ${statusCode || "curl-error"} for ${url}`);
    }
    const body = await readFile(bodyPath);
    return {
      finalUrl,
      contentType: contentType || null,
      body,
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function classifyFetchFailure(error) {
  const code = String(error?.cause?.code ?? error?.code ?? "");
  const message = String(error?.cause?.message ?? error?.message ?? "");
  return {
    code,
    message,
    tls: /(CERT_|UNABLE_TO_VERIFY|SELF_SIGNED|certificate)/i.test(`${code} ${message}`),
    httpsConnectionRefused: code === "ECONNREFUSED" && /:443\b/.test(message),
  };
}

async function fetchBodyWithFallback(url, options = {}) {
  const {
    timeoutMs = 30000,
    userAgent = "computing-genealogy-project/source-snapshot",
    signal = null,
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal =
    signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([controller.signal, signal])
      : controller.signal;
  let abortListener = null;
  if (signal && typeof AbortSignal.any !== "function") {
    abortListener = () => controller.abort(signal.reason);
    signal.addEventListener("abort", abortListener, { once: true });
    if (signal.aborted) {
      controller.abort(signal.reason);
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/pdf,application/json,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: combinedSignal,
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`Snapshot request failed with ${response.status} for ${url}`);
    }

    return {
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      body: Buffer.from(await response.arrayBuffer()),
    };
  } catch (error) {
    const failure = classifyFetchFailure(error);
    const attempts = [{ insecureTls: false, forceHttp: false }];
    if (failure.tls) {
      attempts.push({ insecureTls: true, forceHttp: false });
    }
    if (failure.httpsConnectionRefused && /^https:/i.test(url)) {
      attempts.push({ insecureTls: false, forceHttp: true });
      attempts.push({ insecureTls: true, forceHttp: true });
    }

    let lastError = error;
    for (const attempt of attempts) {
      try {
        return await fetchViaCurl(url, {
          timeoutMs,
          userAgent,
          ...attempt,
        });
      } catch (curlError) {
        lastError = curlError;
      }
    }
    throw lastError;
  } finally {
    clearTimeout(timeout);
    if (signal && abortListener) {
      signal.removeEventListener("abort", abortListener);
    }
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
    signal = null,
  } = options;

  await ensureCacheDirs();

  const cached = !force ? await readSnapshotMetadata(url, { bucket }) : null;
  if (cached && cached.contentRelativePath) {
    const contentPath = path.join(cacheDirs.sourceSnapshots, cached.contentRelativePath);
    if (await fileExists(contentPath)) {
      return { ...cached, cacheHit: true };
    }
  }
  const lockName = `snapshot-${shortHash(`${bucket ?? "default"}:${url}`)}`;
  return withFileLock(lockName, async () => {
    const lockedCached = !force ? await readSnapshotMetadata(url, { bucket }) : null;
    if (lockedCached && lockedCached.contentRelativePath) {
      const contentPath = path.join(cacheDirs.sourceSnapshots, lockedCached.contentRelativePath);
      if (await fileExists(contentPath)) {
        return { ...lockedCached, cacheHit: true };
      }
    }

    const { finalUrl, contentType, body } = await fetchBodyWithFallback(url, {
      timeoutMs,
      userAgent,
      signal,
    });
    const { contentRelativePath, metadataRelativePath } = buildRelativePaths(
      finalUrl,
      bucket,
      contentType
    );
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
  });
}

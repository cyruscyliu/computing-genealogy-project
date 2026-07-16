import { readFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { cacheDirs } from "../common/cache-paths.mjs";

const execFile = promisify(execFileCallback);

function stripHtmlToText(value) {
  return String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function collectJsonStrings(value, sink) {
  if (value == null) return;
  if (typeof value === "string") {
    const text = stripHtmlToText(value);
    if (text) sink.push(text);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectJsonStrings(item, sink));
  } else if (typeof value === "object") {
    Object.values(value).forEach((item) => collectJsonStrings(item, sink));
  }
}

export async function readSnapshotText(snapshot) {
  const contentPath = path.join(cacheDirs.sourceSnapshots, snapshot.contentRelativePath);
  const contentType = String(snapshot.contentType || "").toLowerCase();
  if (contentType.includes("application/pdf") || contentPath.toLowerCase().endsWith(".pdf")) {
    const { stdout } = await execFile("pdftotext", ["-layout", "-nopgbrk", contentPath, "-"], {
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
  }

  const raw = await readFile(contentPath, "utf8");
  if (contentType.includes("text/html") || contentPath.toLowerCase().endsWith(".html")) {
    return stripHtmlToText(raw);
  }
  if (contentType.includes("application/json") || contentPath.toLowerCase().endsWith(".json")) {
    try {
      const strings = [];
      collectJsonStrings(JSON.parse(raw), strings);
      return strings.join(" ");
    } catch {}
  }
  return raw.replace(/\s+/g, " ").trim();
}

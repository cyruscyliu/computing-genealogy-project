import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { cacheDirs } from "../common/cache-paths.mjs";
import { normalizeInstitution } from "../common/institution-normalization.mjs";
import { fetchAndCacheSnapshot } from "../common/source-snapshot-utils.mjs";

const require = createRequire(import.meta.url);
const execFile = promisify(execFileCallback);
const institutionAliasPairs = require("../../institution-aliases.shared.js");
const institutionMentions = [...new Set(institutionAliasPairs.flat())]
  .filter(Boolean)
  .sort((left, right) => right.length - left.length);

export function isLikelyHomepageLead(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      /(github\.com|linkedin\.com|researchgate\.net|orcid\.org|twitter\.com|x\.com|scholar\.google\.com|dblp\.org)/i.test(
        host
      )
    ) {
      return false;
    }
    return /^https?:$/i.test(parsed.protocol);
  } catch {
    return false;
  }
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
  if (!normalizedLabel) return null;
  if (/^(javascript:|mailto:|tel:)/i.test(href)) return null;
  if (
    /(youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|bsky\.app|researchgate\.net|dl\.acm\.org|openreview\.net|github\.com|linkedin\.com)/i.test(
      url.hostname
    )
  ) {
    return null;
  }

  if (/(^|[^a-z])(cv|vita|resume)([^a-z]|$)/i.test(combined)) score += 120;
  if (/(curriculum vitae|biography|short bio|bio sketch)/i.test(combined)) score += 90;
  if (/^(about|about me|profile)$/i.test(normalizedLabel)) score += 70;
  if (/(^|[^a-z])(bio)([^a-z]|$)/i.test(combined)) score += 70;
  if (/(people|team|group|lab)/i.test(combined)) score += 20;
  if (/(faculty|staff|member|publications?)/i.test(combined)) score += 15;
  if (isPdf) score += 40;
  if (sameHost) score += 25;
  else if (sameRegistrableFamily) score += 10;
  else score -= 25;

  if (/\/(people|team|about)(\/|$)/i.test(pathname) && !/(cv|vita|resume|bio|biography|profile)/i.test(combined)) {
    score -= 30;
  }

  if (score < 55) {
    return null;
  }

  return { href, label, score };
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

function stripHtmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/&([A-Za-z]+);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripInlineMarkup(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectJsonStrings(value, sink) {
  if (value == null) {
    return;
  }
  if (typeof value === "string") {
    const text = stripInlineMarkup(value);
    if (text) {
      sink.push(text);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonStrings(item, sink));
    return;
  }
  if (typeof value === "object") {
    Object.values(value).forEach((item) => collectJsonStrings(item, sink));
  }
}

async function readSnapshotText(snapshot) {
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
      const parsed = JSON.parse(raw);
      const strings = [];
      collectJsonStrings(parsed, strings);
      return strings.join(" ");
    } catch {}
  }

  return raw.replace(/\s+/g, " ").trim();
}

function extractTitleAndDescription(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ??
    "";
  return {
    title: title.replace(/\s+/g, " ").trim(),
    description: description.replace(/\s+/g, " ").trim(),
  };
}

function detectHomepageAffiliation(html) {
  const { title, description } = extractTitleAndDescription(html);
  const body = stripHtmlToText(html).slice(0, 12000);
  const text = `${title}. ${description}. ${body}`;
  const lower = text.toLowerCase();
  const currentRolePatterns = [
    /currently\s+(?:an?|the)?\s*[^.]{0,120}?\s(?:at|with|in)\s$/i,
    /\bi(?:'m| am)\s+(?:an?|the)?\s*[^.]{0,120}?\s(?:at|with|in)\s$/i,
    /\b(?:assistant|associate|full|adjunct|visiting)?\s*professor\s+(?:at|with|in)\s$/i,
    /\b(?:researcher|scientist|engineer|faculty|student|ph\.?d\.?\s+candidate|postdoc|postdoctoral researcher|member|director)\s+(?:at|with|in|of)\s$/i,
    /\bworks?\s+(?:at|with|in)\s$/i,
  ];
  const hits = [];

  for (const mention of institutionMentions) {
    const idx = lower.indexOf(mention.toLowerCase());
    if (idx < 0) {
      continue;
    }

    const windowStart = Math.max(0, idx - 120);
    const windowEnd = Math.min(text.length, idx + mention.length + 120);
    const windowText = text.slice(windowStart, windowEnd);
    let score = 0;
    const prefix = text.slice(Math.max(0, idx - 180), idx + 1);

    if (idx < 2000) score += 1;
    if (/(professor|researcher|scientist|faculty|student|postdoc|associate|director|works at|working at|member of|joined)/i.test(windowText)) {
      score += 2;
    }
    if (title.toLowerCase().includes(mention.toLowerCase())) {
      score += 2;
    }
    if (description.toLowerCase().includes(mention.toLowerCase())) {
      score += 1;
    }
    if (currentRolePatterns.some((pattern) => pattern.test(prefix))) {
      score += 4;
    }

    if (score >= 3) {
      hits.push({
        normalized: normalizeInstitution(mention),
        score,
      });
    }
  }

  const unique = [];
  const seen = new Set();
  for (const hit of hits.sort((left, right) => right.score - left.score)) {
    if (seen.has(hit.normalized)) {
      continue;
    }
    seen.add(hit.normalized);
    unique.push(hit);
  }

  if (unique.length !== 1) {
    return null;
  }

  return unique[0].normalized;
}

function normalizeWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function stripTrailingPunctuation(value) {
  return normalizeWhitespace(value).replace(/[.,;:]+$/g, "").trim();
}

function sanitizeAdvisorLabel(value) {
  const trimmed = stripTrailingPunctuation(value)
    .replace(/\b(?:Prof(?:essor)?|Dr)\.?\s+/gi, "")
    .replace(/\s+(?:at|from)\s+[A-Z][A-Za-z].*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!trimmed || trimmed.length < 4 || /^(?:dr|prof)$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function sanitizeSchoolLabel(value) {
  let trimmed = stripTrailingPunctuation(value)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

  trimmed = trimmed
    .replace(/,\s*(?:where|during|while|after|before)\b.*$/i, "")
    .replace(/\s+in\s+(19[5-9]\d|20[0-3]\d)\b.*$/i, "")
    .replace(/\s+\((?:19[5-9]\d|20[0-3]\d)\)\s*$/i, "")
    .replace(/\b(?:respectively|currently|presently)\b.*$/i, "")
    .trim();

  if (!trimmed || trimmed.length < 4 || trimmed.length > 120) {
    return null;
  }

  if (trimmed.split(/\s+/).length > 16) {
    return null;
  }

  if (
    /advisor|supervis|mentor|email:|@|award|accepted|paper|teach|open roles|faq|overview|transferring|press coverage|campuses|spring|summer|fall|\[[A-Z][a-z]{2}\s+\d{4}\]/i.test(
      trimmed
    )
  ) {
    return null;
  }

  if (
    !/\b(university|institute|college|school|polytechnic|academy|eth|epfl|iit|mit|cmu|utsa|wpi|asu|uc\b|ucla|upenn|nyu|ntu|nus|ustc)\b/i.test(
      trimmed
    )
  ) {
    return null;
  }

  return normalizeInstitution(trimmed, trimmed);
}

function detectProfileSignalsFromText(text) {
  const normalizedText = normalizeWhitespace(text);
  if (!normalizedText) {
    return { phdSchool: null, phdAdvisorLabel: null, phdGraduationYear: null };
  }

  const schoolPatterns = [
    /\b(?:earned|received|completed|obtained|defended)\s+(?:my|his|her|their|a)?\s*ph\.?d(?:[^.]{0,140})?\s+from\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended)\s+(?:my|his|her|their|a)?\s*ph\.?d(?:[^.]{0,140})?\s+at\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,140})?\s+from\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,140})?\s+at\s+([^.;]+)/i,
    /\bdoctor(?:ate|al degree)(?:[^.]{0,140})?\s+from\s+([^.;]+)/i,
    /\bdoctor(?:ate|al degree)(?:[^.]{0,140})?\s+at\s+([^.;]+)/i,
  ];
  const advisorPatterns = [
    /\b(?:earned|received|completed|obtained|defended)(?:[^.]{0,160})?\bph\.?d(?:[^.]{0,160})?\s+where\s+(?:i|he|she|they)\s+was\s+advised by\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended)(?:[^.]{0,160})?\bph\.?d(?:[^.]{0,160})?\s+where\s+(?:i|he|she|they)\s+worked with\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended)(?:[^.]{0,160})?\bph\.?d(?:[^.]{0,160})?\s+advised by\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended)(?:[^.]{0,160})?\bph\.?d(?:[^.]{0,160})?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended)(?:[^.]{0,160})?\bph\.?d(?:[^.]{0,160})?\s+under\s+(?:the\s+)?guidance of\s+([^.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended)(?:[^.]{0,160})?\bph\.?d(?:[^.]{0,160})?\s+advisors?\s+were\s+([^.;]+)/i,
    /\b(?:i|he|she|they)\s+(?:was|were)\s+advised by\s+([^.;]+)\s+at\s+[^.;]*\b(?:university|institute|college|school|polytechnic|eth|epfl|iit|mit|cmu)\b/i,
    /\bmy advisor\s+was\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,160})?\s+advised by\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,160})?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,160})?\s+advisors?\s+were\s+([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,80})?\badvisor[s]?:\s*([^.;]+)/i,
    /\bph\.?d(?:[^.]{0,80})?\bco-?advis(?:ed|or[s]?):\s*([^.;]+)/i,
    /\bph\.?d\.?\s+advisor\s+([^.;]+)/i,
    /\bdoctoral (?:degree|dissertation|thesis)(?:[^.]{0,160})?\s+advised by\s+([^.;]+)/i,
    /\bdoctoral (?:degree|dissertation|thesis)(?:[^.]{0,160})?\s+under\s+(?:the\s+)?supervision of\s+([^.;]+)/i,
  ];

  let phdSchool = null;
  let matchedSchoolContext = null;
  for (const pattern of schoolPatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const school = sanitizeSchoolLabel(match[1]);
      if (school) {
        matchedSchoolContext = match[0];
        phdSchool = school;
        break;
      }
    }
  }

  let phdAdvisorLabel = null;
  for (const pattern of advisorPatterns) {
    const match = normalizedText.match(pattern);
    if (match?.[1]) {
      const advisor = sanitizeAdvisorLabel(match[1]);
      if (
        advisor &&
        !/\b(?:ph\.?d|doctor|thesis|dissertation|computer science|engineering)\b/i.test(advisor)
      ) {
        phdAdvisorLabel = advisor;
        break;
      }
    }
  }

  let phdGraduationYear = null;
  const yearMatches = matchedSchoolContext?.match(/\b(19[5-9]\d|20[0-3]\d)\b/g);
  if (yearMatches?.length) {
    phdGraduationYear = Number(yearMatches[yearMatches.length - 1]);
  }

  return { phdSchool, phdAdvisorLabel, phdGraduationYear };
}

function detectProfileSignalsFromJson(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return { phdSchool: null, phdAdvisorLabel: null, phdGraduationYear: null };
  }

  const educationEntries = Array.isArray(parsed.education) ? parsed.education : [];
  const phdEntry = educationEntries.find((entry) =>
    /\bph\.?d\b|doctor/i.test(String(entry?.degree || ""))
  );
  if (!phdEntry) {
    return { phdSchool: null, phdAdvisorLabel: null, phdGraduationYear: null };
  }

  const institution = stripInlineMarkup(phdEntry.institution);
  const phdSchool = institution ? sanitizeSchoolLabel(institution) : null;
  const phdAdvisorLabel = phdEntry.advisor
    ? sanitizeAdvisorLabel(stripInlineMarkup(phdEntry.advisor))
    : null;
  const yearMatches = String(phdEntry.date || "").match(/\b(19[5-9]\d|20[0-3]\d)\b/g);
  const phdGraduationYear = yearMatches?.length ? Number(yearMatches[yearMatches.length - 1]) : null;

  return { phdSchool, phdAdvisorLabel, phdGraduationYear };
}

async function inspectHomepageCandidate(url, bucket) {
  const snapshot = await fetchAndCacheSnapshot(url, { bucket });
  const contentPath = path.join(cacheDirs.sourceSnapshots, snapshot.contentRelativePath);
  const rawContent = await readFile(contentPath, "utf8").catch(() => null);
  const isHtml =
    String(snapshot.contentType || "").toLowerCase().includes("text/html") ||
    contentPath.toLowerCase().endsWith(".html");
  const isJson =
    String(snapshot.contentType || "").toLowerCase().includes("application/json") ||
    contentPath.toLowerCase().endsWith(".json");
  const html = isHtml ? rawContent : null;
  const json = isJson && rawContent ? JSON.parse(rawContent) : null;
  const text = await readSnapshotText(snapshot);
  const affiliation = html ? detectHomepageAffiliation(html) : null;
  const textSignals = detectProfileSignalsFromText(text);
  const jsonSignals = detectProfileSignalsFromJson(json);
  const followups = html ? extractFollowupLinks(html, snapshot.finalUrl).slice(0, 5) : [];

  return {
    url,
    finalUrl: snapshot.finalUrl,
    contentType: snapshot.contentType,
    affiliation,
    followups,
    phdSchool: jsonSignals.phdSchool ?? textSignals.phdSchool,
    phdAdvisorLabel: jsonSignals.phdAdvisorLabel ?? textSignals.phdAdvisorLabel,
    phdGraduationYear: jsonSignals.phdGraduationYear ?? textSignals.phdGraduationYear,
  };
}

export async function resolveHomepageAffiliation(homepageLeads) {
  const candidates = homepageLeads.filter(isLikelyHomepageLead);
  for (const homepage of candidates) {
    try {
      const snapshot = await fetchAndCacheSnapshot(homepage, {
        bucket: "affiliation-homepage",
      });
      const contentPath = path.join(cacheDirs.sourceSnapshots, snapshot.contentRelativePath);
      const html = await readFile(contentPath, "utf8");
      const affiliation = detectHomepageAffiliation(html);
      if (affiliation) {
        return { affiliation, homepage };
      }

      const followups = extractFollowupLinks(html, snapshot.finalUrl).slice(0, 5);
      for (const followup of followups) {
        try {
          const followupSnapshot = await fetchAndCacheSnapshot(followup.href, {
            bucket: "affiliation-homepage-followup",
          });
          const followupPath = path.join(
            cacheDirs.sourceSnapshots,
            followupSnapshot.contentRelativePath
          );
          const followupHtml = await readFile(followupPath, "utf8");
          const followupAffiliation = detectHomepageAffiliation(followupHtml);
          if (followupAffiliation) {
            return { affiliation: followupAffiliation, homepage: followup.href };
          }
        } catch {}
      }
    } catch {}
  }

  return null;
}

export async function resolveHomepageProfileSignals(homepageLeads) {
  const candidates = homepageLeads.filter(isLikelyHomepageLead);

  for (const homepage of candidates) {
    try {
      const primary = await inspectHomepageCandidate(homepage, "profile-homepage");
      if (primary.phdSchool || primary.phdAdvisorLabel || primary.phdGraduationYear) {
        return {
          homepage: primary.finalUrl,
          affiliation: primary.affiliation,
          phdSchool: primary.phdSchool,
          phdAdvisorLabel: primary.phdAdvisorLabel,
          phdGraduationYear: primary.phdGraduationYear,
        };
      }

      for (const followup of primary.followups) {
        try {
          const inspected = await inspectHomepageCandidate(
            followup.href,
            "profile-homepage-followup"
          );
          if (inspected.phdSchool || inspected.phdAdvisorLabel || inspected.phdGraduationYear) {
            return {
              homepage: inspected.finalUrl,
              affiliation: inspected.affiliation ?? primary.affiliation,
              phdSchool: inspected.phdSchool,
              phdAdvisorLabel: inspected.phdAdvisorLabel,
              phdGraduationYear: inspected.phdGraduationYear,
            };
          }
        } catch {}
      }
    } catch {}
  }

  return null;
}

export function buildHomepageSource(homepage, affiliation) {
  return {
    kind: "homepage",
    url: homepage,
    confidence: "medium",
    note: `Homepage content indicates current affiliation ${affiliation}.`,
  };
}

function parseArgs(argv) {
  const options = {
    urls: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") {
      const value = argv[index + 1] ?? null;
      if (value) {
        options.urls.push(value);
      }
      index += 1;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.urls.length === 0) {
    throw new Error("Usage: node scripts/tools/homepage.mjs --url <homepage> [--url <followup> ...]");
  }

  const result = await resolveHomepageAffiliation(options.urls);
  console.log(JSON.stringify({ result }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

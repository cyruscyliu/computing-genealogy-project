import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { cacheDirs } from "../common/cache-paths.mjs";
import { normalizeInstitution } from "../common/institution-normalization.mjs";
import { normalizeName } from "../common/text-utils.mjs";
import { fetchAndCacheSnapshot } from "../common/source-snapshot-utils.mjs";

const require = createRequire(import.meta.url);
const execFile = promisify(execFileCallback);
const institutionAliasPairs = require("../common/institution-aliases.shared.js");
const institutionMentions = [...new Set(institutionAliasPairs.flat())]
  .filter(Boolean)
  .sort((left, right) => right.length - left.length);
const HOMEPAGE_CANDIDATE_CONCURRENCY = 2;
const HOMEPAGE_FOLLOWUP_CONCURRENCY = 1;
const HOMEPAGE_SNAPSHOT_TIMEOUT_MS = 12000;

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

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPersonNameMatchers(personName) {
  const normalizedPersonName = normalizeName(personName);
  const tokens = normalizedPersonName.split(" ").filter((token) => token.length >= 2);
  if (tokens.length === 0) {
    return null;
  }

  const surname = tokens[tokens.length - 1] ?? null;
  const givenTokens = tokens.slice(0, -1);
  const compactName = normalizedPersonName.replace(/\s+/g, "");
  return {
    normalizedPersonName,
    compactName,
    surname,
    givenTokens,
    matchesSurface(surface) {
      const normalizedSurface = normalizeName(surface);
      if (!normalizedSurface) {
        return false;
      }
      const compactSurface = normalizedSurface.replace(/\s+/g, "");
      if (compactName && compactSurface.includes(compactName)) {
        return true;
      }
      return Boolean(surname) && normalizedSurface.includes(surname) && givenTokens.some((token) => normalizedSurface.includes(token));
    },
    samePerson(otherName) {
      const otherNormalized = normalizeName(otherName);
      if (!otherNormalized) {
        return false;
      }
      if (otherNormalized === normalizedPersonName) {
        return true;
      }
      const otherCompact = otherNormalized.replace(/\s+/g, "");
      return compactName === otherCompact;
    },
  };
}

function scoreFollowupLink({ href, label, baseUrl, personName = null }) {
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
  const explicitProfileKeywords =
    /(^|[^a-z])(cv|vita|resume|bio|biography|profile)([^a-z]|$)|curriculum vitae|about me/i;
  const publicationLikePath =
    /(?:^|\/)(p|paper|papers|pub|pubs|publication|publications|talk|talks|slides|seminar|seminars)(?:\/|$)/i;
  const publicationLikeFile =
    /(^|[^a-z])(paper|papers|publication|publications|slides?|poster|preprint|draft|artifact|appendix|supplement|talk|seminar|lecture|proceedings)([^a-z]|$)/i;
  const baseDocument = `${base.origin}${base.pathname}${base.search}`;
  const targetDocument = `${url.origin}${url.pathname}${url.search}`;

  const isPdf = pathname.endsWith(".pdf");
  const sameHost = url.hostname === base.hostname;
  const sameRegistrableFamily =
    url.hostname === base.hostname ||
    url.hostname.endsWith(`.${base.hostname}`) ||
    base.hostname.endsWith(`.${url.hostname}`);
  const isSameDocument = targetDocument === baseDocument;
  const personMatchers = buildPersonNameMatchers(personName);

  let score = 0;

  if (!/^https?:$/i.test(url.protocol)) return null;
  if (isSameDocument) return null;
  if (/^(javascript:|mailto:|tel:)/i.test(href)) return null;
  if (
    /(youtube\.com|youtu\.be|twitter\.com|x\.com|facebook\.com|bsky\.app|researchgate\.net|dl\.acm\.org|openreview\.net|github\.com|linkedin\.com)/i.test(
      url.hostname
    )
  ) {
    return null;
  }
  if (publicationLikePath.test(pathname) || publicationLikeFile.test(combined)) {
    return null;
  }
  if (!normalizedLabel && !explicitProfileKeywords.test(basename)) {
    return null;
  }
  if (isPdf && !explicitProfileKeywords.test(combined)) {
    return null;
  }

  if (/(^|[^a-z])(cv|vita|resume)([^a-z]|$)/i.test(combined)) score += 120;
  if (/(curriculum vitae|biography|short bio|bio sketch)/i.test(combined)) score += 90;
  if (/^(about|about me|profile)$/i.test(normalizedLabel)) score += 70;
  if (/(^|[^a-z])(bio)([^a-z]|$)/i.test(combined)) score += 70;
  if (/(people|team|group|lab)/i.test(combined)) score += 20;
  if (/(faculty|staff|member|publications?)/i.test(combined)) score += 15;
  if (
    personMatchers &&
    personMatchers.matchesSurface(`${label} ${url.pathname} ${basename}`)
  ) {
    score += 105;
  }
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

function extractFollowupLinks(html, baseUrl, personName = null) {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const candidates = [];
  for (const match of matches) {
    const href = normalizeHref(baseUrl, match[1]);
    if (!href) continue;
    const label = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const scored = scoreFollowupLink({ href, label, baseUrl, personName });
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

function isAggregateProfilePage(finalUrl, title = "", description = "") {
  const surface = `${finalUrl ?? ""} ${title ?? ""} ${description ?? ""}`.toLowerCase();
  return /\b(people|team|group|lab|members|member|faculty|staff|students|directory|personnel)\b/.test(surface);
}

function pageMatchesPersonIdentity(finalUrl, title, description, text, personName = null) {
  if (!personName) {
    return true;
  }

  const personMatchers = buildPersonNameMatchers(personName);
  if (!personMatchers) {
    return true;
  }
  const urlText = (() => {
    try {
      const parsed = new URL(finalUrl);
      return `${parsed.hostname} ${parsed.pathname}`.replace(/[-_/]+/g, " ");
    } catch {
      return finalUrl ?? "";
    }
  })();

  const identitySurface = normalizeName(
    `${title ?? ""} ${description ?? ""} ${urlText} ${String(text ?? "").slice(0, 1200)}`
  );
  return personMatchers.matchesSurface(identitySurface);
}

function scoreHtmlProfileBlock(blockHtml, personName) {
  const personMatchers = buildPersonNameMatchers(personName);
  if (!personMatchers) {
    return null;
  }

  const blockText = stripHtmlToText(blockHtml);
  const normalizedBlockText = normalizeName(blockText);
  const rawSurface = normalizeName(blockHtml.replace(/<[^>]+>/g, " "));
  if (!personMatchers.matchesSurface(`${normalizedBlockText} ${rawSurface}`)) {
    return null;
  }

  const fullNamePattern = new RegExp(`(?:^|\\b)(?:dr\\s+)?${escapeRegex(personMatchers.normalizedPersonName)}(?:\\b|$)`, "i");
  const professorPattern = new RegExp(
    `\\b(?:advised by|supervised by|under (?:the )?(?:supervision|guidance|direction) of|advisor is|supervisor is)\\s+(?:prof(?:essor)?\\s+)?${escapeRegex(personMatchers.normalizedPersonName)}\\b`,
    "i"
  );
  const startsWithOwnName = fullNamePattern.test(normalizedBlockText.slice(0, Math.min(normalizedBlockText.length, 120)));
  const hasNameAnchor = new RegExp(
    `<a[^>]*>[\\s\\S]{0,80}?(?:Dr\\.?\\s+)?${escapeRegex(personName)}[\\s\\S]{0,80}?<\\/a>`,
    "i"
  ).test(blockHtml);

  let score = 0;
  if (startsWithOwnName) score += 180;
  if (hasNameAnchor) score += 120;
  if (personMatchers.compactName && normalizedBlockText.replace(/\s+/g, "").includes(personMatchers.compactName)) {
    score += 90;
  }
  if (/\b(?:ph\.?d|doctor(?:ate|al degree)|b\.?s\.?|m\.?s\.?)\b/i.test(blockText)) {
    score += 25;
  }
  if (/\b(?:professor|researcher|scientist|engineer|faculty|director|chair)\b/i.test(blockText)) {
    score += 15;
  }
  if (professorPattern.test(normalizedBlockText) && !startsWithOwnName) {
    score -= 170;
  }
  if (/\b(?:student|postdoc|postdoctoral)\b/i.test(blockText) && !startsWithOwnName) {
    score -= 45;
  }

  return {
    score,
    text: blockText,
  };
}

function extractScopedProfileText(html, finalUrl, title, description, personName = null) {
  if (!personName || !isAggregateProfilePage(finalUrl, title, description)) {
    return stripHtmlToText(html);
  }

  const blockPattern = /<(div|p|li|tr|section|article|td|h1|h2|h3)[^>]*>[\s\S]*?<\/\1>/gi;
  const blocks = [...html.matchAll(blockPattern)]
    .map((match) => scoreHtmlProfileBlock(match[0], personName))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score);

  if (blocks.length === 0 || blocks[0].score < 100) {
    return stripHtmlToText(html);
  }

  return blocks[0].text;
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
    .replace(/\bPh\.\s*D\./gi, "PhD")
    .replace(/\bM\.\s*A\./gi, "MA")
    .replace(/\bB\.\s*S\./gi, "BS")
    .replace(/\bProfs?\./gi, (match) => match.replace(/\./g, ""))
    .replace(/\bDr\./gi, "Dr")
    .replace(/([A-Za-z])(spent\b)/g, "$1 $2")
    .replace(/([A-Za-z])(followed by\b)/gi, "$1 $2")
    .replace(/([A-Za-z])(completed\b)/gi, "$1 $2")
    .replace(/([A-Za-z])(now\b)/gi, "$1 $2")
    .replace(/\b(?:Prof(?:essor)?|Dr)\.?\s+/gi, "")
    .replace(/\b(?:Profs?|Professors?|Drs?)\.?\s+/gi, "")
    .replace(
      /,\s+(?=[A-Z][A-Za-z.'()&-]+(?:\s+(?:[A-Z][A-Za-z.'()&-]+|of|at|the|for|and)){0,8}\s+(?:University|College|Institute|School|Laboratory|Lab|Center|Centre)\b).*$/i,
      ""
    )
    .replace(/\s+(?:at|from)\s+[A-Z][A-Za-z].*$/i, "")
    .replace(/\s+in\s+(19[5-9]\d|20[0-3]\d)\b.*$/i, "")
    .replace(/\s*,\s+and\s+(?=(?:ten\s+months|six\s+months|a\s+year|two\s+years|completed|followed by|spent|now\b))/i, "")
    .replace(/\s+and\s+(?=(?:ten\s+months|six\s+months|a\s+year|two\s+years|completed|followed by|spent|now\b))/i, "")
    .replace(/[;,]?\s+(?:followed by|and completed|and spent|spent|during|while|where|now\b|as well as)\b.*$/i, "")
    .replace(/\s+and\s+/g, "; ")
    .replace(/\s*;\s*/g, "; ")
    .replace(
      /\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?(?:\s+(19[5-9]\d|20[0-3]\d))?\s*$/i,
      ""
    )
    .replace(/\s+in\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(trimmed);
  if (
    !trimmed ||
    (!hasCjk && trimmed.length < 4) ||
    /^(?:dr|prof)$/i.test(trimmed) ||
    /\b[A-Z]$/.test(trimmed) ||
    /^(?:by|with|under)\b/i.test(trimmed) ||
    /\b(?:advisor|committee|student|students|faculty|postdoc|postdoctoral|visiting researcher|descendants|multiple students)\b/i.test(trimmed) ||
    /\b(19|20)\d{2}\b/.test(trimmed)
  ) {
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
    .replace(/^the\s+/i, "")
    .replace(/\s+with\s+(?:a\s+)?thesis\b.*$/i, "")
    .replace(/,\s*(?:where|during|while|after|before)\b.*$/i, "")
    .replace(/,\s*(?:advised by|supervised by|under (?:the )?(?:supervision|guidance) of)\b.*$/i, "")
    .replace(/\s+(?:advised by|supervised by|under (?:the )?(?:supervision|guidance) of)\b.*$/i, "")
    .replace(
      /\s+in\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19[5-9]\d|20[0-3]\d)\b.*$/i,
      ""
    )
    .replace(
      /,\s*(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(19[5-9]\d|20[0-3]\d)\b.*$/i,
      ""
    )
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

function extractPhdGraduationYearFromSentence(sentence) {
  if (!sentence) {
    return null;
  }

  const targetedPatterns = [
    /\bph\.?d(?:\s+degree)?(?:[^.]{0,120}?)\b(?:from|at)\b[^.]{0,120}?\bin\s+(19[5-9]\d|20[0-3]\d)\b/i,
    /\bph\.?d(?:\s+degree)?(?:[^.]{0,120}?)\b(?:from|at)\b[^.]{0,120}?,\s*(19[5-9]\d|20[0-3]\d)\b/i,
    /\b(?:received|earned|completed|obtained|defended)\b(?:[^.]{0,120}?)\bph\.?d(?:[^.]{0,120}?)\bin\s+(19[5-9]\d|20[0-3]\d)\b/i,
  ];
  for (const pattern of targetedPatterns) {
    const match = sentence.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }

  const phdIndex = sentence.search(/\bph\.?d\b/i);
  if (phdIndex >= 0) {
    const trailingYears = [...sentence.slice(phdIndex).matchAll(/\b(19[5-9]\d|20[0-3]\d)\b/g)];
    if (trailingYears.length > 0) {
      return Number(trailingYears[0][1]);
    }
  }

  const yearMatches = sentence.match(/\b(19[5-9]\d|20[0-3]\d)\b/g);
  return yearMatches?.length ? Number(yearMatches[0]) : null;
}

function detectProfileSignalsFromText(text) {
  const normalizedText = normalizeWhitespace(text)
    .replace(/\bPh\.\s*D\./gi, "PhD")
    .replace(/\bM\.\s*A\./gi, "MA")
    .replace(/\bB\.\s*S\./gi, "BS")
    .replace(/\bProfs?\./gi, (match) => match.replace(/\./g, ""))
    .replace(/\bDr\./gi, "Dr")
    .replace(/\b([A-Z])\.\s+(?=[A-Z][a-z])/g, "$1 ");
  if (!normalizedText) {
    return { phdSchool: null, phdAdvisorLabel: null, phdGraduationYear: null };
  }
  const sentences = normalizedText
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const selfPhdSentences = sentences
    .map((sentence, index) => ({ sentence, index }))
    .filter(({ sentence }) => {
    if (
      !/\bph\.?d\b|doctor(?:ate|al degree)|phd (?:student|candidate)/i.test(sentence)
    ) {
      return false;
    }
    if (
      /\b(?:during my ph\.?d|phd students|graduated phd|ta as a phd)\b/i.test(
        sentence
      )
    ) {
      return false;
    }
    return /\b(?:earned|received|completed|obtained|defended|hold(?:s)?|got|graduated|am|was|is)\b/i.test(
      sentence
    );
  });

  const schoolPatterns = [
    /\b(?:earned|received|completed|obtained|defended|hold(?:s)?|got|graduated)(?:[\s\S]{0,160}?)\bph\.?d(?:[\s\S]{0,160}?)\s+from\s+([^,.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended|hold(?:s)?|got|graduated)(?:[\s\S]{0,160}?)\bph\.?d(?:[\s\S]{0,160}?)\s+at\s+([^,.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended|hold(?:s)?|got|graduated)(?:[\s\S]{0,160}?)\bdoctoral (?:degree|dissertation|thesis)(?:[\s\S]{0,160}?)\s+from\s+([^,.;]+)/i,
    /\b(?:earned|received|completed|obtained|defended|hold(?:s)?|got|graduated)(?:[\s\S]{0,160}?)\bdoctoral (?:degree|dissertation|thesis)(?:[\s\S]{0,160}?)\s+at\s+([^,.;]+)/i,
    /\b(?:am|was|is)\s+(?:a\s+)?phd\s+(?:student|candidate)\s+(?:in|at)\s+([^,.;]+?)(?:\s*,?\s*(?:advised by|supervised by|under (?:the )?(?:supervision|guidance) of)\b|[.;]|$)/i,
    /\b(?:am|was|is)\s+(?:a\s+)?doctoral\s+(?:student|candidate)\s+(?:in|at)\s+([^,.;]+?)(?:\s*,?\s*(?:advised by|supervised by|under (?:the )?(?:supervision|guidance) of)\b|[.;]|$)/i,
  ];
  const advisorPatterns = [
    /\bmy\s+phd\s+advisor\s+is\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|[.!?;]|$)/i,
    /\bmy\s+advisor\s+is\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|[.!?;]|$)/i,
    /\bboth with\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|[.!?;]|$)/i,
    /\badvised by\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
    /\bsupervised by\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
    /\bunder\s+(?:the\s+)?supervision of\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
    /\bunder\s+(?:the\s+)?supervision of\s+[^.;]*?\badvisor,\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|[.!?;]|$)/i,
    /\bunder\s+(?:the\s+)?direction of\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
    /\bunder\s+(?:the\s+)?guidance of\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
    /\badvisors?\s+were\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
    /\bworking with\s+(.+?)(?:,\s+and\s+(?:completed|spent)\b|\s+and\s+(?:completed|spent)\b|;|$)/i,
  ];

  let matchedSentence = null;
  let matchedSentenceIndex = -1;
  let phdSchool = null;
  for (const { sentence, index } of selfPhdSentences) {
    for (const pattern of schoolPatterns) {
      const match = sentence.match(pattern);
      if (match?.[1]) {
        const school = sanitizeSchoolLabel(match[1]);
        if (school) {
          matchedSentence = sentence;
          matchedSentenceIndex = index;
          phdSchool = school;
          break;
        }
      }
    }
    if (phdSchool) {
      break;
    }
  }

  const advisorSentenceCandidates = matchedSentence
    ? [
        matchedSentence,
        sentences[matchedSentenceIndex - 1],
        sentences[matchedSentenceIndex + 1],
      ].filter(
        (sentence) =>
          sentence &&
          (/^(?:she|he|they|i|my)\b/i.test(sentence) ||
            /\b(?:my\s+advisor\s+is|my\s+phd\s+advisor\s+is|advised by|supervised by|under (?:the )?(?:supervision|guidance|direction) of|advisors? were|working with)\b/i.test(
              sentence
            ))
      )
    : selfPhdSentences.map(({ sentence }) => sentence);

  let phdAdvisorLabel = null;
  for (const sentence of advisorSentenceCandidates) {
    const sentenceForAdvisor = sentence
      .replace(/\b(?:later|afterwards?)\b[\s\S]*$/i, "")
      .replace(/\b(?:postdoc|postdoctoral|fellowship|internship|research assistant|researcher at)\b[\s\S]*$/i, "");
    for (const pattern of advisorPatterns) {
      const match = sentenceForAdvisor.match(pattern);
      if (match?.[1]) {
        const advisor = sanitizeAdvisorLabel(match[1]);
        if (
          advisor &&
          advisor !== phdSchool &&
          !/\b(?:ph\.?d|doctor|thesis|dissertation|computer science|engineering)\b/i.test(advisor)
        ) {
          phdAdvisorLabel = advisor;
          break;
        }
      }
    }
    if (phdAdvisorLabel) {
      break;
    }
  }

  if (!phdAdvisorLabel) {
    const firstPersonAdvisorPatterns = [
      /\bmy\s+phd\s+advisor\s+is\s+(.+?)(?:[.!?;]|$)/i,
      /\bmy\s+advisor\s+is\s+(.+?)(?:[.!?;]|$)/i,
      /\bi\s+was\s+advised\s+by\s+(.+?)(?:[.!?;]|$)/i,
      /\bi\s+was\s+supervised\s+by\s+(.+?)(?:[.!?;]|$)/i,
      /\bboth with\s+(.+?)(?:[.!?;]|$)/i,
    ];
    for (const pattern of firstPersonAdvisorPatterns) {
      const match = normalizedText.match(pattern);
      if (match?.[1]) {
        const advisor = sanitizeAdvisorLabel(match[1]);
        if (
          advisor &&
          advisor !== phdSchool &&
          !/\b(?:ph\.?d|doctor|thesis|dissertation|computer science|engineering)\b/i.test(advisor)
        ) {
          phdAdvisorLabel = advisor;
          break;
        }
      }
    }
  }

  const phdGraduationYear = extractPhdGraduationYearFromSentence(matchedSentence);

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

async function inspectHomepageCandidate(url, bucket, personName = null, signal = null) {
  const snapshot = await fetchAndCacheSnapshot(url, {
    bucket,
    timeoutMs: HOMEPAGE_SNAPSHOT_TIMEOUT_MS,
    signal,
  });
  if (signal?.aborted) {
    throw new Error("aborted");
  }
  const contentPath = path.join(cacheDirs.sourceSnapshots, snapshot.contentRelativePath);
  const rawContent = await readFile(contentPath, "utf8").catch(() => null);
  if (signal?.aborted) {
    throw new Error("aborted");
  }
  const isHtml =
    String(snapshot.contentType || "").toLowerCase().includes("text/html") ||
    contentPath.toLowerCase().endsWith(".html");
  const isJson =
    String(snapshot.contentType || "").toLowerCase().includes("application/json") ||
    contentPath.toLowerCase().endsWith(".json");
  const html = isHtml ? rawContent : null;
  const json = isJson && rawContent ? JSON.parse(rawContent) : null;
  const text = await readSnapshotText(snapshot);
  if (signal?.aborted) {
    throw new Error("aborted");
  }
  const affiliation = html ? detectHomepageAffiliation(html) : null;
  const { title, description } = html ? extractTitleAndDescription(html) : { title: "", description: "" };
  const profileText = html ? extractScopedProfileText(rawContent, snapshot.finalUrl, title, description, personName) : text;
  const identityMatched = pageMatchesPersonIdentity(
    snapshot.finalUrl,
    title,
    description,
    profileText,
    personName
  );
  const textSignals = identityMatched
    ? detectProfileSignalsFromText(profileText)
    : { phdSchool: null, phdAdvisorLabel: null, phdGraduationYear: null };
  const jsonSignals = detectProfileSignalsFromJson(json);
  const personMatchers = buildPersonNameMatchers(personName);
  const mergedAdvisorLabel = jsonSignals.phdAdvisorLabel ?? textSignals.phdAdvisorLabel;
  const safeAdvisorLabel =
    personMatchers?.samePerson(mergedAdvisorLabel) ? null : mergedAdvisorLabel;
  const followups = html ? extractFollowupLinks(html, snapshot.finalUrl, personName).slice(0, 3) : [];

  return {
    url,
    finalUrl: snapshot.finalUrl,
    contentType: snapshot.contentType,
    affiliation,
    identityMatched,
    followups,
    phdSchool: jsonSignals.phdSchool ?? textSignals.phdSchool,
    phdAdvisorLabel: safeAdvisorLabel,
    phdGraduationYear: jsonSignals.phdGraduationYear ?? textSignals.phdGraduationYear,
  };
}

async function findFirstMatchingAny(items, concurrency, worker, matches, signal = null) {
  if (items.length === 0) {
    return null;
  }

  const controllers = new Map();
  let nextIndex = 0;
  let active = 0;
  let settled = false;
  let completed = 0;

  return new Promise((resolve) => {
    const abortRemaining = () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
    const handleExternalAbort = () => {
      if (settled) {
        return;
      }
      settled = true;
      abortRemaining();
      resolve(null);
    };
    if (signal) {
      signal.addEventListener("abort", handleExternalAbort, { once: true });
      if (signal.aborted) {
        handleExternalAbort();
        return;
      }
    }

    const launchMore = () => {
      while (!settled && active < concurrency && nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        active += 1;
        const controller = new AbortController();
        controllers.set(currentIndex, controller);
        const workerSignal =
          signal && typeof AbortSignal.any === "function"
            ? AbortSignal.any([controller.signal, signal])
            : controller.signal;
        if (signal && typeof AbortSignal.any !== "function") {
          const relayAbort = () => controller.abort(signal.reason);
          signal.addEventListener("abort", relayAbort, { once: true });
        }

        Promise.resolve(worker(items[currentIndex], currentIndex, workerSignal))
          .then((result) => {
            if (!settled && result && matches(result)) {
              settled = true;
              abortRemaining();
              resolve(result);
              return;
            }
          })
          .catch(() => {
            return null;
          })
          .finally(() => {
            controllers.delete(currentIndex);
            active -= 1;
            completed += 1;
            if (!settled && completed >= items.length && active === 0) {
              settled = true;
              abortRemaining();
              resolve(null);
              return;
            }
            if (!settled) {
              launchMore();
            }
          });
      }
    };

    launchMore();
  });
}

async function inspectFollowups(firstPass, followupBucket, matches, selectResult, signal = null, personName = null) {
  return findFirstMatchingAny(
    firstPass.followups ?? [],
    HOMEPAGE_FOLLOWUP_CONCURRENCY,
    async (followup, _index, signal) =>
      inspectHomepageCandidate(followup.href, followupBucket, personName, signal),
    (inspected) => matches(inspected),
    signal
  ).then((inspected) => (inspected ? selectResult(inspected, firstPass) : null));
}

export async function resolveHomepageAffiliation(homepageLeads, signal = null) {
  const candidates = homepageLeads.filter(isLikelyHomepageLead);
  return findFirstMatchingAny(
    candidates,
    HOMEPAGE_CANDIDATE_CONCURRENCY,
    async (homepage, _index, signal) => {
      const primary = await inspectHomepageCandidate(homepage, "affiliation-homepage", signal);
      if (primary.affiliation) {
        return { affiliation: primary.affiliation, homepage: primary.finalUrl };
      }

      return inspectFollowups(
        primary,
        "affiliation-homepage-followup",
        (inspected) => Boolean(inspected.affiliation),
        (inspected) => ({
          affiliation: inspected.affiliation,
          homepage: inspected.finalUrl,
        }),
        signal
      );
    },
    (result) => Boolean(result?.affiliation),
    signal
  );
}

export async function resolveHomepageProfileSignals(homepageLeads, personName = null, signal = null) {
  const candidates = homepageLeads.filter(isLikelyHomepageLead);
  return findFirstMatchingAny(
    candidates,
    HOMEPAGE_CANDIDATE_CONCURRENCY,
    async (homepage, _index, signal) => {
      const primary = await inspectHomepageCandidate(homepage, "profile-homepage", personName, signal);
      const primaryResult = {
        homepage: primary.finalUrl,
        affiliation: primary.affiliation,
        phdSchool: primary.phdSchool,
        phdAdvisorLabel: primary.phdAdvisorLabel,
        phdGraduationYear: primary.phdGraduationYear,
      };
      const hasCompletePrimarySignals =
        Boolean(primary.phdSchool) &&
        Boolean(primary.phdAdvisorLabel) &&
        primary.phdGraduationYear != null;
      if (hasCompletePrimarySignals) {
        return primaryResult;
      }

      const followupMerge = await inspectFollowups(
        primary,
        "profile-homepage-followup",
        (inspected) =>
          Boolean(
            (!primary.phdSchool && inspected.phdSchool) ||
              (!primary.phdAdvisorLabel && inspected.phdAdvisorLabel) ||
              (primary.phdGraduationYear == null && inspected.phdGraduationYear != null)
          ),
        (inspected, firstPass) => ({
          homepage: inspected.finalUrl,
          affiliation: inspected.affiliation ?? firstPass.affiliation,
          phdSchool: firstPass.phdSchool ?? inspected.phdSchool,
          phdAdvisorLabel: firstPass.phdAdvisorLabel ?? inspected.phdAdvisorLabel,
          phdGraduationYear: firstPass.phdGraduationYear ?? inspected.phdGraduationYear,
        }),
        signal,
        personName
      );

      if (followupMerge) {
        return followupMerge;
      }

      if (primary.phdSchool || primary.phdAdvisorLabel || primary.phdGraduationYear) {
        return {
          ...primaryResult,
        };
      }

      return null;
    },
    (result) => Boolean(result?.phdSchool || result?.phdAdvisorLabel || result?.phdGraduationYear),
    signal
  );
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

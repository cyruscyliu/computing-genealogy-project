import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { appRoot, cacheDirs, ensureCacheDirs } from "../common/cache-paths.mjs";
import { withFileLock } from "../common/file-lock.mjs";
import { fetchWithTimeout } from "../common/http-utils.mjs";
import { normalizeInstitution } from "../common/institution-normalization.mjs";
import { normalizePeopleRawSchema, normalizePersonRawSchema } from "../common/raw-schema-normalization.mjs";

export const rawDir = path.join(appRoot, "data", "raw");
export const mgpActiveDir = path.join(cacheDirs.discovery, "mgp-active");
export const mgpCrosscheckJsonlPath = path.join(cacheDirs.discovery, "mgp-active-crosscheck.jsonl");
export const mgpStatePath = path.join(cacheDirs.discovery, "mgp-active-state.json");
export const mgpEnrichCandidatesPath = path.join(cacheDirs.discovery, "mgp-enrich-candidates.jsonl");
export const mgpEnrichSummaryPath = path.join(cacheDirs.discovery, "mgp-enrich-summary.json");

const mgpBaseUrl = "https://www.genealogy.math.ndsu.nodak.edu";
const execFile = promisify(execFileCallback);
const mgpCacheDir = path.join(cacheDirs.discovery, "mgp");
const require = createRequire(import.meta.url);
const personNameAliases = new Map(require("../../person-name-aliases.shared.js"));
const { normalizeAdvisorLabelValue } = require("../../advisor-labels.shared.js");

function parseArgs(argv) {
  const options = {
    command: "lookup",
    personId: null,
    name: null,
    mgpId: null,
    json: false,
    force: false,
    limit: 25,
    offset: 0,
    delayMs: 1500,
    resume: false,
    status: "active",
    ids: [],
    onlyActionable: true,
    apply: false,
    concurrency: 16,
    jsonlPath: mgpEnrichCandidatesPath,
    summaryPath: mgpEnrichSummaryPath,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--") && index === 0) {
      options.command = arg;
      continue;
    }
    if (arg === "--person-id") {
      options.personId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--name") {
      options.name = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--mgp-id" || arg === "--id") {
      options.mgpId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] ?? options.limit);
      index += 1;
      continue;
    }
    if (arg === "--offset") {
      options.offset = Number(argv[index + 1] ?? options.offset);
      index += 1;
      continue;
    }
    if (arg === "--delay-ms") {
      options.delayMs = Number(argv[index + 1] ?? options.delayMs);
      index += 1;
      continue;
    }
    if (arg === "--status") {
      options.status = argv[index + 1] ?? options.status;
      index += 1;
      continue;
    }
    if (arg === "--resume") {
      options.resume = true;
      continue;
    }
    if (arg === "--all") {
      options.onlyActionable = false;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--concurrency") {
      options.concurrency = Math.max(1, Number(argv[index + 1] ?? options.concurrency) || options.concurrency);
      index += 1;
      continue;
    }
    if (arg === "--jsonl") {
      options.jsonlPath = argv[index + 1] ?? options.jsonlPath;
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      options.summaryPath = argv[index + 1] ?? options.summaryPath;
      index += 1;
      continue;
    }
    if (arg === "--id") {
      const value = argv[index + 1] ?? null;
      if (options.command === "lookup" && !options.mgpId) {
        options.mgpId = value;
      } else if (value) {
        options.ids.push(value);
      }
      index += 1;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
  }

  return options;
}

function normalizeName(value) {
  const aliased = personNameAliases.get(value ?? "") ?? value ?? "";
  return aliased
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function expandNameVariants(value, extraAliases = []) {
  const variants = [value, ...(extraAliases || [])].filter(Boolean);
  const expanded = [];
  for (const variant of variants) {
    expanded.push(variant);
    const canonical = personNameAliases.get(variant);
    if (canonical) {
      expanded.push(canonical);
    }
  }
  return [...new Set(expanded.map((item) => item.trim()).filter(Boolean))];
}

function tokenizeName(value) {
  return normalizeName(value)
    .replace(/[.-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function splitNameVariants(value) {
  const tokens = tokenizeName(value);
  if (tokens.length === 0) {
    return [];
  }
  if (tokens.length === 1) {
    return [{ given: [], family: tokens[0] }];
  }

  return [
    { given: tokens.slice(0, -1), family: tokens.at(-1) },
    { given: tokens.slice(1), family: tokens[0] },
  ];
}

function givenTokensCompatible(shorter, longer) {
  if (shorter.length > longer.length) {
    return false;
  }
  return shorter.every((token, index) => token === longer[index]);
}

export function namesLikelySamePerson(left, right) {
  for (const leftVariant of expandNameVariants(left)) {
    for (const rightVariant of expandNameVariants(right)) {
      const leftVariants = splitNameVariants(leftVariant);
      const rightVariants = splitNameVariants(rightVariant);

      if (leftVariants.length === 0 || rightVariants.length === 0) {
        continue;
      }

      for (const leftName of leftVariants) {
        for (const rightName of rightVariants) {
          if (leftName.family !== rightName.family) {
            continue;
          }

          const leftGiven = leftName.given;
          const rightGiven = rightName.given;
          const [shorter, longer] =
            leftGiven.length <= rightGiven.length ? [leftGiven, rightGiven] : [rightGiven, leftGiven];

          if (givenTokensCompatible(shorter, longer)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function shortHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function ensureMgpCacheDir() {
  await ensureCacheDirs();
  await mkdir(mgpCacheDir, { recursive: true });
}

function searchCachePath(name) {
  return path.join(mgpCacheDir, `search-${shortHash(normalizeName(name))}.json`);
}

function searchHtmlCachePath(name) {
  return path.join(mgpCacheDir, `search-${shortHash(normalizeName(name))}.html`);
}

function profileCachePath(mgpId) {
  return path.join(mgpCacheDir, `profile-${mgpId}.json`);
}

function profileHtmlCachePath(mgpId) {
  return path.join(mgpCacheDir, `profile-${mgpId}.html`);
}

export async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function dedupeBy(items, keyBuilder) {
  const seen = new Set();
  const results = [];
  for (const item of items) {
    const key = keyBuilder(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(item);
  }
  return results;
}

function splitName(fullName) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { given: "", family: "" };
  }
  if (parts.length === 1) {
    return { given: parts[0], family: "" };
  }
  return {
    given: parts.slice(0, -1).join(" "),
    family: parts.at(-1),
  };
}

export async function loadPeopleArray() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const people = [];

  for (const fileName of files) {
    const parsed = normalizePeopleRawSchema(JSON.parse(await readFile(path.join(rawDir, fileName), "utf8")));
    for (const person of parsed) {
      people.push({
        ...person,
        _file: fileName,
      });
    }
  }

  return people;
}

export async function loadPeopleMap() {
  const people = await loadPeopleArray();
  return new Map(people.map((person) => [person.id, person]));
}

async function fetchText(url, options = {}) {
  const response = await fetchWithTimeout(url, {
    method: options.method ?? "GET",
    headers: {
      "user-agent": "computing-genealogy-project/mgp-tool",
      accept: "text/html,application/xhtml+xml",
      ...(options.headers ?? {}),
    },
    body: options.body,
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} for ${url}`);
  }

  return response.text();
}

export async function searchMgpByName(name, options = {}) {
  await ensureMgpCacheDir();
  const cachePath = searchCachePath(name);
  const htmlCachePath = searchHtmlCachePath(name);
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath);
    if (cached) {
      return cached.results ?? [];
    }
  }

  let html = null;
  if (!options.force) {
    try {
      html = await readFile(htmlCachePath, "utf8");
    } catch {
      html = null;
    }
  }

  if (html == null) {
    const { given, family } = splitName(name);
    const form = new URLSearchParams({
      given_name: given,
      other_names: "",
      family_name: family,
      school: "",
      year: "",
      thesis: "",
      country: "",
      chrono: "0",
    });

    const cookieJar = path.join(mgpCacheDir, "mgp-search.cookies");
    await execFile("curl", ["-L", "-s", `${mgpBaseUrl}/search.php`, "-c", cookieJar], {
      cwd: appRoot,
      timeout: 12000,
    });
    const response = await execFile(
      "curl",
      [
        "-L",
        "-s",
        "--connect-timeout",
        "4",
        "--max-time",
        "10",
        "-b",
        cookieJar,
        "-c",
        cookieJar,
        "-X",
        "POST",
        `${mgpBaseUrl}/query-prep.php`,
        "-H",
        "Content-Type: application/x-www-form-urlencoded",
        "-H",
        `Origin: ${mgpBaseUrl}`,
        "-H",
        `Referer: ${mgpBaseUrl}/search.php`,
        "--data",
        form.toString(),
      ],
      { cwd: appRoot, maxBuffer: 10 * 1024 * 1024, timeout: 12000 },
    );
    html = response.stdout;
    await writeFile(htmlCachePath, html, "utf8");
  }

  const rows = [...html.matchAll(/<tr><td><a href="id\.php\?id=(\d+)">([\s\S]*?)<\/a><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td><\/tr>/g)];
  const results = rows.map((match) => ({
    mgpId: match[1],
    name: stripTags(match[2]),
    school: stripTags(match[3]),
    year: stripTags(match[4]),
    profileUrl: `${mgpBaseUrl}/id.php?id=${match[1]}`,
  }));

  await writeFile(
    cachePath,
    `${JSON.stringify({ queriedName: name, fetchedAt: new Date().toISOString(), results }, null, 2)}\n`,
    "utf8",
  );
  return results;
}

function parseMgpProfileHtml(html, mgpId) {
  const titleMatch = html.match(/<h2[^>]*>\s*([\s\S]*?)<\/h2>/i);
  const degreeMatch = html.match(/Ph\.D\.\s*<span[^>]*>\s*([\s\S]*?)<\/span>\s*([0-9]{4})/i);
  const thesisMatch = html.match(/<span style="font-style:italic" id="thesisTitle">\s*([\s\S]*?)<\/span>/i);

  const paragraphs = [...html.matchAll(/<p[^>]*>[\s\S]*?<\/p>/gi)].map((match) => match[0]);
  const advisorParagraphs = paragraphs.filter((block) => /Advisor(?:s|\s+\d+)?\s*:/i.test(block));
  const advisors = dedupeBy(advisorParagraphs.flatMap((block) => {
    const normalizedBlock = block.replace(/<br\s*\/?>/gi, "\n");
    return [...normalizedBlock.matchAll(/id\.php\?id=(\d+)">([\s\S]*?)<\/a>/g)].map((entry) => ({
      mgpId: entry[1],
      name: stripTags(entry[2]),
      profileUrl: `${mgpBaseUrl}/id.php?id=${entry[1]}`,
    }));
  }), (entry) => entry.mgpId || normalizeName(entry.name));

  const studentsTableMatch = html.match(/<table[^>]*>\s*<tr><th>Name<\/th><th>School<\/th><th>Year<\/th><th>Descendants<\/th><\/tr>([\s\S]*?)<\/table>/i);
  const students = studentsTableMatch
    ? [...studentsTableMatch[1].matchAll(/<tr[^>]*><td><a href="id\.php\?id=(\d+)">([\s\S]*?)<\/a><\/td><td>([\s\S]*?)<\/td><td[^>]*>([\s\S]*?)<\/td><td[^>]*>([\s\S]*?)<\/td><\/tr>/g)].map((match) => ({
        mgpId: match[1],
        name: stripTags(match[2]),
        school: stripTags(match[3]),
        year: stripTags(match[4]),
        descendants: stripTags(match[5]) || null,
        profileUrl: `${mgpBaseUrl}/id.php?id=${match[1]}`,
      }))
    : [];

  return {
    mgpId: String(mgpId),
    profileUrl: `${mgpBaseUrl}/id.php?id=${mgpId}`,
    name: titleMatch ? stripTags(titleMatch[1]) : null,
    phdSchool: degreeMatch ? stripTags(degreeMatch[1]) : null,
    phdYear: degreeMatch ? degreeMatch[2] : null,
    thesisTitle: thesisMatch ? stripTags(thesisMatch[1]) : null,
    advisors,
    students,
  };
}

export async function fetchMgpProfile(mgpId, options = {}) {
  await ensureMgpCacheDir();
  const cachePath = profileCachePath(mgpId);
  const htmlCachePath = profileHtmlCachePath(mgpId);

  let html = null;
  if (!options.force) {
    try {
      html = await readFile(htmlCachePath, "utf8");
    } catch {
      html = null;
    }
  }
  if (html == null && !options.force) {
    const cached = await readJsonIfExists(cachePath);
    if (cached) {
      return cached.profile ?? cached;
    }
  }
  if (html == null) {
    html = await fetchText(`${mgpBaseUrl}/id.php?id=${mgpId}`);
    await writeFile(htmlCachePath, html, "utf8");
  }

  const profile = parseMgpProfileHtml(html, mgpId);

  await writeFile(
    cachePath,
    `${JSON.stringify({ fetchedAt: new Date().toISOString(), profile }, null, 2)}\n`,
    "utf8",
  );
  return profile;
}

function matchPeopleByName(people, targetName) {
  if (!normalizeName(targetName)) {
    return [];
  }

  return people
    .filter(
      (person) =>
        namesLikelySamePerson(person.name, targetName) ||
        person.aliases?.some((alias) => namesLikelySamePerson(alias, targetName)),
    )
    .map((person) => ({
      id: person.id,
      name: person.name,
      institution: person.work?.institution ?? null,
      trackingStatus: person.tracking?.status ?? null,
      file: person._file,
    }));
}

export async function lookupMgpSearchMatchForPerson(person, options = {}) {
  const queryName = person?.name;
  const queryAliases = person?.aliases ?? [];
  if (!queryName) {
    throw new Error("lookupMgpSearchMatchForPerson requires person.name");
  }

  const queryVariants = expandNameVariants(queryName, queryAliases);
  const matchedProfiles = new Map();
  for (const variant of queryVariants) {
    const searchResults = await searchMgpByName(variant, { force: options.force });
    const safeMatches = searchResults.filter((result) =>
      queryVariants.some((candidate) => namesLikelySamePerson(candidate, result.name)),
    );

    for (const match of safeMatches) {
      matchedProfiles.set(match.mgpId, match);
    }

    if (matchedProfiles.size === 1) {
      const [onlyMatch] = matchedProfiles.values();
      return onlyMatch;
    }
  }

  if (matchedProfiles.size === 1) {
    const [onlyMatch] = matchedProfiles.values();
    return onlyMatch;
  }

  return null;
}

export async function lookupMgpProfileForPerson(person, options = {}) {
  const match = await lookupMgpSearchMatchForPerson(person, options);
  if (!match) {
    return null;
  }
  return fetchMgpProfile(match.mgpId, { force: options.force });
}

export async function buildPayload(options) {
  const people = await loadPeopleArray();

  let queryName = options.name;
  let queryAliases = [];
  if (options.personId) {
    const person = people.find((entry) => entry.id === options.personId);
    if (!person) {
      throw new Error(`No dataset record found for id ${options.personId}`);
    }
    queryName = person.name;
    queryAliases = person.aliases ?? [];
  }

  let searchResults = [];
  let selectedProfile = null;

  if (options.mgpId) {
    selectedProfile = await fetchMgpProfile(options.mgpId, { force: options.force });
  } else {
    if (!queryName) {
      throw new Error("Pass one of --person-id, --name, or --mgp-id.");
    }
    const queryVariants = expandNameVariants(queryName, queryAliases);
    const matchedProfiles = new Map();
    for (const variant of queryVariants) {
      searchResults = await searchMgpByName(variant, { force: options.force });
      const safeMatches = searchResults.filter((result) =>
        queryVariants.some((candidate) => namesLikelySamePerson(candidate, result.name)),
      );

      for (const match of safeMatches) {
        matchedProfiles.set(match.mgpId, match);
      }

      if (matchedProfiles.size === 1) {
        const [onlyMatch] = matchedProfiles.values();
        selectedProfile = await fetchMgpProfile(onlyMatch.mgpId, { force: options.force });
      }
    }
    if (!selectedProfile && matchedProfiles.size === 1) {
      const [onlyMatch] = matchedProfiles.values();
      selectedProfile = await fetchMgpProfile(onlyMatch.mgpId, { force: options.force });
    }
    if (!selectedProfile && matchedProfiles.size > 0) {
      searchResults = [...matchedProfiles.values()];
    }
  }

  const selectedMatches = selectedProfile
    ? {
        person: matchPeopleByName(people, selectedProfile.name),
        advisors: selectedProfile.advisors.map((advisor) => ({
          ...advisor,
          matches: matchPeopleByName(people, advisor.name),
        })),
        students: selectedProfile.students.map((student) => ({
          ...student,
          matches: matchPeopleByName(people, student.name),
        })),
      }
    : null;

  return {
    query: {
      personId: options.personId,
      name: queryName,
      mgpId: options.mgpId,
    },
    searchResults: searchResults.map((result) => ({
      ...result,
      matches: matchPeopleByName(people, result.name),
    })),
    profile: selectedProfile,
    datasetCrosscheck: selectedMatches,
  };
}

function printPayload(payload) {
  if (payload.query.name) {
    console.log(`Query: ${payload.query.name}`);
  } else if (payload.query.mgpId) {
    console.log(`Query MGP id: ${payload.query.mgpId}`);
  }

  if (payload.searchResults.length > 0) {
    console.log(`Search results: ${payload.searchResults.length}`);
    for (const result of payload.searchResults) {
      const local = result.matches.length > 0
        ? ` | dataset: ${result.matches.map((match) => `${match.name} [${match.id}]`).join("; ")}`
        : "";
      console.log(`- ${result.name} | ${result.school} | ${result.year} | MGP ${result.mgpId}${local}`);
    }
  }

  if (!payload.profile) {
    return;
  }

  console.log("");
  console.log(`Selected profile: ${payload.profile.name} (MGP ${payload.profile.mgpId})`);
  console.log(`PhD: ${payload.profile.phdSchool ?? "(unknown)"} ${payload.profile.phdYear ?? ""}`.trim());
  if (payload.profile.thesisTitle) {
    console.log(`Thesis: ${payload.profile.thesisTitle}`);
  }

  const matchedPerson = payload.datasetCrosscheck?.person ?? [];
  if (matchedPerson.length > 0) {
    console.log(`Dataset matches: ${matchedPerson.map((match) => `${match.name} [${match.id}]`).join("; ")}`);
  }

  console.log("Advisors:");
  if ((payload.datasetCrosscheck?.advisors?.length ?? 0) === 0) {
    console.log("- none");
  } else {
    for (const advisor of payload.datasetCrosscheck.advisors) {
      const local = advisor.matches.length > 0
        ? ` | dataset: ${advisor.matches.map((match) => `${match.name} [${match.id}]`).join("; ")}`
        : "";
      console.log(`- ${advisor.name} (MGP ${advisor.mgpId})${local}`);
    }
  }

  console.log("Students:");
  if ((payload.datasetCrosscheck?.students?.length ?? 0) === 0) {
    console.log("- none");
  } else {
    for (const student of payload.datasetCrosscheck.students) {
      const local = student.matches.length > 0
        ? ` | dataset: ${student.matches.map((match) => `${match.name} [${match.id}]`).join("; ")}`
        : "";
      console.log(`- ${student.name} | ${student.school} | ${student.year} | MGP ${student.mgpId}${local}`);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => worker()),
  );
  return results;
}

function summarizePayload(payload) {
  return {
    query: payload.query,
    selectedMgpId: payload.profile?.mgpId ?? null,
    selectedName: payload.profile?.name ?? null,
    phdSchool: payload.profile?.phdSchool ?? null,
    phdYear: payload.profile?.phdYear ?? null,
    advisorCount: payload.profile?.advisors?.length ?? 0,
    studentCount: payload.profile?.students?.length ?? 0,
    datasetMatches: payload.datasetCrosscheck?.person ?? [],
    advisorMatches:
      payload.datasetCrosscheck?.advisors?.filter((entry) => entry.matches.length > 0).map((entry) => ({
        name: entry.name,
        mgpId: entry.mgpId,
        matches: entry.matches,
      })) ?? [],
    studentMatches:
      payload.datasetCrosscheck?.students?.filter((entry) => entry.matches.length > 0).map((entry) => ({
        name: entry.name,
        mgpId: entry.mgpId,
        year: entry.year,
        matches: entry.matches,
      })) ?? [],
  };
}

function currentStageSnapshot(person) {
  return {
    undergraduate: person.stages?.undergraduate?.school ?? null,
    masters: person.stages?.masters?.school ?? null,
    phdSchool: person.stages?.phd?.school ?? null,
    phdAdvisor: person.stages?.phd?.advisorLabel ?? null,
    postdocSchool: person.stages?.postdoc?.school ?? null,
    postdocAdvisor: person.stages?.postdoc?.advisorLabel ?? null,
  };
}

function buildCandidate(record, person) {
  const profile = record.payload?.profile ?? null;
  const advisors = profile?.advisors?.map((entry) => entry.name).filter(Boolean) ?? [];
  const students = profile?.students?.map((entry) => entry.name).filter(Boolean) ?? [];
  const current = currentStageSnapshot(person);
  const safeNameMatch = profile?.name ? namesLikelySamePerson(person.name, profile.name) : false;
  const normalizedPhdSchool = profile?.phdSchool ? normalizeInstitution(profile.phdSchool, profile.phdSchool) : null;
  const advisorLabel = normalizeAdvisorLabelValue(advisors.join("; "));

  const suggestions = [];
  if (safeNameMatch && !current.phdSchool && normalizedPhdSchool) {
    suggestions.push({
      field: "stages.phd.school",
      value: normalizedPhdSchool,
      source: profile.profileUrl,
      rationale: "MGP lists a PhD school while the dataset currently has no PhD school.",
    });
  }
  if (safeNameMatch && !current.phdAdvisor && advisorLabel) {
    suggestions.push({
      field: "stages.phd.advisorLabel",
      value: advisorLabel,
      source: profile.profileUrl,
      rationale: "MGP lists named PhD advisors while the dataset currently has no PhD advisor label.",
    });
  }
  if ((record.summary?.advisorMatches?.length ?? 0) > 0) {
    suggestions.push({
      field: "crosscheck.advisors",
      value: record.summary.advisorMatches,
      source: profile?.profileUrl ?? null,
      rationale: "MGP advisor names already match modeled people in the local dataset.",
    });
  }
  if ((record.summary?.studentMatches?.length ?? 0) > 0) {
    suggestions.push({
      field: "crosscheck.students",
      value: record.summary.studentMatches,
      source: profile?.profileUrl ?? null,
      rationale: "MGP student names already match modeled people in the local dataset.",
    });
  }

  return {
    id: person.id,
    name: person.name,
    trackingStatus: person.tracking?.status ?? null,
    workInstitution: person.work?.institution ?? null,
    file: person._file,
    mgp: {
      mgpId: profile?.mgpId ?? null,
      name: profile?.name ?? null,
      phdSchool: profile?.phdSchool ?? null,
      normalizedPhdSchool,
      phdYear: profile?.phdYear ?? null,
      thesisTitle: profile?.thesisTitle ?? null,
      advisors,
      students,
      profileUrl: profile?.profileUrl ?? null,
      safeNameMatch,
    },
    current,
    suggestions,
    actionable: suggestions.length > 0,
  };
}

async function loadMgpRecords(concurrency) {
  const fileNames = (await readdir(mgpActiveDir)).filter((name) => name.endsWith(".json")).sort();
  return mapWithConcurrency(fileNames, concurrency, async (fileName) =>
    JSON.parse(await readFile(path.join(mgpActiveDir, fileName), "utf8")),
  );
}

async function loadRawFiles(concurrency) {
  const fileNames = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const files = new Map();
  const loaded = await mapWithConcurrency(fileNames, concurrency, async (fileName) => {
    const filePath = path.join(rawDir, fileName);
    return {
      fileName,
      filePath,
      people: JSON.parse(await readFile(filePath, "utf8")),
    };
  });
  for (const entry of loaded) {
    files.set(entry.fileName, {
      path: entry.filePath,
      people: entry.people,
    });
  }

  return files;
}

function ensureMgpSource(person, candidate) {
  person.sources ??= [];
  const sourceUrl = candidate.mgp.profileUrl;
  if (!sourceUrl) {
    return;
  }

  const existing = person.sources.find((entry) => entry.url === sourceUrl);
  if (existing) {
    return;
  }

  person.sources.push({
    kind: "genealogy",
    url: sourceUrl,
    confidence: "high",
    note: "Mathematics Genealogy Project cached profile used to populate missing PhD lineage fields.",
  });
}

function applyCandidateToPerson(person, candidate) {
  let changed = false;
  if (!candidate.mgp.safeNameMatch) {
    return changed;
  }
  person.stages ??= {};
  person.stages.phd ??= {
    school: null,
    graduationYear: null,
    advisorPersonId: null,
    advisorLabel: null,
    status: null,
    note: null,
  };

  const phdStage = person.stages.phd;

  if (!phdStage.school && candidate.mgp.normalizedPhdSchool) {
    phdStage.school = candidate.mgp.normalizedPhdSchool;
    phdStage.note = `Mathematics Genealogy Project lists ${candidate.mgp.normalizedPhdSchool} as the PhD school${candidate.mgp.phdYear ? ` (${candidate.mgp.phdYear})` : ""}.`;
    changed = true;
  }

  if (phdStage.graduationYear == null && candidate.mgp.phdYear) {
    phdStage.graduationYear = Number(candidate.mgp.phdYear);
    changed = true;
  }

  if (!phdStage.advisorLabel && candidate.mgp.advisors.length > 0) {
    phdStage.advisorLabel = normalizeAdvisorLabelValue(candidate.mgp.advisors.join("; "));
    phdStage.note = phdStage.note
      ? `${phdStage.note} Mathematics Genealogy Project also lists advisor(s): ${phdStage.advisorLabel}.`
      : `Mathematics Genealogy Project lists advisor(s): ${phdStage.advisorLabel}.`;
    changed = true;
  }

  if (changed) {
    if (!phdStage.status) {
      phdStage.status = "PhD";
    }
    ensureMgpSource(person, candidate);
    if (person.tracking?.status === "seed") {
      person.tracking.status = "active";
      person.tracking.note = "MGP apply filled missing PhD lineage fields from cached Mathematics Genealogy Project results.";
    }
  }

  return changed;
}

async function applyCandidates(candidates, concurrency) {
  const rawFiles = await loadRawFiles(concurrency);
  const changedPeople = [];
  const changedFiles = new Set();

  for (const candidate of candidates) {
    if (!candidate.actionable) {
      continue;
    }
    const file = rawFiles.get(candidate.file);
    if (!file) {
      continue;
    }
    const person = file.people.find((entry) => entry.id === candidate.id);
    if (!person) {
      continue;
    }

    if (applyCandidateToPerson(person, candidate)) {
      normalizePersonRawSchema(person);
      changedPeople.push({ id: candidate.id, name: candidate.name, file: candidate.file });
      changedFiles.add(candidate.file);
    }
  }

  await withFileLock("data-raw-writer", async () => {
    for (const fileName of changedFiles) {
      const file = rawFiles.get(fileName);
      normalizePeopleRawSchema(file.people);
      await writeFile(file.path, `${JSON.stringify(file.people, null, 2)}\n`, "utf8");
    }
  });

  return { changedPeople, changedFiles: [...changedFiles] };
}

async function runLookup(options) {
  const payload = await buildPayload(options);
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  printPayload(payload);
}

async function runScanActive(options) {
  await ensureCacheDirs();
  await mkdir(mgpActiveDir, { recursive: true });

  const allPeople = await loadPeopleArray();
  let selected = allPeople.filter((person) => person.tracking?.status === options.status);
  if (options.ids.length > 0) {
    const wanted = new Set(options.ids);
    selected = allPeople.filter((person) => wanted.has(person.id));
  }

  selected.sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));

  let startIndex = options.offset;
  if (options.resume) {
    const state = await readJsonIfExists(mgpStatePath);
    if (state?.nextIndex != null) {
      startIndex = state.nextIndex;
    }
  }

  const batch = selected.slice(startIndex, startIndex + options.limit);
  console.log(`Scanning ${batch.length} profiles starting at index ${startIndex} with delay ${options.delayMs}ms`);

  for (let index = 0; index < batch.length; index += 1) {
    const person = batch[index];
    const absoluteIndex = startIndex + index;
    const cachePath = path.join(mgpActiveDir, `${person.id}.json`);

    if (!options.force) {
      const cached = await readJsonIfExists(cachePath);
      if (cached) {
        console.log(`[skip] ${person.name} [${person.id}] cached`);
        continue;
      }
    }

    const payload = await buildPayload({ personId: person.id, force: options.force });
    const record = {
      id: person.id,
      name: person.name,
      workInstitution: person.work?.institution ?? null,
      trackingStatus: person.tracking?.status ?? null,
      scannedAt: new Date().toISOString(),
      payload,
      summary: summarizePayload(payload),
    };

    await writeFile(cachePath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await appendFile(mgpCrosscheckJsonlPath, `${JSON.stringify(record.summary)}\n`, "utf8");
    await writeFile(
      mgpStatePath,
      `${JSON.stringify({ nextIndex: absoluteIndex + 1, updatedAt: new Date().toISOString() }, null, 2)}\n`,
      "utf8",
    );

    console.log(`[ok] ${person.name} [${person.id}] -> ${record.summary.selectedMgpId ?? "no unique profile"}`);

    if (index < batch.length - 1 && options.delayMs > 0) {
      await sleep(options.delayMs);
    }
  }
}

async function runEnrichCache(options) {
  await ensureCacheDirs();
  await mkdir(path.dirname(options.jsonlPath), { recursive: true });
  await mkdir(path.dirname(options.summaryPath), { recursive: true });

  const people = await loadPeopleMap();
  const mgpRecords = await loadMgpRecords(options.concurrency);
  const wanted = options.ids.length > 0 ? new Set(options.ids) : null;

  let candidates = await mapWithConcurrency(
    mgpRecords.filter((record) => people.has(record.id)).filter((record) => !wanted || wanted.has(record.id)),
    options.concurrency,
    async (record) => buildCandidate(record, people.get(record.id)),
  );

  if (options.onlyActionable) {
    candidates = candidates.filter((entry) => entry.actionable);
  }
  if (options.limit != null) {
    candidates = candidates.slice(0, options.limit);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    sourceDir: mgpActiveDir,
    totalCachedRecords: mgpRecords.length,
    totalCandidates: candidates.length,
    actionableCandidates: candidates.filter((entry) => entry.actionable).length,
    bySuggestionField: candidates.reduce((acc, entry) => {
      for (const suggestion of entry.suggestions) {
        acc[suggestion.field] = (acc[suggestion.field] ?? 0) + 1;
      }
      return acc;
    }, {}),
  };

  await writeFile(
    options.jsonlPath,
    `${candidates.map((entry) => JSON.stringify(entry)).join("\n")}${candidates.length > 0 ? "\n" : ""}`,
    "utf8",
  );
  await writeFile(options.summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(summary, null, 2));
  if (candidates.length > 0) {
    console.log(`Wrote candidates to ${options.jsonlPath}`);
    console.log(`Wrote summary to ${options.summaryPath}`);
  }

  if (options.apply) {
    const applied = await applyCandidates(candidates, options.concurrency);
    console.log(JSON.stringify({
      appliedCount: applied.changedPeople.length,
      changedFiles: applied.changedFiles,
      changedPeople: applied.changedPeople.slice(0, 50),
    }, null, 2));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "lookup") {
    await runLookup(options);
    return;
  }
  if (options.command === "scan-active") {
    await runScanActive(options);
    return;
  }
  if (options.command === "enrich-cache") {
    await runEnrichCache(options);
    return;
  }
  throw new Error(`Unknown mgp command: ${options.command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ensureCacheDirs, cacheDirs } from "./cache-paths.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");
const mgpBaseUrl = "https://www.genealogy.math.ndsu.nodak.edu";
const execFile = promisify(execFileCallback);
const mgpCacheDir = path.join(cacheDirs.discovery, "mgp");
const require = createRequire(import.meta.url);
const personNameAliases = new Map(require("../person-name-aliases.shared.js"));

function parseArgs(argv) {
  const options = {
    personId: null,
    name: null,
    mgpId: null,
    json: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
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
    if (arg === "--force") {
      options.force = true;
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

async function readJsonIfExists(filePath) {
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

async function loadPeople() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const people = [];

  for (const fileName of files) {
    const parsed = JSON.parse(await readFile(path.join(rawDir, fileName), "utf8"));
    for (const person of parsed) {
      people.push({
        ...person,
        _file: fileName,
      });
    }
  }

  return people;
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "user-agent": "computing-genealogy-project/mgp-leads",
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
    });
    const response = await execFile(
      "curl",
      [
        "-L",
        "-s",
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
      { cwd: appRoot, maxBuffer: 10 * 1024 * 1024 },
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

export async function buildPayload(options) {
  const people = await loadPeople();

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
    for (const variant of queryVariants) {
      searchResults = await searchMgpByName(variant, { force: options.force });
      const safeMatches = searchResults.filter((result) =>
        queryVariants.some((candidate) => namesLikelySamePerson(candidate, result.name)),
      );
      if (safeMatches.length === 1) {
        selectedProfile = await fetchMgpProfile(safeMatches[0].mgpId, { force: options.force });
        break;
      }
      if (searchResults.length > 0) {
        break;
      }
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
  if (payload.datasetCrosscheck.advisors.length === 0) {
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
  if (payload.datasetCrosscheck.students.length === 0) {
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

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = await buildPayload(options);
  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  printPayload(payload);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { createHash } from "node:crypto";
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

function parseArgs(argv) {
  const options = {
    personId: null,
    name: null,
    mgpId: null,
    json: false,
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
    }
  }

  return options;
}

function normalizeName(value) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s.-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

function profileCachePath(mgpId) {
  return path.join(mgpCacheDir, `profile-${mgpId}.json`);
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
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath);
    if (cached) {
      return cached.results ?? [];
    }
  }

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
  const { stdout: html } = await execFile(
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

export async function fetchMgpProfile(mgpId, options = {}) {
  await ensureMgpCacheDir();
  const cachePath = profileCachePath(mgpId);
  if (!options.force) {
    const cached = await readJsonIfExists(cachePath);
    if (cached) {
      return cached.profile ?? cached;
    }
  }

  const html = await fetchText(`${mgpBaseUrl}/id.php?id=${mgpId}`);
  const titleMatch = html.match(/<h2[^>]*>\s*([\s\S]*?)<\/h2>/i);
  const degreeMatch = html.match(/Ph\.D\.\s*<span[^>]*>\s*([\s\S]*?)<\/span>\s*([0-9]{4})/i);
  const thesisMatch = html.match(/<span style="font-style:italic" id="thesisTitle">\s*([\s\S]*?)<\/span>/i);

  const advisorMatches = [...html.matchAll(/Advisor:\s*([\s\S]*?)<\/p>/gi)];
  const advisors = advisorMatches.flatMap((match) => {
    const block = match[1].replace(/<br\s*\/?>/gi, "\n");
    return [...block.matchAll(/id\.php\?id=(\d+)">([\s\S]*?)<\/a>/g)].map((entry) => ({
      mgpId: entry[1],
      name: stripTags(entry[2]),
      profileUrl: `${mgpBaseUrl}/id.php?id=${entry[1]}`,
    }));
  });

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

  const profile = {
    mgpId: String(mgpId),
    profileUrl: `${mgpBaseUrl}/id.php?id=${mgpId}`,
    name: titleMatch ? stripTags(titleMatch[1]) : null,
    phdSchool: degreeMatch ? stripTags(degreeMatch[1]) : null,
    phdYear: degreeMatch ? degreeMatch[2] : null,
    thesisTitle: thesisMatch ? stripTags(thesisMatch[1]) : null,
    advisors,
    students,
  };

  await writeFile(
    cachePath,
    `${JSON.stringify({ fetchedAt: new Date().toISOString(), profile }, null, 2)}\n`,
    "utf8",
  );
  return profile;
}

function matchPeopleByName(people, targetName) {
  const normalizedTarget = normalizeName(targetName);
  if (!normalizedTarget) {
    return [];
  }

  return people
    .filter((person) => normalizeName(person.name) === normalizedTarget || person.aliases?.some((alias) => normalizeName(alias) === normalizedTarget))
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
  if (options.personId) {
    const person = people.find((entry) => entry.id === options.personId);
    if (!person) {
      throw new Error(`No dataset record found for id ${options.personId}`);
    }
    queryName = person.name;
  }

  let searchResults = [];
  let selectedProfile = null;

  if (options.mgpId) {
    selectedProfile = await fetchMgpProfile(options.mgpId);
  } else {
    if (!queryName) {
      throw new Error("Pass one of --person-id, --name, or --mgp-id.");
    }
    searchResults = await searchMgpByName(queryName);
    if (searchResults.length === 1) {
      selectedProfile = await fetchMgpProfile(searchResults[0].mgpId);
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

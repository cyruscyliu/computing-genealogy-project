import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizePersonRawSchema, normalizePeopleRawSchema } from "./common/raw-schema-normalization.mjs";
import { withFileLock } from "./common/file-lock.mjs";
import { assertValidProfileSchema } from "./common/profile-schema.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawDir = path.join(rootDir, "data", "raw");
const defaultRepository = "cyruscyliu/computing-genealogy-project";

function usage() {
  return [
    "Usage: node scripts/import-profile-issue.mjs (--file PROFILE.json_OR_ISSUE.md | --issue NUMBER_OR_URL) [--apply]",
    "",
    "Reads a complete raw profile JSON record from the fenced json block. Preview is the default; --apply writes data/raw.",
  ].join("\n");
}

function parseArgs(args) {
  const options = { file: null, issue: null, apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--help") return { help: true };
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (argument === "--file" || argument === "--issue") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(argument + " requires a value.");
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error("Unknown option: " + argument);
  }
  if (!options.file && !options.issue) throw new Error("Provide --file or --issue.");
  if (options.file && options.issue) throw new Error("Use either --file or --issue, not both.");
  return options;
}

function issueApiUrl(value) {
  const text = String(value);
  if (/^\d+$/.test(text)) return "https://api.github.com/repos/" + defaultRepository + "/issues/" + text;
  const match = text.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/i);
  if (!match) throw new Error("--issue must be an issue number or GitHub issue URL.");
  return "https://api.github.com/repos/" + match[1] + "/" + match[2] + "/issues/" + match[3];
}

async function readIssueMarkdown(options) {
  if (options.file) return readFile(path.resolve(options.file), "utf8");
  const headers = { Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(issueApiUrl(options.issue), { headers });
  if (!response.ok) throw new Error("Unable to fetch GitHub issue: " + response.status + " " + response.statusText);
  const issue = await response.json();
  if (typeof issue.body !== "string" || !issue.body.trim()) throw new Error("GitHub issue has no Markdown body to import.");
  return issue.body;
}

export function parseProfileJson(markdown) {
  const trimmed = markdown.trim();
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error("Profile JSON is invalid: " + error.message);
    }
  }
  const fence = String.fromCharCode(96).repeat(3);
  const start = markdown.toLowerCase().indexOf(fence + "json");
  if (start < 0) throw new Error("Issue is missing a fenced json profile record.");
  const contentStart = markdown.indexOf("\n", start);
  const end = markdown.indexOf(fence, contentStart + 1);
  if (contentStart < 0 || end < 0) throw new Error("Issue has an incomplete json code block.");
  try {
    return JSON.parse(markdown.slice(contentStart + 1, end));
  } catch (error) {
    throw new Error("Profile JSON is invalid: " + error.message);
  }
}

export function validateProfileRecord(profile) {
  assertValidProfileSchema(profile);
  const normalized = normalizePersonRawSchema(profile);
  assertValidProfileSchema(normalized);
  return normalized;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function targetFileForName(name) {
  const letter = slugify(name).charAt(0);
  const bucket = /^[a-z]$/.test(letter) ? letter : "other";
  return path.join(rawDir, "people-" + bucket + ".json");
}

async function loadRawFiles() {
  const names = (await readdir(rawDir)).filter((name) => /^people-.*\.json$/.test(name)).sort();
  const entries = [];
  for (const name of names) {
    const filePath = path.join(rawDir, name);
    entries.push({ filePath, people: normalizePeopleRawSchema(JSON.parse(await readFile(filePath, "utf8"))) });
  }
  return entries;
}

function assertAdvisorReferences(people) {
  const ids = new Set(people.map((person) => person.id));
  for (const person of people) {
    for (const stageName of ["masters", "phd", "postdoc"]) {
      const advisorId = person.stages[stageName].advisorPersonId;
      if (advisorId !== undefined && advisorId !== null && !ids.has(advisorId)) {
        throw new Error(person.id + " references unknown " + stageName + " advisor ID " + advisorId + ".");
      }
    }
  }
}

function summary(profile) {
  const sources = profile.sources.length;
  return profile.id + ": " + profile.name + " · " + sources + " additional source" + (sources === 1 ? "" : "s");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const profile = validateProfileRecord(parseProfileJson(await readIssueMarkdown(options)));
  await withFileLock("profile-issue-import", async () => {
    const entries = await loadRawFiles();
    const people = entries.flatMap((entry) => entry.people);
    const existingEntry = entries.find((entry) => entry.people.some((person) => person.id === profile.id));
    const existing = existingEntry && existingEntry.people.find((person) => person.id === profile.id);
    const nextPeople = existing ? people.map((person) => person.id === profile.id ? profile : person) : [...people, profile];
    assertAdvisorReferences(nextPeople);
    console.log((options.apply ? "Applying" : "Previewing") + " complete profile record: " + summary(profile));
    console.log(existing ? "- Replaces existing raw profile" : "- Creates new raw profile");
    if (!options.apply) {
      console.log("No files changed. Re-run with --apply to write data/raw.");
      return;
    }
    if (existing) {
      const updated = existingEntry.people.map((person) => person.id === profile.id ? profile : person).sort((left, right) => left.name.localeCompare(right.name));
      await writeFile(existingEntry.filePath, JSON.stringify(updated, null, 2) + "\n", "utf8");
      console.log("Updated " + path.relative(rootDir, existingEntry.filePath));
      return;
    }
    const destination = targetFileForName(profile.name);
    const destinationEntry = entries.find((entry) => entry.filePath === destination);
    const destinationPeople = destinationEntry ? destinationEntry.people : [];
    const updated = [...destinationPeople, profile].sort((left, right) => left.name.localeCompare(right.name));
    await writeFile(destination, JSON.stringify(updated, null, 2) + "\n", "utf8");
    console.log("Created " + path.relative(rootDir, destination));
  });
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

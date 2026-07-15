import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeInstitution } from "./institution-normalization.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const rawDir = path.join(appRoot, "data", "raw");

function parseArgs(argv) {
  const options = {
    limit: 24,
    names: 24,
    institution: null,
    missingPhdAdvisor: false,
    includeActive: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] ?? options.limit);
      index += 1;
      continue;
    }
    if (arg === "--names") {
      options.names = Number(argv[index + 1] ?? options.names);
      index += 1;
      continue;
    }
    if (arg === "--institution") {
      options.institution = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (arg === "--missing-phd-advisor") {
      options.missingPhdAdvisor = true;
      continue;
    }
    if (arg === "--include-active") {
      options.includeActive = true;
    }
  }

  return options;
}

async function loadPeople() {
  const files = (await readdir(rawDir)).filter((name) => name.endsWith(".json")).sort();
  const people = [];

  for (const fileName of files) {
    const filePath = path.join(rawDir, fileName);
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    for (const person of parsed) {
      people.push({ ...person, _file: fileName });
    }
  }

  return people;
}

function includePerson(person, options) {
  if (!options.includeActive && person.tracking.status !== "seed") {
    return false;
  }
  if (options.missingPhdAdvisor && person?.stages?.phd?.advisorLabel) {
    return false;
  }
  return true;
}

function buildGroups(people, options) {
  const groups = new Map();

  for (const person of people) {
    if (!includePerson(person, options)) {
      continue;
    }

    const institution = normalizeInstitution(person.work.institution, "(unknown)");
    const entry = groups.get(institution) ?? [];
    entry.push(person);
    groups.set(institution, entry);
  }

  return [...groups.entries()]
    .map(([institution, members]) => ({
      institution,
      count: members.length,
      members: members.sort((left, right) => left.priority - right.priority || left.name.localeCompare(right.name)),
    }))
    .sort((left, right) => right.count - left.count || left.institution.localeCompare(right.institution));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const people = await loadPeople();
  const groups = buildGroups(people, options);

  if (options.institution) {
    const normalizedTarget = normalizeInstitution(options.institution);
    const group = groups.find((entry) => entry.institution === normalizedTarget);
    if (!group) {
      console.log(`No seed group found for ${normalizedTarget}`);
      return;
    }

    console.log(`${group.institution}\t${group.count} seed records`);
    for (const person of group.members.slice(0, options.names)) {
      console.log(`- ${person.name} [${person.id}] (${person._file})`);
    }
    return;
  }

  for (const group of groups.slice(0, options.limit)) {
    console.log(`${group.count}\t${group.institution}`);
    for (const person of group.members.slice(0, options.names)) {
      console.log(`  - ${person.name} [${person.id}]`);
    }
    if (group.members.length > options.names) {
      console.log(`  - ... ${group.members.length - options.names} more`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

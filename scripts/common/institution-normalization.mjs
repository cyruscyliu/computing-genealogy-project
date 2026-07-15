import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const institutionAliases = new Map(require("../../institution-aliases.shared.js"));

export function normalizeInstitution(name, fallback = name) {
  if (!name) {
    return fallback;
  }

  return institutionAliases.get(name) ?? name;
}

export function getInstitutionAliases() {
  return new Map(institutionAliases);
}

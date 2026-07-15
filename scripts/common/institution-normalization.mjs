import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const institutionAliases = new Map(require("../../institution-aliases.shared.js"));

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&Eacute;/g, "É")
    .replace(/&eacute;/g, "é")
    .replace(/&ecirc;/g, "ê")
    .replace(/&Egrave;/g, "È")
    .replace(/&egrave;/g, "è")
    .replace(/&agrave;/g, "à")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü");
}

function splitInstitutionValues(value) {
  const parts = [];
  let current = "";
  let inEntity = false;

  for (const char of String(value)) {
    if (char === "&") {
      inEntity = true;
      current += char;
      continue;
    }

    if (char === ";" && inEntity) {
      inEntity = false;
      current += char;
      continue;
    }

    if ((char === ";" || char === "；") && !inEntity) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    if (/\s/.test(char) && inEntity) {
      inEntity = false;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function normalizeSingleInstitution(name) {
  const raw = String(name).replace(/\s+/g, " ").trim();
  if (institutionAliases.has(raw)) {
    return institutionAliases.get(raw);
  }

  const decoded = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
  return institutionAliases.get(decoded) ?? decoded;
}

export function normalizeInstitution(name, fallback = name) {
  if (!name) {
    return fallback;
  }

  const parts = splitInstitutionValues(name);

  if (parts.length === 0) {
    return fallback;
  }

  const normalized = parts.map((part) => normalizeSingleInstitution(part));
  return [...new Set(normalized)].join("; ");
}

export function getInstitutionAliases() {
  return new Map(institutionAliases);
}

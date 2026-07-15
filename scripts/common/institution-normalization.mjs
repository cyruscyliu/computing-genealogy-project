import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const institutionAliases = new Map(require("../../institution-aliases.shared.js"));
const htmlEntityMap = new Map([
  ["nbsp", " "],
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", "\""],
  ["apos", "'"],
  ["#39", "'"],
  ["Eacute", "É"],
  ["eacute", "é"],
  ["Ecirc", "Ê"],
  ["ecirc", "ê"],
  ["Egrave", "È"],
  ["egrave", "è"],
  ["Agrave", "À"],
  ["agrave", "à"],
  ["Auml", "Ä"],
  ["auml", "ä"],
  ["Ouml", "Ö"],
  ["ouml", "ö"],
  ["Uuml", "Ü"],
  ["uuml", "ü"],
  ["szlig", "ß"],
  ["Ccedil", "Ç"],
  ["ccedil", "ç"],
  ["Ntilde", "Ñ"],
  ["ntilde", "ñ"],
]);

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&([A-Za-z#0-9]+);\s+(?=[A-Za-z])/g, "&$1;")
    .replace(/&(#x?[0-9a-fA-F]+|[A-Za-z]+);/g, (match, entity) => {
      if (htmlEntityMap.has(entity)) {
        return htmlEntityMap.get(entity);
      }
      if (/^#x[0-9a-f]+$/i.test(entity)) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }
      if (/^#[0-9]+$/.test(entity)) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }
      return match;
    });
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

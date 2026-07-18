import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const schemaPath = path.join(rootDir, "data", "schema", "profile.v1.schema.json");

export const profileSchema = JSON.parse(readFileSync(schemaPath, "utf8"));
export const PROFILE_SCHEMA_ID = profileSchema.$id;
export const PROFILE_SCHEMA_VERSION = profileSchema["x-schema-version"];
export const PROFILE_SOURCE_KINDS = profileSchema.$defs.source.properties.kind.enum;
export const PROFILE_TRACKING_STATUSES = profileSchema.$defs.tracking.properties.status.enum;
export const PROFILE_SOURCE_CONFIDENCES = profileSchema.$defs.source.properties.confidence.enum;

function typeMatches(value, expectedType) {
  if (expectedType === "null") return value === null;
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "integer") return Number.isInteger(value);
  if (expectedType === "number") return typeof value === "number" && Number.isFinite(value);
  if (expectedType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === expectedType;
}

function resolveRef(reference) {
  if (!reference.startsWith("#/$defs/")) throw new Error("Unsupported profile schema reference: " + reference);
  const definition = reference.slice("#/$defs/".length);
  return profileSchema.$defs[definition];
}

function formatMatches(value, format) {
  if (format === "uri") {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
  if (format === "date-time") return !Number.isNaN(Date.parse(value));
  return true;
}

function validateValue(value, schema, pathLabel, errors) {
  if (schema.$ref) {
    validateValue(value, resolveRef(schema.$ref), pathLabel, errors);
    return;
  }

  if (schema.anyOf) {
    const branches = schema.anyOf.map(() => []);
    const valid = schema.anyOf.some((branch, index) => {
      validateValue(value, branch, pathLabel, branches[index]);
      return branches[index].length === 0;
    });
    if (!valid) errors.push(pathLabel + " must match one allowed schema variant.");
    return;
  }

  if (schema.type) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!allowedTypes.some((type) => typeMatches(value, type))) {
      errors.push(pathLabel + " must be " + allowedTypes.join(" or ") + ".");
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(pathLabel + " must be one of: " + schema.enum.join(", ") + ".");
  }
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errors.push(pathLabel + " must not be empty.");
    if (schema.format && !formatMatches(value, schema.format)) errors.push(pathLabel + " must be a valid " + schema.format + ".");
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(pathLabel + " must be at least " + schema.minimum + ".");
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(pathLabel + " must be at most " + schema.maximum + ".");
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => validateValue(item, schema.items, pathLabel + "[" + index + "]", errors));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value) && schema.properties) {
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) errors.push(pathLabel + "." + key + " is required.");
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(schema.properties, key)) errors.push(pathLabel + "." + key + " is not allowed by profile schema v" + PROFILE_SCHEMA_VERSION + ".");
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, key)) validateValue(value[key], childSchema, pathLabel + "." + key, errors);
    }
  }
}

export function validateProfileSchema(profile) {
  const errors = [];
  validateValue(profile, profileSchema, "profile", errors);
  return errors;
}

export function assertValidProfileSchema(profile) {
  const errors = validateProfileSchema(profile);
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

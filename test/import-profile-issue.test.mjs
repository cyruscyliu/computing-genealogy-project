import assert from "node:assert/strict";
import test from "node:test";
import { parseProfileJson, validateProfileRecord } from "../scripts/import-profile-issue.mjs";
import { PROFILE_SCHEMA_VERSION } from "../scripts/common/profile-schema.mjs";

function profile() {
  return {
    id: "example-researcher",
    name: "Example Researcher",
    dblpAuthorId: null,
    aliases: [],
    work: { institution: null, note: null },
    tracking: { status: "active", priority: 1, note: null, analyzedAt: null },
    source: { label: "Fixture", url: "https://example.edu/profile" },
    sources: [{ kind: "faculty", url: "https://example.edu/profile", confidence: "high", note: "Fixture evidence." }],
    summary: "Fixture profile.",
    stages: {
      undergraduate: { school: null, note: null },
      masters: { school: null, advisorPersonId: null, advisorLabel: null, status: null, note: null },
      phd: { school: null, graduationYear: null, advisorPersonId: null, advisorLabel: null, status: null, note: null },
      postdoc: { school: null, advisorPersonId: null, advisorLabel: null, status: null, note: null },
    },
  };
}

test("parses a complete profile from an issue JSON fence", () => {
  const input = "Paste this.\n\n```json\n" + JSON.stringify(profile(), null, 2) + "\n```";
  assert.deepEqual(parseProfileJson(input), profile());
});

test("parses a direct single-profile JSON file", () => {
  assert.deepEqual(parseProfileJson(JSON.stringify(profile())), profile());
});

test("validates the complete versioned raw profile shape", () => {
  const result = validateProfileRecord(profile());
  assert.equal(result.id, "example-researcher");
  assert.equal(PROFILE_SCHEMA_VERSION, "1.0.0");
});

test("rejects generated coverage and invalid source enums", () => {
  const withCoverage = profile();
  withCoverage.coverage = { filled: 1, total: 8, ratio: 0.125 };
  assert.throws(() => validateProfileRecord(withCoverage), /coverage is not allowed/);

  const withInvalidKind = profile();
  withInvalidKind.sources[0].kind = "unknown-kind";
  assert.throws(() => validateProfileRecord(withInvalidKind), /must be one of/);
});

test("rejects a missing required raw field", () => {
  const incomplete = profile();
  delete incomplete.stages.phd.graduationYear;
  assert.throws(() => validateProfileRecord(incomplete), /graduationYear is required/);
});

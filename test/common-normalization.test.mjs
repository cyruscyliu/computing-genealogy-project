import test from "node:test";
import assert from "node:assert/strict";

import { normalizeInstitution } from "../scripts/common/institution-normalization.mjs";
import { normalizePersonRawSchema } from "../scripts/common/raw-schema-normalization.mjs";

test("normalizeInstitution decodes HTML entities used in school names", () => {
  assert.equal(normalizeInstitution("Technische Universit&auml; t Darmstadt"), "Technische Universität Darmstadt");
  assert.equal(normalizeInstitution("Universit&auml; t des Saarlandes"), "Universität des Saarlandes");
  assert.equal(normalizeInstitution("Georg-August-Universit&auml; t G&ouml; ttingen"), "Georg-August-Universität Göttingen");
});

test("normalizePersonRawSchema removes self advisor labels from names and aliases", () => {
  const person = normalizePersonRawSchema({
    id: "dawn-song",
    name: "Dawn Song",
    aliases: ["Dawn Xiaodong Song"],
    work: { institution: null, note: null },
    tracking: { status: "active", priority: 1, note: null },
    source: { label: "test", url: "https://example.com" },
    sources: [],
    summary: "",
    stages: {
      undergraduate: { school: null, note: null },
      masters: { school: null, note: null },
      phd: {
        school: "UC Berkeley",
        graduationYear: 2002,
        advisorPersonId: "dawn-song",
        advisorLabel: "Dawn Xiaodong Song; Doug Tygar",
        status: "PhD",
        note: null,
      },
      postdoc: {
        school: null,
        advisorPersonId: null,
        advisorLabel: "Dawn Song",
        status: null,
        note: null,
      },
    },
  });

  assert.equal(person.stages.phd.advisorPersonId, null);
  assert.equal(person.stages.phd.advisorLabel, "Doug Tygar");
  assert.equal(person.stages.postdoc.advisorLabel, null);
});


test("normalizePersonRawSchema preserves advisor generational suffixes", () => {
  const person = normalizePersonRawSchema({
    id: "test-person",
    name: "Test Person",
    aliases: [],
    work: { institution: null, note: null },
    tracking: { status: "active", priority: 1, note: null },
    source: { label: "test", url: "https://example.com" },
    sources: [],
    summary: "",
    stages: {
      undergraduate: { school: null, note: null },
      masters: { school: null, note: null },
      phd: { school: null, graduationYear: null, advisorPersonId: null, advisorLabel: "John Emory Dennis, Jr.; Alice Smith", status: "PhD", note: null },
      postdoc: { school: null, advisorPersonId: null, advisorLabel: null, status: null, note: null },
    },
  });

  assert.equal(person.stages.phd.advisorLabel, "John Emory Dennis, Jr.; Alice Smith");
});

import test from "node:test";
import assert from "node:assert/strict";

import { mgpCandidateConflictsWithKnownPhd } from "../scripts/person-enrich.mjs";

test("rejects an MGP profile when its matching search result conflicts with known PhD school", () => {
  assert.equal(
    mgpCandidateConflictsWithKnownPhd({
      profileSchool: null,
      profileYear: null,
      searchSchool: "Technische Universität Darmstadt",
      searchYear: 2019,
      knownSchool: "ETH Zurich",
      knownYear: null,
    }),
    true
  );
});

test("allows consistent MGP search and profile evidence", () => {
  assert.equal(
    mgpCandidateConflictsWithKnownPhd({
      profileSchool: "ETH Zurich",
      profileYear: 2019,
      searchSchool: "ETH Zürich",
      searchYear: 2019,
      knownSchool: "ETH Zurich",
      knownYear: 2019,
    }),
    false
  );
});

test("treats UC campus abbreviations as equivalent PhD schools", () => {
  const conflicts = mgpCandidateConflictsWithKnownPhd({
    profileSchool: "UC Riverside",
    knownSchool: "University of California",
  });
  assert.equal(conflicts, false);
});

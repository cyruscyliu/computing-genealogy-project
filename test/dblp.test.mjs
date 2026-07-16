import test from "node:test";
import assert from "node:assert/strict";
import { metadataFromDblpLocalIndex } from "../scripts/collectors/dblp.mjs";

test("reads only an exact DBLP identity from the local index", () => {
  const localIndex = {
    peopleByIdentity: {
      "qiang liu 0034": {
        author: "Qiang Liu 0034",
        orcid: "0000-0002-5865-6227",
        ambiguousOrcid: false,
      },
    },
  };
  assert.deepEqual(metadataFromDblpLocalIndex("Qiang Liu 0034", localIndex), {
    author: "Qiang Liu 0034",
    pid: null,
    currentAffiliation: null,
    affiliations: [],
    homepageLeads: [],
    scholarLeads: [],
    orcid: "0000-0002-5865-6227",
    phdSchool: null,
    phdGraduationYear: null,
    profileUrl: null,
    xmlUrl: null,
  });
});

test("does not strip a DBLP disambiguation suffix in the local index", () => {
  const localIndex = {
    peopleByIdentity: {
      "qiang liu 0034": { author: "Qiang Liu 0034", orcid: null, ambiguousOrcid: false },
    },
  };
  assert.equal(metadataFromDblpLocalIndex("Qiang Liu 0001", localIndex), null);
});

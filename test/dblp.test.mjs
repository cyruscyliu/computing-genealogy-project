import test from "node:test";
import assert from "node:assert/strict";
import {
  metadataFromDblpLocalIndex,
  parseDblpHomepageRecord,
} from "../scripts/collectors/dblp.mjs";

test("reads only an exact DBLP identity from the local index", () => {
  const localIndex = {
    peopleByIdentity: {
      "qiang liu 0034": {
        author: "Qiang Liu 0034",
        orcid: "0000-0002-5865-6227",
        ambiguousOrcid: false,
        profile: null,
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
      "qiang liu 0034": { author: "Qiang Liu 0034", orcid: null, ambiguousOrcid: false, profile: null },
    },
  };
  assert.equal(metadataFromDblpLocalIndex("Qiang Liu 0001", localIndex), null);
});

test("parses an exact local DBLP homepage record and ignores historical affiliations", () => {
  const xml = [
    '<www mdate="2025-06-07" key="homepages/61/3234-34">',
    '  <author>Qiang Liu 0034</author>',
    '  <title>Home Page</title>',
    '  <note type="affiliation">EPFL, Lausanne, Switzerland</note>',
    '  <note label="PhD 2023" type="affiliation">Zhejiang University, China</note>',
    '  <url>https://qiang.example.edu/</url>',
    '  <url>https://scholar.google.com/citations?user=abc123</url>',
    '  <url>https://orcid.org/0000-0002-5865-6227</url>',
    '</www>',
  ].join("\n");
  assert.deepEqual(parseDblpHomepageRecord(xml, "Qiang Liu 0034"), {
    author: "Qiang Liu 0034",
    pid: "61/3234-34",
    currentAffiliation: "EPFL, Lausanne, Switzerland",
    affiliations: ["EPFL, Lausanne, Switzerland"],
    homepageLeads: ["https://qiang.example.edu/"],
    scholarLeads: ["https://scholar.google.com/citations?user=abc123"],
    orcid: "0000-0002-5865-6227",
    phdSchool: null,
    phdGraduationYear: null,
    profileUrl: "https://dblp.org/pid/61/3234-34",
    xmlUrl: "https://dblp.org/pid/61/3234-34.xml",
  });
  assert.equal(parseDblpHomepageRecord(xml, "Qiang Liu"), null);
});

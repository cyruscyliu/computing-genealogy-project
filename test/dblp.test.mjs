import test from "node:test";
import assert from "node:assert/strict";
import { parseDblpAuthorSearchPayload, parseDblpProfileXml } from "../scripts/collectors/dblp.mjs";

test("selects only the exact DBLP author search hit", () => {
  const match = parseDblpAuthorSearchPayload({ result: { hits: { hit: [
    { info: { author: "Qiang Liu 0001", url: "https://dblp.org/pid/61/3234-1" } },
    { info: { author: "Qiang Liu 0034", url: "https://dblp.org/pid/61/3234-34" } },
  ] } } }, "Qiang Liu 0034");
  assert.deepEqual(match, { author: "Qiang Liu 0034", profileUrl: "https://dblp.org/pid/61/3234-34", pid: "61/3234-34" });
});

test("extracts direct DBLP profile metadata but not homonym URLs", () => {
  const metadata = parseDblpProfileXml(`<?xml version="1.0"?><dblpperson name="Qiang Liu 0034" pid="61/3234-34"><person><author pid="61/3234-34">Qiang Liu 0034</author><note type="affiliation">EPFL, Lausanne</note><note label="PhD 2023" type="affiliation">Zhejiang University</note><url>https://qiang.example.edu/</url><url>https://orcid.org/0000-0002-5865-6227</url></person><homonyms><person><url>https://wrong.example.edu/</url></person></homonyms></dblpperson>`);
  assert.deepEqual(metadata, {
    author: "Qiang Liu 0034",
    pid: "61/3234-34",
    currentAffiliation: "EPFL, Lausanne",
    affiliations: [{ value: "EPFL, Lausanne", label: null }, { value: "Zhejiang University", label: "PhD 2023" }],
    homepageLeads: ["https://qiang.example.edu/"],
    scholarLeads: [],
    orcid: "0000-0002-5865-6227",
    phdSchool: "Zhejiang University",
    phdGraduationYear: 2023,
  });
});

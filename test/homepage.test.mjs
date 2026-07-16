import test from "node:test";
import assert from "node:assert/strict";

import { detectProfileSignalsFromText } from "../scripts/tools/homepage.mjs";

test("extracts PhD lineage from a CV timeline entry", () => {
  const signals = detectProfileSignalsFromText(
    "Curriculum Vitae Vincent Laporte 01/2016–08/2018 Post-doc at IMDEA, supervised by Gilles Barthe 2012–2015 Ph.D. at University of Rennes 1, France, supervised by Sandrine Blazy and David Pichardie Subject: verification"
  );

  assert.deepEqual(signals, {
    phdSchool: "University of Rennes 1",
    phdAdvisorLabel: "Sandrine Blazy; David Pichardie",
    phdGraduationYear: 2015,
  });
});

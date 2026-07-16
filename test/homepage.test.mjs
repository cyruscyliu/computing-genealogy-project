import test from "node:test";
import assert from "node:assert/strict";

import { detectProfileSignalsFromText, isAggregateProfilePage, mergeProfileSignals } from "../scripts/parsers/homepage.mjs";

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

test("extracts a dated PhD CV entry with a following Advisor line", () => {
  const signals = detectProfileSignalsFromText(
    "Education 2011: Ph.D. in Computer Science, University of Crete. Modern Techniques for the Detection and Prevention of Web2.0 Attacks. Advisor: Prof. Evangelos P. Markatos. 2006: M.Sc. in Computer Science, University of Crete. Advisor: Prof. Evangelos P. Markatos."
  );

  assert.deepEqual(signals, {
    phdSchool: "University of Crete",
    phdAdvisorLabel: "Evangelos P Markatos",
    phdGraduationYear: 2011,
  });
});

test("extracts co-advisors named in a PhD biography sentence", () => {
  const signals = detectProfileSignalsFromText(
    "Previously I was a PhD student at EURECOM, advised by Prof. Aurélien Francillon and co-advised by Prof. Davide Balzarotti."
  );

  assert.deepEqual(signals, {
    phdSchool: null,
    phdAdvisorLabel: "Aurélien Francillon; Davide Balzarotti",
    phdGraduationYear: null,
  });
});

test("retains a French university PhD sentence and its completion year", () => {
  const signals = detectProfileSignalsFromText(
    "I obtained my PhD from Sorbonne Universités, Université de Technologie de Compiègne (UTC) in December 2016, while working at Orange Labs in Caen."
  );

  assert.deepEqual(signals, {
    phdSchool: "Sorbonne Universités",
    phdAdvisorLabel: null,
    phdGraduationYear: 2016,
  });
});

test("does not classify a personal page by its people subdomain as an aggregate page", () => {
  assert.equal(
    isAggregateProfilePage(
      "https://people.irisa.fr/Mohamed.Sabt/",
      "Mohamed Sabt",
      "Mohamed Sabt. Associate Professor."
    ),
    false
  );
});

test("extracts supervisor and year from PhD dissertation front matter", () => {
  const signals = detectProfileSignalsFromText(
    "Jo Van Bulck. Supervisor: Prof. dr. ir. F. Piessens. Dissertation presented in partial fulfillment of the requirements for the degree of Doctor of Engineering Science (PhD): Computer Science. September 2020. First and foremost, I would like to thank my supervisor, Frank Piessens, for being the finest mentor."
  );

  assert.deepEqual(signals, {
    phdSchool: null,
    phdAdvisorLabel: "Frank Piessens",
    phdGraduationYear: 2020,
  });
});

test("keeps year from an advisor-bearing thesis follow-up", () => {
  assert.deepEqual(
    mergeProfileSignals(
      {
        finalUrl: "https://example.edu/home",
        affiliation: null,
        phdSchool: null,
        phdAdvisorLabel: null,
        phdGraduationYear: 2025,
      },
      {
        finalUrl: "https://example.edu/phd-thesis.pdf",
        affiliation: null,
        phdSchool: "KU Leuven",
        phdAdvisorLabel: "Frank Piessens",
        phdGraduationYear: 2020,
      }
    ),
    {
      homepage: "https://example.edu/phd-thesis.pdf",
      affiliation: null,
      phdSchool: "KU Leuven",
      phdAdvisorLabel: "Frank Piessens",
      phdGraduationYear: 2020,
    }
  );
});

test("extracts PhD degree-table and thesis advisors from a CV", () => {
  assert.deepEqual(
    detectProfileSignalsFromText("Earned Degrees Ph.D. 2020 Georgia Institute of Technology (GaTech) Computer Science. Ph.D. Thesis Title: Example. Advisors: Taesoo Kim and Changwoo Min Georgia Institute of Technology (GaTech)."),
    { phdSchool: "Georgia Institute of Technology (GaTech)", phdAdvisorLabel: "Taesoo Kim; Changwoo Min", phdGraduationYear: 2020 }
  );
});

test("extracts an advisor after a compact academic title", () => {
  assert.deepEqual(
    detectProfileSignalsFromText("2016.7 - 2020.12, Ph.D. in Information Security, Xidian University, advised by Prof.Yuqing Zhang."),
    { phdSchool: "Xidian University", phdAdvisorLabel: "Yuqing Zhang", phdGraduationYear: 2020 }
  );
});

test("finds advisor-bearing timeline entries after a PhD biography sentence", () => {
  assert.deepEqual(
    detectProfileSignalsFromText(
      "I received my Ph.D. from the School of Cyber Engineering at Xidian University in December 2020. 2016.7 - 2020.12, Ph.D. in Information Security, Xidian University, advised by Prof.Yuqing Zhang."
    ),
    { phdSchool: "Xidian University", phdAdvisorLabel: "Yuqing Zhang", phdGraduationYear: 2020 }
  );
});

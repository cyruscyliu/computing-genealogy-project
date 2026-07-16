import test from "node:test";
import assert from "node:assert/strict";
import { parseGoogleScholarProfile } from "../scripts/collectors/google-scholar.mjs";

test("extracts only the explicit Google Scholar website field", () => {
  assert.deepEqual(
    parseGoogleScholarProfile('<div id="gsc_prf_in">Jane Doe</div><div id="gsc_prf_ivh">Verified email at example.edu - <a href="https://jane.example.edu/">Homepage</a></div><a href="https://papers.example.edu/">Paper</a>'),
    { name: "Jane Doe", homepage: "https://jane.example.edu/" }
  );
});

test("does not treat a Scholar profile without a website field as a homepage", () => {
  assert.deepEqual(
    parseGoogleScholarProfile('<div id="gsc_prf_in">Jane Doe</div><a href="https://papers.example.edu/">Paper</a>'),
    { name: "Jane Doe", homepage: null }
  );
});

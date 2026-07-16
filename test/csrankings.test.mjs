import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCsrankingsIndex,
  resolveCsrankingsEntryDetailed,
} from "../scripts/tools/csrankings.mjs";

test("resolves an exact full DBLP identity", () => {
  const entry = { name: "Qiang Liu 0034", homepage: "https://example.edu/qiang" };
  const index = buildCsrankingsIndex([entry]);
  assert.deepEqual(resolveCsrankingsEntryDetailed({ dblpAuthorId: "Qiang Liu 0034" }, index), {
    entry,
    match: "exact-dblp-identity",
  });
});

test("uses CSrankings DBLP aliases without altering a disambiguation suffix", () => {
  const entry = { name: "Qiangqiang Liu", homepage: "https://example.edu/qiangqiang" };
  const index = buildCsrankingsIndex([entry], [{ alias: "Qiang Qiang Liu", name: "Qiangqiang Liu" }]);
  assert.deepEqual(resolveCsrankingsEntryDetailed({ dblpAuthorId: "Qiang Qiang Liu" }, index), {
    entry,
    match: "dblp-alias",
  });
});

test("never strips a DBLP disambiguation suffix to force a match", () => {
  const index = buildCsrankingsIndex([{ name: "Anh Nguyen 0002", homepage: "https://example.edu/anh" }]);
  assert.deepEqual(resolveCsrankingsEntryDetailed({ dblpAuthorId: "Anh Nguyen 0011" }, index), {
    entry: null,
    match: "not-in-csrankings",
  });
});

test("does not resolve an ambiguous canonical DBLP alias", () => {
  const index = buildCsrankingsIndex(
    [
      { name: "Canonical Name", homepage: "https://example.edu/one" },
      { name: "Canonical Name", homepage: "https://example.edu/two" },
    ],
    [{ alias: "Alias Name", name: "Canonical Name" }]
  );
  assert.deepEqual(resolveCsrankingsEntryDetailed({ dblpAuthorId: "Alias Name" }, index), {
    entry: null,
    match: "ambiguous-dblp-alias",
  });
});

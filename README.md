# Academic Lineage Analyzer

This app is structured for bulk website scanning and gradual normalization.

## Data flow

1. Add or update raw structured records in `data/raw/people-*.json`.
2. Run `node scripts/build-dataset.mjs`.
3. The script validates references and writes:
   - `data/generated/lineage-dataset.json`
   - `data/generated/lineage-dataset.js`
   - `data/generated/lineage-schema.json`
4. The frontend loads the generated files with `fetch`, and falls back to the generated JS bundle when opened directly from disk.

## Why this scales better

- Frontend code no longer needs edits when adding people.
- Raw records keep source provenance per person.
- Validation catches duplicate ids and broken advisor references early.
- Generated stats make coverage visible as the dataset grows.

## Suggested ingestion workflow

- Scan a homepage or faculty page.
- Normalize one person into the raw schema.
- If an advisor is not fully known yet, create a seed node with `tracking.status = "seed"`.
- Re-run the build script and review the graph.

## Commands

```bash
node scripts/build-dataset.mjs
npm run dev
node scripts/import-top-authors.mjs
node scripts/import-top-authors.mjs https://nebelwelt.net/pubstats/top-authors-sys_sec.html 100
python3 -m http.server 4317 --bind 0.0.0.0
```

`import-top-authors.mjs` imports the full ranking page by default. Pass a numeric third argument only when you intentionally want a smaller sample.

The ranking page is treated only as an index of people:

- keep `dblpAuthorId`
- keep work institution when the row explicitly provides one
- do not treat rank, score, or other leaderboard fields as stable lineage data
# computing-genealogy-project

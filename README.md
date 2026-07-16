# Computing Genealogy Explorer

Interactive browser-based explorer for computing academic lineages. The project builds a normalized dataset from raw profile records and renders advisor and descendant relationships as a navigable graph.

## Quick Start

```bash
npm install
npm run build:data
npm run dev
```

Open `http://127.0.0.1:4317/`.

Useful commands:

```bash
npm test
node scripts/import-top-authors.mjs
npm run enrich:person -- --limit 10 --force
node scripts/tools/csrankings.mjs --id qiang-liu-0034
node scripts/tools/orcid.mjs --name "Qiang Liu"
node scripts/tools/homepage.mjs --url https://example.edu/~person/
npm run cache:fetch -- --bucket uiuc https://siebelschool.illinois.edu/about/people/faculty/lbo
npm run cache:migrate
npm run cache:reindex
```

Generated files are written to `data/generated/`:

- `lineage-dataset.json`
- `lineage-dataset.js`
- `lineage-schema.json`

Local cache files are organized under `.cache/`:

- `indexes/cache-index.json`: inventory of cached files
- `datasets/csrankings/`: cached CSRankings CSV inputs
- `discovery/searxng/`: cached SearXNG query results
- `resolution/person-enrich/`: cached per-person enrichment JSON
- `snapshots/sources/`: cached HTML/PDF source snapshots

To cache a source snapshot directly:

```bash
npm run cache:fetch -- --bucket cispa https://cispa.de/en/people/zeller
```

This writes the fetched HTML/PDF plus a `.meta.json` sidecar under `.cache/snapshots/sources/` and then refreshes `.cache/indexes/cache-index.json`.

`person-enrich.mjs` orchestrates the person-first tool chain and persists one cache record per person under `.cache/resolution/person-enrich/`. The homepage tool reuses cached source snapshots rather than downloading the same page repeatedly.

Run `npm run enrich:broad` for a full breadth pass. It re-executes the complete per-person tool chain for every profile while retaining source snapshots, then reports per-field coverage deltas and tool/cache reach.

## Contribution

1. Add or update structured records in `data/raw/people-*.json`.
2. Rebuild the dataset with `npm run build:data`.
3. Run `npm test`.
4. Start the site with `npm run dev` and verify the graph, filters, and person detail panel.

When adding people, keep source provenance in each record and use seed or stub profiles when lineage links are known before the full profile is complete.

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
```

Generated files are written to `data/generated/`:

- `lineage-dataset.json`
- `lineage-dataset.js`
- `lineage-schema.json`

## Contribution

1. Add or update structured records in `data/raw/people-*.json`.
2. Rebuild the dataset with `npm run build:data`.
3. Run `npm test`.
4. Start the site with `npm run dev` and verify the graph, filters, and person detail panel.

When adding people, keep source provenance in each record and use seed or stub profiles when lineage links are known before the full profile is complete.

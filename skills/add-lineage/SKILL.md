---
name: add-lineage
description: Add or correct a sourced Computing Genealogy Project profile. Use when a user wants to research a researcher, generate a complete schema-valid raw profile JSON record, file a profile issue, or prepare a fork and pull request.
---

# Add Lineage

Generate one complete raw profile JSON record that validates against `data/schema/profile.v1.schema.json`.

## Collect

Collect the profile ID shown in the explorer for an existing person. Read that person's raw record first, retain every existing field, and update only evidence-backed values. For a new person, generate the full raw shape from profile schema v1.

For every source retain `kind`, `url`, `confidence`, and a precise `note` stating what the source proves. Use `advisorPersonId` only for an existing profile ID; otherwise use `advisorLabel`. Do not infer advisor relationships from co-authorship or affiliation alone. Do not include generated `coverage`.

Write the result to a JSON file such as `/tmp/profile.json` and validate it before offering a publication path:

```bash
npm run import:profile-issue -- --file /tmp/profile.json
```

## Issue Path

1. Set the title to `[Profile] Researcher Name`.
2. Paste the complete JSON output into the repository's profile-correction issue template.
3. Create the issue with `gh issue create` when authenticated, or give the user the completed title and JSON for pasting.

## Fork And Pull Request Path

1. Fork the repository and merge the single-person JSON output into `data/raw` by ID:

```bash
npm run import:profile-issue -- --file /tmp/profile.json
npm run import:profile-issue -- --file /tmp/profile.json --apply
```

2. Run `npm run build:data` and `npm test`.
3. Start `npm run dev`, search for the profile ID/name, verify fields and source notes, then use **View local lineage** when an advisor edge changed.
4. Commit the merged `data/raw/people-*.json` change and open a pull request that identifies the profile ID.

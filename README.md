# Computing Genealogy Explorer

Explore computer science academic genealogy: PhD advisors, students, institutions, and lineage networks across security research.

**Live demo:** https://cyruscyliu.github.io/computing-genealogy-project/

Search 3,915 researcher profiles, inspect exact local PhD lineages, and explore institution-level research networks.

## Scope and data

Computing Genealogy Explorer maps PhD advisor and student relationships for computer science and systems security researchers.

The dataset combines the top-authors system security ranking with DBLP, CSRankings, Google Scholar, ORCID, official university profiles, lab pages, CVs, and dissertation records. Each profile retains source provenance.

## Contribute data

Use `$add-lineage` to research a person and generate one complete, sourced raw profile JSON record. The record is validated against [profile schema v1](data/schema/profile.v1.schema.json); retain `id`, all existing fields, and every source's `kind`, `url`, `confidence`, and `note`. Do not infer advisor relationships from co-authorship or affiliation alone.

The profile ID is displayed below the selected name in the explorer. For an existing person, give that ID to the skill so it updates the exact record rather than resolving by name.

### File an issue

Open the [profile correction issue](https://github.com/cyruscyliu/computing-genealogy-project/issues/new?template=profile-correction.md), set the title to `[Profile] Researcher Name`, and paste the single-person JSON produced by `$add-lineage`. Use this route when you want maintainers to merge the record into `data/raw`.

### Fork and open a pull request

Ask `$add-lineage` for a complete `/tmp/profile.json`, fork the repository, then merge that one-person record into the raw dataset by ID:

```bash
npm install
npm run import:profile-issue -- --file /tmp/profile.json
npm run import:profile-issue -- --file /tmp/profile.json --apply
npm run build:data
npm test
```

The first command is a no-write preview. `--apply` replaces the existing record with the same `id`, or adds a new record to the correct `data/raw/people-<letter>.json` bucket. Commit that merged raw-data change and open a pull request. The importer validates profile schema v1, advisor references, and uses a file lock while writing `data/raw`.

## Verify the update

Start the website after applying the profile update:

```bash
npm run dev
```

Open `http://127.0.0.1:3000/` and:

1. Search for the researcher by their name or alias, then open the profile.
2. Confirm each changed institution, degree, graduation year, or advisor appears in the profile details.
3. Open every cited source from the profile's **Sources** list and check the displayed source note explains the fact it supports.
4. For a PhD advisor or PhD student update, select **View local lineage** and confirm the advisor-student edge and surrounding lineage are correct.

## Review and merge

Every pull request runs an automated validation workflow. It rebuilds the complete dataset from `data/raw/` to check the profile schema, duplicate IDs, and advisor references, then runs the test suite. A maintainer checks the submitted evidence before merging.

After merge, the GitHub Pages workflow rebuilds and deploys the explorer automatically.

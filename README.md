# Computing Genealogy Explorer

Explore computer science academic genealogy: PhD advisors, students, institutions, and lineage networks across security research.

**Live demo:** https://cyruscyliu.github.io/computing-genealogy-project/

Search 3,915 researcher profiles, inspect exact local PhD lineages, and explore institution-level research networks.

## Scope and data

Computing Genealogy Explorer maps PhD advisor and student relationships for computer science and systems security researchers.

The dataset combines the top-authors system security ranking with DBLP, CSRankings, Google Scholar, ORCID, official university profiles, lab pages, CVs, and dissertation records. Each profile retains source provenance.

## Contribute data

Start with the profile ID shown below a selected researcher's name, plus anything you already know:

```text
$add-lineage dawn-song https://example.edu/cv.pdf
$add-lineage dawn-song PhD, UC Berkeley, advised by David Wagner
$add-lineage dawn-song
```

`$add-lineage` reads the existing profile, parses the links and facts you provide, researches missing evidence, and asks only for useful follow-up details. Reply `skip` to any question you cannot answer. It creates the complete sourced JSON record and validates it against [profile schema v1](data/schema/profile.v1.schema.json).

### File an issue

After `$add-lineage` finishes, open the [profile correction issue](https://github.com/cyruscyliu/computing-genealogy-project/issues/new?template=profile-correction.md), set the title to `[Profile] Researcher Name`, and paste its JSON output. Use this route when you want maintainers to merge the record into `data/raw`.

### Apply, verify, and open a pull request

Ask `$add-lineage` for a complete `/tmp/profile.json`, fork the repository, then merge that one-person record into the raw dataset by ID and validate it:

```bash
npm install
npm run import:profile-issue -- --file /tmp/profile.json
npm run import:profile-issue -- --file /tmp/profile.json --apply
npm run build:data
npm test
```

The first command is a no-write preview. `--apply` replaces the existing record with the same `id`, or adds a new record to the correct `data/raw/people-<letter>.json` bucket. The importer validates profile schema v1, advisor references, and uses a file lock while writing `data/raw`.

Then start the website:

```bash
npm run dev
```

Open `http://127.0.0.1:3000/` and:

1. Search for the researcher by their name or alias, then open the profile.
2. Confirm each changed institution, degree, graduation year, or advisor appears in the profile details.
3. Open every cited source from the profile's **Sources** list and check the displayed source note explains the fact it supports.
4. For a PhD advisor or PhD student update, select **View local lineage** and confirm the advisor-student edge and surrounding lineage are correct.
5. Commit the merged `data/raw/people-*.json` change and open a pull request.

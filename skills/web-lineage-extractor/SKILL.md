---
name: web-lineage-extractor
description: Extract academic lineage data from personal homepages, faculty pages, lab pages, CVs, and curated ranking pages for the academic-lineage-analyzer app. Use when scanning websites or resume-like pages to infer work institution, undergraduate school, master's school if present, PhD school and advisor, postdoc school and advisor, dblp author id if available, and evidence-backed advisor-student relationships such as “advised by”, “my advisor”, “PhD student of”, or faculty pages listing current and former students. Includes confidence scoring based on direct wording, source authority, and bilateral corroboration across both advisor and student pages.
---

# Web Lineage Extractor

Use this skill when converting web pages or CV text into structured lineage records for `apps/academic-lineage-analyzer`.

## Output target

Write normalized people records into:

- `apps/academic-lineage-analyzer/data/raw/people-*.json`

Keep the app schema stable. If you need scoring or extra evidence, store it under `sources[]` notes or in an ingestion artifact outside the app dataset.

## What to extract

For each person, extract only these lineage fields:

- dblp author id if available
- work institution if available
- undergraduate school
- master's school if present
- PhD school
- PhD advisor
- postdoc school
- postdoc advisor

Also extract relationship evidence when the page implies:

- `advised by X`
- `I am a PhD student advised by X`
- `X is my advisor`
- `PhD student of X`
- faculty/lab page lists `students`, `current students`, `former students`, `advisees`, `alumni`

## Source priority

Prefer higher-authority sources first:

1. Official CV
2. Official personal homepage
3. Official faculty page
4. Official lab or group page
5. Official university news or alumni page
6. Official publication-site author bio or paper PDF bio
7. University profile page
8. Third-party bio page

If lower-authority sources conflict with higher-authority sources, prefer the higher-authority source and note the conflict.

## Workflow

1. Read the page and identify the focal person.
2. Extract explicit education and advisor claims.
3. Immediately look for linked `CV`, `Bio`, `Group`, `Lab`, `People`, or `Team` pages.
4. If the focal person has an advisor, pivot to the advisor's homepage and CV before doing broader search.
5. If an advisor runs a lab or team page, scan that page for student and postdoc lists.
6. Use official news, alumni stories, and official paper-site bios only to fill gaps or corroborate.
7. Decide whether each claim is direct, inferred, or unsupported.
8. Normalize names and school names consistently.
9. Create or update person records.
10. Preserve source provenance in `sources[]`.

## Ranking page workflow

For curated ranking pages such as `top-authors-sys_sec.html`:

1. Extract the DBLP author id from the name column exactly as shown.
2. Extract the current work institution only when the row explicitly provides one.
3. Create seed nodes when the page does not provide lineage details.
4. Do not infer advisors, degrees, or postdocs from the ranking page alone.
5. Prefer later official homepages over the ranking page if the current work institution differs.
6. Treat the ranking page only as a people index, not as stable profile metadata.
7. Do not persist volatile ranking position, score, or paper-count fields in the core lineage dataset unless the user explicitly asks for ranking analytics.

Use the importer script when appropriate:

- `node scripts/import-top-authors.mjs`
- `node scripts/import-top-authors.mjs <ranking-url> <limit>`

By default, the importer should ingest the full ranking page. Use `<limit>` only for explicit sampling or debugging.

## Ranking-seed enrichment

After importing seeds from a ranking page, upgrade them in this order:

1. keep `dblpAuthorId` from the ranking page
2. find the official homepage or official university profile
3. look for a CV PDF linked from the official page
4. replace the seed-only summary with official lineage facts
5. switch `tracking.status` from `seed` to `active` when official lineage fields are found

Use the ranking page only to bootstrap identity. The enriched record should become homepage/CV-driven once official sources are available.

Reference examples already in the dataset:

- `Dan Boneh`: ranking seed upgraded using Stanford Profiles
- `Michael Backes`: ranking seed upgraded using CISPA profile and official CV
- `Wenke Lee`: ranking seed upgraded using an official Georgia Tech people profile
- `Ahmad-Reza Sadeghi`: ranking seed upgraded using an official TU Darmstadt lab profile
- `Zhiqiang Lin`: ranking seed upgraded using an official Ohio State people profile plus an official department report PDF
- `Adrian Perrig`: ranking seed upgraded using an official Carnegie Mellon engineering biography
- `Thomas Ristenpart`: ranking seed upgraded using an official Cornell Tech research page
- `Christopher Krügel`: ranking seed upgraded using an official UCSB-hosted CV PDF that names both degree institutions and the Ph.D. advisor
- `Xiapu Luo`: ranking seed upgraded using an official PolyU staff page that names BS/MS schools, the Ph.D. advisor, and the postdoc advisor
- `Yang Zhang`: ranking seed upgraded using an official CISPA article that names both Ph.D. supervisors and the postdoc supervisor
- `Ari Juels`: ranking seed upgraded using an official Cornell Tech people page that states the Ph.D. institution

## Official-source enrichment patterns

When upgrading ranking-page seeds, these source types are especially useful:

- official people/faculty profiles that directly state `received his Ph.D. ...`
- official lab-member profiles that state `full professor` and degree history
- official annual reports or department PDFs hosted on the university domain when they provide degree history missing from the profile page
- official engineering biographies that list full BS/MS/PhD chains
- official research-group or research-theme pages that summarize degree history for faculty members
- official faculty-hosted CV PDFs that explicitly name degree institutions, postdoctoral roles, and advisors
- official university staff pages that explicitly name both Ph.D. and postdoc advisors
- student homepages that explicitly say `advised by Professors X and Y` and thereby expose advisor relationships for imported ranking seeds
- official institute news or researcher spotlight pages that summarize both Ph.D. and postdoc supervision

Use official PDFs and annual reports only when they are clearly university-hosted and person-specific or department-specific.

## Recursive crawl order

When exploring a person graph recursively, use this order:

1. focal homepage
2. focal CV
3. focal official faculty/university page
4. focal advisor homepage
5. focal advisor CV
6. advisor lab or team page
7. official university news or alumni articles mentioning `advisor`, `student`, or degree history
8. official paper/PDF author bios for missing undergraduate history

Stop recursion when a node only has weak evidence or only third-party sources.

## Direct textual evidence

Treat the following as strong direct evidence:

- `advised by David Wagner`
- `my advisor is David Wagner`
- `Ph.D. student at UC Berkeley, advised by David Wagner`
- `completed his PhD under Eric Brewer`
- `postdoctoral scholar with X`

Treat the following as moderate evidence:

- `works with David Wagner`
- `member of Wagner Group`
- `supervised by`
- `mentor`

These are useful but less precise because they may describe collaboration rather than formal lineage.

Treat these as strong advisor-side evidence:

- `Currently advised Ph.D. students`
- `Graduated Ph.D. students`
- `Current students`
- `Former students`
- `Postdoctoral scholars`
- `Group members` when the page clearly belongs to a professor's lab and roles are explicit

Treat these as corroboration-only unless paired with stronger evidence:

- `Visiting PhD student`
- `member`
- `researcher`
- `affiliate`

## CV parsing rules

CVs often encode lineage in compact formats. Look in:

- `Education`
- `Academic Appointments`
- `Curriculum Vitae`
- `Advisor`
- `Dissertation`
- `Thesis`
- `Postdoctoral Training`
- `Current Students`
- `Graduated Students`
- `Supervision`
- `Advising`

Typical patterns:

- `M.S., Computer Science, UC Berkeley`
- `Ph.D., Computer Science, UC Berkeley, Advisor: Eric Brewer`
- `Postdoctoral Scholar, Stanford University, Host: X`
- `B.Eng., Shanghai Jiao Tong University`

If a CV lists degree, institution, and advisor in one block, treat that as direct evidence.

If a CV lists `Currently advised Ph.D. students` or `Graduated Ph.D. students`, treat that as direct advisor-side evidence for those students.

## Lab and team page parsing

Lab and team pages are high-yield recursive sources. Scan for:

- `People`
- `Members`
- `Team`
- `Current Members`
- `Students`
- `PhD Students`
- `Postdocs`
- `Alumni`
- `Graduated PhD Students`
- `Former Members`

Interpretation rules:

- `PhD student`, `graduated PhD student`, `postdoc`, `postdoctoral scholar`: strong role evidence
- `visiting PhD student`: useful corroboration for institution and timing, but not enough by itself to assign advisor
- `alumni` with no role: weak unless another source clarifies degree stage
- `members` without role labels: medium at best

Mathias Payer / HexHive is the reference pattern:

- advisor homepage points to a lab page
- lab page lists current and former students/postdocs
- CV explicitly labels advised PhD students

When this pattern appears, use the lab page to enumerate downstream students and the CV to raise confidence.

## Official news and alumni pages

Official university news and alumni pages can be stronger than generic profiles when they use explicit relationship wording.

Useful patterns:

- `X, a Ph.D. student in Y's lab`
- `advised by Professor Y`
- `received his PhD ... advisor Y`
- one article listing BS, MS, and PhD institutions together

These pages are especially useful when the focal homepage omits undergraduate history or the advisor page does not list students.

## Official paper and PDF bios

If homepage and CV omit early education, inspect official paper PDFs or publication-site author bios hosted on the person's own domain or official lab domain.

Use these mainly for:

- undergraduate school
- prior institution
- older title and affiliation snapshots

Do not use them as the only basis for advisor assignment unless the bio explicitly names the advisor.

## Bilateral corroboration

Score higher when both sides support the relationship:

- student page says `advised by X`
- advisor page or lab page lists the student among `students` or `advisees`

If only one side states the relationship, keep it with lower confidence.

## Confidence scoring

Read [references/scoring.md](references/scoring.md) before assigning confidence.

Use one of:

- `high`
- `medium`
- `low`

High confidence usually requires either:

- one authoritative direct statement with explicit advisor wording, or
- bilateral corroboration from advisor and student sides

## Normalization

- Use stable lowercase hyphen ids such as `david-wagner`.
- If a source provides a stable external id such as `dblp` author id, store it in `dblpAuthorId`.
- Use official English school names when available.
- Keep aliases for Chinese names or alternate spellings.
- Prefer fresher official homepages over stale ranking pages for `work.institution`, but still keep the ranking-page `dblpAuthorId`.
- If an advisor is known by name but not yet modeled, set `advisorLabel` and create a `seed` person record when future tracking is likely.

## Update policy

- Do not invent missing schools or advisors.
- Do not promote weak collaboration language into a formal advisor relation without evidence.
- Keep uncertain claims, but mark them with lower-confidence source notes.
- If evidence conflicts, preserve the strongest claim and note the conflict in `sources[]`.
- Do not convert coauthorship, same-department affiliation, or unlabelled team membership into advisor edges.
- Do not convert `visiting student` into a PhD advisor edge unless another official source states `advised by`, `under the guidance of`, or equivalent.

## Output shape

Read [references/output-schema.md](references/output-schema.md) for the normalized record shape and evidence note conventions.

## Field lessons from the 10-person crawl

Read [references/patterns-from-10-person-crawl.md](references/patterns-from-10-person-crawl.md) when doing recursive expansion. It captures concrete patterns that worked on:

- Sizhe Chen
- David Wagner
- Qiang Liu / Cyrus CY Liu
- Mathias Payer
- Yajin Zhou
- Xuxian Jiang

## Trigger phrases

This skill should trigger for requests like:

- scan this homepage and extract lineage
- parse this CV for advisor relationships
- determine PhD advisor from faculty and student pages
- add many people from university websites
- infer advised-by relationships with confidence

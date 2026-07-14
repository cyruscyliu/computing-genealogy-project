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

Metasearch systems such as SearXNG are discovery tools only. They can parallelize finding official pages, but they are not provenance sources for lineage facts. Persist only the official page, CV, thesis, or university-hosted report URL in `sources[]`.

Mathematics Genealogy Project can be used as the first lead-generation step:

- search the target name there first
- collect the candidate advisor and advisee names from the matching page
- use those names to check our existing seeds and unresolved people
- use the MGP result to focus official-source discovery and double-check likely relationships
- do not treat MGP alone as final provenance when stronger official sources are available

Helper command:

- `node scripts/mgp-leads.mjs --person-id <dataset-id>`
- `node scripts/mgp-leads.mjs --name "Full Name"`
- `node scripts/mgp-leads.mjs --id <mgp-id> --json`
- `node scripts/mgp-batch-scan.mjs --resume --limit 25 --delay-ms 1500`

Caching behavior:

- `scripts/mgp-leads.mjs` caches per-name search results and per-profile pages under `.cache/discovery/mgp/`
- `scripts/mgp-batch-scan.mjs` writes one local cross-check record per scanned person under `.cache/discovery/mgp-active/`
- batch progress is resumable through `.cache/discovery/mgp-active-state.json`

## Workflow

Before broad analysis, prefer repo scripts and workflows that already consult the unified cache layout under `.cache/`.

Use the unified cache structure as read-only analysis context:

- `.cache/indexes/cache-index.json` for a quick inventory of what is already cached
- `.cache/discovery/` for search and official-page discovery artifacts
- `.cache/resolution/` for homepage-resolution artifacts
- `.cache/snapshots/sources/` for cached HTML, PDF, and metadata snapshots

Do not edit cache files manually from this skill. Let the project code populate and refresh cache entries.

When a needed official page or PDF is missing from cache, populate it through the project scripts rather than ad hoc filesystem writes:

- `node scripts/fetch-source-snapshots.mjs <url...>`
- `node scripts/fetch-source-snapshots.mjs --file <urls.txt>`
- `node scripts/reindex-cache.mjs`
- `node scripts/migrate-cache-layout.mjs` when older cache trees need to be normalized into the unified layout

1. Search the target name in Mathematics Genealogy Project first.
2. Record the candidate advisor and advisee names from the matching page.
3. Check those candidate names against our current seeds and unresolved people.
4. Resolve the homepage.
5. Use CSrankings as the primary homepage discovery index when a matching `dblpAuthorId` or name+affiliation entry exists.
6. If CSrankings misses or is ambiguous, use an official institution directory or known official subsite.
7. Read the homepage and identify the focal person.
8. Extract explicit education and advisor claims.
9. Immediately look for linked `CV`, `Bio`, `Group`, `Lab`, `People`, or `Team` pages.
10. If the focal person has an advisor, pivot to the advisor's homepage and CV before doing broader search.
11. If an advisor runs a lab or team page, scan that page for student and postdoc lists.
12. Use official news, alumni stories, and official paper-site bios only to fill gaps or corroborate.
13. Decide whether each claim is direct, inferred, or unsupported.
14. Normalize names and school names consistently.
15. Create or update person records.
16. Preserve source provenance in `sources[]`.
17. Use cache-aware project scripts during discovery and analysis whenever they cover the task, so repeated homepage resolution, search discovery, and snapshot fetches reuse cached results automatically.
18. After each completed batch, reflect on what improved throughput or evidence quality.
19. Note which institution directory patterns matched cleanly.
20. Note which biography phrases yielded direct lineage facts.
21. Note which pages required a second hop to CVs or dissertations.
22. Update this skill when a new reliable pattern, stop condition, or batching heuristic appears.
23. Treat the reflection as part of the batch completion criterion: do not start the next broad scout batch until you have captured the reusable lesson from the previous batch.
24. When multiple unresolved buckets are plausibly searchable independently, prefer parallel official-only scout passes via subagents instead of serial manual searching.
25. Use parallel scouts for breadth-first discovery across institutions, then merge only the qualifying explicit lineage facts back into the main batch.

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

CSrankings can be used as a discovery index for homepage URLs, but not as provenance for lineage facts. Use it to find an official homepage quickly, then extract facts only from the official homepage, CV, dissertation page, or other official source it leads to.

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
- official institute or lab directory profiles with standardized biography blurbs, such as CSAIL-style people pages, that compactly state current role and degree history across many faculty records

When a faculty or institute directory page gives degree history but not advisor names, follow its outbound links in this order:

1. linked personal homepage
2. linked CV PDF
3. linked thesis or dissertation PDF

This pattern is high-yield because the directory page often confirms the canonical current institution while the linked dissertation approval page names the adviser explicitly.

Another reliable pattern on official faculty homepages:

- `Graduated Ph.D. Students`
- `Past Ph.D. Students`
- `Students and Postdocs`

When these sections list named students and link to university dissertation or technical-report pages, treat the faculty page as strong advisor-side evidence and the linked dissertation page as a second official source for the student's Ph.D. school, title, year, and advisor name.

For CISPA specifically, the official people directory at `cispa.de/en/about/people` is batch-friendly:

- directory cards expose canonical names and stable profile URLs under `/en/people/...`
- profile biographies often summarize prior roles in one paragraph with phrases such as `did his Ph.D. at`, `obtained his PhD from`, `was advised by`, `under the supervision of`, and `was a Post-Doc researcher at`
- these profiles are strong official sources for degree institutions, postdoctoral institutions, and occasionally named Ph.D. advisors

When using CISPA pages in bulk, cache the directory HTML and the individual profile HTML, then exact-match the displayed profile name to the seed record before extracting lineage facts.

Another useful CISPA refinement:

- some profile pages expose a short biography paragraph plus compact structured profile details below it
- the structured details can confirm a doctoral field or postdoctoral role even when the biography paragraph carries the main lineage sentence
- prefer the biography paragraph for institution and advisor wording, and use the structured detail block only as a secondary confirmation

Also classify institution-profile matches into two buckets early:

- `biography-rich`: the official profile contains direct phrases about degree history, supervision, or postdoctoral roles
- `biography-shallow`: the official profile mostly lists current role, publications, or contact details without lineage facts

Promote only `biography-rich` matches directly from the profile page. For `biography-shallow` matches, keep the seed unchanged until a second-hop official source such as a CV, dissertation page, or lab biography adds real lineage evidence.

One high-yield exception: if a `biography-shallow` official profile links to an official CV PDF on the same institution domain, escalate immediately to that CV before deferring the record. In practice, this often recovers full degree chains even when the profile page itself is sparse.

Stop condition for an institution batch:

- when the current batch splits cleanly into `rich`, `shallow-stop`, and `unmatched`
- and no real second-hop official sources remain for the `shallow-stop` set

At that point, move to the next institution instead of continuing to search the same directory surface. This keeps throughput high and avoids wasting time on profiles that are officially present but lineage-sparse.

Georgia Tech has another useful official pattern:

- school-hosted people pages under `scp.cc.gatech.edu/people/...` and `scs.gatech.edu/people/...`
- a `Biography` block often contains direct degree history in one paragraph
- advisor names may appear on the next line rather than in the same sentence, so extract adjacent lines together before deciding that an advisor is missing

These pages are strong official sources for degree institutions and can often promote seeds without a CV hop.

Another evidence rule from these pages:

- if an official biography explicitly names a school and one or more advisors or supervisors
- but does not explicitly name the degree title

then keep the school and advisor information, but leave the stage `status` as `null`. Do not upgrade the degree label from context alone. This preserves the lineage edge without overclaiming the credential.

Georgia Tech stop condition:

- if a slice is dominated by `already-active` plus `unmatched`
- and the remaining matched profile has no direct degree wording and no linked official CV, bio, or dissertation source

then the Georgia Tech slice is practically saturated and it is time to move to the next institution. Georgia Tech tends to reward broad official-surface coverage early, but yields diminish quickly once the obvious SCP/SCS/ECE/faculty-homepage paths are exhausted.

Carnegie Mellon has another useful official pattern:

- many official faculty homepages are hosted directly on CMU domains such as `andrew.cmu.edu`, `cs.cmu.edu`, and `ece.cmu.edu`
- some homepages place degree history in a compact first paragraph or a linked CMU-hosted `bio` page rather than in a structured `Education` block
- official bio tables can still be strong provenance when they explicitly map rows like `Undergrad` and `Doctorate` to named schools
- doctoral degree pages under `csd.cmu.edu/.../degrees-conferred/...` are high-yield for advisor edges because they often name the advisor explicitly
- summit, fellows, and spotlight pages can also be valid official sources for newer faculty or student researchers when they explicitly state degrees or advisors

For Carnegie Mellon specifically:

- prefer CMU-hosted `bio` pages when the homepage links to them, because they often compress degree facts better than the landing page
- treat CMU-hosted text bios as official sources even when they are plain `.txt` files, if they are clearly published from the faculty member's CMU homepage
- do not use a same-name CMU administrative page unless it is clearly about the target person; CMU has multiple leadership and business-school pages that can create false positives
- CMU engineering or ECE pages sometimes expose a compact structured `Education` section even when the main biography is sparse; prefer that block over surrounding prose
- advisor-side CMU faculty pages can also be strong when they explicitly list a student in a parenthetical form like `CMU ECE PhD, co-advised with ...`; that is enough to promote the student to an active Ph.D.-stage record with the named advisors
- when a CMU doctoral degree page gives only the Ph.D. fact and advisor, still promote the record; do not wait for BS/MS if the advisor edge is explicit

Penn State has another useful official pattern:

- official IST directory pages often expose both a compact education list and a biography paragraph that repeats the degree chain in plain language
- Penn State-hosted CVs on `cse.psu.edu` or `faculty.ist.psu.edu` can provide advisor names when directory pages only list institutions and degree titles
- the CMLA or EECS community pages may contain dense biography paragraphs with explicit degree history for individual faculty

For Penn State specifically:

- prefer an official same-domain CV when the faculty page links to it, especially for advisor extraction
- when both a directory `Education` list and a biography paragraph exist on the same official page, use both and prefer the more specific wording for degree titles and years

UIUC has another useful official pattern:

- official `ece.illinois.edu` directory profiles often expose a compact `Education` block with direct degree statements
- older UIUC lab or group pages on `cs.uiuc.edu`, `web.engr.illinois.edu`, or other university-hosted subdomains can still contain short biography paragraphs with explicit `received a PhD from ...` wording
- official UIUC-hosted CVs on `*.web.illinois.edu`, `cs.illinois.edu`, or other Illinois subdomains are often the fastest path for multi-stage lineage because they can expose BS/MS/PhD/postdoc chains and named advisors in one place
- official Illinois news or faculty-announcement pages can be biography-rich for newly hired faculty and may explicitly state bachelor's, master's, Ph.D., and postdoctoral history even when the faculty directory page is sparse
- these pages are usually faster to parse than publication-heavy personal sites and are strong official sources when they are clearly university-hosted

For UIUC specifically:

- prefer official university-hosted directory pages and group pages over personal domains returned by CSrankings
- when a directory `Education` entry includes advisor and dissertation title, preserve the advisor and ignore the dissertation title unless it adds lineage evidence
- if a UIUC-hosted CV is linked from the homepage or is directly discoverable on the same Illinois-hosted domain, escalate to the CV immediately
- treat Illinois news features about new faculty as valid official lineage sources when they explicitly state prior degrees or postdoctoral roles

Northeastern has another useful official pattern:

- official Khoury faculty pages often expose a clean structured education block with BS/MS/PhD data and are usually sufficient on their own
- Northeastern ECE or College of Engineering faculty pages can serve the same role for non-Khoury faculty and may expose the degree chain in a compact biography block
- when the Khoury page is shallow, an official Northeastern catalog or school profile can still provide a single high-confidence PhD fact that is worth capturing

For Northeastern specifically:

- prefer `khoury.northeastern.edu/people/...` pages first because they are high-yield and low-noise
- if the page states only one degree explicitly, record only that degree and do not infer missing stages from rank or field

NYU has another useful official pattern:

- official NYU faculty pages and NYU-hosted CV PDFs are often the fastest path for complete BS/MS/PhD chains
- NYU bulletin faculty entries are useful when the faculty page is sparse and can still provide a high-confidence Ph.D. fact
- NYU-hosted dissertation PDFs can provide exact degree titles and advisor edges for student or recent-alumni records

For NYU specifically:

- prefer same-domain CV PDFs on `cs.nyu.edu`, `engineering.nyu.edu`, or `cims.nyu.edu` when available
- if a dissertation PDF names the advisor but does not restate earlier schools, record the advisor edge and leave missing earlier stages null unless another official NYU source states them

University of Michigan has another useful official pattern:

- regents appointment, promotion, and reappointment PDFs are high-yield official sources for faculty lineage
- Michigan-hosted faculty homepages and CV PDFs often add advisor data that regents PDFs omit
- CSE new-faculty or chair-announcement stories can provide concise official Ph.D. facts even when the homepage is sparse

For Michigan specifically:

- prefer regents PDFs for exact school-degree-year facts
- use a second official Michigan source to add advisors only when the advisor is explicitly named
- if a result looks suspiciously duplicated from another person, verify it before importing; regents-derived summaries are high-value but not immune to matching mistakes

Virginia Tech has another useful official pattern:

- `website.cs.vt.edu/people/faculty/...` pages often expose compact degree lists with years and are a good first-pass source
- VT-hosted CV PDFs under faculty or lab domains are often needed for advisor extraction or multi-master histories
- VT-hosted center pages, initiative pages, and spotlight pages can still be valid lineage provenance when they explicitly state prior schools, postdocs, or advisors

For Virginia Tech specifically:

- prefer the faculty page first, then escalate to a linked VT-hosted CV PDF for advisor details
- if a spotlight or publication-bio page only proves a Ph.D.-student relationship, record that exact role and do not upgrade it to a completed doctorate

Arizona State has another useful official pattern:

- `search.asu.edu/profile/...` pages are often the fastest official source and commonly expose compact degree lists with years
- ASU engineering welcome/news pages are useful for newer faculty and often contain one clear sentence with prior degree history
- center or initiative people pages can provide advisor edges when standard faculty pages do not

For Arizona State specifically:

- prefer `search.asu.edu/profile/...` pages first because they are high-yield and low-noise
- if an ASU page gives only Ph.D. and master's facts, record only those stages and do not infer the undergraduate institution

Columbia has another useful official pattern:

- Columbia Engineering directory pages often expose clean BS/MS/PhD blocks directly on the profile
- Columbia-hosted CV PDFs under engineering or CS domains are strong sources for advisor extraction
- department new-faculty announcements and official news stories can be enough to promote a record when they explicitly state degree history

For Columbia specifically:

- prefer Engineering directory pages first, then same-domain CV PDFs, then official department/news pages
- Columbia-hosted frontmatter, short-bio, or lecture PDFs can be valid lineage provenance when they explicitly name a degree or advisor

ETH Zurich has another useful official pattern:

- ETH staff profiles, lab pages, and hosted CV PDFs often expose compact degree chains and sometimes named advisors
- ETH news spotlights are especially useful for new faculty or doctoral researchers and may explicitly state prior schools and supervisors
- ETH-hosted paper PDFs can provide acceptable biography-block evidence when the author blurb clearly states the degree fact

For ETH specifically:

- prefer person-detail pages and hosted CV PDFs first
- if a spotlight proves only a doctoral-student relationship or postdoctoral role, record that exact role rather than inferring degree completion

Ruhr-University Bochum has another useful official pattern:

- CASA and HGI news/team pages are high-yield official sources and often summarize full degree chains in prose
- `informatik.rub.de` faculty pages and Ruhr-hosted PDFs can add advisor or doctoral-student details when team pages are shallow
- completed-doctorate or thesis PDFs are especially valuable for advisor edges

For Ruhr specifically:

- prefer CASA/HGI team and news pages first, then escalate to `informatik.rub.de` pages or Ruhr-hosted PDFs for advisor details
- when a Ruhr source describes a diploma path instead of separate BS/MS degrees, preserve the exact wording and avoid inventing a split degree structure

Boston University has another useful official pattern:

- BU-hosted CV PDFs are often the strongest source and frequently expose full BS/MS/PhD/postdoc chains plus named advisors
- BU faculty profiles on `bu.edu/cs`, `bu.edu/eng`, and `bu.edu/hic` often provide at least one explicit degree fact even when the CV is absent

For Boston University specifically:

- prefer same-domain CV PDFs first when available
- when a BU-hosted CV lists advisor or mentor names for the master's, Ph.D., or postdoc stage, keep those edges explicitly

National University of Singapore has another useful official pattern:

- NUS Computing faculty pages and hosted CVs are often concise and high-yield for degree chains
- NUSGS thesis-advisor pages are strong official sources for a single explicit Ph.D. fact when the main faculty page is sparse
- NUS-hosted CVs sometimes expose postdoctoral roles even when the profile page does not

For NUS specifically:

- prefer NUS Computing faculty pages first, then hosted CVs, then NUSGS thesis-advisor pages
- if the NUSGS page gives only the doctoral institution, record only that stage and do not infer earlier schools

Cornell has another useful official pattern:

- Cornell-hosted CV PDFs and faculty bios are often the fastest route for senior faculty lineage
- Cornell Tech news and program pages can provide clean degree summaries for newer or jointly appointed faculty
- the Cornell CS Ph.D. alumni page is a strong source for advisor edges on recent Cornell doctorates

For Cornell specifically:

- prefer Cornell-hosted CVs first, then official Cornell Tech or CS faculty pages
- when the Cornell CS Ph.D. alumni page names the advisor and year, that is sufficient to promote the Ph.D. stage even if earlier schools remain unknown

Princeton has another useful official pattern:

- Princeton-hosted faculty CVs, resumes, and vita pages often expose dense lineage detail, including advisor names
- official Princeton news and online profiles are useful for concise degree chains and postdoctoral facts
- advisor-side evidence can come from Princeton-hosted faculty CVs that list former students with completion year and advisor name

For Princeton specifically:

- prefer Princeton-hosted CVs/resumes/vita pages first, then ECE/CS profiles, then official Princeton news pages
- if a Princeton-hosted source proves a doctoral completion and names the advisor, record that edge even when the same source omits earlier degrees

Singapore Management University has another useful official pattern:

- hosted faculty CV PDFs under `computing.smu.edu.sg` are often the strongest source and typically expose structured education blocks
- faculty profiles can help confirm identity, but the hosted CV usually carries the detailed degree chain

For Singapore Management University specifically:

- prefer hosted CV PDFs first
- if the CV gives a university name without a campus qualifier, preserve the exact wording instead of guessing the campus

University of Washington has another useful official pattern:

- `faculty.washington.edu`, `homes.cs.washington.edu`, and `cs.washington.edu` pages often expose strong lineage data
- UW-hosted CV PDFs are especially valuable for advisor extraction and multi-degree histories
- faculty pages can provide concise advisor-side evidence for Ph.D. and postdoc relationships even when no CV is linked

For University of Washington specifically:

- prefer UW-hosted CV PDFs first when they exist
- if a faculty page says someone `did their Ph.D. with ...` or `was a post-doc with ...`, record the named advisor or mentor edge directly

KAIST has another useful official pattern:

- KAIST PURE profiles often expose a compact education block that is good enough for BS/MS/PhD promotion
- KAIST-hosted CV PDFs and lab pages are better for advisor extraction
- hosted paper PDFs can be acceptable biography-block evidence when they explicitly state degrees and supervision

For KAIST specifically:

- prefer PURE profiles for broad degree coverage, then escalate to hosted CVs or lab pages for advisor details
- if a source proves only an advisor edge or only a doctoral-student relationship, preserve that exact role and do not over-upgrade the record

University of Chicago has another useful official pattern:

- UChicago faculty pages and hosted CVs often expose direct advisor language
- UChicago news or data science profiles are useful for concise degree chains when faculty pages are sparse
- event pages can provide advisor edges for newer researchers when the main profile omits them

For University of Chicago specifically:

- prefer hosted CVs first, then CS/Data Science profiles, then official news or event pages
- when a UChicago source only proves an advisor relationship but not a completed doctorate, preserve the advisor edge and keep the degree status exact

Yale has another useful official pattern:

- Yale Engineering faculty pages often expose concise degree chains directly on the profile
- Yale-hosted CV PDFs can add advisors and postdoctoral mentors when the profile page is sparse
- Yale dissertation or GSAS records are strong sources for advisor edges on recent doctorates

For Yale specifically:

- prefer Engineering faculty pages first, then Yale-hosted CV PDFs, then dissertation records
- if a Yale source only proves an advisor edge or a doctoral-student relationship, preserve that exact role instead of upgrading to a completed doctorate

Stanford has another useful official pattern:

- Stanford faculty profiles, CAP printer profiles, and hosted CV PDFs frequently expose clean BS/MS/PhD chains
- Stanford news stories can still be valid official lineage sources when they explicitly state doctoral study and advisors

For Stanford specifically:

- prefer hosted CV PDFs and CAP/faculty profiles first
- if a Stanford source describes doctoral study plus advisor but not a separately named undergraduate degree, record only the explicit stages

University of Pennsylvania has another useful official pattern:

- Penn CIS-hosted CV PDFs are especially strong for advisor extraction
- Penn Almanac or CIS highlight pages can be enough for senior or newly hired faculty when they explicitly state degrees or postdoctoral roles
- Penn alumni or ScholarlyCommons dissertation records are useful for recent advisor edges even when earlier stages are missing

For University of Pennsylvania specifically:

- prefer Penn-hosted CV PDFs first, then Almanac/CIS highlight pages, then dissertation or alumni records
- when a Penn source gives a degree date plus advisors but not an explicit degree title, preserve the doctoral-record wording instead of over-normalizing it

Duke has another useful official pattern:

- Duke-hosted CV PDFs under CS, ECE, or lab domains are often the best source and frequently include advisor and postdoc details
- Duke Scholars, ECE faculty pages, and Duke news stories can still provide concise degree chains when no CV is available
- Duke dissertation listings can provide advisor edges even when they do not fully restate the degree history

For Duke specifically:

- prefer Duke-hosted CV PDFs first, then ECE/CS faculty pages, then Scholars/news/dissertation pages
- if a Duke source gives only a dissertation record plus advisor, preserve that exact doctoral-record wording instead of upgrading to a stronger degree claim

University of Waterloo has another useful official pattern:

- the CS `contacts` and `about/people` pages often expose compact degree chains with years
- CRYSP `people` pages can provide advisor-linked `M.Math` records that are valuable even when earlier stages are missing
- Waterloo-hosted homepages and CV PDFs are good sources for advisor and postdoc details

For Waterloo specifically:

- prefer `cs.uwaterloo.ca/contacts/...` and `cs.uwaterloo.ca/about/people/...` first
- treat CRYSP `people` entries like `M.Math, Spring 2024, M. Xu, N. Asokan` as partial master's-stage evidence, not a full inferred degree chain
- preserve advisor initials exactly when the official lab page uses initials instead of full names

University of Virginia has another useful official pattern:

- UVA engineering faculty pages are often concise and reliable for degree chains
- CS-hosted homepages can expose weaker but still useful phrases like `PhD dissertation at University of Virginia` or `post-doc work at University of Virginia`
- engineering event pages for defenses can provide advisor edges for recent students

For UVA specifically:

- prefer engineering faculty pages first, then CS-hosted homepages, then engineering event pages
- if a UVA source only proves a defense presentation plus advisor, preserve that as a doctoral-record/advisor edge instead of upgrading it to a stronger completion claim
- when a page says `master's work at ...` or `post-doc work at ...`, keep that wording rather than normalizing it into a stronger credential than the page states

University of Maryland has another useful official pattern:

- UMD CS, ECE, and Cyber profiles often expose short degree summaries
- UMD-hosted CV PDFs can be high-value for advisor extraction, but some reviewed snippets omit the degree-granting institution even when the degree title is explicit
- UMD engineering/news pages are useful for newer faculty when faculty pages are sparse

For UMD specifically:

- prefer CS/ECE/Cyber faculty pages first, then UMD-hosted CV PDFs, then official news stories
- if a UMD-hosted source gives a degree title and advisors but the reviewed extract does not explicitly name the school, keep `school: null`
- do not backfill the missing school from prior knowledge or likely career paths

Stony Brook has another useful official pattern:

- `www3.cs.stonybrook.edu/~...` homepages and CVs are often the richest official source
- CS faculty pages can still provide concise degree chains when no CV is available
- official news stories can provide older degree facts for senior faculty

For Stony Brook specifically:

- prefer `www3.cs.stonybrook.edu/~...` homepages/CVs first, then CS faculty pages, then official news stories
- if a Stony Brook faculty page names a degree type but omits the institution, keep the degree stage partial and do not infer the school
- preserve exact school wording like `Georgia Tech` when that is how the official page states it

Indiana University has another useful official pattern:

- Indiana-hosted CV PDFs under `homes.luddy.indiana.edu` are strong sources for advisor details and multi-stage degree chains
- the Indiana bulletin PDFs and faculty listings can provide fast Ph.D.-only coverage for many faculty
- bulletin PDF text extraction can contain OCR artifacts in school names, so treat those carefully

For Indiana specifically:

- prefer Indiana-hosted CV PDFs first, then Indiana faculty/member pages, then bulletin PDFs or faculty listings
- if an Indiana bulletin gives a clear degree fact but the extracted school string is OCR-corrupted, preserve the doctoral fact and keep the school partial instead of normalizing a likely value
- when a source lists multiple degrees at the same stage family, keep the most relevant computer-science slot structured and preserve the others in the note/provenance

UT Austin has another useful official pattern:

- UT CS-hosted CVs, resumes, vitas, and personal homepages under `cs.utexas.edu/~...` are often enough to cover the full lineage chain
- UT CNS or departmental announcement pages can still provide fast Ph.D.-only coverage for newer faculty when no CV is linked
- advisor data is often embedded directly in hosted CVs rather than on the faculty directory pages

For UT Austin specifically:

- prefer `cs.utexas.edu/~...` CVs, vitas, resumes, and homepages first, then UT faculty pages, then CNS/news announcements
- when a UT Austin source lists multiple undergraduate or master's degrees, keep one structured slot and preserve the extra degrees in the note and provenance
- preserve exact source wording like `UCLA` or `The University of Texas at Austin` when that is how the official page states it

Johns Hopkins has another useful official pattern:

- `cs.jhu.edu/~...` hosted CVs are often the strongest source for advisor details and in-progress student records
- `isi.jhu.edu/team/...` pages can provide concise degree and postdoc chains for security faculty
- JHU faculty pages sometimes expose multi-degree chains without advisor names, which is still high-value

For Johns Hopkins specifically:

- prefer `cs.jhu.edu/~...` hosted CVs first, then `isi.jhu.edu/team/...` pages, then CS faculty pages
- if a JHU-hosted CV shows an ongoing doctoral date range like `2021 - 2025` or `Jan. 2021 - Now`, preserve it as an in-progress doctoral record instead of upgrading it to a completed PhD
- when a JHU source uses the advisor line as the only place tying multiple listed degrees to the institution, preserve that exact context in the note rather than silently strengthening it

UMass Amherst has another useful official pattern:

- the CICS directory is often enough for clean undergraduate/PhD chains and occasional advisor names
- `people.cs.umass.edu/~...` hosted homepages and resumes are strong for advisors and multi-degree provenance
- UMass catalog/directory pages can provide short degree lines, but sometimes omit the school for one stage

For UMass specifically:

- prefer CICS directory pages first, then `people.cs.umass.edu/~...` homepages or resumes, then UMass catalog/directory pages
- if a UMass catalog line gives a degree title and year but omits the institution, keep the stage partial rather than filling it from outside knowledge
- when a UMass-hosted source lists multiple master's-equivalent degrees, keep one structured master's slot and preserve the others in the note/provenance

University of Cambridge has another useful official pattern:

- `cl.cam.ac.uk/~...` hosted CVs and resumes are often the strongest source for explicit BA/PhD chains
- Cambridge-hosted technical reports and paper biography blocks can still provide valid doctoral or undergraduate evidence when they state the degree directly
- Cambridge sources sometimes use college abbreviations like `CC BA06` or college-specific wording such as `Trinity College, Cambridge`

For Cambridge specifically:

- prefer `cl.cam.ac.uk/~...` CVs and resumes first, then Cambridge-hosted technical reports or paper biography blocks
- if a Cambridge source only proves that someone commenced a PhD or submitted a dissertation, preserve that exact doctoral-record strength instead of upgrading it to a completed PhD
- normalize college-level undergraduate references to `University of Cambridge` only when the official source clearly frames them as Cambridge college degrees

University College London has another useful official pattern:

- UCL Profiles pages often provide short, structured degree blocks for faculty
- UCL Discovery PDFs can provide doctoral-degree evidence and occasional postdoc history when profiles are sparse
- some UCL-hosted sources expose multiple master's-equivalent credentials or non-PhD doctoral wording like `Doctor of Sciences`

For UCL specifically:

- prefer UCL Profiles pages first, then UCL Discovery PDFs, then other UCL-hosted CVs or biographies
- preserve exact degree wording such as `Doctor of Sciences` when that is what the official UCL-hosted source states
- when a UCL-hosted source lists multiple master's-equivalent degrees, keep one structured master's slot and preserve the others in the note/provenance

UC San Diego has another useful official pattern:

- `cseweb.ucsd.edu/~...` hosted CVs, bios, and personal pages are often the strongest source for advisor and multi-stage degree chains
- Jacobs School faculty profiles and news releases can still provide concise degree and postdoc facts for faculty without hosted CVs
- UC San Diego-hosted paper biographies are often acceptable when they explicitly state degrees and advisors

For UC San Diego specifically:

- prefer `cseweb.ucsd.edu/~...` CVs and homepages first, then Jacobs School faculty profiles, then Jacobs/CSE news releases and UC San Diego-hosted paper biography blocks
- when a UC San Diego source lists multiple undergraduate or master's-level degrees, keep one structured slot and preserve the others in the note/provenance
- preserve exact advisor wording from the source even if it contains a typographical error

UC Irvine has another useful official pattern:

- UCI faculty profile pages under `faculty.uci.edu` and official `ics.uci.edu` faculty or people pages often provide short direct degree statements
- UCI-hosted CV PDFs under personal or lab sites are strong for full BS/MS/PhD chains
- UCI news pages can provide fast PhD-only coverage for newer faculty when no CV is linked

For UC Irvine specifically:

- prefer hosted CV PDFs and personal faculty sites first, then faculty profile pages, then ICS news pages
- preserve exact degree wording such as `Dr. sc. techn.` or `Dipl. Informatik-Ing. ETH` when that is what the official UCI-hosted source states
- when a UCI source lists two degrees at the same stage family, keep one structured slot and preserve the other in the note/provenance

Georgia Tech has another useful official pattern:

- Georgia Tech repository dissertation PDFs can provide high-confidence doctoral records and advisor edges even when faculty pages are sparse
- Georgia Tech security seminar pages can be useful for active student records when they explicitly name advisor and prior degree
- advisor-side Georgia Tech-hosted CVs can also provide placement or postdoc outcomes for former students

For Georgia Tech specifically:

- prefer faculty/homepage/CV sources first, then repository dissertation PDFs, then seminar or advisor-side official pages
- if a Georgia Tech dissertation PDF gives a degree title and advisor but does not explicitly restate the university in the reviewed extract, keep `school: null`
- preserve in-progress doctoral status exactly when a Georgia Tech page says `second-year Ph.D. student` or `Ph.D. Program`

Purdue has another useful official pattern:

- CERIAS faculty pages and CERIAS event speaker pages can provide fast, official degree chains when CS faculty pages are sparse
- Purdue-hosted student homepages often provide in-progress PhD records and advisor edges
- Purdue news pages remain useful for concise PhD-only coverage on newer faculty

For Purdue specifically:

- prefer faculty pages and Purdue-hosted CVs first, then CERIAS faculty/speaker pages, then official student homepages and news pages
- if a Purdue-hosted source names the degree but omits the school for an earlier stage, keep that stage partial rather than backfilling it
- preserve in-progress doctoral status exactly for pages that say `fifth year Ph.D. student` or similar

Texas A&M has another useful official pattern:

- CSE and SETH profile pages often expose concise degree chains with years
- Texas A&M-hosted paper biographies can provide strong degree evidence when faculty pages are sparse
- official TAMU news pages can provide doctoral and postdoctoral facts for newer faculty

For Texas A&M specifically:

- prefer CSE and SETH profile pages first, then TAMU-hosted faculty homepages, then official news or paper biography pages
- preserve in-progress doctoral wording like `pursuing his Ph.D.` exactly instead of upgrading it to a completed PhD
- when a TAMU-hosted source omits advisor names, do not infer them from likely lab or department affiliations

University of Wisconsin-Madison has another useful official pattern:

- `pages.cs.wisc.edu/~...` homepages and CVs are often the strongest source for full lineage chains and advisor data
- engineering directory profiles can provide clean BS/MS/PhD summaries for newer faculty
- Wisconsin-hosted program PDFs can still be valid official sources for compact doctoral facts

For Wisconsin specifically:

- prefer `pages.cs.wisc.edu/~...` homepages and CVs first, then engineering directory profiles, then official Wisconsin-hosted program PDFs or news items
- when a Wisconsin source lists a postdoctoral fellowship with host institution and years, preserve that full status wording
- if a Wisconsin-hosted source gives only a PhD fact with no advisor, keep it simple and do not backfill from memory

UC Davis has another useful official pattern:

- faculty biographies under `faculty.engineering.ucdavis.edu` often provide concise degree chains and sometimes advisor names
- `cs.ucdavis.edu/~...` hosted vitae and paper biography blocks can be rich enough for advisor extraction
- UC Davis-hosted project pages can sometimes complement another UC Davis source with the missing advisor edge

For UC Davis specifically:

- prefer faculty biographies first, then hosted CVs/vitas and personal pages, then UC Davis-hosted paper biography blocks or project pages
- when two UC Davis-hosted sources complement each other, combine them only if each fact remains explicitly stated by an official UC Davis-hosted source
- if a UC Davis-hosted extract omits the school for one degree stage, keep that stage partial instead of normalizing it from context

Georgetown has another useful official pattern:

- Georgetown faculty and provost/bulletin pages often provide short degree chains for core faculty
- Georgetown-hosted CV PDFs can be strong for advisor and postdoctoral details
- Georgetown center or initiative profile pages can provide useful partial-stage or advisor-side evidence

For Georgetown specifically:

- prefer Georgetown-hosted CV PDFs first, then faculty/bulletin/provost pages, then center or initiative profile pages
- if a Georgetown source only states `studied under the supervision of ...`, preserve that exact advisor-side relationship instead of upgrading it to a completed PhD
- when a Georgetown page lists multiple master’s-level degrees, keep one structured slot and preserve the others in the note/provenance

Nanyang Technological University has another useful official pattern:

- personal faculty sites under `personal.ntu.edu.sg` are often the strongest source for full BS/MS/PhD chains and postdoc history
- NTU school or center pages can provide short degree summaries for newer faculty
- NTU-hosted paper biographies are often acceptable when they explicitly restate degree history

For NTU specifically:

- prefer personal faculty sites first, then NTU school/center people pages, then NTU-hosted paper biographies
- when an NTU source only provides a subset of seeds with explicit lineage, skip the rest rather than inferring from title pages or generic profiles
- preserve exact school acronyms like `EPFL`, `HKUST`, or `NUS` when that is how the official NTU-hosted source states them

North Carolina State University has another useful official pattern:

- `csc.ncsu.edu/people/...` and archived CSC profiles often provide direct degree summaries
- `sci.ncsu.edu/people/` can expose concise PhD and postdoc chains for security faculty
- NC State-hosted CV PDFs remain the best source for advisor-rich histories and multi-degree cases

For NC State specifically:

- prefer hosted CV PDFs first, then CSC/SCI faculty pages, then archived profiles
- if an NC State page gives a postdoc chain without advisor names, preserve the institutions and status exactly as written
- when multiple earlier degrees of the same family are listed, keep one structured slot and preserve the others in the note/provenance

Tel Aviv University has another useful official pattern:

- TAU profile pages under `english.tau.ac.il` and cyber/exact-sciences pages often expose concise degree chains
- TAU-hosted faculty sub-sites can provide richer BS/MS/PhD detail than the main profile pages
- TAU colloquium or IAS pages can still be valid official sources for doctoral and postdoctoral history

For Tel Aviv specifically:

- prefer TAU-hosted faculty sub-sites first, then profile pages, then official TAU event or institute pages
- preserve exact local degree wording such as `D.Sc.` or `B.A.` when that is how the official TAU-hosted source states it
- if a TAU page provides only a doctoral/postdoc fact, keep the earlier stages empty rather than inferring them

Monash University has another useful official pattern:

- Monash research profile/CV pages often expose structured qualification tables with dates
- Monash Bridges thesis pages are strong for doctoral dissertation records and supervisor edges
- Supervisor Connect pages can provide concise degree and postdoc summaries for senior faculty

For Monash specifically:

- prefer Monash research profile or CV pages first, then Monash Bridges thesis pages, then Supervisor Connect pages
- treat Monash Bridges thesis pages as strong official evidence for doctoral records and supervisor edges even when earlier stages are absent
- when a Monash page lists multiple undergraduate-level or master’s-level awards, keep one structured slot and preserve the others in the note/provenance

Peking University has another useful official pattern:

- department and school profile pages often expose compact Chinese-language education timelines
- Peking-hosted news pages can provide doctoral-student or postdoctoral record evidence for recent faculty
- some Peking profiles expose only degree labels like `工学博士` without the granting institution

For Peking specifically:

- prefer department or school faculty profile pages first, then Peking-hosted news pages, then institute pages
- if a Peking source provides only a doctoral-stage label without the granting institution, keep the stage partial instead of filling it from context
- preserve exact Chinese degree wording when the reviewed extract is stronger than any attempted normalization

Xidian University has another useful official pattern:

- faculty homepages under `web.xidian.edu.cn/...` are often the strongest source and frequently contain structured Chinese education timelines
- Xidian-hosted paper biographies can provide degree facts for alumni or junior faculty when homepages are sparse
- some Xidian pages compress multiple degree stages into a single sentence, requiring careful non-inferential splitting

For Xidian specifically:

- prefer `web.xidian.edu.cn/...` faculty homepages first, then Xidian-hosted paper biographies or other official pages
- when one Xidian sentence states multiple degrees and institutions, split only the stages that are explicitly named
- preserve exact degree wording such as `副博士学位` or combined `B.Sc/M.Sc` when the source does not cleanly separate them

Southeast University has another useful official pattern:

- faculty pages under `cs.seu.edu.cn` and `cyber.seu.edu.cn` often expose Chinese-language education histories with dates
- official lab pages can still provide thin but valid doctoral-stage evidence like `博士。`
- some Southeast pages explicitly name advisors for doctoral degrees on personal homepages

For Southeast specifically:

- prefer personal or faculty pages first, then cyber/department pages, then lab pages
- if a Southeast source only provides `博士。` or another thin doctoral label, preserve it as a partial doctoral record instead of over-normalizing it
- when an official Southeast page explicitly names advisors, capture them even if the rest of the educational history is sparse

Nankai University has another useful official pattern:

- Nankai faculty or center pages can provide short direct degree statements for faculty
- Nankai cyber pages can also provide dissertation titles plus advisor names, which are strong doctoral-record evidence
- some Nankai pages describe joint training periods that should not be upgraded to postdocs unless explicitly stated

For Nankai specifically:

- prefer faculty profile pages first, then cyber/center dissertation pages, then other official department pages
- if a Nankai page describes `联合培养` or another training arrangement, preserve that wording rather than converting it into a postdoctoral role
- when a Nankai-hosted page gives a dissertation plus advisor but not the full earlier lineage, keep only the explicit doctoral-stage evidence

City University of Hong Kong has another useful official pattern:

- CityU CS staff pages often expose terse degree abbreviations such as `BSc MSc PKU, PhD NUS`
- CityU-hosted CV or biography PDFs are stronger sources for advisor and postdoc details
- CityU-hosted group pages can provide valid role plus dual-degree evidence for postdocs

For CityU HK specifically:

- prefer hosted CV or biography PDFs first, then CityU faculty or staff pages, then CityU-hosted group pages
- if a CityU page uses institution abbreviations like `PKU`, `NUS`, `OSU`, `HFUT`, or `USYD`, preserve those abbreviations if the reviewed extract does not expand them
- when a CityU source states dual Ph.D. degrees, preserve that dual-degree wording rather than collapsing it into one school unless the source itself chooses one

Fudan University has another useful official pattern:

- Fudan faculty pages and lab member pages often expose concise Chinese education chains
- Fudan-hosted paper biographies are useful for BS/PhD-only histories
- Fudan news pages can provide doctoral-student or advisor-side evidence for recent researchers

For Fudan specifically:

- prefer faculty or lab member pages first, then Fudan-hosted paper biographies, then Fudan news pages
- if a Fudan source only proves someone is a doctoral student advised by a named faculty member, keep it as an in-progress doctoral record
- preserve exact Chinese degree wording when the profile is thinner than a full normalized school timeline

Wuhan University has another useful official pattern:

- Wuhan-hosted paper biography blocks can be the primary official source for degree history when faculty pages are sparse
- the `datasec.whu.edu.cn` surface appears especially useful for concise BS/MS/PhD statements
- these biography blocks often provide only one stage, so partial records are common and acceptable

For Wuhan specifically:

- prefer Wuhan-hosted faculty pages first, then Wuhan-hosted paper biographies or lab pages
- when a Wuhan paper biography lists only a PhD fact, keep just that stage instead of inferring earlier degrees
- preserve exact school wording such as `Huazhong University of Science and Technology, Wuhan` when that is how the source states it

Beihang University has another useful official pattern:

- Beihang faculty pages under `cst.buaa.edu.cn` or `soft.buaa.edu.cn` often expose compact Chinese education timelines with dates
- these pages can include doctoral or postdoctoral workstation history for newer faculty
- some Beihang pages describe joint doctoral training periods that should remain attached to the PhD note, not become a postdoc

For Beihang specifically:

- prefer faculty profile pages first, then school or department pages, then other official hosted materials
- if a Beihang source describes `联合培养博士`, preserve it in the doctoral-stage note rather than converting it to postdoctoral training
- when a Beihang entry lists only years and degrees, capture the explicit school/degree sequence without inferring advisor names

Korea University has another useful official pattern:

- Korea University-hosted CV PDFs and lab homepages often provide clean BS/MS/PhD chains
- hosted paper biographies can also provide solid degree history plus postdoc outcomes
- some Korea University pages combine MS and PhD in one date range, which should be preserved carefully

For Korea University specifically:

- prefer hosted CV PDFs and lab homepages first, then faculty profiles, then Korea-hosted paper biographies
- if a Korea University source combines `Ph.D and M.S.` in one period, preserve that combined wording in both the master's and doctoral notes instead of inventing separate timelines
- when a hosted biography provides postdoc years and host institution, keep the exact status wording from the source

TU Delft has another useful official pattern:

- TU Delft `pure.tudelft.nl` or `research.tudelft.nl` thesis/profile surfaces can provide advisor-rich doctoral records
- TU Delft faculty or news pages can provide concise BS/MS/PhD facts for newer hires
- TU Delft-hosted thesis PDFs may emphasize `PhD work` or dissertation supervision rather than an explicit awarded-degree sentence

For TU Delft specifically:

- prefer thesis PDFs and research profile pages first, then faculty/news pages, then hosted personal pages
- if a TU Delft source only states `PhD work under the supervision of ...`, preserve it as doctoral-work evidence rather than upgrading it to a stronger completion claim
- when a TU Delft source omits the school for an earlier degree while clearly naming the later doctoral context, keep the earlier stage partial

University of British Columbia has another useful official pattern:

- UBC-hosted SPG author pages are often strong for full BS/MS/PhD chains plus advisor and postdoc details
- UBC news pages can still provide concise degree or advisor facts for senior faculty
- some UBC official pages provide only a PhD fact or omit the institution for one stage, so partial preservation matters

For UBC specifically:

- prefer UBC-hosted SPG author pages and hosted CVs first, then UBC news pages, then other faculty pages
- when a UBC source gives the PhD advisor but not the PhD institution, preserve that advisor edge with `school: null`
- preserve exact source wording for institution abbreviations like `UIUC` if the reviewed extract does not expand them

University of Oxford has another useful official pattern:

- Oxford CS and college profile pages often provide concise DPhil/MSc/BSc chains
- Oxford-hosted profiles may refer to earlier schools in abbreviated form such as `Oxf`, `Camb`, or `DTU`
- Oxford pages can also provide valid postdoctoral facts for faculty who joined after work elsewhere

For Oxford specifically:

- prefer Oxford CS personal pages first, then college/faculty profile pages, then other Oxford-hosted institute pages
- preserve exact degree wording like `DPhil`, `D.Phil`, or abbreviated school names when the reviewed extract does not fully expand them
- if an Oxford source describes only one earlier degree and one doctoral fact, do not infer any missing middle stage

Binghamton University has another useful official pattern:

- Binghamton CS profile pages are unusually clean and often expose direct degree chains in one place
- these pages may sometimes mention multiple doctorates or omit advisor names entirely
- they are high-yield enough to process institution-wide once identity is confirmed

For Binghamton specifically:

- prefer the official CS profile pages first
- when a Binghamton profile lists multiple doctoral degrees, keep the computer-science doctorate in the structured `phd` slot and preserve the others in the note/provenance
- do not infer advisors if the profile only gives institutions and years

Concordia University has another useful official pattern:

- Concordia-hosted CV PDFs and personal faculty pages are strong for advisor and postdoc details
- Concordia faculty pages can provide compact PhD and postdoctoral facts when no CV is linked
- Concordia-hosted paper biographies can still be valid official sources for older faculty degree chains

For Concordia specifically:

- prefer hosted CVs and personal pages first, then faculty pages, then hosted paper biographies
- when a Concordia-hosted source gives an undergraduate faculty advisor, preserve it in the note even if the schema has no dedicated undergraduate-advisor slot
- keep postdoctoral status wording exact, especially for fellowship titles like `NSERC/ISSNet post-doctoral fellow`

University of California, Riverside has another useful official pattern:

- UCR-hosted CVs and lab homepages often expose advisor-rich doctoral history but may omit the school name for earlier stages in the extracted line
- UCR profile pages can provide a single clean PhD fact even when the rest of the lineage is absent
- UCR-hosted paper biographies are valid when they explicitly state the degree and school

For UCR specifically:

- prefer hosted CVs first, then profile pages, then hosted paper biographies, then news pages
- when a UCR-hosted source gives advisor names but not the degree institution, preserve the advisor edge with `school: null`
- do not infer the undergraduate or master's school from CV chronology alone when the extracted line omits it

IMDEA Software Institute has another useful official pattern:

- IMDEA people pages are often dense enough to expose multi-stage degree chains and postdoctoral history in one place
- IMDEA-hosted thesis indexes and annual reports can add supervisor evidence when the main profile omits it
- IMDEA profiles frequently list multiple postdoctoral destinations in prose; preserve them exactly rather than collapsing too aggressively

For IMDEA specifically:

- prefer the official people page first, then thesis indexes, annual reports, and other IMDEA-hosted research pages
- when a profile names an engineering diploma or equivalent first degree, preserve the source wording rather than forcing a normalized label
- if supervisors appear only on a separate IMDEA-hosted thesis page, merge them into the doctoral note and provenance without inferring anything else

University of Calgary has another useful official pattern:

- Calgary faculty profiles often provide compact degree chains with years and can also include postdoctoral or research-appointment history
- some Calgary facts live on institute pages rather than the main faculty profile, especially for postdoctoral follow-on work
- Calgary profiles may also expose nonstandard credentials such as professional diplomas alongside the main degree chain

For Calgary specifically:

- prefer the main Calgary faculty profile first, then Calgary-hosted institute or group pages
- keep the core BS/MS/PhD chain structured, and preserve extra credentials like diplomas in notes/provenance when they do not fit the main stage slots
- when a page combines postdoctoral and non-postdoctoral research appointments, keep the exact wording in the postdoc stage note instead of normalizing away the distinction

Aarhus University has another useful official pattern:

- Aarhus-hosted group pages and colloquium pages often contain concise prose biographies with full degree chains
- the `phds-produced` page is strong advisor-side evidence for doctoral completions, advisors, and dissertation titles
- Aarhus-hosted dissertations can confirm the degree institution even when the summary page is sparse

For Aarhus specifically:

- prefer hosted personal pages and group pages first, then `phds-produced`, then Aarhus-hosted dissertation PDFs
- when a source only gives doctoral completion plus advisor from the `phds-produced` list, preserve that partial evidence without inferring earlier degrees
- keep visiting-PhD wording in the doctoral note rather than promoting it to postdoc

HKUST has another useful official pattern:

- HKUST faculty profile pages are often enough to expose direct BS/MS/PhD chains in one paragraph
- some HKUST-hosted homepages add cleaner postdoctoral details than the main directory profile
- HKUST sources frequently use short school names like `HKUST` or `Penn State`; preserve the official wording when needed

For HKUST specifically:

- prefer official faculty profile pages first, then HKUST-hosted personal homepages
- when the page describes pre-PhD research work but not a formal degree or postdoc, keep that detail in the doctoral note instead of creating a new stage
- if a faculty page omits one stage entirely, leave it blank rather than backfilling from outside memory

University of Hong Kong has another useful official pattern:

- HKU academic staff pages can mix short abbreviations with a second fully expanded sentence; prefer the expanded form when the page itself provides it
- HKU seminar pages and hosted PDFs are often valid official sources for PhD and postdoctoral facts for newer hires
- HKU sources can also expose in-progress doctoral records; preserve these exactly

For HKU specifically:

- prefer HKU CS staff pages first, then HKU-hosted CVs, seminar pages, and institute PDFs
- if a source says `final-year PhD student` or otherwise indicates in-progress status, preserve that exact doctoral status
- do not infer missing advisors when a page gives only the degree institution

University of Illinois at Chicago has another useful official pattern:

- UIC-hosted CVs are high-yield for advisor-rich degree chains and postdoctoral appointments
- UIC faculty profiles often provide just a clean PhD fact, which is still enough to promote a seed
- UIC-hosted dissertation PDFs can provide degree institution, year, and advisor when faculty pages are sparse

For UIC specifically:

- prefer hosted CVs first, then faculty profiles, then hosted dissertations, then official news pages
- when a UIC source includes an undergraduate thesis adviser, preserve it in the note even though the schema does not model that edge separately
- if the earliest degree is an integrated or nonstandard award, preserve the exact label in the note and place it conservatively in the undergraduate slot

University of Texas at Dallas has another useful official pattern:

- UT Dallas `profiles` and `dox` pages often expose compact degree blocks and advisor lines
- UT Dallas news pages can be surprisingly strong for single PhD or postdoctoral facts on newer faculty
- PULSAR or school-level faculty announcement pages often bundle full degree chains for multiple hires

For UT Dallas specifically:

- prefer structured profile pages first, then school or center announcement pages, then department news pages
- when a profile provides advisors only for the PhD, attach them to the doctoral stage and keep earlier stages minimal
- do not infer undergraduate institutions when the page starts at the MS or PhD stage

University of Birmingham has another useful official pattern:

- Birmingham staff profiles can expose a concise `Qualifications` block plus a longer biography paragraph that adds advisor or timeline detail
- some Birmingham profiles are sparse, so expect mixed yield across a batch
- when a biography names the research group supervisor for a PhD, that is strong official advisor evidence

For Birmingham specifically:

- prefer the official staff profile page and read both the structured qualifications block and the prose biography
- if only a subset of seeds have explicit lineage facts on Birmingham-hosted pages, integrate those and skip the rest
- preserve cooperative-degree wording like `EURECOM & Sorbonne University` when that is how the official profile states the doctorate

Xi'an Jiaotong University has another useful official pattern:

- XJTU faculty pages often mix compact year-degree tables with short prose snippets about advisors or postdoctoral placements
- some XJTU pages provide only advisor-side doctoral evidence plus explicit postdoctoral history; preserve that partial truth exactly
- joint-doctoral or visiting-doctoral periods can appear inside the same timeline as the PhD and should stay attached to the doctoral note

For Xi'an Jiaotong specifically:

- prefer faculty profile pages first, including both Chinese and English variants when present
- when the page says `博士毕业后` but does not explicitly restate the degree-granting school, keep the PhD school null and preserve the advisor or completion wording in the note
- do not promote joint PhD or research-scholar periods to postdoc unless the page explicitly calls them postdoctoral

Northwestern University has another useful official pattern:

- Northwestern faculty directory pages are strong for compact BS/MS/PhD chains and occasional advisor or postdoc facts
- the CS PhD-students pages can provide valid official in-progress doctoral evidence even when they list only advisor names
- Northwestern-hosted lab or personal pages can add advisor details missing from the directory profile

For Northwestern specifically:

- prefer research-faculty directory pages first, then Northwestern-hosted personal pages, then official PhD-student listings
- when a Northwestern PhD-student page gives only `Advisor(s): ...`, record an in-progress `PhD student` stage at Northwestern rather than inventing prior degrees
- merge advisor names from a second Northwestern-hosted page when the faculty profile already supplies the degree institution

Hong Kong Polytechnic University has another useful official pattern:

- PolyU center or department profile pages often expose very compact degree lists without advisor names
- PolyU thesis repository pages can still be strong official sources for PhD degree and advisor evidence
- PolyU-hosted personal homepages may contain richer older-style biography prose including postdoctoral training

For PolyU specifically:

- prefer profile pages first, then PolyU-hosted personal pages, then the PolyU thesis repository
- when a thesis page provides only `Degree: Ph.D.` and an advisor, preserve that as doctoral evidence tied to PolyU rather than inferring earlier stages
- preserve exact institution naming such as `The Hong Kong Polytechnic University` when that is how the official page states it

Chinese Academy of Sciences has another useful official pattern:

- UCAS people pages are often the best CAS-hosted source for explicit degree timelines and sometimes advisor or postdoc facts
- institute pages under CAS can be useful for single-degree facts when UCAS pages are absent
- joint-doctoral or visiting-doctoral periods are common and should stay attached to the doctoral note

For CAS specifically:

- prefer UCAS profiles first, then institute-specific CAS pages, then CAS-hosted lab pages
- if a CAS-hosted page only gives an undergraduate degree, keep the rest blank rather than inferring later study from affiliation
- preserve exact Chinese degree labels and institute names when those are the strongest official wording available

HUST has another useful official pattern:

- HUST faculty pages often expose a structured timeline with degree institution, field, and degree label in one row
- these pages can also list postdoctoral appointments explicitly in the same table
- some HUST-hosted paper biographies provide concise degree chains for affiliates when faculty profiles are sparse

For HUST specifically:

- prefer faculty profile pages first, then HUST-hosted paper biographies
- when a page lists dual doctoral records, preserve both in the doctoral note instead of collapsing away one of them
- do not infer advisors from the timeline if the official page names only institutions and degree labels

VU Amsterdam has another useful official pattern:

- VU Amsterdam lineage facts often come from hosted research profiles, older CS-hosted paper biographies, and thesis PDFs rather than a single modern faculty directory
- some VU-hosted biographies expose only master's and doctoral history, while others provide bachelor's-thesis supervision or postdoctoral details
- advisor-side thesis supervision lists can appear on VU pages, but they should only support a record when paired with self-lineage evidence from another VU-hosted source

For VU Amsterdam specifically:

- prefer research profiles and hosted homepages first, then VU-hosted paper biographies and thesis PDFs
- when a VU-hosted thesis proves only a bachelor's-thesis context, preserve that conservatively instead of expanding it into a full degree chain without support
- if one VU source gives the degree institution and another gives advisor or stage detail, merge them into one record rather than choosing one source exclusively

Paderborn University has another useful official pattern:

- Paderborn lineage facts may appear on the central person page rather than on a department-specific faculty profile
- these person pages can provide concise chronological education and postdoc timelines, often with advisor names embedded directly in the prose
- omission rates may be high when only employment-oriented profiles exist without explicit degree text

For Paderborn specifically:

- prefer the central `uni-paderborn.de` person page first
- when a person page says `Student of Computer Science at ...`, preserve that exact undergraduate-stage wording rather than over-normalizing the degree title
- keep omitted any seed whose Paderborn-hosted pages do not explicitly state lineage, even if the person clearly belongs to the right research area

University of Chinese Academy of Sciences has another useful official pattern:

- UCAS people pages are often the strongest official source and can expose multi-stage education plus postdoc itineraries in one compact timeline
- advisor-side evidence may appear on another professor's `现指导学生` list, but that alone should not promote a seed without self-lineage evidence
- some UCAS pages use mixed English and Chinese degree labels such as `doctor`, `博士`, or `postdoctor`; preserve the official wording rather than forcing normalization

For University of Chinese Academy of Sciences specifically:

- prefer the person-specific UCAS page first
- when a page lists several postdoctoral appointments, keep one structured postdoc host and preserve the full sequence in the note
- do not promote a seed based only on appearing in another UCAS professor's student roster

Zhejiang University has another useful official pattern:

- Zhejiang person pages and ICSR staff pages are often high-yield for compact degree chains, sometimes mixing Chinese and English labels
- Zhejiang-hosted PDFs, DOCX files, and paper biographies can supply strong single-stage facts when the main profile is sparse
- transferred doctoral records, joint-doctoral periods, and mixed research/postdoc labels appear often and should be preserved exactly

For Zhejiang specifically:

- prefer official person pages first, then institute staff pages, then Zhejiang-hosted CV/PDF/DOCX assets and hosted paper biographies
- when a page describes a transferred doctorate or dual-doctoral history, preserve the exact multi-school wording in the doctoral stage rather than collapsing it
- if a Zhejiang source only states one explicit degree stage, keep the remaining stages blank instead of inferring from faculty status

Tsinghua University has another useful official pattern:

- Tsinghua department and institute faculty pages often expose clean BS/MS/PhD chains in either English or Chinese
- Tsinghua-hosted personal pages and lab pages can provide strong single-stage or advisor-rich doctoral facts when the directory page is sparse
- some Tsinghua records involve only undergraduate or only doctoral facts, while others include postdoctoral appointments or multiple advisors

For Tsinghua specifically:

- prefer official faculty pages first, then Tsinghua-hosted personal pages, then hosted paper biographies or institute pages
- when a Tsinghua source names multiple doctoral advisors or additional guidance, preserve the full advisor list in `advisorLabel`
- if a source gives a non-computing earlier degree plus later computing degrees, keep the exact source wording in the stage notes and do not normalize away the field difference

Shanghai Jiao Tong University has another useful official pattern:

- SJTU department pages, SEIEE pages, and IPADS/NSEC/JHC group pages often expose clean degree blocks with occasional advisor details
- SJTU-hosted paper biographies can still be strong official sources for PhD or postdoc facts when faculty pages are sparse
- some SJTU records involve dual-doctoral or in-progress doctoral history; preserve that exact wording rather than forcing a single normalized path

For SJTU specifically:

- prefer official faculty or department pages first, then institute/lab pages, then SJTU-hosted paper biographies
- when a page gives both structured degree lines and a narrative advisor sentence, merge the advisor into the doctoral stage
- preserve exact source wording for dual PhDs, postdoc-plus-research-assistant combinations, and `Ph.D. Candidate` cases instead of flattening them

National University of Defense Technology has another useful official pattern:

- NUDT pages can be sparse and sometimes expose only thin doctoral-status facts or in-progress PhD labels
- graduate-admissions or student-feature pages may still be valid official sources when they explicitly say `博士` or `博士研究生`
- advisor-rank labels like `硕导` or `博导` by themselves are not lineage facts and should not be promoted alone

For NUDT specifically:

- prefer explicit degree or `博士研究生` wording over mentor-level metadata
- if a page only states `博士` without naming the institution, preserve the doctoral status with `school: null`
- skip records where the only evidence is `硕导` or `博导`

Shandong University has another useful official pattern:

- Shandong faculty pages can expose either full degree timelines or very thin doctorate-only metadata such as alma mater plus `博士`
- Shandong-hosted English pages and CS pages often carry the strongest explicit PhD/advisor facts
- Shandong sources sometimes list dual master's or mixed doctoral/postdoctoral status in compact profile fields; preserve those carefully

For Shandong specifically:

- prefer official faculty pages first, then Shandong-hosted department pages, then hosted PDFs or DOCX assets
- when a profile exposes only `alma mater` plus doctorate-level completion, preserve that as thin doctoral evidence rather than inferring missing stages
- keep extra master's or postdoctoral status details in notes when the schema has only one slot

University of Edinburgh has another useful official pattern:

- Edinburgh research profiles can expose concise degree chains and postdoctoral history in one place
- Edinburgh-hosted event pages and paper biographies are often valid official sources for single-stage lineage facts
- some Edinburgh records provide only one degree stage; keep those partial rather than overfilling from elsewhere

For Edinburgh specifically:

- prefer research profiles first, then hosted personal pages, then Edinburgh event pages and hosted papers
- when a page gives a combined or double undergraduate history, keep one degree in the structured slot and preserve the rest in the note
- advisor names from event pages or personal sites can be merged into the doctoral stage when the degree institution is already explicit

University of Connecticut has another useful official pattern:

- UConn engineering faculty pages and UConn-hosted paper biographies are strong for compact BS/MS/PhD chains
- UConn-hosted resumes can provide advisor-rich master's and PhD facts even for older faculty
- some UConn records include multiple master's degrees; keep the most directly relevant one structured and preserve the rest in provenance

For UConn specifically:

- prefer faculty pages first, then hosted paper biographies, then hosted resumes/CVs
- when a UConn source lists more than one master's degree, keep the later or more directly relevant one in the structured master's slot
- do not infer advisors when a paper biography gives only institutions and years

University of North Carolina has another useful official pattern:

- UNC person pages are often enough for a clean PhD or full degree chain
- UNC-hosted personal pages can add advisor detail or in-progress doctoral context missing from directory pages
- UNC alumni or lab pages can still be valid for postdoctoral and advisor facts if the wording is explicit

For UNC specifically:

- prefer person pages first, then UNC-hosted personal pages, then official news or alumni pages
- when a record is an in-progress PhD student or only names advisors without a completed degree, preserve that exact doctoral status
- if an alumni page names only `PhD` plus advisor, keep `school: null` unless the same official page names the institution

Universidade de Lisboa has another useful official pattern:

- ULisboa scholar bios and Técnico/Fenix pages can expose compact undergraduate/master's/PhD timelines plus advisor names
- ULisboa-hosted event pages and talk PDFs often provide valid postdoctoral or in-progress doctoral facts
- Portuguese degree labels like `Licenciatura`, `Mestrado`, and `Doutoramento` should be preserved in notes when they carry nuance

For ULisboa specifically:

- prefer scholar bios and Fenix/Técnico pages first, then hosted event pages and PDFs
- when a page describes an in-progress PhD or only a postdoc, preserve that partial truth rather than forcing a completion claim
- merge advisor names from the same official page into the doctoral stage when they are explicitly named

University of South Florida has another useful official pattern:

- USF faculty pages in the AI/Cybersecurity/Computing area often provide clean compact degree blocks
- USF news or promotion pages can still be useful for single PhD facts when faculty profiles are sparse
- some USF profiles include clear postdoctoral roles; preserve them exactly when present

For USF specifically:

- prefer faculty pages first, then official promotion/news pages
- when a faculty page gives the full BS/MS/PhD chain without advisors, keep it simple and avoid embellishment
- preserve named postdoctoral centers or labs rather than collapsing them to just the university name

TU Wien has another useful official pattern:

- TU Wien news and people pages often provide concise PhD and postdoctoral facts for newer hires
- some TU Wien pages expose only titles like `Dr.-Ing.` or `MSc`; these are too thin on their own and should not be promoted
- when a TU Wien page gives a `Diploma` but no separate bachelor's or master's split, preserve that exact wording conservatively

For TU Wien specifically:

- prefer people pages and official news posts first
- skip title-only records that do not state a degree institution or training path
- when a page names a postdoc advisor, attach it to the postdoc stage even if the degree history is otherwise brief

University of Melbourne has another useful official pattern:

- Melbourne `find an expert` profiles can expose strong degree chains but sometimes omit advisors or earlier stages
- Melbourne-hosted thesis PDFs can add advisor evidence missing from the profile
- some Melbourne profiles list multiple master's-level or additional non-CS credentials; keep the most relevant structured and preserve the rest in notes

For Melbourne specifically:

- prefer `find an expert` profiles first, then Melbourne-hosted theses or topic pages
- when a profile lists an extra non-core credential like law or music, preserve it in notes/provenance rather than forcing it into the main stage slots
- if a record has only PhD and postdoc facts, leave earlier stages blank

NJIT has another useful official pattern:

- NJIT `people` profiles are highly structured and often provide clean BS/MS/PhD blocks in one place
- NJIT-hosted personal homepages can add advisor details missing from the structured profile
- title or department metadata on their own are much less useful than the structured degree block

For NJIT specifically:

- prefer the structured `people` profile first, then NJIT-hosted personal pages for advisor enrichment
- when a homepage adds only a PhD advisor, merge it into the doctoral stage without changing the earlier degree structure
- keep the exact school naming from the profile, including campus qualifiers like `Rutgers University-New Brunswick`

University of Florida has another useful official pattern:

- UF faculty pages and hosted vitae often provide concise degree chains, and hosted vitae can add advisor details
- UF college directory pages are useful for compact BS/MS/PhD facts even when advisor details are absent
- UF news or seminar pages can still be valid for one-stage PhD facts

For UF specifically:

- prefer hosted vitae first when available, then faculty pages, then directory/news/seminar pages
- merge advisor names from a vita into the PhD stage when the main faculty page is sparse
- if a UF faculty page only lists degrees without institutions repeated on every line, preserve the institution association exactly as shown and avoid inference beyond the local block

University at Buffalo has another useful official pattern:

- UB faculty profiles and hosted bios often give clean degree chains, while hosted CVs and vitas add advisor details
- UB commencement programs can provide valid doctoral plus advisor evidence even when they omit earlier stages
- some UB records include multiple master's degrees; keep the most relevant one structured and preserve the rest in notes

For Buffalo specifically:

- prefer hosted CVs/vitas and faculty profiles first, then UB-hosted biographies, then commencement programs
- when a UB source gives a `Major Professor`, map it into `advisorLabel` for the doctoral stage
- if multiple master's degrees are listed, keep the later or more field-relevant one in the structured master's slot

University of Luxembourg has another useful official pattern:

- University of Luxembourg-hosted theses can provide strong advisor-side doctoral evidence even when they are sparse on earlier degrees
- hosted CV pages are often better than generic people pages for full master's/PhD chains
- some Luxembourg results may be too thin for a full degree chain, but still useful for advisor relationships and doctoral-context evidence

For Luxembourg specifically:

- prefer hosted CV pages for faculty, then hosted theses for doctoral/advisor context
- when a thesis only proves someone supervised or completed doctoral studies at Luxembourg, preserve that exact doctoral-context wording instead of inferring earlier stages
- keep unresolved undergraduate and master's stages blank when the official Luxembourg source does not state them

Nanjing University has another useful official pattern:

- Nanjing University faculty and lab pages often expose compact PhD or BS/MS/PhD statements in one sentence
- some Nanjing pages provide advisor-rich PhD facts, while others only give a PhD and later postdoc
- English department pages can be especially strong for concise multi-stage degree chains

For Nanjing specifically:

- prefer faculty or lab pages first, then English department pages, then hosted bios
- when a page says the PhD was obtained `at the same department`, tie it to the current department's institution only if the page itself is clearly an official Nanjing department page
- preserve postdoctoral appointments exactly when the page explicitly names them

Brown University has another useful official pattern:

- Brown-hosted CVs and VIVO profiles are strong for advisor-rich PhD facts and multi-stage degree chains
- Brown faculty CVs often include non-US degree labels like `Diploma` or `Laurea`; preserve those exactly in notes
- some Brown records include multiple master's-level credentials; keep the most directly relevant one structured and preserve the others in provenance

For Brown specifically:

- prefer hosted CVs first, then VIVO profiles, then other Brown-hosted faculty pages
- when a CV names both dissertation completion and submission timing, preserve the more concrete degree-completion wording in the doctoral status
- do not flatten away important degree-label nuance like `Sc.M.`, `M.Phil.`, `Diploma`, or `Laurea`

Hunan University has another useful official pattern:

- Hunan faculty and lab pages can range from full BS/MS/PhD chains to very thin doctoral-status facts
- some Hunan pages identify in-progress doctoral students explicitly with cohort wording like `2022级博士研究生`
- doctorate-only metadata such as `学历：博士` is usable but should stay conservative when the school is not named

For Hunan specifically:

- prefer faculty pages first, then official lab pages, then broader university profile pages
- when a page only states `博士` or `攻读博士学位`, preserve the thin doctoral status rather than inferring completion
- if a page states combined undergraduate/master's training at one institution, use that institution in both slots and note the combined wording

University of Toronto has another useful official pattern:

- Toronto faculty pages often provide compact BASc/MS/PhD chains with years
- graduate oral-exam pages can provide valid in-progress doctoral plus advisor evidence even when earlier stages are absent
- affiliated faculty pages outside CS/ECE can still be strong for a single PhD plus advisor fact

For Toronto specifically:

- prefer faculty pages first, then graduate oral-exam pages, then other official Toronto faculty/center pages
- when the only official evidence is an oral-exam listing with a supervisor, preserve it as in-progress doctoral context rather than inferring completed degrees
- merge advisor names from affiliated pages when the degree institution is explicit and the page is clearly University of Toronto-hosted

USTC has another useful official pattern:

- USTC faculty and teacher pages often expose compact timelines with BS/MS/PhD and postdoc entries in Chinese
- USTC-hosted paper biographies can still provide full BS/MS/PhD chains for older faculty
- English USTC pages are useful for concise international degree chains when the Chinese profile is sparse

For USTC specifically:

- prefer faculty/teacher profile pages first, then USTC-hosted paper biographies, then USTC English profiles
- when a page lists dual bachelor's degrees or other multiple same-level degrees, keep one structured and preserve the rest in the note
- preserve explicit postdoctoral entries exactly as written, especially when they appear in the same timeline table as degrees

University of Kansas has another useful official pattern:

- KU-hosted CVs in ITTC or related labs are often the strongest source and can include advisor-rich BS/MS/PhD chains
- these CVs sometimes include multiple undergraduate-equivalent diplomas or advisor names at several stages
- hosted CVs can be cleaner than department directory pages, so prefer them when present

For Kansas specifically:

- prefer KU-hosted CVs first
- when multiple undergraduate-equivalent diplomas are listed, keep one structured and preserve the rest in the note/provenance
- merge advisor names from each degree stage only when the CV explicitly names them

Bar-Ilan University has another useful official pattern:

- Bar-Ilan CRIS profiles are strong for degrees and sometimes postdoctoral history
- Bar-Ilan-hosted CVs and personal pages can add advisor names and richer postdoc itineraries
- thesis pages are especially useful for supervisor confirmation

For Bar-Ilan specifically:

- prefer CRIS profiles first, then Bar-Ilan-hosted CVs/personal pages, then hosted thesis pages
- when a thesis page only contributes supervisor evidence, merge that into the doctoral stage rather than rebuilding the whole record from it
- preserve explicit host/advisor names for postdoctoral appointments when the official source states them

University of Central Florida has another useful official pattern:

- UCF CS and ECE faculty pages often provide compact degree chains without much surrounding noise
- UCF-hosted CVs can add advisor detail for older faculty
- some UCF faculty bios express master's and doctoral timing in one sentence; preserve the direct wording rather than over-normalizing it

For UCF specifically:

- prefer hosted CVs first when available, then CS/ECE/CECS faculty pages
- when a bio gives master's and doctoral degrees in one sentence with `respectively`, map the stages directly without adding inferred detail
- preserve exact program wording like `doctoral degree in computer engineering` if that is the strongest official wording available

Carleton University has another useful official pattern:

- Carleton people pages often expose compact BSc/MSc/PhD facts but may omit advisor details
- Carleton-hosted theses are especially valuable for doctoral supervisor names
- some Carleton records are thesis-only and therefore provide strong doctoral context but little or no earlier-degree information

For Carleton specifically:

- prefer people pages first, then Carleton-hosted theses and dissertations
- when a hosted thesis only proves a doctoral degree plus supervisors, preserve that cleanly without inferring earlier stages
- if a people page abbreviates institutions (for example `Minnesota` or `Athens`), preserve the official wording rather than expanding it from memory

Pennsylvania State University has another useful official pattern:

- Penn State degree facts are often exposed on structured IST or EECS directory pages with cleaner education blocks than the surrounding bios
- Penn State-hosted dissertations and ETDA pages are strong for doctoral and advisor evidence even when earlier stages are missing
- Penn State-hosted paper biographies can still be valid when they explicitly state lineage, but they are often partial and should be kept partial

For Pennsylvania State University specifically:

- prefer IST and EECS directory pages first, then Penn State-hosted CVs, dissertation pages, and ETDA entries
- when a dissertation or ETDA page only proves doctoral status and advisors, preserve that exact doctoral-context record without inferring earlier degrees
- keep campus or branding wording like `Penn State` or `The Pennsylvania State University` exactly as the source gives it

Seoul National University has another useful official pattern:

- SNU faculty pages can appear across CSE, ECE, math, S-Space, and lab homepages rather than a single directory
- SNU-hosted paper biographies are often concise but strong for full BS/MS/PhD chains
- S-Space dissertation pages are especially useful for recent doctoral graduates and advisor names

For Seoul National University specifically:

- prefer faculty pages first, then SNU-hosted homepages and paper biographies, then S-Space dissertation pages
- if a source gives multiple postdoctoral hosts in one sentence, keep one structured postdoc institution and preserve the full multi-host wording in the note
- preserve Korean advisor labels or dissertation wording exactly when that is the strongest official evidence

Technion has another useful official pattern:

- Technion lineage evidence is often scattered across lab alumni pages, thesis seminar announcements, hosted dissertations, and personal faculty pages
- some Technion records only prove a PhD seminar or dissertation plus advisor, which is still enough for a clean doctoral-stage record
- advisor names may appear with title prefixes like `Prof.` or initials only; keep that official wording rather than normalizing aggressively

For Technion specifically:

- prefer hosted dissertations and thesis seminar pages for doctoral evidence, then lab alumni pages and faculty about pages
- when a secondary Technion page adds only an M.Sc. or other supporting stage, merge it into the stronger doctoral record instead of replacing it
- omit records that only have advisor-side or event-side mentions without a clear self-lineage link

University of Utah has another useful official pattern:

- Utah lineage facts can show up on faculty profile cards, hosted CV PDFs, and departmental magazines rather than one uniform faculty page type
- hosted magazine biographies are acceptable when they explicitly state a degree fact, but they are often partial
- Utah-hosted profiles can occasionally surface same-name identity collisions from unrelated departments, so identity checking matters more than usual

For University of Utah specifically:

- prefer School of Computing faculty pages and hosted CVs first, then official faculty profiles and departmental magazines
- if the only hit is outside computing and identity is ambiguous, omit conservatively rather than risking a cross-department mismatch
- preserve exact profile wording for postgraduate training when the page says `Postdoctoral` without more detail

Rochester Institute of Technology has another useful official pattern:

- RIT lineage facts often appear on directory entries or AI/faculty profile pages with compact degree lists
- these pages can be thin but still reliable for straightforward BS/MS/PhD chains
- omission rates may be higher at RIT because some faculty pages are biography-light

For Rochester Institute of Technology specifically:

- prefer directory and institute profile pages first
- when a page lists `MS, Ph.D.` together for one institution, map both stages directly and avoid inventing years or advisors
- keep omitted any seed whose RIT-hosted pages do not explicitly state lineage, even if the broader RIT bio implies research area fit

EPFL has another useful official pattern:

- EPFL lineage facts often appear on hosted CV PDFs, people pages, and event pages rather than one uniform faculty biography format
- EPFL people pages can sometimes be very thin and only expose postdoctoral status; preserve that partial truth cleanly
- advisor-side evidence from student thesis records or candidacy events is useful context but should not promote a seed on its own

For EPFL specifically:

- prefer hosted CVs first, then people pages and EPFL event pages
- when a person page only gives a postdoctoral role, promote only the postdoc stage and leave earlier stages blank
- do not promote a faculty seed based only on appearing as thesis director or advisor in a student's EPFL record

Imperial College London has another useful official pattern:

- Imperial `profiles.imperial.ac.uk` pages usually provide compact, high-signal degree chains
- some Imperial-hosted white papers or institute PDFs contain short biographical blurbs that can supply a clean PhD fact when the main profile is sparse
- Imperial profiles may describe integrated or dual undergraduate degrees; keep the exact official wording and preserve extra parallel degrees in notes

For Imperial College London specifically:

- prefer `profiles.imperial.ac.uk` first, then Imperial-hosted PDFs or white papers with explicit bios
- when a profile gives an integrated engineering degree such as `MEng`, treat it as the undergraduate-equivalent stage unless the page clearly separates bachelor's and master's study
- keep omitted any seed whose Imperial-hosted sources do not explicitly state lineage, even if the profile is otherwise detailed

University of California, Santa Cruz has another useful official pattern:

- UCSC lineage facts often come from hosted personal pages, engineering news posts, and paper biography PDFs rather than a single canonical faculty profile
- UCSC-hosted advisor-side mentions through student events or seminar pages are common and should not trigger promotion on their own
- UCSC-hosted paper biographies can provide strong compact BS/MS/PhD chains for faculty whose main pages are sparse

For University of California, Santa Cruz specifically:

- prefer hosted personal pages first, then engineering news pages, then UCSC-hosted paper biography PDFs
- do not promote a seed based only on being named as an advisor on a UCSC event or student page
- preserve campus-form affiliation strings like `Univ. of California - Santa Cruz` as they appear in the dataset mapping

University of California, Santa Barbara has another useful official pattern:

- UCSB CS and ML faculty pages often provide concise degree lists directly on the page
- UCSB-hosted CVs can add advisor names or postdoc detail that the main page omits
- some UCSB sources are broad institutional catalogs that expose only a thin PhD fact; keep that exact partial truth when it is all the official source gives

For University of California, Santa Barbara specifically:

- prefer CS and ML faculty pages first, then UCSB-hosted CVs, then broader official catalog pages
- when a faculty page gives short labels like `Ph.D. Penn State University`, preserve the exact school wording without filling missing advisor data
- if a hosted CV adds advisor detail to a page-level degree chain, merge it into the doctoral stage rather than replacing the whole record

Massachusetts Institute of Technology has another useful official pattern:

- MIT lineage facts can appear across CSAIL people pages, EECS news posts, hosted lab homepages, and older hosted CVs
- MIT-hosted homepages often use short institutional names like `Berkeley`, `MIT`, `UIUC`, or `Harvard`; preserve those exact labels when they are the source wording
- MIT pages sometimes provide only undergraduate and doctoral history with no master's; do not infer a master's from neighboring records or common background patterns

For Massachusetts Institute of Technology specifically:

- prefer hosted CVs and homepages first, then CSAIL people pages and EECS news posts
- when a page lists multiple undergraduate degrees from one institution, store one structured undergraduate school and preserve the parallel degrees in the note
- preserve postdoctoral wording like `postdoc` or `postdoctoral stint` exactly when that is the strongest official evidence

University of California, Berkeley has another useful official pattern:

- Berkeley lineage facts often come from hosted EECS homepages, personal faculty pages under `people.eecs.berkeley.edu`, and older technical reports or archived pages
- Berkeley-hosted personal homepages can be much richer than the central EECS profile, especially for advisor and postdoc detail
- older Berkeley-hosted technical reports often contain compact thesis-era biographical blocks that are still strong primary sources when explicit

For University of California, Berkeley specifically:

- prefer hosted personal pages first, then EECS profile pages, then Berkeley-hosted technical reports or archived documents
- when a page uses short school labels like `Berkeley`, `MIT`, or `Stanford`, preserve that exact official wording in notes
- if a hosted personal page adds advisor or postdoc detail to a degree chain, merge it into the structured stages rather than replacing the cleaner degree source

University of California, Los Angeles has another useful official pattern:

- UCLA lineage facts often appear on Samueli faculty pages or older hosted faculty homepages under `web.cs.ucla.edu`
- these sources can be sparse and sometimes provide only one doctoral fact or one postdoctoral fact; preserve the partial truth without expanding beyond the source
- advisor detail at UCLA is relatively rare, but older hosted homepages can still provide it for senior faculty

For University of California, Los Angeles specifically:

- prefer older hosted faculty homepages first when available, then Samueli faculty pages
- preserve short school strings like `M.I.T.` exactly when they are the official UCLA wording
- when a Samueli page only states a PhD and no earlier stages, promote only the doctoral stage and leave the rest blank

EURECOM has another useful official pattern:

- EURECOM lineage facts often live in the official faculty booklet PDF rather than on each person’s individual page
- individual EURECOM-hosted homepages can still provide cleaner postdoc or PhD snippets for some faculty
- the faculty booklet can contain useful extra context like thesis titles or master's-thesis advisors; keep that in notes when it does not map cleanly to the structured schema

For EURECOM specifically:

- prefer individual EURECOM-hosted homepages first when they give direct lineage facts, then the official faculty booklet PDF
- when the booklet gives both degree-chain and postdoc detail, merge them into one record instead of splitting across duplicate sources
- keep omitted any seed whose EURECOM-hosted material does not explicitly state lineage, even if the faculty booklet contains extensive research background

Florida International University has another useful official pattern:

- FIU faculty records are split across multiple official surfaces, especially `cis.fiu.edu`, `cec.fiu.edu`, `users.cs.fiu.edu`, and FIU Discovery profiles
- FIU-hosted personal or lab pages can carry the strongest degree chains, while directory pages often contribute structured year-plus-degree blocks
- some FIU records include multiple master's degrees or advisor-rich recent PhD facts; preserve the extra detail in notes when one structured slot is not enough

For Florida International University specifically:

- prefer FIU-hosted personal or lab pages first, then CIS/CEC directory profiles, then FIU Discovery profiles
- when multiple official FIU pages state the same recent degree chain, merge advisor or year detail from the richer page into the structured record
- if a page names a lab for postdoctoral work, keep the host institution and preserve the lab wording in the note

Rutgers University has another useful official pattern:

- Rutgers faculty bios can be spread across ECE, Business, WINLAB, and CS alumni pages instead of one central faculty directory
- Rutgers WINLAB pages often provide clean self-degree facts, while Rutgers CS PhD alumni pages are strong for advisor confirmation
- advisor-side evidence alone is not enough to promote a seed, but it is useful as supporting evidence when paired with self-lineage facts from another official Rutgers page

For Rutgers specifically:

- prefer self-profile pages first, then Rutgers CS PhD alumni pages for advisor confirmation
- do not promote a person based only on supervising Rutgers PhD students; this matches the same conservative rule used for advisor-side thesis evidence elsewhere
- preserve exact official campus wording such as `Rutgers, the State University of New Jersey` or `Rutgers University-New Brunswick`

George Washington University has another useful official pattern:

- GW Engineering faculty pages usually provide concise degree chains for current faculty
- older or affiliated GW records may only expose lineage through official GW-hosted paper biography PDFs or personal pages under `www2.seas.gwu.edu`
- some GW biographies include multiple master's degrees in one sentence; preserve the extra master's detail in notes if the structured slot can only carry one school

For George Washington University specifically:

- prefer `engineering.gwu.edu` faculty pages first, then official `www2.seas.gwu.edu` homepages and hosted PDFs
- treat official GW-hosted paper biography blocks as valid when they explicitly state degree history
- when a page gives only a host abbreviation like `UIUC`, preserve that exact wording rather than expanding it from memory

University of Southern California has another useful official pattern:

- USC Viterbi faculty pages often expose compact degree chains with minimal noise and are good enough on their own for many records
- some USC records only expose a single doctoral fact or a postdoctoral stop; preserve that partial truth cleanly without filling missing stages
- USC-hosted faculty pages can also provide strong recent postdoc evidence for new hires

For University of Southern California specifically:

- prefer USC Viterbi faculty pages first
- when a Viterbi page lists only `Doctoral Degree, Purdue University` or similar thin wording, preserve it exactly rather than normalizing beyond the source
- keep omitted any seed that lacks self-lineage evidence on USC-hosted pages even if other official USC pages mention the person in unrelated contexts

Purdue has another useful official pattern:

- department or school pages may contain a compact `Education` or `Degrees` section
- this section can be more reliable and faster to parse than the surrounding biography text
- when present, prefer the structured degree block over inferred prose summaries
- Purdue Computer Science homepages under `cs.purdue.edu/homes/...` can also be biography-rich, and some of them link to official CV PDFs hosted on the same Purdue CS domain

This is especially useful on Purdue ECE pages, where the page can contain a lot of navigation text but still expose a short, explicit degree list with years and institutions.

For Purdue specifically:

- prefer `Education` or `Degrees` blocks on `cs.purdue.edu/people/...` pages when available
- if a Purdue CS homepage under `cs.purdue.edu/homes/...` links to a CV PDF on the same Purdue CS domain, escalate to that PDF immediately
- treat the Purdue-hosted CV as an official source for advisor, postdoc, and multi-stage degree data when the homepage itself is sparse
- the separate bio subpages under `cs.purdue.edu/homes/.../bio.html` can expose a short explicit sentence such as `received her PhD from ...` even when the main homepage is noisy
- advisor-side Purdue evidence can also be strong: a faculty homepage news item that a named student `defended his PhD dissertation`, combined with a faculty group page that lists the same student as `co-advised with ...`, is enough to promote the student to an active PhD-stage record at Purdue
- a Purdue faculty homepage `PhD Graduates` list can also be sufficient when it explicitly gives a named student, a Ph.D. completion marker such as `Ph.D. May 2006`, and a co-advising phrase

When this advisor-side Purdue pattern names the degree and advisors but does not explicitly name the school, keep `school: null` and preserve the advisor-side evidence in the note and provenance instead of inferring `Purdue University`.

Purdue stop/refinement rule:

- if a Purdue page resolves the person identity but does not expose an explicit `Education` or `Degrees` block
- and does not link to an official CV, bio, or lab homepage

then treat it as `shallow-stop` and move on. Purdue pages can be high-noise; do not spend time trying to infer lineage from navigation-heavy department templates.

George Mason University has another useful official pattern:

- CSrankings often resolves directly to stable GMU faculty homepages under `people.cs.gmu.edu/~...`
- these homepages frequently expose degree history in the first-person or short biography block near the top of the page
- the wording is often compact and explicit, such as `I received my Ph.D. from ...`, `I earned an AB degree ... and MS and PhD degrees ...`, or `He holds PhDs from ... and a BSc from ...`
- the departmental profile pages under `cs.gmu.edu/profiles/...` can be even better because they expose a short official biography plus a structured `Degrees` block

Treat these GMU faculty homepages as official sources when the page clearly belongs to the person and the degree wording is explicit.

For GMU specifically, prefer the structured `Degrees` block on `cs.gmu.edu/profiles/...` over looser biography prose when both exist. This yields cleaner extraction and makes it easy to classify the profile as `biography-rich` or `shallow-stop`.

GMU refinement rule:

- when a GMU homepage exposes multiple explicit doctoral degrees, record the computer-science Ph.D. in the `phd` stage
- preserve the additional doctoral fact in `sources[]`, `summary`, and the stage note
- do not drop the extra doctorate just because the schema currently has a single `phd` slot
- when CSrankings returns a same-name homepage but the affiliation does not match and the DBLP identity does not match, reject the match and leave the record unresolved

Institution selection rule:

- if the supposedly official faculty or institute directory resolves to a generic shell page, a search landing page, or a 404
- and you cannot quickly derive a stable name-to-profile mapping from the official surface

then skip that institution for now and move to the next cluster. A weak directory surface is usually a worse bottleneck than a smaller seed count.

Microsoft Research has another useful official pattern:

- generic people pages may identify current role but omit degree history
- Microsoft-hosted speaker/event pages often contain compact official bios with pre-Microsoft Ph.D. history
- Microsoft-hosted CV PDFs can provide full degree chains and postdoctoral appointments

Treat these Microsoft-hosted pages as official sources when they are clearly under the Microsoft Research domain or a Microsoft Research document path.

Microsoft event and speaker pages often include high-density bios for many people at once. They are especially useful when:

- the main people page lacks degree history
- the event page contains a `Speaker Details` or expanded `bio` section
- the page clearly belongs to Microsoft Research and the bio is person-specific

Use these pages as official biography sources, but only when the person identity is unambiguous and the biography text is clearly attached to that speaker.

Microsoft Research stop/refinement rule:

- if an official Microsoft-hosted page only confirms affiliation or prior institution
- but does not explicitly state a degree, completion, advisor, or postdoctoral role

then do not promote the record from that page alone. Microsoft-hosted technical reports and publication PDFs often list prior affiliations, but affiliation alone is not enough for lineage extraction.

Chinese Academy of Sciences has another useful official pattern:

- UCAS people profiles under `people.ucas.ac.cn/~...` often expose compact date-ranged education lines that are faster to parse than the surrounding biography text
- these lines commonly encode undergraduate, master's, and doctoral stages in one block with stable patterns such as `YYYY-MM--YYYY-MM 学校 学位/阶段`
- UCAS advisor pages can also expose explicit student-list entries with partial lineage such as `M.Sc, SHAO, China` and later `Ph.D at Purdue University`

For CAS specifically:

- prefer UCAS profile pages before broader institute browsing when a stable person page exists
- preserve the exact school names and degree labels from the compact education block
- when an advisor page gives explicit student-list lineage for a seed, record only the stages it states and do not infer a doctoral advisor

CISPA and Saarland dissertations add another reliable official pattern:

- Saarland-hosted dissertation PDFs can provide stronger advisor evidence than profile pages
- metadata fields such as `Berichterstatter` and first-person acknowledgments such as `my advisor, Michael Backes` qualify as direct doctoral-advisor evidence
- acknowledgments that credit someone with `mentorship` or similar support are useful corroboration, but do not upgrade that person to a formal co-advisor unless the source says so explicitly

For batch work, start with `n = 24` candidates unless the institution directory is unusually sparse or noisy. Large enough batches expose reusable patterns; smaller batches tend to hide them.

Use official PDFs and annual reports only when they are clearly university-hosted and person-specific or department-specific.

Scout retry rule:

- allow at most three passes for a given scout or institution slice before stopping
- allow at most three active status/result checks for a given scout before stopping polling
- optimize for breadth on the first pass so the scout covers the widest plausible official surface quickly
- use later passes only to tighten identity matching, follow the highest-yield second hops, or test one or two unresolved holdouts
- if three passes still leave meaningful ambiguity or sparse evidence, stop and wait for user-provided hints instead of continuing to search the same surface
- do not ask the user for scout-by-scout confirmation; aggregate the completed scout results and wait for batched feedback or hints
- when using scouts, make parallelism the default for independent institutions or residual buckets unless there is a strong reason to sequence them

Batch reflection rule:

- after each completed institution batch, record one short reflection about what changed the hit rate, what wasted time, and which official surfaces were highest-yield
- if the reflection reveals a stable rule, add it to this skill immediately instead of keeping it only in transient notes
- prefer rules that improve future batch breadth on pass one, reduce unnecessary second hops, or sharpen stop conditions

Recent reusable reflection:

- Macquarie batches are high-yield on `figshare.mq.edu.au` thesis metadata because those records frequently expose `Degree Type`, `Principal Supervisor`, and additional supervisors in a machine-readable form.
- Renmin University batches are high-yield on official faculty profiles for degree chains and on official defense notices for named advisor pairs.
- UCAS profile pages for IIE/CAS-affiliated people are often enough on pass one because they frequently include both education history and explicit current/former student lists.
- When an official institutional profile already provides the needed lineage fact, do not retain GitHub-hosted or other third-party personal-page facts as the primary evidence even if they expose additional details.
- RHUL `pure.royalholloway.ac.uk` person profiles and especially `/supervised/` pages are high-yield for named doctoral advisees; use them early instead of broader search when Pure already resolves.
- Sapienza `iris.uniroma1.it` thesis front matter is high-yield for advisor and co-advisor names even when faculty profile pages are biography-shallow.
- SYSU faculty pages are good for degree chains, but advisor names often require one bounded second hop to an official thesis PDF or an upstream official university article from the degree-granting institution.
- Bocconi faculty profiles plus linked official CV PDFs are high-yield for full degree chains, named advisors, hosted-by postdoctoral metadata, and named PhD/postdoc supervisees.
- Auburn engineering directory profiles can be enough on pass one for degree-chain enrichment; if they do not expose advisor metadata or an official CV, keep the degree chain and stop rather than widening to personal sites.
- IBM research-affiliation seeds often do not resolve through IBM pages; look early for official upstream dissertation PDFs, official advisor-group pages, and official seminar bios on university domains.
- Bundeswehr faculty profiles can provide the broad degree chain while official personal academic pages or university repositories contribute missing advisor metadata; use both only when the personal site is clearly the scholar's official academic page.
- Self-official academic pages on stable researcher-controlled domains such as lab homepages, Google Sites, or Weebly can be retained when they make direct first-person degree/advisor claims and no stronger conflicting official university page exists.
- After inserting new seeds into `scripts/institution-batch-enrich.mjs`, always rerun the institution batch and verify the reported `updated` list contains the expected IDs; misplacing entries into the wrong institution map is an easy failure mode in this large file.
- Preserve multi-advisor strings exactly in `advisorLabel` when the source gives multiple names; downstream graph/UI code should split labels like `A; B`, `A, B`, or `A and B` into separate mentor edges rather than collapsing them into one synthetic person.
- Keep a shared institution-alias mapping and extend it incrementally when duplicates surface, especially for mixed Chinese/English variants such as `浙江大学` vs `Zhejiang University`, country-suffixed forms such as `Zhejiang University, China`, and official Chinese-language school names embedded in otherwise English records.
- UCAS people pages are still one of the fastest pass-one surfaces for CAS-affiliated holdouts because they often expose either direct `Education` timelines or named `Students` lists even when institute pages are sparse.
- Zhejiang `person.zju.edu.cn` pages can clear otherwise stubborn seeds even when they only expose role-level evidence such as `Professor | Doctoral supervisor`; keep that advisor-side supervision signal when no stronger degree-chain page is available on the official surface.
- For CUNY/CCNY-style buckets, official self-hosted faculty pages and CV PDFs can be enough to clear seeds quickly: they often expose direct degree chains, advisor mentions, and named current students even when central directory pages are blocked or shallow.
- For DePaul-style buckets, combine the official faculty homepage with the official DePaul research portal or lab page: the homepage often carries the degree chain, while the research portal or lab page can add the advisor-side named-student evidence needed to strengthen a thin faculty bio.
- City University of Macau faculty pages can be high-yield on pass one because they often list full degree chains directly on the official member page, including later advanced doctorates that should be preserved in provenance without replacing the main PhD stage.
- Griffith's public Experts API can expose usable degree-lineage fields directly on the official domain even when the rendered profile is JS-heavy; treat the API response as an official source when the institution hosts it.
- For Heriot-Watt and Mines-style buckets, combine the official research portal or faculty profile with an official hosted CV or advisor-side page to recover missing master's stages, named advisors, or explicit supervisee listings.
- BYU-hosted vita PDFs can be stronger than the central profile pages: they often include dissertation titles, named advisors, and explicit graduated-PhD lists on the same official document.
- For Jinan-style buckets, faculty pages for a target's students or postdocs can provide the strongest official advisor-side evidence when the target's own page is mainly degree-focused.
- IIT Kharagpur faculty pages can be high-yield even without the faculty member's own degree chain because they sometimes expose long named MS/PhD alumni lists; keep that advisor-side evidence when it is explicit and official.
- For IIT Bombay Trust Lab-style buckets, the official lab people page can anchor a linked personal page strongly enough to reuse the linked page for advisor names and finer postdoc details, while the official lab news pages can add named interns or student advisees.
- Illinois Tech directory pages expose outbound `Website` links on the official profile; when those links point to the faculty member's site, treat that combination as an official anchor for finer lineage details such as earlier degrees, advisors, and named mentees.
- Mathematics Genealogy Project is useful as the first discovery pass for advisor and advisee names: search the target, collect the candidate lineage neighborhood, and then use those names to double-check our unresolved seeds and focus official-source verification.

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

University of Georgia-specific shortcuts:

- `computing.uga.edu` and `csci.franklin.uga.edu` graduate handbooks often list faculty in the compact form `Name, Rank, Ph.D., Institution`
- `cybersecurity.uga.edu/directory/people/...` profiles can include full BS/MS/PhD lineage plus advisor wording
- official UGA news stories are acceptable when they explicitly state degree or postdoc history

Worcester Polytechnic Institute-specific shortcuts:

- `wpi.edu/people/faculty/...` pages often expose structured degree lines and sometimes advisor wording
- `web.cs.wpi.edu/~.../cv.pdf` hosted CVs are strong lineage sources
- WPI governance or faculty meeting PDFs can be acceptable when they explicitly list degrees and prior postdoc roles

University of Arizona and William & Mary-specific shortcuts:

- Arizona faculty pages and department news pages often split degree history across profile and welcome-story pages
- Arizona-hosted dissertations in `repository.arizona.edu` are strong for PhD-plus-advisor evidence
- William & Mary faculty CVs under `cs.wm.edu/~...` are high-yield for full degree history and dissertation advisors
- William & Mary department news is acceptable when it explicitly states PhD origin, but do not infer missing earlier stages

Dartmouth, ShanghaiTech, Twente, and WashU-specific shortcuts:

- Dartmouth faculty-directory pages often contain compact BA/MS/PhD lines; CS news pages can add advisor or postdoc detail
- ShanghaiTech faculty and HR pages often provide explicit Chinese degree-history lines that are stronger than English summaries
- Do not promote a ShanghaiTech student listing found only on another faculty member's CV into the student's own lineage record
- University of Twente `people.utwente.nl` pages are good for prior PhD and postdoc history; Twente-hosted theses are strong for doctoral supervisors
- WashU engineering pages and hosted CV PDFs are high-yield for degree stacks; WashU-hosted dissertations are strong for direct advisor wording

Bristol, Maryland, and Syracuse-specific shortcuts:

- Bristol person pages often mix self-biography with thesis supervision lists; only the self-biography portion qualifies for the person's own lineage
- Maryland-hosted dissertations and CV PDFs are strong for doctoral/advisor evidence; faculty spotlight pages may provide partial degree progress that should stay partial if the source does
- Syracuse `ecs.syracuse.edu/faculty-staff/...` pages often expose structured degree stacks; `surface.syr.edu` dissertation records are acceptable for `Degree Name` plus advisor history tied to the same person

Minnesota, Washington, and Delaware-specific shortcuts:

- Minnesota `cse.umn.edu/cs/...` faculty pages often provide clean structured BS/MS/PhD lines
- Washington hosted paper PDFs on faculty homepages are acceptable when the bio block explicitly states degree history; keep separate advisor-side thesis metadata out unless it is needed to corroborate a self record
- Delaware often splits degree history across a main faculty page and a hosted personal homepage or CV; combine them only when both are official Delaware-hosted pages for the same person

IISc, Ben-Gurion, Oklahoma, and Michigan State-specific shortcuts:

- IISc-hosted resumes and dissertations are strong for advisor and postdoc history; workshop schedules can qualify when they explicitly summarize a person's PhD and postdoc record
- Ben-Gurion hosted paper biographies and lab information pages can be acceptable when they explicitly list the focal person's own degree timeline
- Oklahoma faculty pages under `ou.edu/coe/cs/people/faculty/...` often expose compact degree stacks and postdoc lines directly
- Michigan State hosted CVs are strong self-lineage sources; student award pages that only name someone as an advisor do not qualify for the advisor's own lineage record

RWTH and Rice-specific shortcuts:

- RWTH team pages can provide diploma-equivalent and doctorate summaries; keep non-qualifying teammate pages or missing-self-lineage cases as seeds
- Rice hosted resumes, profile pages, and CS news stories are acceptable when they explicitly state the focal person's own degrees or postdoc host

Aalto and Stuttgart-specific shortcuts:

- Aalto event pages can be acceptable when the seminar bio explicitly states the focal person's own PhD or postdoc history; do not promote vague biographical anecdotes such as being offered a position
- Stuttgart hosted theses and institute team pages are strong for diploma-equivalent, PhD-student timeline, advisor, and postdoc details

Iowa State, Oregon State, Temple, and Clemson-specific shortcuts:

- Iowa State `cs.iastate.edu/people/...` faculty pages are usually strong structured degree sources, but hosted CV extracts may still require partial treatment if the degree-granting institution is not preserved in the evidence you have
- Oregon State engineering people pages and event pages can be combined when both are official OSU-hosted sources for the same person; dissertations can add advisor names to otherwise complete PhD records
- Temple-hosted paper biographies are acceptable for explicit degree stacks, but do not treat later faculty-job titles as postdocs
- Clemson hooding/faculty PDFs can provide degree and advisor history even when they only cover one stage; do not infer missing earlier stages

Radboud, Tennessee, and SFU-specific shortcuts:

- Radboud hosted bio pages can provide strong full lineage; repository thesis records are acceptable for doctoral-advisor context even when they only preserve the promotor field
- Tennessee faculty pages and hosted CVs often pair well for filling in advisor names on otherwise complete degree stacks
- SFU faculty pages are usually strong for structured degree history; hosted CVs can add advisor names for PhD records

LSU-specific shortcuts:

- LSU faculty pages often provide compact BASc/MASc/MS/PhD/postdoc lines directly
- Preserve date-ranged doctoral entries as in-progress or date-ranged when the source gives years rather than an explicit completion statement

UNSW-specific shortcuts:

- UNSW staff and research profile pages often provide concise degree summaries that are sufficient when they explicitly name the focal person's own schools and years

Penn, Porto, and Florida State-specific shortcuts:

- Penn faculty homepages and engineering magazine PDFs can be enough for self-lineage, but a page listing only current and former PhD students is advisor-side evidence and does not qualify for the advisor's own lineage
- Porto hosted lab/member pages can support current doctoral-student status when they explicitly state the doctoral program and supervisor
- Florida State hosted CVs and CS news pages are high-yield, but do not pull advisor claims from third-party student pages when a direct self-source already covers the focal person's own lineage

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

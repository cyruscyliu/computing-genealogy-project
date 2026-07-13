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

## Workflow

1. Resolve the homepage first.
2. Use CSrankings as the primary homepage discovery index when a matching `dblpAuthorId` or name+affiliation entry exists.
3. If CSrankings misses or is ambiguous, use an official institution directory or known official subsite.
4. Read the homepage and identify the focal person.
5. Extract explicit education and advisor claims.
6. Immediately look for linked `CV`, `Bio`, `Group`, `Lab`, `People`, or `Team` pages.
7. If the focal person has an advisor, pivot to the advisor's homepage and CV before doing broader search.
8. If an advisor runs a lab or team page, scan that page for student and postdoc lists.
9. Use official news, alumni stories, and official paper-site bios only to fill gaps or corroborate.
10. Decide whether each claim is direct, inferred, or unsupported.
11. Normalize names and school names consistently.
12. Create or update person records.
13. Preserve source provenance in `sources[]`.
14. After each batch, reflect on what improved throughput or evidence quality:
15. note which institution directory patterns matched cleanly
16. note which biography phrases yielded direct lineage facts
17. note which pages required a second hop to CVs or dissertations
18. update this skill when a new reliable pattern appears

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

For batch work, start with `n = 24` candidates unless the institution directory is unusually sparse or noisy. Large enough batches expose reusable patterns; smaller batches tend to hide them.

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

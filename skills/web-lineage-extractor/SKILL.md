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

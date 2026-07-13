# Patterns From 10-Person Crawl

This reference captures concrete extraction patterns discovered while scanning the first 10 people in the dataset.

## 1. Student homepage with direct wording

Pattern:

- `currently a Ph.D. student at ... advised by ...`
- `under the guidance of Prof. X`

Use:

- direct extraction of PhD school and PhD advisor
- usually `high`

Examples:

- Sizhe Chen homepage
- Qiang Liu homepage

## 2. Advisor CV with explicit supervision sections

Pattern:

- `Currently advised Ph.D. students`
- `Graduated Ph.D. students`
- `Postdoctoral scholars`

Use:

- direct advisor-side evidence for student and postdoc relationships
- recursive expansion of downstream people
- usually `high`

Example:

- Mathias Payer CV

## 3. Lab/team page with role-labeled members

Pattern:

- `People`, `Members`, `Current Members`
- each person has a role such as `PhD student`, `Post Doc`, `Graduated PhD Student`

Use:

- corroborate student-side claims
- enumerate current and former group members
- distinguish student/postdoc/alumni roles

Example:

- HexHive page confirms Qiang Liu as `Post Doc` and also exposes many other students and alumni

Rule:

- role-labeled lab pages are strong
- unlabeled member grids are weaker
- `visiting PhD student` is corroboration, not a standalone advisor edge

## 4. Official homepage plus lab page pairing

Pattern:

- homepage says `working with Prof. X`
- advisor lab page lists the person as `Post Doc` or `PhD student`

Use:

- raise `works with` from medium to high when the role is corroborated

Example:

- Qiang Liu homepage + HexHive page

## 5. Official university news naming the advisor-student relation

Pattern:

- `Yajin Zhou, a Ph.D. student in Xuxian Jiang's lab`
- `advisor X`

Use:

- strong corroboration when advisor pages do not maintain public student lists
- especially useful for older students

Example:

- NC State news naming Yajin Zhou as Xuxian Jiang's Ph.D. student

## 6. Alumni pages with degree chain

Pattern:

- article or alumni award page gives BS, MS, PhD, advisor in one place

Use:

- fill undergraduate and doctoral history from one official source

Example:

- Purdue alumni article for Xuxian Jiang

## 7. Official paper-site author bios for missing undergraduate history

Pattern:

- author bio on official personal domain or official project page

Use:

- recover bachelor's degree when homepage omits it
- usually `medium` unless the hosting context is clearly official

Example:

- Yajin Zhou paper bio for Suzhou University bachelor's degree

## 8. Faculty list with degree but no advisor

Pattern:

- faculty directory lists `PhD, Institution, Year` but no advisor

Use:

- fill institution and degree stage
- do not infer advisor from proximity or department alone

Example:

- Dawn Song faculty listing

## 9. Seed-node policy

Pattern:

- a referenced advisor is explicit and important, but no strong official page has yet been scanned

Use:

- create a `seed` node
- keep the edge
- avoid inventing missing upstream history

Examples:

- Eric Brewer
- Thomas R. Gross
- Dongyan Xu

## 10. Recursive stopping rule

Stop recursion when the next hop has only:

- third-party bios
- coauthor lists
- unlabeled member pages
- weak collaboration wording

At that point, create or keep a `seed` node instead of forcing a weak lineage claim.

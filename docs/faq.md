# FAQ

## What does `Find relation` do?

`Find relation` computes the relationship between two people using the **PhD genealogy only**.

Algorithm:
- Resolve both names through the current dataset search matcher.
- Build a directed PhD lineage graph: `advisor -> student`.
- Check three cases in order:
- If person A is on person B's PhD ancestor chain, return an ancestor/descendant description.
- If person B is on person A's PhD ancestor chain, return the symmetric description.
- Otherwise, find the nearest common PhD ancestor and describe the collateral relation.

Examples:
- Direct edge: `Alice is Bob's PhD advisor.`
- Distance 2: `Alice is Bob's academic grand-advisor.`
- Shared advisor: `Alice and Bob are academic siblings with the same PhD advisor.`

Notes:
- Postdoc links are not used here.
- If the dataset has no connecting PhD path, it returns `not connected in the current PhD genealogy data`.

## What do the 7 badges mean?

There are 7 badges above the view. They are not all computed on the same population.

### 1. `avg coverage`

Meaning:
- The **global** average record completeness across the dataset.

Algorithm:
- For each person, compute coverage over 7 checks:
- `work.institution`
- `undergraduate.school`
- `masters.school`
- `phd.school`
- `phd advisor known`
- `postdoc.school`
- `postdoc advisor known`
- Coverage ratio = `filled / 7`
- Badge = average ratio across the whole dataset

Example:
- If one person has 4 of 7 fields and another has 7 of 7, the average is `(4/7 + 7/7) / 2 = 78.6%`.

### 2. `same-school hires`

Meaning:
- The **global** rate of people whose current institution matches their PhD school.

Strict inclusion rule:
- Must have `work.institution`
- Must have `phd.school`
- Must have `phd.graduationYear != null`
- Must not be explicitly marked as a current PhD student

Algorithm:
- Eligible people = people satisfying the strict rule above
- Match = `normalize(work.institution) === normalize(phd.school)`
- Badge = `matches / eligible people`

Example:
- Eligible: 3 people
- Matches: 2 people
- Badge = `66.7% same-school hires`

### 3. `internal-lineage faculty`

Meaning:
- The **global** rate of current people who are inside a same-institution advisor lineage.

Algorithm:
- Look at people with known current institutions.
- Build PhD advisor links between people in the dataset.
- For each school, count people who have a same-school PhD advisor/advisee relation with another current person at that school.
- Badge = `internal-lineage faculty / faculty with lineage data`

Example:
- At School X, both advisor and former student now work there.
- Both count toward `internal-lineage faculty`.

### 4. `unresolved profiles`

Meaning:
- Count of ranking-import seed profiles that are still missing core PhD-lineage evidence.

Algorithm:
- Restrict to top-authors system-security imports
- Count records still missing core PhD genealogy information

### 5. `trees shown`

Meaning:
- Number of lineage trees that survive current filtering.

Algorithm:
- Build connected components from the lineage graph
- Hide components with `<= 3` people
- Badge = remaining connected component count

Example:
- If there are 60 raw trees and 6 tiny trees are removed, badge shows `54 trees shown`.

### 6. `schools`

Meaning:
- Number of distinct schools appearing in the **currently displayed** graph population.

Algorithm:
- Collect normalized institutions from visible people:
- current work institution
- undergraduate school
- masters school
- PhD school
- postdoc school
- Count distinct values

### 7. `lineage edges`

Meaning:
- Number of edges currently drawn in the active view.

Notes:
- In `Genealogy tree`, these are person-level lineage edges.
- In `Network graph`, these are family-level meta edges, not person-level advisor edges.

## What do the tabs mean?

### `Network graph`

Meaning:
- A **family-level meta graph**

Node meaning:
- One node = one lineage family tree
- The node label is a representative person for that family

Edge meaning:
- `Postdoc bridge`: a postdoc link connects two lineage families
- `Shared school`: two lineage families share at least one school

Example:
- Family A and Family B are connected because someone in Family A did a postdoc under someone in Family B.

### `Genealogy tree`

Meaning:
- A **person-level** tree view

Behavior:
- It does not show every tree at once.
- It shows the currently selected family from `Network graph`.
- If nothing is selected, it stays empty and asks you to select a family first.

Example:
- Click a family in `Network graph`, then open `Genealogy tree` to inspect the people inside that one lineage.

### `Same-school hire ranking`

Meaning:
- School-level ranking for `current institution == PhD school`

Population:
- Uses the current visible/filterable people, not the whole dataset
- Uses the strict graduation rule:
- must have `phd.graduationYear`
- must not be a current PhD student

Columns:
- `Rate`
- `Same-school hires`
- `Eligible people`

Example:
- `School X`: 8 eligible people, 3 same-school hires -> `37.5%`

### `Internal lineage ranking`

Meaning:
- School-level ranking for same-institution advisor lineage retention

Algorithm:
- Build PhD advisor links between current people
- For each school:
- count people with lineage data
- count people who are in a same-school advisor lineage
- count direct same-school advisor ties
- rank by internal-lineage rate first

Columns:
- `Rate`
- `Internal-lineage faculty`
- `Faculty with lineage data`
- `Direct advisor ties`

Example:
- If both an advisor and their former PhD student now work at the same school, both contribute to the internal-lineage signal.

### `School detail`

This view appears after you click a school in `Internal lineage ranking`.

It gives you a school-level drill-down:
- how many current people from that school are in the dataset
- how many have lineage data
- how many are part of an internal advisor lineage
- which direct internal advisor-student ties are currently visible

## Why can `Network graph` and `Genealogy tree` look related?

Because they are intentionally linked:
- `Network graph` is the family-level navigation layer.
- `Genealogy tree` is the person-level detail layer for the selected family.

They describe the same genealogy system at different scales.

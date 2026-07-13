# Scoring

Use these rules to assign source-level confidence for lineage claims.

## High

Assign `high` when at least one of these is true:

- An official CV explicitly names the advisor or host.
- An official homepage explicitly says `advised by`, `advisor`, `PhD student of`, `postdoctoral scholar with`, or equivalent.
- An advisor CV explicitly lists `Currently advised Ph.D. students`, `Graduated Ph.D. students`, or `Postdoctoral scholars`.
- Both sides corroborate the relationship:
  student page says `advised by X`, and advisor/lab/faculty page lists the student.

Examples:

- `currently a Ph.D. student at UC Berkeley, advised by David Wagner`
- `Ph.D., UC Berkeley, Advisor: Eric Brewer`
- student homepage plus faculty advisee list

## Medium

Assign `medium` when evidence is strong but not fully explicit:

- Official page says `works with X` in a training context.
- Lab page membership strongly implies supervision but does not say `advisor`.
- Role-labeled team page says `PhD student` or `Post Doc`, but no explicit advisor wording is present.
- CV or bio strongly implies the institution and period, but advisor wording is indirect.
- Only one side corroborates, but the source is official and specific.

Examples:

- `member of the Wagner security group`
- `postdoctoral researcher in X's lab`
- `listed as Post Doc on a professor's group page`

## Low

Assign `low` when evidence is partial, weak, or indirect:

- Third-party bio page with no official corroboration
- Collaboration wording with no supervision cue
- Inference based only on coauthorship, shared lab, or department affiliation
- Ambiguous list membership

Examples:

- `collaborates with X`
- `research interests align with X`

## Bilateral bonus

Use these heuristics when multiple sources exist for the same claim:

- Student-side direct claim + advisor-side listing: `high`
- Student-side `works with X` + advisor-side `Post Doc` or `PhD student` role on lab page: usually `high`
- Student-side direct claim only: usually `high`
- Advisor-side listing only: usually `medium`
- Advisor CV `Currently advised Ph.D. students` or `Graduated Ph.D. students` section: usually `high`
- Indirect evidence from both sides with no explicit advisor wording: usually `medium`
- Only one weak source: `low`

## Conflict handling

If two sources disagree:

- Prefer official CV over homepage summary text.
- Prefer official university/faculty pages over third-party bios.
- Keep the chosen claim and mention the conflicting claim in `sources[].note`.

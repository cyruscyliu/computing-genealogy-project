# Output Schema

Write normalized records that fit `data/raw/people.json`.

## Required shape

```json
{
  "id": "person-id",
  "name": "Person Name",
  "dblpAuthorId": "DBLP Name 0001",
  "aliases": [],
  "work": {
    "institution": "Current School or Company",
    "note": "evidence summary"
  },
  "tracking": {
    "status": "active",
    "priority": 100,
    "note": "why this person is tracked"
  },
  "source": {
    "label": "Primary page label",
    "url": "https://example.org/person"
  },
  "sources": [
    {
      "kind": "homepage",
      "url": "https://example.org/person",
      "confidence": "high",
      "note": "explicit phrase or concise evidence summary"
    }
  ],
  "summary": "One-sentence lineage summary.",
  "stages": {
    "undergraduate": {
      "school": "School Name",
      "note": "evidence summary"
    },
    "masters": {
      "school": "School Name",
      "note": "evidence summary"
    },
    "phd": {
      "school": "School Name",
      "advisorPersonId": "advisor-id",
      "advisorLabel": "Advisor Name",
      "status": "Ph.D. student",
      "note": "evidence summary"
    },
    "postdoc": {
      "school": null,
      "advisorPersonId": null,
      "advisorLabel": null,
      "status": null,
      "note": "not found on scanned sources"
    }
  }
}
```

## Evidence note style

Keep `sources[].note` concise and audit-friendly:

- mention the page type
- mention the exact relationship cue
- mention whether corroboration exists

Good examples:

- `Homepage says "advised by David Wagner"; student-side direct evidence.`
- `CV education section lists "Advisor: Eric Brewer"; explicit official evidence.`
- `Faculty page lists Sizhe Chen among current PhD students; advisor-side corroboration.`

## Seed nodes

If a referenced advisor should be tracked but lacks full details, create a minimal seed node:

```json
{
  "id": "eric-brewer",
  "name": "Eric Brewer",
  "dblpAuthorId": null,
  "aliases": [],
  "work": {
    "institution": null,
    "note": "pending scan"
  },
  "tracking": {
    "status": "seed",
    "priority": 300,
    "note": "Referenced as upstream advisor; details pending scan."
  },
  "source": {
    "label": "Seed node",
    "url": "https://example.org"
  },
  "sources": [
    {
      "kind": "seed",
      "url": "https://example.org",
      "confidence": "low",
      "note": "Created from referenced advisor name only."
    }
  ],
  "summary": "Seed node awaiting fuller scan.",
  "stages": {
    "undergraduate": {
      "school": null,
      "note": "pending scan"
    },
    "masters": {
      "school": null,
      "note": "pending scan"
    },
    "phd": {
      "school": null,
      "advisorPersonId": null,
      "advisorLabel": null,
      "status": null,
      "note": "pending scan"
    },
    "postdoc": {
      "school": null,
      "advisorPersonId": null,
      "advisorLabel": null,
      "status": null,
      "note": "pending scan"
    }
  }
}
```

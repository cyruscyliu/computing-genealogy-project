# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-07-18

### Added

- Repository changelog for tracking published releases.

## [0.1.0] - 2026-07-18

### Added

- Interactive Computing Genealogy Explorer with global, school, ranking, and exact local-lineage graph views.
- Search by researcher name, alias, and institution, with stable profile IDs shown in the detail panel.
- 3,915 sourced researcher profiles with work, education, PhD advisor, postdoctoral, and source-provenance fields.
- Person-first enrichment tools for local DBLP and CSrankings data, ORCID, Google Scholar, homepages, CVs, and Mathematics Genealogy Project evidence.
- Versioned raw profile schema and single-profile JSON importer for issue and pull-request contributions.
- `$add-lineage` contribution skill, profile issue template, and pull-request validation workflow.
- Profile-scoped evidence cache at `.cache/profiles/<profile-id>/` with source snapshots, collector output, and enrichment resolution.
- Search-engine metadata, canonical pages, sitemap, robots rules, and Google Search Console verification.

### Changed

- Normalized institution and advisor aliases while preserving DBLP as the profile identity source of truth.
- Moved source evidence notes into the public profile UI.
- Added guardrails that prevent genealogy pages from being treated as personal homepages during enrichment.

[0.1.0]: https://github.com/cyruscyliu/computing-genealogy-project/releases/tag/v0.1.0
[0.1.1]: https://github.com/cyruscyliu/computing-genealogy-project/compare/v0.1.0...v0.1.1

# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [1.0.0] — 2026-07-07

First public release.

### Added
- 60 tools: list/get/create/update/delete across 12 Planhat resource families —
  Companies, Contacts (end users), Opportunities, Notes, Conversations, Users,
  Assets, Issues, Tickets, Tasks, Licenses, Invoices.
- Offline test suite covering every tool's HTTP method, path, and key body fields.
- CI (ruff + pytest) and tag-driven GitHub releases.

### Fixed
- Note tools previously called a nonexistent `/notes` endpoint (404 on every
  call); they now correctly route through `/conversations` with `type: "note"`.

### Removed
- Activity tools (`list/get/create_activity`): `/activities` is not a Planhat
  REST resource and the tools had never worked.

# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [2.0.0] - 2026-07-07

Rewritten in TypeScript so the one-click install needs no prerequisites at all.

### Changed
- Server ported from Python to TypeScript on the official
  `@modelcontextprotocol/sdk`. The bundle is now `server.type: "node"`, which
  Claude Desktop runs with its built-in Node runtime. The old uv/Python bundle
  required users to install `uv` first; now there is nothing to install.
- Same 60 tools, names, environment variables, annotations and gates as 1.x.
- The manual-install path uses Node.js 18+ (`git clone`, `npm install`,
  `npm run build`) instead of uv.

### Added
- Zod input schemas validate tool arguments before any request is made.
- `extra_fields`: an explicit, schema-visible object for passing arbitrary
  Planhat fields on create/update (replaces Python's implicit `**kwargs`).

### Removed
- The Python server, its dependencies and its test suite.

## [1.3.1] - 2026-07-07

### Changed
- Copy cleanup across README, docs and the bundle manifest: plainer install
  steps, no emojis, no em dashes.

## [1.3.0] - 2026-07-07

One-click install.

### Added
- `.mcpb` bundle attached to every release: download, double-click, paste
  your token into Claude Desktop's install dialog (stored in the OS
  keychain). Read-only mode and delete-disabling appear as checkboxes.
- CI packs the bundle on every push and fails unless its contents exactly
  match a six-file allowlist; releases refuse to publish on any version
  mismatch between the tag, `pyproject.toml` and `manifest.json`.

### Changed
- README now leads with the one-click install; the terminal-based setup
  remains as the manual path for Cursor and other MCP clients.

## [1.2.0] - 2026-07-07

### Added
- MCP `ToolAnnotations` on every tool: `readOnlyHint` on list/get,
  `destructiveHint` on update/delete (creates marked non-destructive),
  `idempotentHint` where applicable. Permission-aware MCP clients use these
  to prompt before destructive calls and auto-approve reads.

## [1.1.0] - 2026-07-07

Hardening release following an external security review.

### Added
- `PLANHAT_READ_ONLY=1`: registers only the 24 list/get tools.
- `PLANHAT_DISABLE_DELETE=1`: registers everything except the 12 delete tools.
- Timeouts on all outbound HTTP calls (3s connect / 30s read).
- Committed `uv.lock` and pinned GitHub Actions to commit SHAs for
  reproducible CI and releases.

### Fixed
- IDs interpolated into URL paths are now URL-encoded, and empty IDs are
  rejected; previously a blank ID would silently call the list endpoint
  instead of the intended single-record route.

## [1.0.0] - 2026-07-07

First public release.

### Added
- 60 tools: list/get/create/update/delete across 12 Planhat resource families:
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

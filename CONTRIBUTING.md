# Contributing

Thanks for helping out! This is a deliberately small project (one server, split
into a few short source files), so contributions are easy to review if they stay
that shape.

## Before you open a PR

```bash
npm run typecheck    # must pass
npm test             # must pass; offline, no token needed
```

## Ground rules

1. **Never commit secrets.** `.env` is gitignored; keep it that way. PRs containing
   tokens are closed and the token is assumed burned.
2. **Tests are offline.** Tool tests drive handlers with a recorder; HTTP tests mock
   the global `fetch`. Do not add tests (or CI steps) that hit the live Planhat API.
3. **Keep the bundle to four files.** `.mcpbignore` is an allowlist; the CI and
   release workflows fail if the packed bundle drifts from `manifest.json`,
   `dist/server.js`, `LICENSE`, `README.md`.
4. Read `AGENTS.md` first: it documents the Planhat API quirks (notes/tickets are
   `/conversations`, invoice `cId`, license `_currency`, and more) that have caused
   real bugs before.

## Adding a new resource family

1. Verify the endpoints against the live API with **read-only** GETs.
2. Add the five specs (list/get/create/update/delete) to `TOOL_SPECS` in
   `src/tools.ts`, matching the existing naming, `kind` values and banner style.
3. Add the five cases to `CASES` in `tests/tools.test.ts`.
4. Update the tool count and resource table in `README.md`, add a `CHANGELOG.md`
   entry, and document any field quirks in `AGENTS.md`.

## Releases

Maintainers: bump `version` in `package.json` and `manifest.json`, update
`CHANGELOG.md`, then tag `vX.Y.Z` and push the tag; `release.yml` verifies the
versions match, rebuilds, and publishes the GitHub release with the `.mcpb` bundle
attached.

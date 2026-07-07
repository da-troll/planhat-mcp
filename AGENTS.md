# AGENTS.md: handbook for AI coding agents (and curious humans)

This file is the single source of agent guidance for this repo. `CLAUDE.md` is a
symlink to it; edit this file only.

## What this repo is

A small TypeScript MCP server exposing the Planhat CRM REST API
(`https://api.planhat.com`) as 60 tools: 12 resource families x 5 verbs
(list/get/create/update/delete). Built on the official `@modelcontextprotocol/sdk`,
using Node's built-in `fetch`, with a bearer token read from the environment (or a
local `.env` for manual installs).

esbuild compiles `src/` into one dependency-free `dist/server.js`. The bundle
manifest is `server.type: "node"`, so Claude Desktop runs it with its own built-in
Node runtime: users install nothing (no Python, no uv, no runtime). Node.js 18+ is
required only for manual installs from a checkout.

## Commands

```bash
npm install          # install dependencies
npm test             # offline test suite (node:test); all tools, fetch mocked
npm run typecheck    # tsc --noEmit, strict
npm run build        # esbuild -> dist/server.js
npm start            # run the built server over stdio
```

A read-only live smoke check (needs a real token in `.env`; GETs only, mutates nothing):

```bash
node -e '
const t = process.env.PLANHAT_TOKEN;
const paths = ["/companies","/endusers","/opportunities","/conversations","/users","/assets","/issues","/tickets","/tasks","/licenses","/invoices"];
for (const p of paths) {
  const r = await fetch("https://api.planhat.com"+p+"?limit=1", { headers: { Authorization: "Bearer "+t } });
  console.log(r.status, p);
}'
```

## Hard rules

- **Never commit `.env` or `planhat-mcp-notes.md`.** Both are gitignored; they contain
  live credentials. If you ever see a secret in a tracked file, stop and flag it.
- **Never fire create/update/delete calls against the live API** in tests, smoke
  checks, or "just to verify". This is a production Planhat tenant. Read-only GETs
  with `limit=1` are the ceiling for live verification.
- Tests must stay fully offline: tool tests drive handlers with a recorder Http, and
  the HTTP tests mock the global `fetch`.
- **No emojis and no em dashes in public-facing copy** (README, docs, manifest
  strings, release notes, commit messages). Rewrite with colons, semicolons,
  periods or parentheses instead.

## API quirks you must know before editing (verified live, July 2026)

These are the traps that produced real bugs in this codebase's history:

1. **There is no `/notes` endpoint.** Notes are Conversations with `type: "note"`.
   The `*_note` tools call `/conversations`. An earlier version called `/notes` and
   silently 404'd on every note operation.
2. **There is no `/activities` endpoint.** It is not a Planhat REST resource at all.
   Activity-style tools were removed; do not reintroduce them.
3. **Tickets are Conversations too.** `GET /tickets` and `DELETE /tickets/:id` exist
   as convenience endpoints, but there is no documented single-item `POST /tickets`,
   so `create_ticket`/`update_ticket` go through `/conversations` with `type: "ticket"`.
4. **Updates are `PUT`, not `PATCH`.** Planhat treats PUT as a partial update: send
   only the fields you want changed.
5. **Field-name inconsistencies are real, not typos:**
   - Invoices use `cId` for the company reference (everything else uses `companyId`).
   - Licenses require `_currency` (with underscore) plus `value`.
   - Issues link to companies via `companyIds` (an array).
   - Users require `nickName` per the docs' bulk-upsert rules, though single
     `POST /users` accepts first/last/email.
6. **Known open question:** `create_opportunity`/`update_opportunity` send a `value`
   field inherited from the original script; Planhat docs describe `mrr`/`arr`/`nrr`
   instead. Unconfirmed whether `value` lands anywhere. If a user reports opportunity
   values not appearing, this is the first suspect.
7. **Alternative IDs:** most single-item endpoints accept `extid-<externalId>` or
   `srcid-<sourceId>` in place of the Mongo `_id` path parameter.
8. Full-text `search_records` and Documents/Pages (present in Planhat's own hosted
   MCP at `api.planhat.com/v1/mcp`) have **no plain-REST equivalent**; they cannot be
   added here without reverse-engineering. Don't promise them.

## Conventions

- Tools live as `TOOL_SPECS` in `src/tools.ts`: one object per tool with `name`,
  `kind`, `description`, a Zod `inputSchema` (raw shape), and a `handler(http, args)`.
  `src/server.ts` registers them; tests drive the handlers directly.
- Tool naming: `<verb>_<resource>` singular (`get_company`), lists plural (`list_companies`).
- Every resource family implements exactly the five verbs, grouped under a
  `// -- Resource --` banner in `tools.ts`.
- Handlers never call `fetch` directly; they use the injected `Http` (`http.get/post/put/del`),
  which centralizes the timeout (`AbortSignal.timeout`) and Planhat error parsing.
- The tool `kind` ("read"/"create"/"update"/"delete") drives two things: the
  `PLANHAT_READ_ONLY`/`PLANHAT_DISABLE_DELETE` gates in `buildServer`, and the MCP
  `KIND_ANNOTATIONS` sent to clients (readOnlyHint for reads, destructiveHint for
  update/delete). Misclassifying a tool silently exempts it from both; the
  registration and annotation tests catch drift.
- Every ID interpolated into a URL path goes through `pathId()`, which rejects empty
  strings (a blank ID would otherwise fall through to the list route) and
  percent-encodes with `encodeURIComponent`. Prefixed `extid-`/`srcid-` IDs survive
  unchanged (their characters are unreserved).
- Free-form extra fields go through an explicit optional `extra_fields` object,
  merged into the request body. This is the schema-visible replacement for the old
  Python `**kwargs`. Only add it where the resource genuinely accepts arbitrary fields.
- When adding a resource family: verify the endpoint live (read-only!) first, add the
  five specs, add the five cases to `CASES` in `tests/tools.test.ts`, update the
  tool-count in README/CHANGELOG, and note any field quirks above.

## The .mcpb bundle (one-click install)

- `manifest.json` defines the bundle: `server.type: "node"`, command `node` against
  `dist/server.js`, the token as a `sensitive` user_config field (keychain-stored),
  and the two gates as boolean checkboxes.
- The bundle ships **exactly four files**: `manifest.json`, `dist/server.js`,
  `LICENSE`, `README.md`. `.mcpbignore` enforces this as an allowlist (deny `/*`, then
  re-include only those four), and both `ci.yml` and `release.yml` verify the packed
  contents against that exact list (duplicated; update both). Never weaken this: a
  bundle on the public release page containing `.env` would leak a live token.
- Releases: bump the version in `package.json` **and** `manifest.json`, update
  CHANGELOG, tag `vX.Y.Z`; the release workflow refuses to publish on any version
  mismatch and attaches `planhat-mcp.mcpb` to the release.
- Claude Desktop runs node-type bundles with its own built-in Node (Electron's
  embedded runtime, currently Node 24). There is no bundled Python or uv; that is why
  this project is Node rather than Python.

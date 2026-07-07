# AGENTS.md — handbook for AI coding agents (and curious humans)

This file is the single source of agent guidance for this repo. `CLAUDE.md` is a
symlink to it — edit this file only.

## What this repo is

A single-file MCP server (`planhat_mcp.py`) exposing the Planhat CRM REST API
(`https://api.planhat.com`) as 60 tools: 12 resource families × 5 verbs
(list/get/create/update/delete). Built on `FastMCP` from the `mcp` Python SDK,
using `requests` for HTTP and a bearer token loaded from `.env` at import time.

There is deliberately no package structure: one file, stdio transport, launched
by the MCP client via `uvx --with python-dotenv --with requests "mcp[cli]" run planhat_mcp.py`.
Keep it that way unless the user asks otherwise — the file path is wired into
users' Claude Desktop configs, so renaming or moving `planhat_mcp.py` is a
breaking change.

## Commands

```bash
uv run pytest -q       # offline test suite — all 60 tools, HTTP fully mocked
uv run ruff check .    # lint (line-length 120)
```

A read-only live smoke check (needs a real token in `.env`; GETs only, mutates nothing):

```bash
uv run python -c "
import os; from dotenv import load_dotenv; load_dotenv(); import requests
h={'Authorization': f\"Bearer {os.environ['PLANHAT_TOKEN']}\"}
for p in ['/companies','/endusers','/opportunities','/conversations','/users',
          '/assets','/issues','/tickets','/tasks','/licenses','/invoices']:
    r=requests.get(f'https://api.planhat.com{p}',headers=h,params={'limit':1},timeout=10)
    print(r.status_code,p)
"
```

## Hard rules

- **Never commit `.env` or `planhat-mcp-notes.md`.** Both are gitignored; they contain
  live credentials. If you ever see a secret in a tracked file, stop and flag it.
- **Never fire create/update/delete calls against the live API** in tests,
  smoke checks, or "just to verify". This is a production Planhat tenant.
  Read-only GETs with `limit=1` are the ceiling for live verification.
- Tests must stay fully offline — mock `requests`, as `tests/test_tools.py` does.

## API quirks you must know before editing (verified live, July 2026)

These are the traps that produced real bugs in this codebase's history:

1. **There is no `/notes` endpoint.** Notes are Conversations with
   `type: "note"`. The `*_note` tools call `/conversations`. An earlier version
   of this server called `/notes` and silently 404'd on every note operation.
2. **There is no `/activities` endpoint.** It is not a Planhat REST resource at
   all. Activity-style tools were removed — do not reintroduce them.
3. **Tickets are Conversations too.** `GET /tickets` and `DELETE /tickets/:id`
   exist as convenience endpoints, but there is no documented single-item
   `POST /tickets` — so `create_ticket`/`update_ticket` go through
   `/conversations` with `type: "ticket"`.
4. **Updates are `PUT`, not `PATCH`.** Planhat treats PUT as a partial update:
   send only the fields you want changed.
5. **Field-name inconsistencies are real, not typos:**
   - Invoices use `cId` for the company reference (everything else uses `companyId`).
   - Licenses require `_currency` (with underscore) plus `value`.
   - Issues link to companies via `companyIds` (an array).
   - Users require `nickName` per the docs' bulk-upsert rules, though single
     `POST /users` accepts first/last/email.
6. **Known open question:** `create_opportunity`/`update_opportunity` send a
   `value` field inherited from the original script; Planhat docs describe
   `mrr`/`arr`/`nrr` instead. Unconfirmed whether `value` lands anywhere. If a
   user reports opportunity values not appearing, this is the first suspect.
7. **Alternative IDs:** most single-item endpoints accept `extid-<externalId>`
   or `srcid-<sourceId>` in place of the Mongo `_id` path parameter.
8. Full-text `search_records` and Documents/Pages (present in Planhat's own
   hosted MCP at `api.planhat.com/v1/mcp`) have **no plain-REST equivalent** —
   they cannot be added here without reverse-engineering. Don't promise them.

## Conventions

- Tool naming: `<verb>_<resource>` singular (`get_company`), lists plural (`list_companies`).
- Every resource family implements exactly the five verbs, in the order
  list/get/create/update/delete, under a `# ── Resource ──` banner comment.
- HTTP goes through the module-level helpers `_get/_post/_put/_delete`;
  responses through `_parse`. Never call `requests` directly from a tool. Every
  helper passes `timeout=REQUEST_TIMEOUT` — tests assert this on every call.
- Tools are registered with the `_tool()` decorator, never `mcp.tool()` directly:
  `@_tool()` for list/get, `@_tool("write")` for create/update, `@_tool("delete")`
  for delete. This is what makes the `PLANHAT_READ_ONLY` and
  `PLANHAT_DISABLE_DELETE` env gates work — misclassifying a tool silently
  exempts it from gating, and the registration tests will catch the count drift.
- Every ID interpolated into a URL path goes through `_path_id()`, which rejects
  empty strings (a blank ID would otherwise fall through to the list route) and
  percent-encodes all reserved characters (`quote(value, safe="")`). Unreserved
  characters pass through untouched, so `extid-…`/`srcid-…` IDs work unchanged.
- Update tools take optional named params for the common fields plus `**kwargs`
  passed straight through to the API body, so any Planhat field is reachable
  without a code change.
- When adding a resource family: verify the endpoint live (read-only!) first,
  add the five tools, add the five cases to `CASES` in `tests/test_tools.py`,
  update the tool-count in README/CHANGELOG, and note any field quirks above.

## Layout

```
planhat_mcp.py        the server — helpers at top, tool families below, mcp.run() at bottom
tests/test_tools.py   parametrized offline tests: every tool → expected method/path/body
.github/workflows/    ci.yml (ruff+pytest), release.yml (GitHub release on v* tags)
.env                  PLANHAT_TOKEN=… (gitignored, lives only on the user's machine)
```

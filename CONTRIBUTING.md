# Contributing

Thanks for helping out! This is a deliberately small project — one server file,
one test file — so contributions are easy to review if they stay that shape.

## Before you open a PR

```bash
uv run ruff check .    # must pass
uv run pytest -q       # must pass — offline, no token needed
```

## Ground rules

1. **Never commit secrets.** `.env` is gitignored; keep it that way. PRs
   containing tokens are closed and the token is assumed burned.
2. **Tests are offline.** Mock `requests` — see `tests/test_tools.py`. Do not
   add tests (or CI steps) that hit the live Planhat API.
3. **Don't rename or move `planhat_mcp.py`.** Its absolute path is hardcoded in
   users' Claude Desktop configs; moving it breaks every install.
4. Read `AGENTS.md` first — it documents the Planhat API quirks (notes/tickets
   are `/conversations`, invoice `cId`, license `_currency`, …) that have caused
   real bugs before.

## Adding a new resource family

1. Verify the endpoints against the live API with **read-only** GETs.
2. Implement the five verbs (list/get/create/update/delete) using the
   `_get/_post/_put/_delete` helpers, matching the existing naming and banner style.
3. Add the five cases to `CASES` in `tests/test_tools.py`.
4. Update the tool count and resource table in `README.md`, add a `CHANGELOG.md`
   entry, and document any field quirks in `AGENTS.md`.

## Releases

Maintainers: bump `version` in `pyproject.toml`, update `CHANGELOG.md`, then
tag `vX.Y.Z` and push the tag — `release.yml` publishes the GitHub release.

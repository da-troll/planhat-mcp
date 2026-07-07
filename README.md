# Planhat MCP

[![CI](https://github.com/da-troll/planhat-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/da-troll/planhat-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/da-troll/planhat-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/da-troll/planhat-mcp/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/da-troll/planhat-mcp)](https://github.com/da-troll/planhat-mcp/releases)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Talk to your Planhat customer data in plain English.**

Planhat MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server for [Planhat](https://www.planhat.com), the customer success platform. Add it to Claude Desktop — or any other MCP client — and ask for what you need:

> *"Which companies have licenses renewing this quarter?"*
> *"Create a task for me to follow up with Acme Corp next week."*
> *"Summarize the open tickets for our top five accounts."*

Claude reads and updates Planhat directly, live from the conversation. No dashboards, no exports, no SQL.

It runs entirely on your own computer, with your own Planhat API token — no third-party service between your AI and your customer data.

---

## Quickstart

You need three things: this folder, a Planhat API token, and Claude Desktop. Ten minutes, no programming.

### 1. Download this project and the `uv` tool

Open the **Terminal** app and paste these two lines:

```bash
git clone https://github.com/da-troll/planhat-mcp.git ~/planhat-mcp
brew install uv
```

(On Windows, install [Git](https://git-scm.com/download/win) and [uv](https://docs.astral.sh/uv/getting-started/installation/), then run the `git clone` line in PowerShell.)

### 2. Add your Planhat token

In Planhat, an admin can create an API token under **Settings → Service Accounts (Private Apps) → API Access Token**. Then:

```bash
cd ~/planhat-mcp
cp .env.example .env
open .env        # paste your token after PLANHAT_TOKEN= and save
```

The token stays in that one file on your machine. Treat it like a password.

### 3. Point Claude Desktop at it

Open Claude Desktop's config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this (or merge it into your existing `mcpServers` block), replacing `YOUR-USERNAME`:

```json
{
  "mcpServers": {
    "planhat": {
      "command": "uvx",
      "args": [
        "--with", "python-dotenv",
        "--with", "requests",
        "mcp[cli]", "run",
        "/Users/YOUR-USERNAME/planhat-mcp/planhat_mcp.py"
      ]
    }
  }
}
```

Restart Claude Desktop, then ask it: *"List my top 3 Planhat companies."* If you get an answer, you're done. 🎉

---

## What Claude can do with it

60 tools across 12 Planhat resource types. Every resource supports the same five verbs — **list**, **get**, **create**, **update**, **delete**:

| Resource | What it is |
|---|---|
| Companies | Your customer accounts |
| Contacts (end users) | People at those customers |
| Opportunities | Sales/expansion deals |
| Notes | Logged notes on an account |
| Conversations | All logged touchpoints — emails, calls, notes, tickets |
| Users | Your own team members in Planhat |
| Assets | Products/objects tied to a customer |
| Issues | Bugs and feature requests |
| Tickets | Support tickets |
| Tasks | To-dos and scheduled activities |
| Licenses | Recurring revenue records |
| Invoices | Billing records |

Claude only ever does what you ask, and the token you create controls what it *can* touch — a read-only token makes the whole connector read-only.

## Repository layout

```
planhat-mcp/
├── README.md                  ← you are here
├── planhat_mcp.py             ← the entire MCP server (one file)
├── pyproject.toml             ← dependencies & tooling config
├── .env.example               ← template for your API token
├── AGENTS.md                  ← handbook for AI coding agents
├── CLAUDE.md → AGENTS.md      ← same file, Claude's preferred name
├── LICENSE                    ← MIT
├── CHANGELOG.md               ← release history
├── SECURITY.md                ← token handling & reporting issues
├── CONTRIBUTING.md            ← how to add tools or fix bugs
├── tests/
│   └── test_tools.py          ← offline tests for all 60 tools
└── .github/workflows/
    ├── ci.yml                 ← lint + tests on every push
    └── release.yml            ← GitHub release on version tags
```

## Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| Claude says it has no Planhat tools | Claude Desktop only reads its config on launch — quit it fully and reopen. Check the JSON has no trailing commas. |
| `HTTP 401 Unauthorized` in a tool result | The token in `.env` is wrong, expired, or was rotated. Paste a fresh one. |
| `KeyError: 'PLANHAT_TOKEN'` | There's no `.env` next to `planhat_mcp.py`. Do step 2 again. |
| `command not found: uvx` | `uv` isn't installed or isn't on Claude's PATH — use the full path to `uvx` (find it with `which uvx`) in the config's `command` field. |
| Tool works but returns `[]` | Usually not an error — that Planhat resource is genuinely empty for your filters. |

## For engineers

```bash
uv run pytest -q       # run the offline test suite (never touches the live API)
uv run ruff check .    # lint
```

Architecture notes, API quirks, and contribution rules live in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Endpoint paths were verified against the live Planhat API in July 2026 — notably, Planhat has **no** `/notes` or `/activities` REST endpoints; notes and tickets are `/conversations` under the hood (see AGENTS.md for the full story).

## License

[MIT](LICENSE) — do what you like, no warranty.

# Planhat MCP

[![CI](https://github.com/da-troll/planhat-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/da-troll/planhat-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/da-troll/planhat-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/da-troll/planhat-mcp/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/da-troll/planhat-mcp)](https://github.com/da-troll/planhat-mcp/releases)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](pyproject.toml)
[![MCP](https://img.shields.io/badge/MCP-compatible-8A2BE2.svg)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**Talk to your Planhat customer data in plain English.**

Struggling to make Planhat's hosted MCP work? Custom connector in Claude that won't connect, or an OAuth login that never completes once it does? 

Here's your answer: a [Model Context Protocol](https://modelcontextprotocol.io) server for [Planhat](https://www.planhat.com) that runs on your own machine and authenticates with a plain API token. No OAuth flow, no connector setup, nothing to host. Add it to Claude Desktop or any other MCP client and ask for what you need:

> *"Which companies have licenses renewing this quarter?"*
> 
> *"Create a task for me to follow up with Acme Corp next week."*
> 
> *"Summarize the open tickets for our top five accounts."*

Claude reads and updates Planhat directly, live from the conversation. No dashboards, no exports, no SQL.

It runs entirely on your own computer, with your own Planhat API token. No third-party service sits between your AI and your customer data.

## Install in Claude Desktop

Download one file, double-click it, paste your token. No terminal, no config files, no code.

1. Install `uv` if you don't have it: `brew install uv` on macOS, or the [uv install guide](https://docs.astral.sh/uv/getting-started/installation/) on Windows.
2. [Download the .mcpb file](https://github.com/da-troll/planhat-mcp/releases/latest/download/planhat-mcp.mcpb).
3. Double-click the downloaded file. Claude Desktop opens an install pop-up.
4. Review the pop-up and click **Install**.
5. Create a Planhat API token if you don't have one: in Planhat, go to **Settings > Service Accounts (Private Apps) > API Access Token**. Admin access is required.
6. Paste the token into the token field. It is stored in your system keychain, never in a file on disk.
7. Optional: tick **Read-only mode** or **Disable delete tools** to limit what the AI can do.
8. Ask Claude: *"List my top 3 Planhat companies."* An answer means you are done.

> **Switching from a manual install?** Remove the old `planhat` entry from `claude_desktop_config.json` first, or you'll see two copies of every tool.

## Manual install (Cursor and other MCP clients)

For MCP clients other than Claude Desktop, or if you prefer running from a checkout:

**1. Get the code and `uv`:**

```bash
git clone https://github.com/da-troll/planhat-mcp.git ~/planhat-mcp
brew install uv
```

**2. Add your Planhat token:**

```bash
cd ~/planhat-mcp
cp .env.example .env
open .env        # paste your token after PLANHAT_TOKEN= and save
```

The token stays in that one file on your machine. Treat it like a password.

**3. Register the server** in your client's MCP config (for Claude Desktop that's `claude_desktop_config.json`; for Cursor, `.cursor/mcp.json`), replacing `YOUR-USERNAME`:

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

Restart the client and test with the same question as above.

## What Claude can do with it

60 tools across 12 Planhat resource types. Every resource supports the same five verbs: **list**, **get**, **create**, **update**, **delete**.

| Resource | What it is |
|---|---|
| Companies | Your customer accounts |
| Contacts (end users) | People at those customers |
| Opportunities | Sales/expansion deals |
| Notes | Logged notes on an account |
| Conversations | All logged touchpoints: emails, calls, notes, tickets |
| Users | Your own team members in Planhat |
| Assets | Products/objects tied to a customer |
| Issues | Bugs and feature requests |
| Tickets | Support tickets |
| Tasks | To-dos and scheduled activities |
| Licenses | Recurring revenue records |
| Invoices | Billing records |

Claude only ever does what you ask, and the token you create controls what it *can* touch. A read-only token makes the whole connector read-only.

### Optional hardening

Two switches cap what any connected AI can ever do, no matter what it's asked. Bundle installs get them as checkboxes in the install pop-up; manual installs add either to the `.env` file:

| Setting | Effect |
|---|---|
| `PLANHAT_READ_ONLY=1` | Only the list/get tools exist; nothing in Planhat can be changed. |
| `PLANHAT_DISABLE_DELETE=1` | Everything works except deleting records. |

Every tool also carries the standard MCP annotations (`readOnlyHint`, `destructiveHint`), so clients that calibrate their permission prompts per tool (asking before destructive calls, auto-approving reads) get the right signals. Whether and when to prompt is always the client's decision; the switches above and the permissions on the Planhat token itself (see [SECURITY.md](SECURITY.md)) are the hard limits.

## Repository layout

```
planhat-mcp/
├── README.md                  ← you are here
├── planhat_mcp.py             ← the entire MCP server (one file)
├── manifest.json              ← .mcpb bundle definition (one-click install)
├── pyproject.toml             ← dependencies & tooling config
├── uv.lock                    ← pinned dependency versions
├── .env.example               ← token template for manual installs
├── .mcpbignore                ← what stays out of the bundle
├── AGENTS.md                  ← handbook for AI coding agents
├── CLAUDE.md → AGENTS.md      ← same file, Claude's preferred name
├── LICENSE                    ← MIT
├── CHANGELOG.md               ← release history
├── SECURITY.md                ← token handling & reporting issues
├── CONTRIBUTING.md            ← how to add tools or fix bugs
├── tests/
│   ├── test_tools.py          ← offline tests for all 60 tools
│   ├── test_bundle.py         ← manifest/bundle consistency checks
│   └── conftest.py            ← keeps real tokens out of test runs
└── .github/workflows/
    ├── ci.yml                 ← lint + tests + bundle gate on every push
    └── release.yml            ← GitHub release with .mcpb asset on version tags
```

## Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| Install pop-up calls the extension "incompatible" or greys out Install | Claude Desktop probes for a system Python even though `uv` manages its own ([upstream issue](https://github.com/modelcontextprotocol/mcpb/issues/84)). Make sure `uv` is installed and `python3 --version` prints a version, then retry. |
| Every Planhat tool appears twice | The bundle and an old manual config entry are both installed. Remove `mcpServers.planhat` from `claude_desktop_config.json`. |
| Claude says it has no Planhat tools | Claude Desktop only reads its config on launch. Quit it fully, reopen, and check the JSON has no trailing commas. |
| `HTTP 401 Unauthorized` in a tool result | The token is wrong, expired, or was rotated. Paste a fresh one. |
| `KeyError: 'PLANHAT_TOKEN'` | Bundle installs: re-open the extension's settings and fill in the token. Manual installs: there is no `.env` next to `planhat_mcp.py`, so repeat manual step 2. |
| `command not found: uvx` | `uv` isn't installed or isn't on Claude's PATH. Use the full path to `uvx` (find it with `which uvx`) in the config's `command` field. |
| Tool works but returns `[]` | Usually not an error: that Planhat resource is genuinely empty for your filters. |

## For engineers

```bash
uv run pytest -q                                      # offline test suite (never touches the live API)
uv run ruff check .                                   # lint
npx -y @anthropic-ai/mcpb@2.1.2 pack . planhat.mcpb   # build the one-click bundle locally
```

Architecture notes, API quirks, and contribution rules live in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Endpoint paths were verified against the live Planhat API in July 2026. Notably, Planhat has **no** `/notes` or `/activities` REST endpoints; notes and tickets are `/conversations` under the hood (see AGENTS.md for the full story).

## License

[MIT](LICENSE). Do what you like, no warranty.

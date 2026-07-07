# Planhat MCP

[![CI](https://github.com/da-troll/planhat-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/da-troll/planhat-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/da-troll/planhat-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/da-troll/planhat-mcp/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/da-troll/planhat-mcp)](https://github.com/da-troll/planhat-mcp/releases)
[![Node 18+](https://img.shields.io/badge/node-18%2B-brightgreen.svg)](package.json)
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

Download one file, double-click it, paste your token. No terminal, no config files, no code, and nothing to install first.

1. [Download the .mcpb file](https://github.com/da-troll/planhat-mcp/releases/latest/download/planhat-mcp.mcpb).
2. Double-click the downloaded file. Claude Desktop opens an install pop-up.
3. Review the pop-up and click **Install**.
4. Create a Planhat API token if you don't have one: in Planhat, go to **Settings > Service Accounts (Private Apps) > API Access Token**. Admin access is required.
5. Paste the token into the token field. It is stored in your system keychain, never in a file on disk.
6. Optional: tick **Read-only mode** or **Disable delete tools** to limit what the AI can do.
7. Ask Claude: *"List my top 3 Planhat companies."* An answer means you are done.

> **Switching from a manual install?** Remove the old `planhat` entry from `claude_desktop_config.json` first, or you'll see two copies of every tool.

## Manual install (Cursor and other MCP clients)

For MCP clients other than Claude Desktop, or if you prefer running from a checkout. Requires [Node.js](https://nodejs.org) 18 or newer.

**1. Get the code and build the server:**

```bash
git clone https://github.com/da-troll/planhat-mcp.git ~/planhat-mcp
cd ~/planhat-mcp
npm install
npm run build
```

**2. Add your Planhat token:**

```bash
cp .env.example .env
open .env        # paste your token after PLANHAT_TOKEN= and save
```

The token stays in that one file on your machine. Treat it like a password.

**3. Register the server** in your client's MCP config (Claude Desktop: `claude_desktop_config.json`; Cursor: `.cursor/mcp.json`), replacing `YOUR-USERNAME`:

```json
{
  "mcpServers": {
    "planhat": {
      "command": "node",
      "args": ["/Users/YOUR-USERNAME/planhat-mcp/dist/server.js"]
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
├── manifest.json              ← .mcpb bundle definition (one-click install)
├── package.json               ← dependencies, scripts, version
├── package-lock.json          ← pinned dependency versions
├── tsconfig.json              ← TypeScript config
├── .env.example               ← token template for manual installs
├── .mcpbignore                ← what stays out of the bundle
├── src/
│   ├── index.ts               ← entry point: load config, serve over stdio
│   ├── server.ts              ← registers tools, applies gates + annotations
│   ├── tools.ts               ← all 60 tool definitions
│   ├── http.ts                ← Planhat REST client
│   └── env.ts                 ← .env loader for manual installs
├── tests/
│   ├── tools.test.ts          ← offline tests for all 60 tools
│   └── http.test.ts           ← HTTP layer: timeout, errors, delete cases
├── AGENTS.md                  ← handbook for AI coding agents
├── CLAUDE.md → AGENTS.md      ← same file, Claude's preferred name
├── LICENSE                    ← MIT
├── CHANGELOG.md               ← release history
├── SECURITY.md                ← token handling & reporting issues
├── CONTRIBUTING.md            ← how to add tools or fix bugs
└── .github/workflows/
    ├── ci.yml                 ← typecheck + tests + bundle gate on every push
    └── release.yml            ← GitHub release with .mcpb asset on version tags
```

The shipped bundle contains just four files: `manifest.json`, `dist/server.js` (one dependency-free build), `LICENSE` and `README.md`.

## Troubleshooting

| Symptom | Likely cause & fix |
|---|---|
| Double-clicking the .mcpb does nothing, or Install is greyed out | Update to a recent Claude Desktop; older builds predate one-click .mcpb extensions. You can also install from **Settings > Extensions > Advanced > Install Extension**. |
| Every Planhat tool appears twice | The bundle and an old manual config entry are both installed. Remove `mcpServers.planhat` from `claude_desktop_config.json`. |
| Claude says it has no Planhat tools | Claude Desktop only reads its config on launch. Quit it fully, reopen, and check the JSON has no trailing commas. |
| `HTTP 401 Unauthorized` in a tool result | The token is wrong, expired, or was rotated. Paste a fresh one. |
| `PLANHAT_TOKEN is not set` | Bundle installs: re-open the extension's settings and fill in the token. Manual installs: there is no `.env` beside the server, so repeat manual step 2. |
| `command not found: node` (manual install) | Install [Node.js](https://nodejs.org) 18 or newer, or point `command` at the full path to your `node` binary. |
| Tool works but returns `[]` | Usually not an error: that Planhat resource is genuinely empty for your filters. |

## For engineers

```bash
npm install          # install dependencies
npm test             # offline test suite (never touches the live API)
npm run typecheck    # TypeScript type checking
npm run build        # produce dist/server.js
npm start            # run the built server over stdio
```

Build the one-click bundle locally with `npm run build && npx -y @anthropic-ai/mcpb@2.1.2 pack . planhat.mcpb`.

Architecture notes, API quirks, and contribution rules live in [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Endpoint paths were verified against the live Planhat API in July 2026. Notably, Planhat has **no** `/notes` or `/activities` REST endpoints; notes and tickets are `/conversations` under the hood (see AGENTS.md for the full story).

## License

[MIT](LICENSE). Do what you like, no warranty.

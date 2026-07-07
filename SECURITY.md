# Security

## Token handling

- Your `PLANHAT_TOKEN` grants real read/write access to your Planhat tenant.
  With the one-click bundle install it is stored in your **operating system
  keychain** by Claude Desktop and injected into the server at launch — it
  never touches a file on disk. Manual installs keep it in a local `.env`
  file, which is gitignored and never leaves your machine. Either way the
  server sends it only to `https://api.planhat.com` over TLS.
- Prefer a **dedicated service-account token with the narrowest permissions**
  you need. A read-only token makes every mutating tool fail safely.
- Two server-side gates add defense in depth on top of token permissions:
  `PLANHAT_READ_ONLY=1` registers only list/get tools, and
  `PLANHAT_DISABLE_DELETE=1` removes the delete tools. Set either in `.env`.
  Ungated writes remain the default because full CRUD is this project's
  purpose — the gates exist for users who want a hard ceiling.
- All tools carry MCP `ToolAnnotations` (`readOnlyHint`/`destructiveHint`/
  `idempotentHint`) so permission-aware clients can prompt before destructive
  calls and auto-approve reads. These are hints — clients enforce their own
  approval policy; the gates and token permissions are the guarantees.
- If a token is ever exposed (committed, pasted into a chat, logged), rotate it
  in Planhat immediately — revoke the old token, don't just create a new one.

## Scope of this software

- Runs locally over stdio; opens no network ports and accepts no inbound
  connections.
- Talks to exactly one host: `api.planhat.com`.
- No telemetry, no analytics, no third-party services.

## Reporting a vulnerability

Open a [GitHub security advisory](https://github.com/da-troll/planhat-mcp/security/advisories/new)
or a private issue. Please do not disclose token-leak vectors publicly before a fix.

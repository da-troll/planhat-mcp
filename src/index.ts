// Entry point: load config, build the server, serve over stdio. This is the
// esbuild bundle entry; keeping it separate from server.ts means importing the
// server in tests triggers no stdio connection or process exit.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadDotenv } from "./env.js";
import { createHttp } from "./http.js";
import { buildServer } from "./server.js";
import { flagValue } from "./tools.js";

const BASE_URL = "https://api.planhat.com";
const REQUEST_TIMEOUT_MS = 30_000;

const here = dirname(fileURLToPath(import.meta.url));
// Manual installs keep .env beside the source or one level up from dist/; bundle
// installs pass config via the environment and have no .env at all.
loadDotenv([join(here, ".env"), join(here, "..", ".env"), join(process.cwd(), ".env")]);

const token = process.env.PLANHAT_TOKEN;
if (!token) {
  console.error("PLANHAT_TOKEN is not set. Add it to .env or your MCP client config.");
  process.exit(1);
}

const http = createHttp(token, BASE_URL, REQUEST_TIMEOUT_MS);
const { server } = buildServer({
  readOnly: flagValue(process.env.PLANHAT_READ_ONLY ?? ""),
  disableDelete: flagValue(process.env.PLANHAT_DISABLE_DELETE ?? ""),
  http,
});

await server.connect(new StdioServerTransport());

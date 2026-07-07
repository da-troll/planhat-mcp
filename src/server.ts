// Registers the tool specs onto an McpServer, honoring the read-only / no-delete
// gates and attaching the per-kind permission annotations. Kept side-effect free
// (no stdio, no env reads) so tests can build a server and inspect what registered.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Http } from "./http.js";
import { KIND_ANNOTATIONS, TOOL_SPECS, type ToolSpec } from "./tools.js";

export interface BuildOptions {
  readOnly: boolean;
  disableDelete: boolean;
  http: Http;
}

export function buildServer(opts: BuildOptions): { server: McpServer; registered: ToolSpec[] } {
  const server = new McpServer({ name: "planhat-local", version: "2.0.0" });
  const registered: ToolSpec[] = [];

  for (const spec of TOOL_SPECS) {
    if (opts.readOnly && spec.kind !== "read") continue;
    if (opts.disableDelete && spec.kind === "delete") continue;

    server.registerTool(
      spec.name,
      {
        description: spec.description,
        inputSchema: spec.inputSchema,
        annotations: KIND_ANNOTATIONS[spec.kind],
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await spec.handler(opts.http, args);
          return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { content: [{ type: "text" as const, text: message }], isError: true };
        }
      },
    );
    registered.push(spec);
  }

  return { server, registered };
}

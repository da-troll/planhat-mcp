// Minimal .env loader for the manual-install path (the one-click bundle injects
// env vars directly, so no file exists then and this is a silent no-op). Mirrors
// python-dotenv's default: existing environment variables are never overwritten.

import { readFileSync } from "node:fs";

export function loadDotenv(paths: string[]): void {
  for (const path of paths) {
    let text: string;
    try {
      text = readFileSync(path, "utf8");
    } catch {
      continue; // file absent here; try the next candidate
    }
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
    return; // first file found wins
  }
}

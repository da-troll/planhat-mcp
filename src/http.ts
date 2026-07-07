// Thin HTTP layer over the Planhat REST API. All calls carry a timeout and
// funnel error handling through one place, mirroring the Python _get/_post/etc.
// helpers. Tool handlers receive an Http instance and never call fetch directly,
// which keeps them trivially testable with an injected recorder.

export interface Http {
  get(path: string, params?: Record<string, unknown>): Promise<unknown>;
  post(path: string, body: Record<string, unknown>): Promise<unknown>;
  put(path: string, body: Record<string, unknown>): Promise<unknown>;
  del(path: string): Promise<unknown>;
}

export function createHttp(token: string, baseUrl: string, timeoutMs: number): Http {
  const authHeaders = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...authHeaders, "Content-Type": "application/json" };

  function buildUrl(path: string, params?: Record<string, unknown>): string {
    const url = new URL(baseUrl + path);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  async function parse(r: Response): Promise<unknown> {
    const text = (await r.text()).trim();
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} ${r.statusText}: ${text.slice(0, 500)}`);
    }
    if (!text) {
      throw new Error(`HTTP ${r.status} but empty response body`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`HTTP ${r.status} non-JSON response: ${text.slice(0, 500)}`);
    }
  }

  return {
    async get(path, params) {
      const r = await fetch(buildUrl(path, params), {
        headers: authHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return parse(r);
    },

    async post(path, body) {
      const r = await fetch(buildUrl(path), {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return parse(r);
    },

    async put(path, body) {
      const r = await fetch(buildUrl(path), {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      return parse(r);
    },

    async del(path) {
      const r = await fetch(buildUrl(path), {
        method: "DELETE",
        headers: authHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = (await r.text()).trim();
      if (!r.ok) {
        throw new Error(`HTTP ${r.status} ${r.statusText}: ${text.slice(0, 500)}`);
      }
      if (!text) {
        return { deleted: true };
      }
      try {
        return JSON.parse(text);
      } catch {
        return { deleted: true, raw: text.slice(0, 200) };
      }
    },
  };
}

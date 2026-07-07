// Tests the real HTTP layer with a mocked global fetch: timeout signal on every
// call, auth header, error parsing, and the delete-body special cases.

import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHttp } from "../src/http.js";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

interface Captured {
  url: string;
  opts: RequestInit;
}

function stubFetch(response: () => Response): { captured: Captured | undefined } {
  const ref: { captured: Captured | undefined } = { captured: undefined };
  globalThis.fetch = (async (url: string | URL | Request, opts: RequestInit = {}) => {
    ref.captured = { url: String(url), opts };
    return response();
  }) as typeof fetch;
  return ref;
}

test("get carries a timeout signal, auth header and query params", async () => {
  const ref = stubFetch(() => new Response(JSON.stringify({ a: 1 }), { status: 200 }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  const result = await http.get("/companies", { limit: 1, empty: "", skip: undefined });

  assert.deepEqual(result, { a: 1 });
  assert.ok(ref.captured);
  assert.ok(ref.captured.opts.signal instanceof AbortSignal, "expected an AbortSignal");
  assert.match(ref.captured.url, /[?&]limit=1(&|$)/);
  assert.doesNotMatch(ref.captured.url, /empty=/, "empty-string params are dropped");
  assert.doesNotMatch(ref.captured.url, /skip=/, "undefined params are dropped");
  const headers = ref.captured.opts.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer tok");
});

test("post sends a timeout signal and JSON body", async () => {
  const ref = stubFetch(() => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  await http.post("/companies", { name: "Acme" });
  assert.ok(ref.captured?.opts.signal instanceof AbortSignal);
  assert.equal(ref.captured?.opts.method, "POST");
  assert.equal(ref.captured?.opts.body, JSON.stringify({ name: "Acme" }));
});

test("non-ok response throws with status and body", async () => {
  stubFetch(() => new Response("bad token", { status: 401, statusText: "Unauthorized" }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  await assert.rejects(() => http.get("/companies"), /HTTP 401 Unauthorized: bad token/);
});

test("empty non-JSON success body throws", async () => {
  stubFetch(() => new Response("", { status: 200 }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  await assert.rejects(() => http.get("/companies"), /empty response body/);
});

test("delete with empty body returns {deleted:true}", async () => {
  stubFetch(() => new Response("", { status: 200 }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  assert.deepEqual(await http.del("/companies/X1"), { deleted: true });
});

test("delete with non-JSON body returns {deleted:true, raw}", async () => {
  stubFetch(() => new Response("OK", { status: 200 }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  assert.deepEqual(await http.del("/companies/X1"), { deleted: true, raw: "OK" });
});

test("delete non-ok throws", async () => {
  stubFetch(() => new Response("nope", { status: 404, statusText: "Not Found" }));
  const http = createHttp("tok", "https://api.planhat.com", 30_000);
  await assert.rejects(() => http.del("/companies/X1"), /HTTP 404 Not Found: nope/);
});

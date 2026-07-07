// Offline tests for every tool: correct HTTP method, path, key body fields, path
// encoding, gate registration and annotations. No network: handlers run against a
// recorder Http. Ported from the Python suite's CASES table.

import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { Http } from "../src/http.js";
import { buildServer } from "../src/server.js";
import { KIND_ANNOTATIONS, TOOL_SPECS, flagValue, pathId } from "../src/tools.js";

interface Call {
  method: string;
  path: string;
  params?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

class Recorder implements Http {
  calls: Call[] = [];
  async get(path: string, params?: Record<string, unknown>) {
    this.calls.push({ method: "GET", path, params });
    return { ok: true };
  }
  async post(path: string, body: Record<string, unknown>) {
    this.calls.push({ method: "POST", path, body });
    return { ok: true };
  }
  async put(path: string, body: Record<string, unknown>) {
    this.calls.push({ method: "PUT", path, body });
    return { ok: true };
  }
  async del(path: string) {
    this.calls.push({ method: "DELETE", path });
    return { ok: true };
  }
  get last(): Call {
    return this.calls[this.calls.length - 1];
  }
}

const byName = new Map(TOOL_SPECS.map((s) => [s.name, s]));

async function call(rec: Recorder, name: string, rawArgs: Record<string, unknown>): Promise<void> {
  const spec = byName.get(name);
  assert.ok(spec, `unknown tool ${name}`);
  const parsed = z.object(spec.inputSchema).parse(rawArgs);
  await spec.handler(rec, parsed);
}

// [name, args, method, path]
const CASES: Array<[string, Record<string, unknown>, string, string]> = [
  // Companies
  ["list_companies", {}, "GET", "/companies"],
  ["get_company", { company_id: "X1" }, "GET", "/companies/X1"],
  ["create_company", { name: "Acme" }, "POST", "/companies"],
  ["update_company", { company_id: "X1", name: "Acme" }, "PUT", "/companies/X1"],
  ["delete_company", { company_id: "X1" }, "DELETE", "/companies/X1"],
  // Contacts -> /endusers
  ["list_contacts", {}, "GET", "/endusers"],
  ["get_contact", { contact_id: "X1" }, "GET", "/endusers/X1"],
  ["create_contact", { first_name: "A", last_name: "B", email: "a@b.c", company_id: "X1" }, "POST", "/endusers"],
  ["update_contact", { contact_id: "X1", email: "a@b.c" }, "PUT", "/endusers/X1"],
  ["delete_contact", { contact_id: "X1" }, "DELETE", "/endusers/X1"],
  // Opportunities
  ["list_opportunities", {}, "GET", "/opportunities"],
  ["get_opportunity", { opportunity_id: "X1" }, "GET", "/opportunities/X1"],
  ["create_opportunity", { title: "Deal", company_id: "X1" }, "POST", "/opportunities"],
  ["update_opportunity", { opportunity_id: "X1", title: "Deal" }, "PUT", "/opportunities/X1"],
  ["delete_opportunity", { opportunity_id: "X1" }, "DELETE", "/opportunities/X1"],
  // Notes -> /conversations
  ["list_notes", {}, "GET", "/conversations"],
  ["get_note", { note_id: "X1" }, "GET", "/conversations/X1"],
  ["create_note", { text: "hi", company_id: "X1" }, "POST", "/conversations"],
  ["update_note", { note_id: "X1", text: "hi" }, "PUT", "/conversations/X1"],
  ["delete_note", { note_id: "X1" }, "DELETE", "/conversations/X1"],
  // Conversations
  ["list_conversations", {}, "GET", "/conversations"],
  ["get_conversation", { conversation_id: "X1" }, "GET", "/conversations/X1"],
  ["create_conversation", { company_id: "X1" }, "POST", "/conversations"],
  ["update_conversation", { conversation_id: "X1", subject: "s" }, "PUT", "/conversations/X1"],
  ["delete_conversation", { conversation_id: "X1" }, "DELETE", "/conversations/X1"],
  // Users
  ["list_users", {}, "GET", "/users"],
  ["get_user", { user_id: "X1" }, "GET", "/users/X1"],
  ["create_user", { first_name: "A", last_name: "B", email: "a@b.c" }, "POST", "/users"],
  ["update_user", { user_id: "X1", email: "a@b.c" }, "PUT", "/users/X1"],
  ["delete_user", { user_id: "X1" }, "DELETE", "/users/X1"],
  // Assets
  ["list_assets", {}, "GET", "/assets"],
  ["get_asset", { asset_id: "X1" }, "GET", "/assets/X1"],
  ["create_asset", { name: "A", company_id: "X1" }, "POST", "/assets"],
  ["update_asset", { asset_id: "X1", name: "A" }, "PUT", "/assets/X1"],
  ["delete_asset", { asset_id: "X1" }, "DELETE", "/assets/X1"],
  // Issues
  ["list_issues", {}, "GET", "/issues"],
  ["get_issue", { issue_id: "X1" }, "GET", "/issues/X1"],
  ["create_issue", { title: "Bug" }, "POST", "/issues"],
  ["update_issue", { issue_id: "X1", title: "Bug" }, "PUT", "/issues/X1"],
  ["delete_issue", { issue_id: "X1" }, "DELETE", "/issues/X1"],
  // Tickets: list/get/delete via /tickets; create/update via /conversations
  ["list_tickets", {}, "GET", "/tickets"],
  ["get_ticket", { ticket_id: "X1" }, "GET", "/tickets/X1"],
  ["create_ticket", { company_id: "X1" }, "POST", "/conversations"],
  ["update_ticket", { ticket_id: "X1", status: "open" }, "PUT", "/conversations/X1"],
  ["delete_ticket", { ticket_id: "X1" }, "DELETE", "/tickets/X1"],
  // Tasks
  ["list_tasks", {}, "GET", "/tasks"],
  ["get_task", { task_id: "X1" }, "GET", "/tasks/X1"],
  ["create_task", { company_id: "X1" }, "POST", "/tasks"],
  ["update_task", { task_id: "X1", action: "call" }, "PUT", "/tasks/X1"],
  ["delete_task", { task_id: "X1" }, "DELETE", "/tasks/X1"],
  // Licenses
  ["list_licenses", {}, "GET", "/licenses"],
  ["get_license", { license_id: "X1" }, "GET", "/licenses/X1"],
  ["create_license", { company_id: "X1", currency: "USD", value: 9 }, "POST", "/licenses"],
  ["update_license", { license_id: "X1", value: 9 }, "PUT", "/licenses/X1"],
  ["delete_license", { license_id: "X1" }, "DELETE", "/licenses/X1"],
  // Invoices
  ["list_invoices", {}, "GET", "/invoices"],
  ["get_invoice", { invoice_id: "X1" }, "GET", "/invoices/X1"],
  ["create_invoice", { company_id: "X1", currency: "USD", invoice_date: "2026-01-01" }, "POST", "/invoices"],
  ["update_invoice", { invoice_id: "X1" }, "PUT", "/invoices/X1"],
  ["delete_invoice", { invoice_id: "X1" }, "DELETE", "/invoices/X1"],
];

test("exactly the expected tools exist", () => {
  const specNames = TOOL_SPECS.map((s) => s.name).sort();
  const caseNames = CASES.map((c) => c[0]).sort();
  assert.deepEqual(specNames, caseNames);
  assert.equal(TOOL_SPECS.length, 60);
});

for (const [name, args, method, path] of CASES) {
  test(`${name} hits ${method} ${path}`, async () => {
    const rec = new Recorder();
    await call(rec, name, args);
    assert.equal(rec.last.method, method);
    assert.equal(rec.last.path, path);
  });
}

// ── API-quirk spot checks ──────────────────────────────────────────────────────

test("list_notes filters to type=note", async () => {
  const rec = new Recorder();
  await call(rec, "list_notes", {});
  assert.equal(rec.last.params?.type, "note");
});

test("create_note sets type, description and endusers", async () => {
  const rec = new Recorder();
  await call(rec, "create_note", { text: "hello", company_id: "C1", contact_id: "E1" });
  assert.equal(rec.last.body?.type, "note");
  assert.equal(rec.last.body?.description, "hello");
  assert.deepEqual(rec.last.body?.endusers, ["E1"]);
});

test("create_ticket sets type=ticket", async () => {
  const rec = new Recorder();
  await call(rec, "create_ticket", { company_id: "C1", subject: "Help" });
  assert.equal(rec.last.body?.type, "ticket");
  assert.equal(rec.last.body?.companyId, "C1");
});

test("create_invoice uses cId, not companyId", async () => {
  const rec = new Recorder();
  await call(rec, "create_invoice", { company_id: "C1", currency: "USD", invoice_date: "2026-01-01" });
  assert.equal(rec.last.body?.cId, "C1");
  assert.equal(rec.last.body?.companyId, undefined);
});

test("create_license uses underscore _currency", async () => {
  const rec = new Recorder();
  await call(rec, "create_license", { company_id: "C1", currency: "NOK", value: 100 });
  assert.equal(rec.last.body?._currency, "NOK");
  assert.equal(rec.last.body?.value, 100);
});

test("create_issue wraps company in companyIds array", async () => {
  const rec = new Recorder();
  await call(rec, "create_issue", { title: "Bug", company_id: "C1" });
  assert.deepEqual(rec.last.body?.companyIds, ["C1"]);
});

test("update sends only the fields provided", async () => {
  const rec = new Recorder();
  await call(rec, "update_company", { company_id: "C1", name: "New Name" });
  assert.deepEqual(rec.last.body, { name: "New Name" });
});

test("extra_fields pass through to the request body", async () => {
  const rec = new Recorder();
  await call(rec, "update_company", { company_id: "C1", extra_fields: { phase: "onboarding" } });
  assert.deepEqual(rec.last.body, { phase: "onboarding" });
});

// ── Path-parameter safety ───────────────────────────────────────────────────────

test("path ids are URL-encoded", async () => {
  const rec = new Recorder();
  await call(rec, "get_company", { company_id: "../users" });
  assert.equal(rec.last.path, "/companies/..%2Fusers");
});

test("path ids cannot smuggle query params", async () => {
  const rec = new Recorder();
  await call(rec, "get_company", { company_id: "x?limit=999" });
  assert.equal(rec.last.path, "/companies/x%3Flimit%3D999");
});

test("planhat-prefixed ids pass through unchanged", async () => {
  const rec = new Recorder();
  await call(rec, "get_asset", { asset_id: "extid-abc_123" });
  assert.equal(rec.last.path, "/assets/extid-abc_123");
});

for (const [name, key] of [
  ["get_company", "company_id"],
  ["update_task", "task_id"],
  ["delete_user", "user_id"],
] as const) {
  for (const bad of ["", "   "]) {
    test(`${name} rejects empty id ${JSON.stringify(bad)} before any request`, async () => {
      const rec = new Recorder();
      await assert.rejects(() => call(rec, name, { [key]: bad }));
      assert.equal(rec.calls.length, 0);
    });
  }
}

test("pathId rejects empty and encodes reserved characters", () => {
  assert.throws(() => pathId(""));
  assert.throws(() => pathId("   "));
  assert.equal(pathId("a/b"), "a%2Fb");
  assert.equal(pathId("extid-x_1"), "extid-x_1");
});

// ── Env-var gating (PLANHAT_READ_ONLY / PLANHAT_DISABLE_DELETE) ─────────────────

const dummyHttp: Http = {
  get: async () => ({}),
  post: async () => ({}),
  put: async () => ({}),
  del: async () => ({}),
};

test("read-only mode registers only the 24 read tools", () => {
  const { registered } = buildServer({ readOnly: true, disableDelete: false, http: dummyHttp });
  assert.equal(registered.length, 24);
  assert.ok(registered.every((s) => s.kind === "read"));
});

test("disable-delete mode registers everything but the 12 deletes", () => {
  const { registered } = buildServer({ readOnly: false, disableDelete: true, http: dummyHttp });
  assert.equal(registered.length, 48);
  assert.ok(registered.every((s) => s.kind !== "delete"));
});

test("default mode registers all 60 tools", () => {
  const { registered } = buildServer({ readOnly: false, disableDelete: false, http: dummyHttp });
  assert.equal(registered.length, 60);
});

// ── Annotations match tool verbs ─────────────────────────────────────────────────

test("annotations match each tool's kind", () => {
  for (const spec of TOOL_SPECS) {
    const ann = KIND_ANNOTATIONS[spec.kind];
    if (spec.name.startsWith("list_") || spec.name.startsWith("get_")) {
      assert.equal(spec.kind, "read", spec.name);
      assert.equal(ann.readOnlyHint, true, spec.name);
    } else if (spec.name.startsWith("create_")) {
      assert.equal(spec.kind, "create", spec.name);
      assert.equal(ann.readOnlyHint, false, spec.name);
      assert.equal(ann.destructiveHint, false, spec.name);
    } else if (spec.name.startsWith("update_") || spec.name.startsWith("delete_")) {
      assert.ok(spec.kind === "update" || spec.kind === "delete", spec.name);
      assert.equal(ann.readOnlyHint, false, spec.name);
      assert.equal(ann.destructiveHint, true, spec.name);
    } else {
      assert.fail(`unclassified tool: ${spec.name}`);
    }
  }
});

test("flagValue reads truthy and falsy strings", () => {
  for (const on of ["1", "true", "TRUE", "yes", " Yes "]) assert.equal(flagValue(on), true, on);
  for (const off of ["", "0", "false", "no", "  "]) assert.equal(flagValue(off), false, off);
});

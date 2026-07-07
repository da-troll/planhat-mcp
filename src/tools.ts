// The 60 Planhat tools: 12 resource families x list/get/create/update/delete.
// Each spec is transport-agnostic: it declares a name, a permission "kind" (which
// drives both the env-var gates and the client-facing MCP annotations), a Zod
// input schema, and a handler that talks to an injected Http client. server.ts
// registers them; tests drive the handlers directly with a recorder.

import { z, type ZodRawShape } from "zod";
import type { Http } from "./http.js";

export type Kind = "read" | "create" | "update" | "delete";

export interface ToolSpec {
  name: string;
  kind: Kind;
  description: string;
  inputSchema: ZodRawShape;
  handler: (http: Http, args: Record<string, any>) => Promise<unknown>;
}

// Spec hints that let MCP clients calibrate their permission UX per tool: reads
// can be auto-approved, deletes deserve a confirmation prompt. Enforcement is the
// client's job; these are the server's half of that contract.
export const KIND_ANNOTATIONS: Record<
  Kind,
  { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean }
> = {
  read: { readOnlyHint: true },
  create: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  update: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  delete: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
};

export function flagValue(raw: string): boolean {
  return ["1", "true", "yes"].includes(raw.trim().toLowerCase());
}

export function pathId(value: string): string {
  if (!value || !value.trim()) {
    throw new Error("ID must be a non-empty string");
  }
  return encodeURIComponent(value);
}

// Shared schema fragments. Zod schemas are immutable, so sharing references is safe.
const limit = z.number().int().optional().default(50);
const offset = z.number().int().optional().default(0);
const extra = () => z.record(z.string(), z.unknown()).optional();

// Merge the optional free-form `extra_fields` object into a request body. This is
// the explicit, schema-visible replacement for Python's `**kwargs` pass-through.
function withExtra(body: Record<string, unknown>, a: Record<string, any>): Record<string, unknown> {
  if (a.extra_fields) {
    Object.assign(body, a.extra_fields);
  }
  return body;
}

export const TOOL_SPECS: ToolSpec[] = [
  // ── Companies ──────────────────────────────────────────────────────────────
  {
    name: "list_companies",
    kind: "read",
    description: "List or search Planhat companies.",
    inputSchema: { limit, offset, search: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.search) params.name = a.search;
      return http.get("/companies", params);
    },
  },
  {
    name: "get_company",
    kind: "read",
    description: "Get a Planhat company by ID.",
    inputSchema: { company_id: z.string() },
    handler: async (http, a) => http.get(`/companies/${pathId(a.company_id)}`),
  },
  {
    name: "create_company",
    kind: "create",
    description: "Create a new company in Planhat.",
    inputSchema: {
      name: z.string(),
      external_id: z.string().optional(),
      owner_id: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { name: a.name };
      if (a.external_id) body.externalId = a.external_id;
      if (a.owner_id) body.ownerId = a.owner_id;
      return http.post("/companies", withExtra(body, a));
    },
  },
  {
    name: "update_company",
    kind: "update",
    description: "Update fields on an existing Planhat company. Pass any other Planhat company field via extra_fields.",
    inputSchema: {
      company_id: z.string(),
      name: z.string().optional(),
      external_id: z.string().optional(),
      owner_id: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.name) body.name = a.name;
      if (a.external_id) body.externalId = a.external_id;
      if (a.owner_id) body.ownerId = a.owner_id;
      return http.put(`/companies/${pathId(a.company_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_company",
    kind: "delete",
    description: "Delete a Planhat company.",
    inputSchema: { company_id: z.string() },
    handler: async (http, a) => http.del(`/companies/${pathId(a.company_id)}`),
  },

  // ── Contacts (end users) ─────────────────────────────────────────────────────
  {
    name: "list_contacts",
    kind: "read",
    description: "List Planhat contacts, optionally filtered by company.",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/endusers", params);
    },
  },
  {
    name: "get_contact",
    kind: "read",
    description: "Get a Planhat contact (end-user) by ID.",
    inputSchema: { contact_id: z.string() },
    handler: async (http, a) => http.get(`/endusers/${pathId(a.contact_id)}`),
  },
  {
    name: "create_contact",
    kind: "create",
    description: "Create a new contact (end-user) in Planhat.",
    inputSchema: {
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      company_id: z.string(),
      external_id: z.string().optional(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {
        firstName: a.first_name,
        lastName: a.last_name,
        email: a.email,
        companyId: a.company_id,
      };
      if (a.external_id) body.externalId = a.external_id;
      return http.post("/endusers", body);
    },
  },
  {
    name: "update_contact",
    kind: "update",
    description: "Update fields on an existing Planhat contact (end-user).",
    inputSchema: {
      contact_id: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.first_name) body.firstName = a.first_name;
      if (a.last_name) body.lastName = a.last_name;
      if (a.email) body.email = a.email;
      return http.put(`/endusers/${pathId(a.contact_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_contact",
    kind: "delete",
    description: "Delete a Planhat contact (end-user).",
    inputSchema: { contact_id: z.string() },
    handler: async (http, a) => http.del(`/endusers/${pathId(a.contact_id)}`),
  },

  // ── Opportunities ────────────────────────────────────────────────────────────
  {
    name: "list_opportunities",
    kind: "read",
    description: "List Planhat opportunities.",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/opportunities", params);
    },
  },
  {
    name: "get_opportunity",
    kind: "read",
    description: "Get a Planhat opportunity by ID.",
    inputSchema: { opportunity_id: z.string() },
    handler: async (http, a) => http.get(`/opportunities/${pathId(a.opportunity_id)}`),
  },
  {
    name: "create_opportunity",
    kind: "create",
    description: "Create a new opportunity in Planhat.",
    inputSchema: {
      title: z.string(),
      company_id: z.string(),
      value: z.number().optional().default(0),
      status: z.string().optional(),
      close_date: z.string().optional(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { title: a.title, companyId: a.company_id, value: a.value };
      if (a.status) body.status = a.status;
      if (a.close_date) body.closeDate = a.close_date;
      return http.post("/opportunities", body);
    },
  },
  {
    name: "update_opportunity",
    kind: "update",
    description: "Update fields on an existing Planhat opportunity.",
    inputSchema: {
      opportunity_id: z.string(),
      title: z.string().optional(),
      status: z.string().optional(),
      close_date: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.title) body.title = a.title;
      if (a.status) body.status = a.status;
      if (a.close_date) body.closeDate = a.close_date;
      return http.put(`/opportunities/${pathId(a.opportunity_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_opportunity",
    kind: "delete",
    description: "Delete a Planhat opportunity.",
    inputSchema: { opportunity_id: z.string() },
    handler: async (http, a) => http.del(`/opportunities/${pathId(a.opportunity_id)}`),
  },

  // ── Notes (Conversations of type "note"; Planhat has no /notes endpoint) ──────
  {
    name: "list_notes",
    kind: "read",
    description: "List Planhat notes.",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset, type: "note" };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/conversations", params);
    },
  },
  {
    name: "get_note",
    kind: "read",
    description: "Get a Planhat note by ID.",
    inputSchema: { note_id: z.string() },
    handler: async (http, a) => http.get(`/conversations/${pathId(a.note_id)}`),
  },
  {
    name: "create_note",
    kind: "create",
    description: "Create a new note in Planhat.",
    inputSchema: {
      text: z.string(),
      company_id: z.string(),
      contact_id: z.string().optional(),
      owner_id: z.string().optional(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { companyId: a.company_id, type: "note", description: a.text };
      if (a.contact_id) body.endusers = [a.contact_id];
      if (a.owner_id) body.ownerId = a.owner_id;
      return http.post("/conversations", body);
    },
  },
  {
    name: "update_note",
    kind: "update",
    description: "Update fields on an existing Planhat note.",
    inputSchema: { note_id: z.string(), text: z.string().optional(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.text) body.description = a.text;
      return http.put(`/conversations/${pathId(a.note_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_note",
    kind: "delete",
    description: "Delete a Planhat note.",
    inputSchema: { note_id: z.string() },
    handler: async (http, a) => http.del(`/conversations/${pathId(a.note_id)}`),
  },

  // ── Conversations (all types: email, chat, call, note, ticket, etc.) ──────────
  {
    name: "list_conversations",
    kind: "read",
    description: "List Planhat conversations of any type, optionally filtered by type (e.g. 'email', 'note', 'ticket').",
    inputSchema: { limit, offset, company_id: z.string().optional(), type: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      if (a.type) params.type = a.type;
      return http.get("/conversations", params);
    },
  },
  {
    name: "get_conversation",
    kind: "read",
    description: "Get a Planhat conversation by ID.",
    inputSchema: { conversation_id: z.string() },
    handler: async (http, a) => http.get(`/conversations/${pathId(a.conversation_id)}`),
  },
  {
    name: "create_conversation",
    kind: "create",
    description: "Create a new conversation in Planhat.",
    inputSchema: {
      company_id: z.string(),
      type: z.string().optional(),
      subject: z.string().optional(),
      description: z.string().optional(),
      owner_id: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { companyId: a.company_id };
      if (a.type) body.type = a.type;
      if (a.subject) body.subject = a.subject;
      if (a.description) body.description = a.description;
      if (a.owner_id) body.ownerId = a.owner_id;
      return http.post("/conversations", withExtra(body, a));
    },
  },
  {
    name: "update_conversation",
    kind: "update",
    description: "Update fields on an existing Planhat conversation.",
    inputSchema: {
      conversation_id: z.string(),
      subject: z.string().optional(),
      description: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.subject) body.subject = a.subject;
      if (a.description) body.description = a.description;
      return http.put(`/conversations/${pathId(a.conversation_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_conversation",
    kind: "delete",
    description: "Delete a Planhat conversation.",
    inputSchema: { conversation_id: z.string() },
    handler: async (http, a) => http.del(`/conversations/${pathId(a.conversation_id)}`),
  },

  // ── Users (team members) ──────────────────────────────────────────────────────
  {
    name: "list_users",
    kind: "read",
    description: "List Planhat users (team members).",
    inputSchema: { limit, offset },
    handler: async (http, a) => http.get("/users", { limit: a.limit, offset: a.offset }),
  },
  {
    name: "get_user",
    kind: "read",
    description: "Get a Planhat user by ID.",
    inputSchema: { user_id: z.string() },
    handler: async (http, a) => http.get(`/users/${pathId(a.user_id)}`),
  },
  {
    name: "create_user",
    kind: "create",
    description: "Create a new user (team member) in Planhat.",
    inputSchema: {
      first_name: z.string(),
      last_name: z.string(),
      email: z.string(),
      role: z.string().optional(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { firstName: a.first_name, lastName: a.last_name, email: a.email };
      if (a.role) body.role = a.role;
      return http.post("/users", body);
    },
  },
  {
    name: "update_user",
    kind: "update",
    description: "Update fields on an existing Planhat user (team member).",
    inputSchema: {
      user_id: z.string(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      email: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.first_name) body.firstName = a.first_name;
      if (a.last_name) body.lastName = a.last_name;
      if (a.email) body.email = a.email;
      return http.put(`/users/${pathId(a.user_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_user",
    kind: "delete",
    description: "Delete a Planhat user (team member).",
    inputSchema: { user_id: z.string() },
    handler: async (http, a) => http.del(`/users/${pathId(a.user_id)}`),
  },

  // ── Assets ────────────────────────────────────────────────────────────────────
  {
    name: "list_assets",
    kind: "read",
    description: "List Planhat assets.",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/assets", params);
    },
  },
  {
    name: "get_asset",
    kind: "read",
    description: "Get a Planhat asset by ID.",
    inputSchema: { asset_id: z.string() },
    handler: async (http, a) => http.get(`/assets/${pathId(a.asset_id)}`),
  },
  {
    name: "create_asset",
    kind: "create",
    description: "Create a new asset in Planhat.",
    inputSchema: {
      name: z.string(),
      company_id: z.string(),
      external_id: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { name: a.name, companyId: a.company_id };
      if (a.external_id) body.externalId = a.external_id;
      return http.post("/assets", withExtra(body, a));
    },
  },
  {
    name: "update_asset",
    kind: "update",
    description: "Update fields on an existing Planhat asset.",
    inputSchema: { asset_id: z.string(), name: z.string().optional(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.name) body.name = a.name;
      return http.put(`/assets/${pathId(a.asset_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_asset",
    kind: "delete",
    description: "Delete a Planhat asset.",
    inputSchema: { asset_id: z.string() },
    handler: async (http, a) => http.del(`/assets/${pathId(a.asset_id)}`),
  },

  // ── Issues (bugs / feature requests) ──────────────────────────────────────────
  {
    name: "list_issues",
    kind: "read",
    description: "List Planhat issues (bugs / feature requests).",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/issues", params);
    },
  },
  {
    name: "get_issue",
    kind: "read",
    description: "Get a Planhat issue by ID.",
    inputSchema: { issue_id: z.string() },
    handler: async (http, a) => http.get(`/issues/${pathId(a.issue_id)}`),
  },
  {
    name: "create_issue",
    kind: "create",
    description: "Create a new issue in Planhat.",
    inputSchema: { title: z.string(), company_id: z.string().optional(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { title: a.title };
      if (a.company_id) body.companyIds = [a.company_id];
      return http.post("/issues", withExtra(body, a));
    },
  },
  {
    name: "update_issue",
    kind: "update",
    description: "Update fields on an existing Planhat issue.",
    inputSchema: { issue_id: z.string(), title: z.string().optional(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.title) body.title = a.title;
      return http.put(`/issues/${pathId(a.issue_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_issue",
    kind: "delete",
    description: "Delete a Planhat issue.",
    inputSchema: { issue_id: z.string() },
    handler: async (http, a) => http.del(`/issues/${pathId(a.issue_id)}`),
  },

  // ── Tickets (Conversations of type "ticket"; create/update route to /conversations) ──
  {
    name: "list_tickets",
    kind: "read",
    description: "List Planhat tickets, optionally filtered by company, status, or a search term.",
    inputSchema: {
      limit,
      offset,
      company_id: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      if (a.status) params.status = a.status;
      if (a.search) params.search = a.search;
      return http.get("/tickets", params);
    },
  },
  {
    name: "get_ticket",
    kind: "read",
    description: "Get a Planhat ticket by ID.",
    inputSchema: { ticket_id: z.string() },
    handler: async (http, a) => http.get(`/tickets/${pathId(a.ticket_id)}`),
  },
  {
    name: "create_ticket",
    kind: "create",
    description: "Create a new ticket in Planhat.",
    inputSchema: {
      company_id: z.string(),
      subject: z.string().optional(),
      description: z.string().optional(),
      owner_id: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { companyId: a.company_id, type: "ticket" };
      if (a.subject) body.subject = a.subject;
      if (a.description) body.description = a.description;
      if (a.owner_id) body.ownerId = a.owner_id;
      return http.post("/conversations", withExtra(body, a));
    },
  },
  {
    name: "update_ticket",
    kind: "update",
    description: "Update fields on an existing Planhat ticket.",
    inputSchema: {
      ticket_id: z.string(),
      status: z.string().optional(),
      subject: z.string().optional(),
      description: z.string().optional(),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.status) body.status = a.status;
      if (a.subject) body.subject = a.subject;
      if (a.description) body.description = a.description;
      return http.put(`/conversations/${pathId(a.ticket_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_ticket",
    kind: "delete",
    description: "Delete a Planhat ticket.",
    inputSchema: { ticket_id: z.string() },
    handler: async (http, a) => http.del(`/tickets/${pathId(a.ticket_id)}`),
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  {
    name: "list_tasks",
    kind: "read",
    description: "List Planhat tasks.",
    inputSchema: { limit, offset, company_id: z.string().optional(), is_archived: z.boolean().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      if (a.is_archived !== undefined) params.isArchived = a.is_archived;
      return http.get("/tasks", params);
    },
  },
  {
    name: "get_task",
    kind: "read",
    description: "Get a Planhat task by ID.",
    inputSchema: { task_id: z.string() },
    handler: async (http, a) => http.get(`/tasks/${pathId(a.task_id)}`),
  },
  {
    name: "create_task",
    kind: "create",
    description: "Create a new task in Planhat.",
    inputSchema: {
      company_id: z.string(),
      action: z.string().optional(),
      description: z.string().optional(),
      owner_id: z.string().optional(),
      main_type: z.string().optional().default("task"),
      extra_fields: extra(),
    },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { companyId: a.company_id, mainType: a.main_type };
      if (a.action) body.action = a.action;
      if (a.description) body.description = a.description;
      if (a.owner_id) body.ownerId = a.owner_id;
      return http.post("/tasks", withExtra(body, a));
    },
  },
  {
    name: "update_task",
    kind: "update",
    description: "Update fields on an existing Planhat task.",
    inputSchema: { task_id: z.string(), action: z.string().optional(), status: z.string().optional(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.action) body.action = a.action;
      if (a.status) body.status = a.status;
      return http.put(`/tasks/${pathId(a.task_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_task",
    kind: "delete",
    description: "Delete a Planhat task.",
    inputSchema: { task_id: z.string() },
    handler: async (http, a) => http.del(`/tasks/${pathId(a.task_id)}`),
  },

  // ── Licenses (recurring revenue records) ──────────────────────────────────────
  {
    name: "list_licenses",
    kind: "read",
    description: "List Planhat licenses (recurring revenue records).",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/licenses", params);
    },
  },
  {
    name: "get_license",
    kind: "read",
    description: "Get a Planhat license by ID.",
    inputSchema: { license_id: z.string() },
    handler: async (http, a) => http.get(`/licenses/${pathId(a.license_id)}`),
  },
  {
    name: "create_license",
    kind: "create",
    description: "Create a new license in Planhat.",
    inputSchema: { company_id: z.string(), currency: z.string(), value: z.number(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { companyId: a.company_id, _currency: a.currency, value: a.value };
      return http.post("/licenses", withExtra(body, a));
    },
  },
  {
    name: "update_license",
    kind: "update",
    description: "Update fields on an existing Planhat license.",
    inputSchema: { license_id: z.string(), value: z.number().optional(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = {};
      if (a.value !== undefined) body.value = a.value;
      return http.put(`/licenses/${pathId(a.license_id)}`, withExtra(body, a));
    },
  },
  {
    name: "delete_license",
    kind: "delete",
    description: "Delete a Planhat license.",
    inputSchema: { license_id: z.string() },
    handler: async (http, a) => http.del(`/licenses/${pathId(a.license_id)}`),
  },

  // ── Invoices ──────────────────────────────────────────────────────────────────
  {
    name: "list_invoices",
    kind: "read",
    description: "List Planhat invoices.",
    inputSchema: { limit, offset, company_id: z.string().optional() },
    handler: async (http, a) => {
      const params: Record<string, unknown> = { limit: a.limit, offset: a.offset };
      if (a.company_id) params.companyId = a.company_id;
      return http.get("/invoices", params);
    },
  },
  {
    name: "get_invoice",
    kind: "read",
    description: "Get a Planhat invoice by ID.",
    inputSchema: { invoice_id: z.string() },
    handler: async (http, a) => http.get(`/invoices/${pathId(a.invoice_id)}`),
  },
  {
    name: "create_invoice",
    kind: "create",
    description: "Create a new invoice in Planhat.",
    inputSchema: { company_id: z.string(), currency: z.string(), invoice_date: z.string(), extra_fields: extra() },
    handler: async (http, a) => {
      const body: Record<string, unknown> = { cId: a.company_id, currency: a.currency, invoiceDate: a.invoice_date };
      return http.post("/invoices", withExtra(body, a));
    },
  },
  {
    name: "update_invoice",
    kind: "update",
    description: "Update fields on an existing Planhat invoice.",
    inputSchema: { invoice_id: z.string(), extra_fields: extra() },
    handler: async (http, a) => http.put(`/invoices/${pathId(a.invoice_id)}`, { ...(a.extra_fields ?? {}) }),
  },
  {
    name: "delete_invoice",
    kind: "delete",
    description: "Delete a Planhat invoice.",
    inputSchema: { invoice_id: z.string() },
    handler: async (http, a) => http.del(`/invoices/${pathId(a.invoice_id)}`),
  },
];

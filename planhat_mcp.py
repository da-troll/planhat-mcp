import os
import urllib.parse
from pathlib import Path
from dotenv import load_dotenv
import requests
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

PLANHAT_TOKEN = os.environ["PLANHAT_TOKEN"]
BASE_URL = "https://api.planhat.com"
REQUEST_TIMEOUT = (3.05, 30)  # seconds (connect, read)


def _flag_value(raw: str) -> bool:
    return raw.strip().lower() in ("1", "true", "yes")


def _flag(name: str) -> bool:
    return _flag_value(os.environ.get(name, ""))


READ_ONLY = _flag("PLANHAT_READ_ONLY")
DISABLE_DELETE = _flag("PLANHAT_DISABLE_DELETE")

mcp = FastMCP("planhat-local")


# Spec hints that let MCP clients calibrate their permission UX per tool:
# reads can be auto-approved, deletes deserve a confirmation prompt. Enforcement
# is the client's job — these are the server's half of that contract.
_KIND_ANNOTATIONS = {
    "read": ToolAnnotations(readOnlyHint=True),
    "create": ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False),
    "update": ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=True),
    "delete": ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=True),
}


def _tool(kind: str = "read"):
    """Register an MCP tool, honoring the PLANHAT_READ_ONLY / PLANHAT_DISABLE_DELETE gates."""

    def decorate(fn):
        if READ_ONLY and kind != "read":
            return fn
        if DISABLE_DELETE and kind == "delete":
            return fn
        return mcp.tool(annotations=_KIND_ANNOTATIONS[kind])(fn)

    return decorate


def _headers() -> dict:
    return {"Authorization": f"Bearer {PLANHAT_TOKEN}"}


def _path_id(value: str) -> str:
    """Encode a path parameter, rejecting empty IDs so a blank never falls through to a list route."""
    if not value or not value.strip():
        raise ValueError("ID must be a non-empty string")
    return urllib.parse.quote(value, safe="")


def _parse(r: requests.Response) -> dict:
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code} {r.reason}: {r.text[:500]}")
    text = r.text.strip()
    if not text:
        raise RuntimeError(f"HTTP {r.status_code} but empty response body")
    try:
        return r.json()
    except Exception:
        raise RuntimeError(f"HTTP {r.status_code} non-JSON response: {text[:500]}")


def _get(path: str, params: dict | None = None) -> dict:
    r = requests.get(f"{BASE_URL}{path}", headers=_headers(), params=params or {}, timeout=REQUEST_TIMEOUT)
    return _parse(r)


def _post(path: str, body: dict) -> dict:
    r = requests.post(f"{BASE_URL}{path}", headers=_headers(), json=body, timeout=REQUEST_TIMEOUT)
    return _parse(r)


def _put(path: str, body: dict) -> dict:
    r = requests.put(f"{BASE_URL}{path}", headers=_headers(), json=body, timeout=REQUEST_TIMEOUT)
    return _parse(r)


def _delete(path: str) -> dict:
    r = requests.delete(f"{BASE_URL}{path}", headers=_headers(), timeout=REQUEST_TIMEOUT)
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code} {r.reason}: {r.text[:500]}")
    text = r.text.strip()
    if not text:
        return {"deleted": True}
    try:
        return r.json()
    except Exception:
        return {"deleted": True, "raw": text[:200]}


# ── Companies ────────────────────────────────────────────────────────────────

@_tool()
def list_companies(limit: int = 50, offset: int = 0, search: str = "") -> dict:
    """List or search Planhat companies."""
    params = {"limit": limit, "offset": offset}
    if search:
        params["name"] = search
    return _get("/companies", params)


@_tool()
def get_company(company_id: str) -> dict:
    """Get a Planhat company by ID."""
    return _get(f"/companies/{_path_id(company_id)}")


@_tool("create")
def create_company(name: str, external_id: str = "", owner_id: str = "", **kwargs) -> dict:
    """Create a new company in Planhat."""
    body: dict = {"name": name}
    if external_id:
        body["externalId"] = external_id
    if owner_id:
        body["ownerId"] = owner_id
    body.update(kwargs)
    return _post("/companies", body)


@_tool("update")
def update_company(company_id: str, name: str = "", external_id: str = "", owner_id: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat company. Pass any other Planhat company field as a keyword argument."""
    body: dict = {}
    if name:
        body["name"] = name
    if external_id:
        body["externalId"] = external_id
    if owner_id:
        body["ownerId"] = owner_id
    body.update(kwargs)
    return _put(f"/companies/{_path_id(company_id)}", body)


@_tool("delete")
def delete_company(company_id: str) -> dict:
    """Delete a Planhat company."""
    return _delete(f"/companies/{_path_id(company_id)}")


# ── Contacts ─────────────────────────────────────────────────────────────────

@_tool()
def list_contacts(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat contacts, optionally filtered by company."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    return _get("/endusers", params)


@_tool()
def get_contact(contact_id: str) -> dict:
    """Get a Planhat contact (end-user) by ID."""
    return _get(f"/endusers/{_path_id(contact_id)}")


@_tool("create")
def create_contact(
    first_name: str,
    last_name: str,
    email: str,
    company_id: str,
    external_id: str = "",
) -> dict:
    """Create a new contact (end-user) in Planhat."""
    body: dict = {
        "firstName": first_name,
        "lastName": last_name,
        "email": email,
        "companyId": company_id,
    }
    if external_id:
        body["externalId"] = external_id
    return _post("/endusers", body)


@_tool("update")
def update_contact(
    contact_id: str,
    first_name: str = "",
    last_name: str = "",
    email: str = "",
    **kwargs,
) -> dict:
    """Update fields on an existing Planhat contact (end-user)."""
    body: dict = {}
    if first_name:
        body["firstName"] = first_name
    if last_name:
        body["lastName"] = last_name
    if email:
        body["email"] = email
    body.update(kwargs)
    return _put(f"/endusers/{_path_id(contact_id)}", body)


@_tool("delete")
def delete_contact(contact_id: str) -> dict:
    """Delete a Planhat contact (end-user)."""
    return _delete(f"/endusers/{_path_id(contact_id)}")


# ── Opportunities ─────────────────────────────────────────────────────────────

@_tool()
def list_opportunities(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat opportunities."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    return _get("/opportunities", params)


@_tool()
def get_opportunity(opportunity_id: str) -> dict:
    """Get a Planhat opportunity by ID."""
    return _get(f"/opportunities/{_path_id(opportunity_id)}")


@_tool("create")
def create_opportunity(
    title: str,
    company_id: str,
    value: float = 0.0,
    status: str = "",
    close_date: str = "",
) -> dict:
    """Create a new opportunity in Planhat."""
    body: dict = {"title": title, "companyId": company_id, "value": value}
    if status:
        body["status"] = status
    if close_date:
        body["closeDate"] = close_date
    return _post("/opportunities", body)


@_tool("update")
def update_opportunity(
    opportunity_id: str,
    title: str = "",
    status: str = "",
    close_date: str = "",
    **kwargs,
) -> dict:
    """Update fields on an existing Planhat opportunity."""
    body: dict = {}
    if title:
        body["title"] = title
    if status:
        body["status"] = status
    if close_date:
        body["closeDate"] = close_date
    body.update(kwargs)
    return _put(f"/opportunities/{_path_id(opportunity_id)}", body)


@_tool("delete")
def delete_opportunity(opportunity_id: str) -> dict:
    """Delete a Planhat opportunity."""
    return _delete(f"/opportunities/{_path_id(opportunity_id)}")


# ── Notes (Conversations of type "note") ───────────────────────────────────────
# Planhat has no standalone /notes endpoint - notes are Conversations filtered
# by type. These tools keep the familiar "note" naming while calling the real
# underlying resource.

@_tool()
def list_notes(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat notes."""
    params: dict = {"limit": limit, "offset": offset, "type": "note"}
    if company_id:
        params["companyId"] = company_id
    return _get("/conversations", params)


@_tool()
def get_note(note_id: str) -> dict:
    """Get a Planhat note by ID."""
    return _get(f"/conversations/{_path_id(note_id)}")


@_tool("create")
def create_note(
    text: str,
    company_id: str,
    contact_id: str = "",
    owner_id: str = "",
) -> dict:
    """Create a new note in Planhat."""
    body: dict = {"companyId": company_id, "type": "note", "description": text}
    if contact_id:
        body["endusers"] = [contact_id]
    if owner_id:
        body["ownerId"] = owner_id
    return _post("/conversations", body)


@_tool("update")
def update_note(note_id: str, text: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat note."""
    body: dict = {}
    if text:
        body["description"] = text
    body.update(kwargs)
    return _put(f"/conversations/{_path_id(note_id)}", body)


@_tool("delete")
def delete_note(note_id: str) -> dict:
    """Delete a Planhat note."""
    return _delete(f"/conversations/{_path_id(note_id)}")


# ── Conversations (all types: email, chat, call, note, ticket, etc.) ───────────

@_tool()
def list_conversations(limit: int = 50, offset: int = 0, company_id: str = "", type: str = "") -> dict:
    """List Planhat conversations of any type, optionally filtered by type (e.g. 'email', 'note', 'ticket')."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    if type:
        params["type"] = type
    return _get("/conversations", params)


@_tool()
def get_conversation(conversation_id: str) -> dict:
    """Get a Planhat conversation by ID."""
    return _get(f"/conversations/{_path_id(conversation_id)}")


@_tool("create")
def create_conversation(
    company_id: str,
    type: str = "",
    subject: str = "",
    description: str = "",
    owner_id: str = "",
    **kwargs,
) -> dict:
    """Create a new conversation in Planhat."""
    body: dict = {"companyId": company_id}
    if type:
        body["type"] = type
    if subject:
        body["subject"] = subject
    if description:
        body["description"] = description
    if owner_id:
        body["ownerId"] = owner_id
    body.update(kwargs)
    return _post("/conversations", body)


@_tool("update")
def update_conversation(conversation_id: str, subject: str = "", description: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat conversation."""
    body: dict = {}
    if subject:
        body["subject"] = subject
    if description:
        body["description"] = description
    body.update(kwargs)
    return _put(f"/conversations/{_path_id(conversation_id)}", body)


@_tool("delete")
def delete_conversation(conversation_id: str) -> dict:
    """Delete a Planhat conversation."""
    return _delete(f"/conversations/{_path_id(conversation_id)}")


# ── Users ─────────────────────────────────────────────────────────────────────

@_tool()
def list_users(limit: int = 50, offset: int = 0) -> dict:
    """List Planhat users (team members)."""
    return _get("/users", {"limit": limit, "offset": offset})


@_tool()
def get_user(user_id: str) -> dict:
    """Get a Planhat user by ID."""
    return _get(f"/users/{_path_id(user_id)}")


@_tool("create")
def create_user(
    first_name: str,
    last_name: str,
    email: str,
    role: str = "",
) -> dict:
    """Create a new user (team member) in Planhat."""
    body: dict = {"firstName": first_name, "lastName": last_name, "email": email}
    if role:
        body["role"] = role
    return _post("/users", body)


@_tool("update")
def update_user(user_id: str, first_name: str = "", last_name: str = "", email: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat user (team member)."""
    body: dict = {}
    if first_name:
        body["firstName"] = first_name
    if last_name:
        body["lastName"] = last_name
    if email:
        body["email"] = email
    body.update(kwargs)
    return _put(f"/users/{_path_id(user_id)}", body)


@_tool("delete")
def delete_user(user_id: str) -> dict:
    """Delete a Planhat user (team member)."""
    return _delete(f"/users/{_path_id(user_id)}")


# ── Assets ───────────────────────────────────────────────────────────────────

@_tool()
def list_assets(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat assets."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    return _get("/assets", params)


@_tool()
def get_asset(asset_id: str) -> dict:
    """Get a Planhat asset by ID."""
    return _get(f"/assets/{_path_id(asset_id)}")


@_tool("create")
def create_asset(name: str, company_id: str, external_id: str = "", **kwargs) -> dict:
    """Create a new asset in Planhat."""
    body: dict = {"name": name, "companyId": company_id}
    if external_id:
        body["externalId"] = external_id
    body.update(kwargs)
    return _post("/assets", body)


@_tool("update")
def update_asset(asset_id: str, name: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat asset."""
    body: dict = {}
    if name:
        body["name"] = name
    body.update(kwargs)
    return _put(f"/assets/{_path_id(asset_id)}", body)


@_tool("delete")
def delete_asset(asset_id: str) -> dict:
    """Delete a Planhat asset."""
    return _delete(f"/assets/{_path_id(asset_id)}")


# ── Issues ───────────────────────────────────────────────────────────────────

@_tool()
def list_issues(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat issues (bugs / feature requests)."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    return _get("/issues", params)


@_tool()
def get_issue(issue_id: str) -> dict:
    """Get a Planhat issue by ID."""
    return _get(f"/issues/{_path_id(issue_id)}")


@_tool("create")
def create_issue(title: str, company_id: str = "", **kwargs) -> dict:
    """Create a new issue in Planhat."""
    body: dict = {"title": title}
    if company_id:
        body["companyIds"] = [company_id]
    body.update(kwargs)
    return _post("/issues", body)


@_tool("update")
def update_issue(issue_id: str, title: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat issue."""
    body: dict = {}
    if title:
        body["title"] = title
    body.update(kwargs)
    return _put(f"/issues/{_path_id(issue_id)}", body)


@_tool("delete")
def delete_issue(issue_id: str) -> dict:
    """Delete a Planhat issue."""
    return _delete(f"/issues/{_path_id(issue_id)}")


# ── Tickets ──────────────────────────────────────────────────────────────────
# Tickets are Conversations of type "ticket" under the hood (same pattern as
# Notes). The dedicated /tickets endpoint only documents list/delete/bulk-upsert,
# so single create/update go through /conversations like Notes do.

@_tool()
def list_tickets(limit: int = 50, offset: int = 0, company_id: str = "", status: str = "", search: str = "") -> dict:
    """List Planhat tickets, optionally filtered by company, status, or a search term."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    if status:
        params["status"] = status
    if search:
        params["search"] = search
    return _get("/tickets", params)


@_tool()
def get_ticket(ticket_id: str) -> dict:
    """Get a Planhat ticket by ID."""
    return _get(f"/tickets/{_path_id(ticket_id)}")


@_tool("create")
def create_ticket(
    company_id: str,
    subject: str = "",
    description: str = "",
    owner_id: str = "",
    **kwargs,
) -> dict:
    """Create a new ticket in Planhat."""
    body: dict = {"companyId": company_id, "type": "ticket"}
    if subject:
        body["subject"] = subject
    if description:
        body["description"] = description
    if owner_id:
        body["ownerId"] = owner_id
    body.update(kwargs)
    return _post("/conversations", body)


@_tool("update")
def update_ticket(ticket_id: str, status: str = "", subject: str = "", description: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat ticket."""
    body: dict = {}
    if status:
        body["status"] = status
    if subject:
        body["subject"] = subject
    if description:
        body["description"] = description
    body.update(kwargs)
    return _put(f"/conversations/{_path_id(ticket_id)}", body)


@_tool("delete")
def delete_ticket(ticket_id: str) -> dict:
    """Delete a Planhat ticket."""
    return _delete(f"/tickets/{_path_id(ticket_id)}")


# ── Tasks ────────────────────────────────────────────────────────────────────

@_tool()
def list_tasks(limit: int = 50, offset: int = 0, company_id: str = "", is_archived: bool | None = None) -> dict:
    """List Planhat tasks."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    if is_archived is not None:
        params["isArchived"] = is_archived
    return _get("/tasks", params)


@_tool()
def get_task(task_id: str) -> dict:
    """Get a Planhat task by ID."""
    return _get(f"/tasks/{_path_id(task_id)}")


@_tool("create")
def create_task(
    company_id: str,
    action: str = "",
    description: str = "",
    owner_id: str = "",
    main_type: str = "task",
    **kwargs,
) -> dict:
    """Create a new task in Planhat."""
    body: dict = {"companyId": company_id, "mainType": main_type}
    if action:
        body["action"] = action
    if description:
        body["description"] = description
    if owner_id:
        body["ownerId"] = owner_id
    body.update(kwargs)
    return _post("/tasks", body)


@_tool("update")
def update_task(task_id: str, action: str = "", status: str = "", **kwargs) -> dict:
    """Update fields on an existing Planhat task."""
    body: dict = {}
    if action:
        body["action"] = action
    if status:
        body["status"] = status
    body.update(kwargs)
    return _put(f"/tasks/{_path_id(task_id)}", body)


@_tool("delete")
def delete_task(task_id: str) -> dict:
    """Delete a Planhat task."""
    return _delete(f"/tasks/{_path_id(task_id)}")


# ── Licenses ─────────────────────────────────────────────────────────────────

@_tool()
def list_licenses(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat licenses (recurring revenue records)."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    return _get("/licenses", params)


@_tool()
def get_license(license_id: str) -> dict:
    """Get a Planhat license by ID."""
    return _get(f"/licenses/{_path_id(license_id)}")


@_tool("create")
def create_license(company_id: str, currency: str, value: float, **kwargs) -> dict:
    """Create a new license in Planhat."""
    body: dict = {"companyId": company_id, "_currency": currency, "value": value}
    body.update(kwargs)
    return _post("/licenses", body)


@_tool("update")
def update_license(license_id: str, value: float | None = None, **kwargs) -> dict:
    """Update fields on an existing Planhat license."""
    body: dict = {}
    if value is not None:
        body["value"] = value
    body.update(kwargs)
    return _put(f"/licenses/{_path_id(license_id)}", body)


@_tool("delete")
def delete_license(license_id: str) -> dict:
    """Delete a Planhat license."""
    return _delete(f"/licenses/{_path_id(license_id)}")


# ── Invoices ─────────────────────────────────────────────────────────────────

@_tool()
def list_invoices(limit: int = 50, offset: int = 0, company_id: str = "") -> dict:
    """List Planhat invoices."""
    params: dict = {"limit": limit, "offset": offset}
    if company_id:
        params["companyId"] = company_id
    return _get("/invoices", params)


@_tool()
def get_invoice(invoice_id: str) -> dict:
    """Get a Planhat invoice by ID."""
    return _get(f"/invoices/{_path_id(invoice_id)}")


@_tool("create")
def create_invoice(company_id: str, currency: str, invoice_date: str, **kwargs) -> dict:
    """Create a new invoice in Planhat."""
    body: dict = {"cId": company_id, "currency": currency, "invoiceDate": invoice_date}
    body.update(kwargs)
    return _post("/invoices", body)


@_tool("update")
def update_invoice(invoice_id: str, **kwargs) -> dict:
    """Update fields on an existing Planhat invoice."""
    return _put(f"/invoices/{_path_id(invoice_id)}", kwargs)


@_tool("delete")
def delete_invoice(invoice_id: str) -> dict:
    """Delete a Planhat invoice."""
    return _delete(f"/invoices/{_path_id(invoice_id)}")


if __name__ == "__main__":
    mcp.run()

"""Offline tests for every MCP tool: correct HTTP method, path, and key body fields.

All HTTP is mocked — these tests never touch the live Planhat API and need no token.
"""

import importlib
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("PLANHAT_TOKEN", "test-token")

import planhat_mcp  # noqa: E402


class FakeResponse:
    ok = True
    status_code = 200
    reason = "OK"
    text = '{"ok": true}'

    def json(self):
        return {"ok": True}


class Recorder:
    def __init__(self):
        self.calls = []

    def handler(self, method):
        def call(url, headers=None, params=None, json=None, **kwargs):
            assert headers["Authorization"] == "Bearer test-token"
            assert kwargs.get("timeout") == planhat_mcp.REQUEST_TIMEOUT, f"{method} {url} missing timeout"
            self.calls.append({"method": method, "url": url, "params": params, "json": json})
            return FakeResponse()

        return call

    @property
    def last(self):
        return self.calls[-1]


@pytest.fixture
def api(monkeypatch):
    rec = Recorder()
    for method in ("get", "post", "put", "delete"):
        monkeypatch.setattr(planhat_mcp.requests, method, rec.handler(method.upper()))
    return rec


def tool(name):
    return planhat_mcp.mcp._tool_manager._tools[name].fn


# (tool_name, kwargs, expected_method, expected_path)
CASES = [
    # Companies
    ("list_companies", {}, "GET", "/companies"),
    ("get_company", {"company_id": "X1"}, "GET", "/companies/X1"),
    ("create_company", {"name": "Acme"}, "POST", "/companies"),
    ("update_company", {"company_id": "X1", "name": "Acme"}, "PUT", "/companies/X1"),
    ("delete_company", {"company_id": "X1"}, "DELETE", "/companies/X1"),
    # Contacts → /endusers
    ("list_contacts", {}, "GET", "/endusers"),
    ("get_contact", {"contact_id": "X1"}, "GET", "/endusers/X1"),
    ("create_contact", {"first_name": "A", "last_name": "B", "email": "a@b.c", "company_id": "X1"}, "POST", "/endusers"),
    ("update_contact", {"contact_id": "X1", "email": "a@b.c"}, "PUT", "/endusers/X1"),
    ("delete_contact", {"contact_id": "X1"}, "DELETE", "/endusers/X1"),
    # Opportunities
    ("list_opportunities", {}, "GET", "/opportunities"),
    ("get_opportunity", {"opportunity_id": "X1"}, "GET", "/opportunities/X1"),
    ("create_opportunity", {"title": "Deal", "company_id": "X1"}, "POST", "/opportunities"),
    ("update_opportunity", {"opportunity_id": "X1", "title": "Deal"}, "PUT", "/opportunities/X1"),
    ("delete_opportunity", {"opportunity_id": "X1"}, "DELETE", "/opportunities/X1"),
    # Notes → /conversations (no /notes endpoint exists in Planhat)
    ("list_notes", {}, "GET", "/conversations"),
    ("get_note", {"note_id": "X1"}, "GET", "/conversations/X1"),
    ("create_note", {"text": "hi", "company_id": "X1"}, "POST", "/conversations"),
    ("update_note", {"note_id": "X1", "text": "hi"}, "PUT", "/conversations/X1"),
    ("delete_note", {"note_id": "X1"}, "DELETE", "/conversations/X1"),
    # Conversations
    ("list_conversations", {}, "GET", "/conversations"),
    ("get_conversation", {"conversation_id": "X1"}, "GET", "/conversations/X1"),
    ("create_conversation", {"company_id": "X1"}, "POST", "/conversations"),
    ("update_conversation", {"conversation_id": "X1", "subject": "s"}, "PUT", "/conversations/X1"),
    ("delete_conversation", {"conversation_id": "X1"}, "DELETE", "/conversations/X1"),
    # Users
    ("list_users", {}, "GET", "/users"),
    ("get_user", {"user_id": "X1"}, "GET", "/users/X1"),
    ("create_user", {"first_name": "A", "last_name": "B", "email": "a@b.c"}, "POST", "/users"),
    ("update_user", {"user_id": "X1", "email": "a@b.c"}, "PUT", "/users/X1"),
    ("delete_user", {"user_id": "X1"}, "DELETE", "/users/X1"),
    # Assets
    ("list_assets", {}, "GET", "/assets"),
    ("get_asset", {"asset_id": "X1"}, "GET", "/assets/X1"),
    ("create_asset", {"name": "A", "company_id": "X1"}, "POST", "/assets"),
    ("update_asset", {"asset_id": "X1", "name": "A"}, "PUT", "/assets/X1"),
    ("delete_asset", {"asset_id": "X1"}, "DELETE", "/assets/X1"),
    # Issues
    ("list_issues", {}, "GET", "/issues"),
    ("get_issue", {"issue_id": "X1"}, "GET", "/issues/X1"),
    ("create_issue", {"title": "Bug"}, "POST", "/issues"),
    ("update_issue", {"issue_id": "X1", "title": "Bug"}, "PUT", "/issues/X1"),
    ("delete_issue", {"issue_id": "X1"}, "DELETE", "/issues/X1"),
    # Tickets: list/get/delete via /tickets; create/update via /conversations
    ("list_tickets", {}, "GET", "/tickets"),
    ("get_ticket", {"ticket_id": "X1"}, "GET", "/tickets/X1"),
    ("create_ticket", {"company_id": "X1"}, "POST", "/conversations"),
    ("update_ticket", {"ticket_id": "X1", "status": "open"}, "PUT", "/conversations/X1"),
    ("delete_ticket", {"ticket_id": "X1"}, "DELETE", "/tickets/X1"),
    # Tasks
    ("list_tasks", {}, "GET", "/tasks"),
    ("get_task", {"task_id": "X1"}, "GET", "/tasks/X1"),
    ("create_task", {"company_id": "X1"}, "POST", "/tasks"),
    ("update_task", {"task_id": "X1", "action": "call"}, "PUT", "/tasks/X1"),
    ("delete_task", {"task_id": "X1"}, "DELETE", "/tasks/X1"),
    # Licenses
    ("list_licenses", {}, "GET", "/licenses"),
    ("get_license", {"license_id": "X1"}, "GET", "/licenses/X1"),
    ("create_license", {"company_id": "X1", "currency": "USD", "value": 9.0}, "POST", "/licenses"),
    ("update_license", {"license_id": "X1", "value": 9.0}, "PUT", "/licenses/X1"),
    ("delete_license", {"license_id": "X1"}, "DELETE", "/licenses/X1"),
    # Invoices
    ("list_invoices", {}, "GET", "/invoices"),
    ("get_invoice", {"invoice_id": "X1"}, "GET", "/invoices/X1"),
    ("create_invoice", {"company_id": "X1", "currency": "USD", "invoice_date": "2026-01-01"}, "POST", "/invoices"),
    ("update_invoice", {"invoice_id": "X1"}, "PUT", "/invoices/X1"),
    ("delete_invoice", {"invoice_id": "X1"}, "DELETE", "/invoices/X1"),
]


def test_exactly_the_expected_tools_are_registered():
    assert sorted(planhat_mcp.mcp._tool_manager._tools) == sorted(name for name, *_ in CASES)


@pytest.mark.parametrize("name,kwargs,method,path", CASES, ids=[c[0] for c in CASES])
def test_tool_hits_expected_endpoint(api, name, kwargs, method, path):
    tool(name)(**kwargs)
    assert api.last["method"] == method
    assert api.last["url"] == f"{planhat_mcp.BASE_URL}{path}"


# ── Body/param spot checks for the API's known quirks ──────────────────────────


def test_notes_list_filters_to_type_note(api):
    tool("list_notes")()
    assert api.last["params"]["type"] == "note"


def test_note_create_sets_type_and_description(api):
    tool("create_note")(text="hello", company_id="C1", contact_id="E1")
    body = api.last["json"]
    assert body["type"] == "note"
    assert body["description"] == "hello"
    assert body["endusers"] == ["E1"]


def test_ticket_create_sets_type_ticket(api):
    tool("create_ticket")(company_id="C1", subject="Help")
    body = api.last["json"]
    assert body["type"] == "ticket"
    assert body["companyId"] == "C1"


def test_invoice_create_uses_cid_not_companyid(api):
    tool("create_invoice")(company_id="C1", currency="USD", invoice_date="2026-01-01")
    body = api.last["json"]
    assert body["cId"] == "C1"
    assert "companyId" not in body


def test_license_create_uses_underscore_currency(api):
    tool("create_license")(company_id="C1", currency="NOK", value=100.0)
    body = api.last["json"]
    assert body["_currency"] == "NOK"
    assert body["value"] == 100.0


def test_issue_create_wraps_company_in_companyids_array(api):
    tool("create_issue")(title="Bug", company_id="C1")
    assert api.last["json"]["companyIds"] == ["C1"]


def test_update_sends_only_provided_fields(api):
    tool("update_company")(company_id="C1", name="New Name")
    assert api.last["json"] == {"name": "New Name"}


def test_kwargs_pass_through_to_body(api):
    tool("update_company")(company_id="C1", phase="onboarding")
    assert api.last["json"] == {"phase": "onboarding"}


# ── Path-parameter safety ──────────────────────────────────────────────────────


def test_path_ids_are_url_encoded(api):
    tool("get_company")(company_id="../users")
    assert api.last["url"] == f"{planhat_mcp.BASE_URL}/companies/..%2Fusers"


def test_path_ids_cannot_smuggle_query_params(api):
    tool("get_company")(company_id="x?limit=999")
    assert api.last["url"] == f"{planhat_mcp.BASE_URL}/companies/x%3Flimit%3D999"


def test_planhat_prefixed_ids_pass_through_unchanged(api):
    tool("get_asset")(asset_id="extid-abc_123")
    assert api.last["url"] == f"{planhat_mcp.BASE_URL}/assets/extid-abc_123"


@pytest.mark.parametrize(
    "name,kwarg",
    [("get_company", "company_id"), ("update_task", "task_id"), ("delete_user", "user_id")],
)
@pytest.mark.parametrize("bad_id", ["", "   "])
def test_empty_ids_are_rejected_before_any_request(api, name, kwarg, bad_id):
    with pytest.raises(ValueError):
        tool(name)(**{kwarg: bad_id})
    assert api.calls == []


# ── Env-var gating (PLANHAT_READ_ONLY / PLANHAT_DISABLE_DELETE) ────────────────

ALL_TOOLS = {name for name, *_ in CASES}


def _reload_with_env(monkeypatch, **env):
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return importlib.reload(planhat_mcp)


def _restore_default_module(monkeypatch, *keys):
    for key in keys:
        monkeypatch.delenv(key)
    importlib.reload(planhat_mcp)


def test_read_only_mode_registers_only_read_tools(monkeypatch):
    mod = _reload_with_env(monkeypatch, PLANHAT_READ_ONLY="1")
    try:
        registered = set(mod.mcp._tool_manager._tools)
        assert registered == {n for n in ALL_TOOLS if n.startswith(("list_", "get_"))}
        assert len(registered) == 24
    finally:
        _restore_default_module(monkeypatch, "PLANHAT_READ_ONLY")


def test_disable_delete_mode_registers_everything_but_deletes(monkeypatch):
    mod = _reload_with_env(monkeypatch, PLANHAT_DISABLE_DELETE="true")
    try:
        registered = set(mod.mcp._tool_manager._tools)
        assert registered == {n for n in ALL_TOOLS if not n.startswith("delete_")}
        assert len(registered) == 48
    finally:
        _restore_default_module(monkeypatch, "PLANHAT_DISABLE_DELETE")


def test_default_mode_registers_all_60_tools():
    assert len(planhat_mcp.mcp._tool_manager._tools) == 60


# ── Error handling ─────────────────────────────────────────────────────────────


def test_http_error_raises(monkeypatch):
    class ErrResponse:
        ok = False
        status_code = 401
        reason = "Unauthorized"
        text = "bad token"

    monkeypatch.setattr(planhat_mcp.requests, "get", lambda *a, **k: ErrResponse())
    with pytest.raises(RuntimeError, match="401"):
        tool("list_companies")()

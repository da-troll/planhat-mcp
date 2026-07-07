"""Consistency checks for the .mcpb bundle definition (manifest.json).

These guard the invariants the one-click install depends on: the manifest
version tracking pyproject, the env mapping matching what the server actually
reads, and the checkbox booleans stringifying into values _flag() understands.
"""

import json
import re
from pathlib import Path

import pytest

import planhat_mcp

ROOT = Path(__file__).resolve().parent.parent


def manifest() -> dict:
    return json.loads((ROOT / "manifest.json").read_text())


def pyproject_version() -> str:
    match = re.search(r'^version = "(.+)"$', (ROOT / "pyproject.toml").read_text(), re.MULTILINE)
    assert match, "version not found in pyproject.toml"
    return match.group(1)


def test_manifest_version_matches_pyproject():
    assert manifest()["version"] == pyproject_version()


def test_entry_point_exists_and_matches_server_args():
    m = manifest()
    entry = m["server"]["entry_point"]
    assert (ROOT / entry).is_file()
    assert entry in m["server"]["mcp_config"]["args"]


def test_env_mapping_matches_what_the_server_reads():
    env = manifest()["server"]["mcp_config"]["env"]
    assert set(env) == {"PLANHAT_TOKEN", "PLANHAT_READ_ONLY", "PLANHAT_DISABLE_DELETE"}


def test_every_env_template_has_a_user_config_entry():
    m = manifest()
    user_config = m["user_config"]
    for value in m["server"]["mcp_config"]["env"].values():
        match = re.fullmatch(r"\$\{user_config\.(\w+)\}", value)
        assert match, f"env value {value!r} is not a user_config template"
        assert match.group(1) in user_config, f"no user_config entry for {value!r}"


def test_token_field_is_sensitive_and_required():
    token = manifest()["user_config"]["planhat_token"]
    assert token["sensitive"] is True
    assert token["required"] is True
    assert token["type"] == "string"


def test_gate_fields_are_optional_booleans_defaulting_off():
    m = manifest()
    for key in ("read_only", "disable_delete"):
        field = m["user_config"][key]
        assert field["type"] == "boolean"
        assert field["default"] is False


@pytest.mark.parametrize("value", ["false", "False", "0", "", "no"])
def test_flag_treats_checkbox_off_values_as_off(value):
    assert planhat_mcp._flag_value(value) is False


@pytest.mark.parametrize("value", ["true", "True", "1", "yes"])
def test_flag_treats_checkbox_on_values_as_on(value):
    assert planhat_mcp._flag_value(value) is True

"""Server-side mirror of the local action-policy engine.

Authoritative enforcement runs on-device; this mirror backs
POST /agent/action/validate for the extension/tests.
"""
from __future__ import annotations

import re
from typing import Any

CRITICAL = {"OTP", "PASSWORD", "CREDIT_CARD", "API_KEY"}


def _targets_credential(action: dict[str, Any], entities: list[dict], elements: list[dict]) -> bool:
    el = next((e for e in elements if e.get("id") == action.get("target_id")), None)
    if el and (el.get("attributes") or {}).get("type") == "password":
        return True
    critical = [e for e in entities if e.get("type") in CRITICAL]
    val = action.get("value")
    if val:
        vdigits = re.sub(r"\D", "", val)
        for e in critical:
            ed = re.sub(r"\D", "", e.get("value", ""))
            if e.get("value", "") in val or (len(ed) >= 4 and ed in vdigits):
                return True
    if el and any(e.get("element_id") == el.get("id") for e in critical):
        return True
    return False


CATALOGUE = [
    ("block.reveal_credential", "BLOCK", "Revealing OTP/password/payment credentials is prohibited by local policy."),
    ("block.fill_credential_from_remote", "BLOCK", "Remote AI attempted to write into a credential/OTP/password field. Blocked locally."),
    ("block.transmit_credential", "BLOCK", "Action would expose a critical credential. Blocked locally."),
    ("block.download_sensitive", "BLOCK", "Downloading a document while sensitive identity data is present requires manual review."),
    ("confirm.purchase", "CONFIRM", "Purchases require explicit human confirmation."),
    ("confirm.submit", "CONFIRM", "Submitting a form requires explicit human confirmation."),
    ("confirm.settings_change", "CONFIRM", "Changing account settings requires explicit human confirmation."),
    ("confirm.download", "CONFIRM", "Downloading a file requires human confirmation."),
    ("allow.navigation", "ALLOW", "Public navigation / scroll is permitted."),
    ("allow.fill_public", "ALLOW", "Filling a non-sensitive public field is permitted."),
    ("allow.select_public", "ALLOW", "Selecting a non-sensitive option is permitted."),
]


def evaluate(action: dict[str, Any], entities: list[dict], elements: list[dict]) -> dict[str, Any]:
    t = action.get("type")
    label = action.get("target_label") or ""

    if t == "REVEAL_CREDENTIAL":
        return _d("block.reveal_credential", "BLOCK")
    if t == "FILL" and _targets_credential(action, entities, elements):
        return _d("block.fill_credential_from_remote", "BLOCK")
    if _targets_credential(action, entities, elements) and t != "CLICK":
        return _d("block.transmit_credential", "BLOCK")
    if t == "DOWNLOAD" and any(e.get("sensitivity") in ("CRITICAL", "HIGH") for e in entities):
        return _d("block.download_sensitive", "BLOCK")
    if t == "PURCHASE":
        return _d("confirm.purchase", "CONFIRM")
    if t == "SUBMIT":
        return _d("confirm.submit", "CONFIRM")
    if t in ("CLICK", "SELECT") and re.search(r"(?i)account settings|change|delete|deactivate", label):
        return _d("confirm.settings_change", "CONFIRM")
    if t == "DOWNLOAD":
        return _d("confirm.download", "CONFIRM")
    if t in ("CLICK", "NAVIGATE", "SCROLL"):
        return _d("allow.navigation", "ALLOW")
    if t == "FILL":
        return _d("allow.fill_public", "ALLOW")
    if t == "SELECT":
        return _d("allow.select_public", "ALLOW")
    return {"decision": "CONFIRM", "rule": "default.confirm",
            "reason": "No explicit allow rule matched; defaulting to human confirmation."}


def _d(rule: str, decision: str) -> dict[str, Any]:
    reason = next((r for n, dd, r in CATALOGUE if n == rule), "")
    return {"decision": decision, "rule": rule, "reason": reason}

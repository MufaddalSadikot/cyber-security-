"""Server-side mirror of the context compiler."""
from __future__ import annotations

import json
import re
from typing import Any

INTENTS = [
    (r"(?i)\b(order|status|track|shipment|delivery|parcel)\b", "track_order",
     ["order", "status", "shipped", "delivery", "track", "expected"], ["status", "price", "button", "link"]),
    (r"(?i)\b(cheapest|flight|price|book|fare)\b", "find_cheapest",
     ["price", "cheapest", "fare", "flight", "total"], ["price", "button", "link", "text"]),
    (r"(?i)\b(fill|register|form|sign\s?up|registration)\b", "fill_form",
     ["name", "organization", "track", "submit", "next", "register"], ["input", "label", "button"]),
    (r"(?i)\b(settings?|preferences|configuration)\b", "open_settings",
     ["settings", "account", "preferences"], ["link", "button", "nav"]),
    (r"(?i)\b(profile|account|identity)\b", "open_profile",
     ["profile", "account", "membership", "name"], ["link", "button", "heading"]),
    (r"(?i)\b(otp|password|pay|payment|card|credential)\b", "complete_payment",
     ["pay", "amount", "payee", "confirm"], ["button", "price", "text"]),
    (r"(?i)\b(navigate|open|go to|scroll|find)\b", "navigate",
     ["open", "section", "page", "nav"], ["link", "button", "nav", "heading"]),
]


def classify(task: str):
    for pat, intent, kws, roles in INTENTS:
        if re.search(pat, task):
            return intent, kws, roles
    return "generic_task", [w for w in task.lower().split() if len(w) > 3], ["link", "button", "text", "heading"]


def _redact(text: str, entities: list[dict]) -> str:
    out = text
    for e in entities:
        v = e.get("value")
        if not v:
            continue
        rep = "[removed]" if e.get("action") == "DROP" else e.get("placeholder", "")
        out = out.replace(v, rep)
    return out


def compile_context(task: str, perception: dict[str, Any], entities: list[dict]) -> tuple[dict, dict]:
    intent, keywords, roles = classify(task)
    elements = perception.get("elements", [])

    scored = []
    for el in elements:
        score = 0
        if el.get("role") in roles:
            score += 2
        low = (el.get("text") or "").lower()
        for kw in keywords:
            if kw in low:
                score += 3
        if el.get("interactive"):
            score += 1
        if score > 0:
            scored.append((score, el))
    scored.sort(key=lambda x: -x[0])
    kept = [el for _, el in scored]

    visible = []
    for el in kept:
        t = _redact(el.get("text") or "", entities).strip()
        if t:
            visible.append(t)
    visible = visible[:8]

    targets = [
        {"id": el["id"], "label": _redact(el.get("text") or (el.get("attributes") or {}).get("name") or el["role"], entities).strip() or el["role"], "role": el["role"]}
        for el in kept if el.get("interactive")
    ][:10]

    fields: dict[str, Any] = {}
    for el in kept:
        text = el.get("text") or ""
        t = _redact(text, entities)
        if re.search(r"(?i)order status", text):
            fields["status"] = re.sub(r"(?i)order status:?\s*", "", t).strip()
        elif re.search(r"(?i)order\s*#", text):
            fields["order_reference"] = "REDACTED"
        if re.search(r"(?i)delivery", text):
            fields["delivery_estimate"] = re.sub(r"(?i).*delivery:?\s*", "", t).strip()
        if re.search(r"(?i)total|amount", text) and el.get("role") == "price":
            fields["amount"] = re.sub(r"(?i).*(total|amount):?\s*", "", t).strip()

    compiled = {
        "intent": intent,
        "pageType": perception.get("pageType", "unknown"),
        "visibleElements": visible,
        "fields": fields,
        "actionableTargets": targets,
    }

    raw_chars = len(perception.get("rawText", ""))
    retained_chars = len("\n".join(visible))
    compiled_chars = len(json.dumps(compiled))
    stats = {
        "rawChars": raw_chars,
        "compiledChars": compiled_chars,
        "reductionPct": max(0, round((1 - retained_chars / raw_chars) * 1000) / 10) if raw_chars else 0,
        "elementsIn": len(elements),
        "elementsOut": len(kept),
        "sensitiveRemoved": len(entities),
    }
    return compiled, stats

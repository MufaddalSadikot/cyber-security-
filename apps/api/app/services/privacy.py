"""Server-side mirror of the local privacy engine.

Used by POST /privacy/analyze and /privacy/sanitize so the extension or tests
can call a canonical implementation. The AUTHORITATIVE detection for the demo
runs on-device (packages/privacy-engine); this mirror keeps the same rules.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

SENSITIVITY = {
    "OTP": "CRITICAL", "PASSWORD": "CRITICAL", "CREDIT_CARD": "CRITICAL", "API_KEY": "CRITICAL",
    "AADHAAR": "HIGH", "PAN": "HIGH", "DOB": "HIGH",
    "EMAIL": "MEDIUM", "PHONE": "MEDIUM", "ADDRESS": "MEDIUM",
    "PERSON_NAME": "LOW", "IP_ADDRESS": "LOW",
}
DEFAULT_ACTION = {
    "OTP": "DROP", "PASSWORD": "DROP", "CREDIT_CARD": "MASK", "API_KEY": "DROP",
    "AADHAAR": "MASK", "PAN": "MASK", "DOB": "REDACT", "EMAIL": "REDACT",
    "PHONE": "REDACT", "ADDRESS": "REDACT", "PERSON_NAME": "REDACT", "IP_ADDRESS": "HASH",
}
REASON = {
    "OTP": "One-time passcode — never transmit off device",
    "PASSWORD": "Credential — never transmit off device",
    "CREDIT_CARD": "Payment card number detected locally",
    "API_KEY": "Secret token detected locally",
    "AADHAAR": "National identity number detected locally",
    "PAN": "Tax identity number detected locally",
    "DOB": "Date of birth is PII",
    "EMAIL": "Email address is PII",
    "PHONE": "Phone number is PII",
    "ADDRESS": "Postal address is PII",
    "PERSON_NAME": "Personal name is PII",
    "IP_ADDRESS": "IP address can identify a user",
}


@dataclass
class Match:
    type: str
    value: str
    start: int
    end: int
    confidence: float
    detector: str


def _luhn(digits: str) -> bool:
    d = re.sub(r"\D", "", digits)
    if not (13 <= len(d) <= 19):
        return False
    total, alt = 0, False
    for ch in reversed(d):
        n = int(ch)
        if alt:
            n *= 2
            if n > 9:
                n -= 9
        total += n
        alt = not alt
    return total % 10 == 0


def _detect(text: str) -> list[Match]:
    out: list[Match] = []

    for m in re.finditer(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", text):
        out.append(Match("EMAIL", m.group(), m.start(), m.end(), 0.99, "regex.email"))

    for m in re.finditer(r"(?:\+91[\s-]?)?(?<!\d)[6-9]\d{4}[\s-]?\d{5}(?!\d)", text):
        out.append(Match("PHONE", m.group().strip(), m.start(), m.end(), 0.94, "regex.phone_in"))

    for m in re.finditer(r"(?i)\b(?:otp|one[-\s]?time\s+(?:pass(?:word|code)|code)|verification\s+code)\b[^0-9]{0,20}(\d{4,8})", text):
        idx = m.start() + m.group().rfind(m.group(1))
        out.append(Match("OTP", m.group(1), idx, idx + len(m.group(1)), 0.97, "context.otp"))

    for m in re.finditer(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)", text):
        digits = re.sub(r"\D", "", m.group())
        if 13 <= len(digits) <= 19 and _luhn(digits):
            out.append(Match("CREDIT_CARD", m.group().strip(), m.start(), m.end(), 0.96, "regex.card+luhn"))

    for m in re.finditer(r"(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)", text):
        digits = re.sub(r"\D", "", m.group())
        if len(digits) == 12 and not _luhn(digits):
            out.append(Match("AADHAAR", m.group().strip(), m.start(), m.end(), 0.9, "regex.aadhaar"))

    for m in re.finditer(r"\b[A-Z]{5}\d{4}[A-Z]\b", text):
        out.append(Match("PAN", m.group(), m.start(), m.end(), 0.93, "regex.pan"))

    for m in re.finditer(r"\b(?:sk|pk|api|key|token|ghp|xox[baprs])[-_][A-Za-z0-9]{16,}\b", text):
        out.append(Match("API_KEY", m.group(), m.start(), m.end(), 0.88, "regex.apikey"))

    for m in re.finditer(r"(?i)\b(?:date\s+of\s+birth|dob|born)\b[^0-9]{0,12}(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})", text):
        idx = m.start() + m.group().rfind(m.group(1))
        out.append(Match("DOB", m.group(1), idx, idx + len(m.group(1)), 0.85, "context.dob"))

    for m in re.finditer(r"[^\n]*\b\d{6}\b[^\n]*", text):
        line = m.group()
        if re.search(r"(?i)\b(road|rd|street|st|floor|tower|nagar|lane|block|sector|colony|view|apartment|apt)\b", line):
            cleaned = re.sub(r"(?i)^\s*(ship to|address|addr|deliver to)\s*:?\s*", "", line)
            offset = len(line) - len(cleaned)
            out.append(Match("ADDRESS", cleaned.strip(), m.start() + offset, m.end(), 0.8, "heuristic.address_in"))

    for m in re.finditer(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b", text):
        out.append(Match("IP_ADDRESS", m.group(), m.start(), m.end(), 0.82, "regex.ipv4"))

    for m in re.finditer(r"(?i)\b(?:welcome(?:\s+back)?|hi|hello|dear|profile|name|mr\.?|ms\.?|mrs\.?)\b[\s,:]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})", text):
        idx = m.start() + m.group().rfind(m.group(1))
        out.append(Match("PERSON_NAME", m.group(1), idx, idx + len(m.group(1)), 0.72, "heuristic.name_context"))

    # resolve overlaps: keep leftmost, then highest confidence
    out.sort(key=lambda x: (x.start, -x.confidence))
    kept: list[Match] = []
    last_end = -1
    for mm in out:
        if mm.start >= last_end:
            kept.append(mm)
            last_end = mm.end
    return kept


def _placeholder(t: str, action: str, value: str) -> str:
    if action == "DROP":
        return ""
    if action == "MASK":
        digits = re.sub(r"\D", "", value)
        last4 = digits[-4:]
        return f"[{t}:••••{last4}]" if last4 else f"[{t}:MASKED]"
    if action == "HASH":
        h = 0
        for ch in value:
            h = (h * 31 + ord(ch)) & 0xFFFFFFFF
        return f"[{t}:#{format(h, 'x')[:8]}]"
    return f"[REDACTED:{t}]"


def analyze(text: str, elements: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    elements = elements or []
    matches = _detect(text)
    entities: list[dict[str, Any]] = []
    for i, m in enumerate(matches):
        action = DEFAULT_ACTION[m.type]
        entities.append({
            "id": f"ent_{i}",
            "type": m.type,
            "value": m.value,
            "placeholder": _placeholder(m.type, action, m.value),
            "confidence": m.confidence,
            "sensitivity": SENSITIVITY[m.type],
            "action": action,
            "start": m.start,
            "end": m.end,
            "reason": REASON[m.type],
            "detector": m.detector,
        })

    for el in elements:
        if (el.get("attributes") or {}).get("type") == "password":
            entities.append({
                "id": f"ent_pw_{el.get('id')}",
                "type": "PASSWORD",
                "value": f"[password field #{el.get('id')}]",
                "placeholder": "",
                "confidence": 1.0,
                "sensitivity": "CRITICAL",
                "action": "DROP",
                "element_id": el.get("id"),
                "reason": REASON["PASSWORD"],
                "detector": "dom.password_field",
            })

    # build sanitized text
    sanitized = text
    for e in sorted([e for e in entities if e.get("start", -1) >= 0], key=lambda e: -e["start"]):
        rep = "[removed]" if e["action"] == "DROP" else e["placeholder"]
        sanitized = sanitized[: e["start"]] + rep + sanitized[e["end"]:]

    return {"entities": entities, "sanitized_text": sanitized}

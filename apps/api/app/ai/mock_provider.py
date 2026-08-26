"""Deterministic mock reasoning provider.

Produces realistic, reproducible structured actions from sanitized context.
It NEVER sees raw sensitive values (they were redacted client-side). This is
NOT a real model — it is a rule-based stand-in whose interface matches what a
real LLM/VLM would expose.
"""
from __future__ import annotations

from typing import Any

from app.ai.base import AIProvider


class MockProvider(AIProvider):
    name = "mock"

    def reason(self, task: str, scenario_id: str, compiled_context: dict[str, Any]) -> dict[str, Any]:
        intent = compiled_context.get("intent", "generic_task")
        targets = compiled_context.get("actionableTargets", [])

        def find(*needles: str) -> dict[str, Any] | None:
            for t in targets:
                label = (t.get("label") or "").lower()
                if any(n in label for n in needles):
                    return t
            return None

        # Dangerous intents: the model may still *propose* an unsafe action —
        # the LOCAL policy engine is what blocks it. This demonstrates the
        # boundary is enforced on-device, not trusted to the server.
        if intent == "complete_payment" or "otp" in task.lower() or "password" in task.lower():
            if "otp" in task.lower() or "read the otp" in task.lower():
                return {
                    "action": {
                        "type": "REVEAL_CREDENTIAL",
                        "target_id": None,
                        "target_label": "OTP value",
                        "rationale": "Task asks to read the OTP to continue the flow.",
                    },
                    "result_summary": "Proposed reading the OTP to proceed (will be evaluated by local policy).",
                }
            pay = find("pay now", "pay", "confirm")
            return {
                "action": {
                    "type": "PURCHASE",
                    "target_id": pay.get("id") if pay else None,
                    "target_label": pay.get("label") if pay else "Pay now",
                    "rationale": "Task requests completing the payment.",
                },
                "result_summary": "Proposed completing the payment (requires local confirmation).",
            }

        if intent == "track_order":
            t = find("order details", "details", "track")
            return {
                "action": {
                    "type": "CLICK",
                    "target_id": t.get("id") if t else None,
                    "target_label": t.get("label") if t else "Order details",
                    "rationale": "Open order details to reveal the current shipment status.",
                },
                "result_summary": f"Order status appears to be '{compiled_context.get('fields', {}).get('status', 'unknown')}'. Opening details for confirmation.",
            }

        if intent == "fill_form":
            t = find("full name", "name", "org", "organization")
            if t and t.get("role") == "input":
                return {
                    "action": {
                        "type": "FILL",
                        "target_id": t.get("id"),
                        "target_label": t.get("label"),
                        "value": "SpaceTech Labs",
                        "rationale": "Fill the public organization field to progress the registration.",
                    },
                    "result_summary": "Filling a public, non-sensitive form field.",
                }
            nxt = find("next", "continue")
            return {
                "action": {
                    "type": "CLICK",
                    "target_id": nxt.get("id") if nxt else None,
                    "target_label": nxt.get("label") if nxt else "Next step",
                    "rationale": "Advance to the next step of the public form.",
                },
                "result_summary": "Advancing the public registration form.",
            }

        if intent in ("open_settings", "open_profile", "navigate"):
            t = find("settings", "profile", "api", "installation", "account", "help")
            return {
                "action": {
                    "type": "NAVIGATE",
                    "target_id": t.get("id") if t else None,
                    "target_label": t.get("label") if t else "Settings",
                    "rationale": "Navigate to the requested public section.",
                },
                "result_summary": "Navigating to the requested section.",
            }

        # default
        first = targets[0] if targets else None
        return {
            "action": {
                "type": "CLICK",
                "target_id": first.get("id") if first else None,
                "target_label": first.get("label") if first else "primary action",
                "rationale": "Perform the most relevant available action.",
            },
            "result_summary": "Performing the most relevant available action.",
        }

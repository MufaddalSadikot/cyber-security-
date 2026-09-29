"""RealProvider — placeholder for a production LLM/VLM integration.

Implement `reason()` by calling your model of choice (e.g. an on-prem VLM or a
hosted API). It receives ONLY sanitized minimal context and must return the
same structured action shape as MockProvider. Kept intentionally unimplemented
so the prototype never fabricates real-model claims.
"""
from __future__ import annotations

from typing import Any

from app.ai.base import AIProvider


class RealProvider(AIProvider):
    name = "real"

    def __init__(self) -> None:
        # e.g. load an API client / local model handle here.
        pass

    def reason(self, task: str, scenario_id: str, compiled_context: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError(
            "RealProvider is not configured. Set AI_PROVIDER=mock for the demo, "
            "or implement this method against your LLM/VLM."
        )

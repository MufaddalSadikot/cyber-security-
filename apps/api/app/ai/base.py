"""AIProvider abstraction.

The remote reasoning layer receives ONLY sanitized, minimal context and must
return a single structured action. This is the seam where a real LLM/VLM is
plugged in: implement `AIProvider.reason()` against your model and register it
via the factory.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class AIProvider(ABC):
    name: str = "base"

    @abstractmethod
    def reason(self, task: str, scenario_id: str, compiled_context: dict[str, Any]) -> dict[str, Any]:
        """Return {action: {...}, result_summary: str}."""
        raise NotImplementedError

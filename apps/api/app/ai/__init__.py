"""AI provider factory."""
from __future__ import annotations

from app.ai.base import AIProvider
from app.ai.mock_provider import MockProvider
from app.core.config import settings


def get_ai_provider() -> AIProvider:
    if settings.AI_PROVIDER == "real":
        from app.ai.real_provider import RealProvider

        return RealProvider()
    return MockProvider()

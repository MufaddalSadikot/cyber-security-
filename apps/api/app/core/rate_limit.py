"""Simple in-memory token-bucket rate limiter abstraction.

This is a pluggable seam: swap the in-memory store for Redis in production by
implementing the same `allow()` interface.
"""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import settings


class InMemoryRateLimiter:
    def __init__(self, per_minute: int) -> None:
        self.per_minute = per_minute
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        now = time.time()
        window = now - 60
        hits = [t for t in self._hits[key] if t > window]
        if len(hits) >= self.per_minute:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True


limiter = InMemoryRateLimiter(settings.RATE_LIMIT_PER_MINUTE)


async def rate_limit(request: Request) -> None:
    key = request.client.host if request.client else "anon"
    if not limiter.allow(key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Try again shortly.",
        )

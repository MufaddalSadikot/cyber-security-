"""Application configuration loaded from environment variables."""
from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------
    # Default: local SQLite file (zero-setup, works everywhere).
    # For PostgreSQL set e.g.:
    #   DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/pvcc
    # The ORM models are written to be Postgres-compatible.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./pvcc.db")

    # ------------------------------------------------------------------
    # Auth / JWT
    # ------------------------------------------------------------------
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "dev-insecure-secret-change-me-0123456789abcdef-please-override"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

    # ------------------------------------------------------------------
    # CORS
    # ------------------------------------------------------------------
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "*",
    ).split(",")

    # ------------------------------------------------------------------
    # AI provider abstraction
    # ------------------------------------------------------------------
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock")  # "mock" | "real"

    # ------------------------------------------------------------------
    # Rate limiting (simple in-memory token bucket abstraction)
    # ------------------------------------------------------------------
    RATE_LIMIT_PER_MINUTE: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))

    APP_NAME: str = "Privacy-Aware Visual Context Compiler API"
    APP_VERSION: str = "1.0.0"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

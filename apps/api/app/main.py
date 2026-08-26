"""FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.models import Base  # noqa: F401 (ensure models are imported)
from app.db.session import Base as _Base, engine
from app.routers import agent, auth, misc, tasks
from app.routers import privacy as privacy_router

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    # For the prototype we create tables on startup. A migrations tool
    # (Alembic) is documented in the README for production.
    _Base.metadata.create_all(bind=engine)


@app.get("/health", tags=["system"])
def health() -> dict:
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION,
            "ai_provider": settings.AI_PROVIDER}


app.include_router(auth.router)
app.include_router(privacy_router.router)
app.include_router(agent.router)
app.include_router(tasks.router)
app.include_router(misc.router)

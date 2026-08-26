"""SQLAlchemy ORM models — the persistent data layer.

Covers: User, BrowserSession, AgentTask, WebPageContext, SensitiveEntity,
SanitizationEvent, CompiledContext, AgentAction, PolicyDecision, AuditEvent,
BenchmarkRun.

Models use portable column types so the same schema runs on SQLite and
PostgreSQL. JSON columns use SQLAlchemy's cross-dialect JSON type.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20), default="demo")  # "admin" | "demo"
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    sessions: Mapped[list["BrowserSession"]] = relationship(back_populates="user")
    tasks: Mapped[list["AgentTask"]] = relationship(back_populates="user")


class BrowserSession(Base):
    __tablename__ = "browser_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    user_agent: Mapped[str] = mapped_column(String(255), default="")
    device: Mapped[str] = mapped_column(String(60), default="desktop")
    started_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User"] = relationship(back_populates="sessions")
    tasks: Mapped[list["AgentTask"]] = relationship(back_populates="session")


class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    session_id: Mapped[str | None] = mapped_column(ForeignKey("browser_sessions.id"), nullable=True)
    scenario_id: Mapped[str] = mapped_column(String(60))
    instruction: Mapped[str] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(String(20), default="QUEUED")
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending|completed|blocked
    total_ms: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped["User"] = relationship(back_populates="tasks")
    session: Mapped["BrowserSession"] = relationship(back_populates="tasks")
    page_context: Mapped["WebPageContext"] = relationship(back_populates="task", uselist=False)
    compiled: Mapped["CompiledContextRow"] = relationship(back_populates="task", uselist=False)
    action: Mapped["AgentActionRow"] = relationship(back_populates="task", uselist=False)
    policy: Mapped["PolicyDecisionRow"] = relationship(back_populates="task", uselist=False)
    audit_events: Mapped[list["AuditEvent"]] = relationship(back_populates="task")


class WebPageContext(Base):
    __tablename__ = "web_page_contexts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"))
    url: Mapped[str] = mapped_column(String(512))
    title: Mapped[str] = mapped_column(String(255))
    page_type: Mapped[str] = mapped_column(String(80))
    element_count: Mapped[int] = mapped_column(Integer, default=0)
    raw_char_count: Mapped[int] = mapped_column(Integer, default=0)
    elements: Mapped[list] = mapped_column(JSON, default=list)

    task: Mapped["AgentTask"] = relationship(back_populates="page_context")
    entities: Mapped[list["SensitiveEntityRow"]] = relationship(back_populates="page_context")


class SensitiveEntityRow(Base):
    __tablename__ = "sensitive_entities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    page_context_id: Mapped[str] = mapped_column(ForeignKey("web_page_contexts.id"))
    type: Mapped[str] = mapped_column(String(30))
    placeholder: Mapped[str] = mapped_column(String(120))
    confidence: Mapped[float] = mapped_column(Float)
    sensitivity: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(20))
    element_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    reason: Mapped[str] = mapped_column(String(255))
    detector: Mapped[str] = mapped_column(String(60))
    # NOTE: raw sensitive value is intentionally NOT stored server-side.

    page_context: Mapped["WebPageContext"] = relationship(back_populates="entities")


class SanitizationEvent(Base):
    __tablename__ = "sanitization_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"))
    entities_detected: Mapped[int] = mapped_column(Integer, default=0)
    entities_redacted: Mapped[int] = mapped_column(Integer, default=0)
    critical_blocked: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)


class CompiledContextRow(Base):
    __tablename__ = "compiled_contexts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"))
    intent: Mapped[str] = mapped_column(String(60))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    raw_chars: Mapped[int] = mapped_column(Integer, default=0)
    compiled_chars: Mapped[int] = mapped_column(Integer, default=0)
    reduction_pct: Mapped[float] = mapped_column(Float, default=0.0)

    task: Mapped["AgentTask"] = relationship(back_populates="compiled")


class AgentActionRow(Base):
    __tablename__ = "agent_actions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"))
    type: Mapped[str] = mapped_column(String(30))
    target_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    target_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    rationale: Mapped[str] = mapped_column(Text, default="")
    executed: Mapped[bool] = mapped_column(Boolean, default=False)

    task: Mapped["AgentTask"] = relationship(back_populates="action")


class PolicyDecisionRow(Base):
    __tablename__ = "policy_decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(ForeignKey("agent_tasks.id"))
    decision: Mapped[str] = mapped_column(String(20))
    rule: Mapped[str] = mapped_column(String(80))
    reason: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    task: Mapped["AgentTask"] = relationship(back_populates="policy")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str | None] = mapped_column(ForeignKey("agent_tasks.id"), nullable=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    ts: Mapped[datetime] = mapped_column(DateTime, default=_now, index=True)
    category: Mapped[str] = mapped_column(String(20), index=True)  # PRIVACY|AI|ACTION|ERROR|SYSTEM
    code: Mapped[str] = mapped_column(String(60))
    message: Mapped[str] = mapped_column(String(400))
    ok: Mapped[bool] = mapped_column(Boolean, default=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)

    task: Mapped["AgentTask"] = relationship(back_populates="audit_events")


class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    label: Mapped[str] = mapped_column(String(120))
    system: Mapped[str] = mapped_column(String(40))  # "baseline" | "ours"
    scenario_id: Mapped[str] = mapped_column(String(60))
    visual_context_accuracy: Mapped[float] = mapped_column(Float)
    pii_precision: Mapped[float] = mapped_column(Float)
    pii_recall: Mapped[float] = mapped_column(Float)
    redaction_precision: Mapped[float] = mapped_column(Float)
    client_cpu_pct: Mapped[float] = mapped_column(Float)
    client_mem_mb: Mapped[float] = mapped_column(Float)
    e2e_latency_ms: Mapped[float] = mapped_column(Float)
    payload_bytes: Mapped[int] = mapped_column(Integer)
    privacy_exposure: Mapped[float] = mapped_column(Float)  # 0..100, lower is better
    sensitive_leaks: Mapped[int] = mapped_column(Integer)
    task_success: Mapped[float] = mapped_column(Float)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

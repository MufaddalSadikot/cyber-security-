"""Pydantic request/response schemas (typed API contract)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# ----------------------------- Auth --------------------------------------
class RegisterRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=6, max_length=128)
    role: Literal["admin", "demo"] = "demo"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ------------------------- Privacy engine --------------------------------
class PerceivedElementIn(BaseModel):
    id: str
    role: str
    text: str = ""
    attributes: Optional[dict[str, str]] = None
    interactive: bool = False


class AnalyzeRequest(BaseModel):
    text: str
    elements: list[PerceivedElementIn] = []


class SensitiveEntityOut(BaseModel):
    id: str
    type: str
    placeholder: str
    confidence: float
    sensitivity: str
    action: str
    element_id: Optional[str] = None
    reason: str
    detector: str


class AnalyzeResponse(BaseModel):
    entities: list[SensitiveEntityOut]
    sanitized_text: str
    counts: dict[str, int]


# ------------------------- Context compiler ------------------------------
class CompileRequest(BaseModel):
    task: str
    scenario_id: str
    perception: dict[str, Any]
    entities: list[dict[str, Any]] = []


class CompileResponse(BaseModel):
    compiled: dict[str, Any]
    stats: dict[str, Any]


# ----------------------------- Agent -------------------------------------
class ReasonRequest(BaseModel):
    task: str
    scenario_id: str
    compiled_context: dict[str, Any]


class AgentActionOut(BaseModel):
    type: str
    target_id: Optional[str] = None
    target_label: Optional[str] = None
    value: Optional[str] = None
    rationale: str


class ReasonResponse(BaseModel):
    action: AgentActionOut
    provider: str
    result_summary: str


class ValidateActionRequest(BaseModel):
    action: dict[str, Any]
    entities: list[dict[str, Any]] = []
    elements: list[dict[str, Any]] = []


class PolicyDecisionOut(BaseModel):
    decision: str
    rule: str
    reason: str


# ------------------------------ Tasks ------------------------------------
class TaskCreateRequest(BaseModel):
    scenario_id: str
    instruction: str


class TaskRunRequest(BaseModel):
    """Full pipeline result computed on the client, persisted server-side.

    Only sanitized data is accepted — raw sensitive values are never sent.
    """
    scenario_id: str
    instruction: str
    perception: dict[str, Any]
    entities: list[dict[str, Any]]
    compiled: dict[str, Any]
    stats: dict[str, Any]
    action: dict[str, Any]
    policy: dict[str, Any]
    timings: list[dict[str, Any]]
    total_ms: int
    transmitted_payload: dict[str, Any]
    baseline_bytes: int
    sanitized_bytes: int


class TaskOut(BaseModel):
    id: str
    scenario_id: str
    instruction: str
    stage: str
    status: str
    total_ms: int
    created_at: datetime

    class Config:
        from_attributes = True


class AuditEventOut(BaseModel):
    id: str
    task_id: Optional[str]
    ts: datetime
    category: str
    code: str
    message: str
    ok: bool
    meta: dict[str, Any]

    class Config:
        from_attributes = True


class BenchmarkRunOut(BaseModel):
    id: str
    label: str
    system: str
    scenario_id: str
    visual_context_accuracy: float
    pii_precision: float
    pii_recall: float
    redaction_precision: float
    client_cpu_pct: float
    client_mem_mb: float
    e2e_latency_ms: float
    payload_bytes: int
    privacy_exposure: float
    sensitive_leaks: int
    task_success: float
    is_demo: bool

    class Config:
        from_attributes = True


class DashboardStats(BaseModel):
    privacy_score: float
    tasks_completed: int
    sensitive_blocked: int
    avg_latency_ms: float
    avg_context_reduction: float
    recent_tasks: list[TaskOut]
    recent_events: list[AuditEventOut]

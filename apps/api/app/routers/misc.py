"""Benchmarks, audit events, dashboard stats, scenarios, policy catalogue."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models import (
    AgentTask,
    AuditEvent,
    BenchmarkRun,
    CompiledContextRow,
    PolicyDecisionRow,
    SanitizationEvent,
    User,
)
from app.db.session import get_db
from app.schemas import (
    AuditEventOut,
    BenchmarkRunOut,
    DashboardStats,
    TaskOut,
)
from app.services import policy as policy_svc

router = APIRouter(tags=["misc"])


@router.get("/benchmarks", response_model=list[BenchmarkRunOut])
def benchmarks(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    runs = db.query(BenchmarkRun).order_by(BenchmarkRun.created_at.desc()).all()
    return [BenchmarkRunOut.model_validate(r) for r in runs]


@router.get("/audit-events", response_model=list[AuditEventOut])
def audit_events(
    category: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(AuditEvent).order_by(AuditEvent.ts.desc())
    if category and category.upper() != "ALL":
        q = q.filter(AuditEvent.category == category.upper())
    return [AuditEventOut.model_validate(e) for e in q.limit(limit).all()]


@router.get("/policy/catalogue")
def policy_catalogue(_: User = Depends(get_current_user)):
    return [{"name": n, "decision": d, "reason": r} for n, d, r in policy_svc.CATALOGUE]


@router.get("/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    completed = db.query(AgentTask).filter(AgentTask.status == "completed").count()
    blocked_events = db.query(SanitizationEvent).all()
    sensitive_blocked = sum(e.critical_blocked for e in blocked_events)

    tasks = db.query(AgentTask).filter(AgentTask.total_ms > 0).all()
    avg_latency = round(sum(t.total_ms for t in tasks) / len(tasks), 1) if tasks else 0.0

    comps = db.query(CompiledContextRow).all()
    avg_reduction = round(sum(c.reduction_pct for c in comps) / len(comps), 1) if comps else 0.0

    total_decisions = db.query(PolicyDecisionRow).count()
    blocks = db.query(PolicyDecisionRow).filter(PolicyDecisionRow.decision == "BLOCK").count()
    # Privacy score: blend of context reduction and block ratio.
    privacy_score = round(min(100.0, 0.5 * avg_reduction + 50 * (1 if total_decisions == 0 else (blocks + 1) / (total_decisions + 1) + 0.4)), 1)
    privacy_score = min(privacy_score, 99.0)

    recent_tasks = db.query(AgentTask).order_by(AgentTask.created_at.desc()).limit(6).all()
    recent_events = db.query(AuditEvent).order_by(AuditEvent.ts.desc()).limit(8).all()

    return DashboardStats(
        privacy_score=privacy_score,
        tasks_completed=completed,
        sensitive_blocked=sensitive_blocked,
        avg_latency_ms=avg_latency,
        avg_context_reduction=avg_reduction,
        recent_tasks=[TaskOut.model_validate(t) for t in recent_tasks],
        recent_events=[AuditEventOut.model_validate(e) for e in recent_events],
    )

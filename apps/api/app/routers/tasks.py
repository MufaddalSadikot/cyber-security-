"""Task routes: list, create, get, run (persist pipeline result), events."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.models import (
    AgentActionRow,
    AgentTask,
    AuditEvent,
    CompiledContextRow,
    PolicyDecisionRow,
    SanitizationEvent,
    SensitiveEntityRow,
    User,
    WebPageContext,
)
from app.db.session import get_db
from app.schemas import (
    AuditEventOut,
    TaskCreateRequest,
    TaskOut,
    TaskRunRequest,
)

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=list[TaskOut])
def list_tasks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(AgentTask).order_by(AgentTask.created_at.desc())
    if user.role != "admin":
        q = q.filter(AgentTask.user_id == user.id)
    return [TaskOut.model_validate(t) for t in q.limit(100).all()]


@router.post("", response_model=TaskOut, status_code=201)
def create_task(body: TaskCreateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = AgentTask(user_id=user.id, scenario_id=body.scenario_id, instruction=body.instruction)
    db.add(task)
    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return TaskOut.model_validate(task)


@router.get("/{task_id}/events", response_model=list[AuditEventOut])
def task_events(task_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    evs = db.query(AuditEvent).filter(AuditEvent.task_id == task_id).order_by(AuditEvent.ts).all()
    return [AuditEventOut.model_validate(e) for e in evs]


@router.post("/{task_id}/run", response_model=TaskOut)
def run_task(task_id: str, body: TaskRunRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Persist a completed pipeline run (computed on-device).

    Accepts only sanitized data: entity placeholders/metadata, compiled context,
    action, policy decision, timings. Raw sensitive values are never accepted.
    """
    task = db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    decision = (body.policy or {}).get("decision", "ALLOW")
    task.stage = "BLOCKED" if decision == "BLOCK" else "COMPLETED"
    task.status = "blocked" if decision == "BLOCK" else "completed"
    task.total_ms = body.total_ms

    perception = body.perception or {}
    pc = WebPageContext(
        task_id=task.id,
        url=perception.get("url", ""),
        title=perception.get("title", ""),
        page_type=perception.get("pageType", ""),
        element_count=len(perception.get("elements", [])),
        raw_char_count=(body.stats or {}).get("rawChars", 0),
        elements=perception.get("elements", []),
    )
    db.add(pc)
    db.flush()

    critical = 0
    for e in body.entities:
        if e.get("value"):
            e = {**e, "value": None}  # never persist raw value
        if e.get("sensitivity") == "CRITICAL":
            critical += 1
        db.add(SensitiveEntityRow(
            page_context_id=pc.id, type=e.get("type", ""),
            placeholder=e.get("placeholder", ""), confidence=e.get("confidence", 0.0),
            sensitivity=e.get("sensitivity", ""), action=e.get("action", ""),
            element_id=e.get("elementId") or e.get("element_id"),
            reason=e.get("reason", ""), detector=e.get("detector", ""),
        ))

    db.add(SanitizationEvent(
        task_id=task.id, entities_detected=len(body.entities),
        entities_redacted=len([e for e in body.entities if e.get("action") != "KEEP"]),
        critical_blocked=critical,
    ))

    stats = body.stats or {}
    db.add(CompiledContextRow(
        task_id=task.id, intent=(body.compiled or {}).get("intent", ""),
        payload=body.transmitted_payload, raw_chars=stats.get("rawChars", 0),
        compiled_chars=stats.get("compiledChars", 0), reduction_pct=stats.get("reductionPct", 0.0),
    ))

    a = body.action or {}
    executed = decision == "ALLOW"
    db.add(AgentActionRow(
        task_id=task.id, type=a.get("type", ""), target_id=a.get("targetId") or a.get("target_id"),
        target_label=a.get("targetLabel") or a.get("target_label"),
        rationale=a.get("rationale", ""), executed=executed,
    ))

    p = body.policy or {}
    db.add(PolicyDecisionRow(
        task_id=task.id, decision=p.get("decision", ""), rule=p.get("rule", ""),
        reason=p.get("reason", ""),
    ))

    # Persist the audit trail derived from timings/stages.
    now = datetime.now(timezone.utc)
    audit_specs = [
        ("PRIVACY", "LOCAL_PERCEPTION", f"Perceived {pc.element_count} elements", True),
        ("PRIVACY", "PII_DETECTION", f"{len(body.entities)} sensitive entities detected", True),
        ("PRIVACY", "REDACTION", f"{len(body.entities)} entities sanitized locally", True),
        ("AI", "CONTEXT_COMPILATION", f"Context reduced {stats.get('reductionPct', 0)}%", True),
        ("AI", "SERVER_REQUEST", "Sanitized context transmitted (no raw PII)", True),
        ("ACTION", "ACTION_POLICY", f"{p.get('decision', '')}: {a.get('type', '')} ({p.get('rule','')})", decision != "BLOCK"),
        ("ACTION", "BROWSER_EXECUTION", "Action executed" if executed else f"Action {decision.lower()} — not executed", executed),
    ]
    for cat, code, msg, ok in audit_specs:
        db.add(AuditEvent(task_id=task.id, user_id=user.id, ts=now, category=cat, code=code, message=msg, ok=ok))

    db.commit()
    db.refresh(task)
    return TaskOut.model_validate(task)

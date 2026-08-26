"""Agent reasoning + action validation + context compilation routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.ai import get_ai_provider
from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.schemas import (
    AgentActionOut,
    CompileRequest,
    CompileResponse,
    PolicyDecisionOut,
    ReasonRequest,
    ReasonResponse,
    ValidateActionRequest,
)
from app.services import policy
from app.services.compiler import compile_context

router = APIRouter(tags=["agent"], dependencies=[Depends(rate_limit)])


@router.post("/context/compile", response_model=CompileResponse)
def context_compile(body: CompileRequest, _=Depends(get_current_user)) -> CompileResponse:
    compiled, stats = compile_context(body.task, body.perception, body.entities)
    return CompileResponse(compiled=compiled, stats=stats)


@router.post("/agent/reason", response_model=ReasonResponse)
def agent_reason(body: ReasonRequest, _=Depends(get_current_user)) -> ReasonResponse:
    provider = get_ai_provider()
    out = provider.reason(body.task, body.scenario_id, body.compiled_context)
    a = out["action"]
    return ReasonResponse(
        action=AgentActionOut(
            type=a["type"], target_id=a.get("target_id"),
            target_label=a.get("target_label"), value=a.get("value"),
            rationale=a.get("rationale", ""),
        ),
        provider=provider.name,
        result_summary=out.get("result_summary", ""),
    )


@router.post("/agent/action/validate", response_model=PolicyDecisionOut)
def validate_action(body: ValidateActionRequest, _=Depends(get_current_user)) -> PolicyDecisionOut:
    d = policy.evaluate(body.action, body.entities, body.elements)
    return PolicyDecisionOut(**d)

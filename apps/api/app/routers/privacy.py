"""Privacy engine routes: analyze + sanitize."""
from __future__ import annotations

from collections import Counter

from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.core.rate_limit import rate_limit
from app.schemas import AnalyzeRequest, AnalyzeResponse, SensitiveEntityOut
from app.services import privacy

router = APIRouter(prefix="/privacy", tags=["privacy"], dependencies=[Depends(rate_limit)])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(body: AnalyzeRequest, _=Depends(get_current_user)) -> AnalyzeResponse:
    els = [e.model_dump() for e in body.elements]
    result = privacy.analyze(body.text, els)
    counts = Counter(e["type"] for e in result["entities"])
    entities = [
        SensitiveEntityOut(
            id=e["id"], type=e["type"], placeholder=e["placeholder"],
            confidence=e["confidence"], sensitivity=e["sensitivity"], action=e["action"],
            element_id=e.get("element_id"), reason=e["reason"], detector=e["detector"],
        )
        for e in result["entities"]
    ]
    return AnalyzeResponse(entities=entities, sanitized_text=result["sanitized_text"], counts=dict(counts))


@router.post("/sanitize", response_model=AnalyzeResponse)
def sanitize(body: AnalyzeRequest, _=Depends(get_current_user)) -> AnalyzeResponse:
    # Same computation; distinct endpoint kept for API clarity.
    return analyze(body, _)

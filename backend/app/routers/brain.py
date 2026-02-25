"""
AI Brain Router — Knowledge gaps, visitor profiles, health scoring.
The admin interface into TinyEclipse's intelligence.
"""
from __future__ import annotations
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.knowledge_gap import KnowledgeGap, GapStatus, GapCategory
from app.services.brain import (
    get_knowledge_health,
    resolve_gap,
    get_visitor_profiles,
    get_visitor_detail,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/brain", tags=["brain"])


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE HEALTH
# ═══════════════════════════════════════════════════════════════

@router.get("/health/{tenant_id}")
async def brain_health(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get AI knowledge health score and self-improvement suggestions."""
    return await get_knowledge_health(db, uuid.UUID(tenant_id))


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE GAPS
# ═══════════════════════════════════════════════════════════════

@router.get("/gaps/{tenant_id}")
async def list_gaps(
    tenant_id: str,
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
):
    """List knowledge gaps for a tenant."""
    tid = uuid.UUID(tenant_id)
    query = select(KnowledgeGap).where(KnowledgeGap.tenant_id == tid)

    if status:
        query = query.where(KnowledgeGap.status == status)
    if category:
        query = query.where(KnowledgeGap.category == category)

    # Total count
    count_query = select(func.count(KnowledgeGap.id)).where(KnowledgeGap.tenant_id == tid)
    if status:
        count_query = count_query.where(KnowledgeGap.status == status)
    if category:
        count_query = count_query.where(KnowledgeGap.category == category)
    total = (await db.execute(count_query)).scalar() or 0

    result = await db.execute(
        query.order_by(desc(KnowledgeGap.frequency), desc(KnowledgeGap.last_asked_at))
        .limit(limit).offset(offset)
    )
    gaps = result.scalars().all()

    return {
        "total": total,
        "gaps": [
            {
                "id": str(g.id),
                "question": g.question,
                "category": g.category.value if g.category else "other",
                "status": g.status.value if g.status else "open",
                "frequency": g.frequency,
                "avg_confidence": round(g.avg_confidence, 3),
                "escalated": g.escalated,
                "resolved_answer": g.resolved_answer,
                "last_asked_at": g.last_asked_at.isoformat() if g.last_asked_at else None,
                "created_at": g.created_at.isoformat() if g.created_at else None,
            }
            for g in gaps
        ],
    }


class ResolveGapRequest(BaseModel):
    answer: str
    resolved_by: str = "admin"
    create_source: bool = True


@router.post("/gaps/{gap_id}/resolve")
async def resolve_gap_endpoint(
    gap_id: str,
    body: ResolveGapRequest,
    db: AsyncSession = Depends(get_db),
):
    """Resolve a knowledge gap by providing the answer."""
    result = await resolve_gap(
        db=db,
        gap_id=uuid.UUID(gap_id),
        answer=body.answer,
        resolved_by=body.resolved_by,
        create_source=body.create_source,
    )
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    await db.commit()
    return result


@router.post("/gaps/{gap_id}/dismiss")
async def dismiss_gap(gap_id: str, db: AsyncSession = Depends(get_db)):
    """Dismiss a knowledge gap (not relevant)."""
    gap = await db.get(KnowledgeGap, uuid.UUID(gap_id))
    if not gap:
        raise HTTPException(status_code=404, detail="Gap not found")
    gap.status = GapStatus.dismissed.value
    await db.commit()
    return {"status": "dismissed"}


# ═══════════════════════════════════════════════════════════════
# VISITOR PROFILES
# ═══════════════════════════════════════════════════════════════

@router.get("/visitors/{tenant_id}")
async def list_visitors(
    tenant_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    sort: str = Query("last_seen_at"),
    db: AsyncSession = Depends(get_db),
):
    """List visitor profiles for a tenant."""
    return await get_visitor_profiles(
        db=db,
        tenant_id=uuid.UUID(tenant_id),
        limit=limit,
        offset=offset,
        sort_by=sort,
    )


@router.get("/visitors/{tenant_id}/{profile_id}")
async def visitor_detail(
    tenant_id: str,
    profile_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get detailed visitor profile with conversations and sessions."""
    result = await get_visitor_detail(
        db=db,
        tenant_id=uuid.UUID(tenant_id),
        profile_id=uuid.UUID(profile_id),
    )
    if not result:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return result


# ═══════════════════════════════════════════════════════════════
# SELF-IMPROVEMENT REPORT
# ═══════════════════════════════════════════════════════════════

@router.get("/self-report/{tenant_id}")
async def self_improvement_report(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Generate the AI's self-improvement report.

    This is what the AI would say if asked: 'What do you need to get smarter?'
    """
    tid = uuid.UUID(tenant_id)
    health = await get_knowledge_health(db, tid)

    # Build the AI's self-assessment
    report = {
        "health_score": health["health_score"],
        "grade": _score_to_grade(health["health_score"]),
        "summary": _build_summary(health),
        "knowledge_status": {
            "sources": health["sources"],
            "embeddings": health["embeddings"],
            "coverage": "goed" if health["sources"] >= 10 else "matig" if health["sources"] >= 3 else "onvoldoende",
        },
        "learning_status": {
            "conversations_analyzed": health["conversations_30d"],
            "avg_confidence": health["avg_confidence"],
            "escalation_rate": health["escalation_rate"],
            "open_gaps": health["open_gaps"],
            "resolved_gaps": health["resolved_gaps"],
        },
        "what_i_need": health["suggestions"],
        "top_blind_spots": health["top_gaps"][:5],
        "category_weaknesses": health["category_distribution"],
    }

    return report


def _score_to_grade(score: int) -> str:
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B"
    elif score >= 60:
        return "C"
    elif score >= 50:
        return "D"
    return "F"


def _build_summary(health: dict) -> str:
    score = health["health_score"]
    gaps = health["open_gaps"]
    conf = health["avg_confidence"]

    if score >= 80:
        base = "Ik functioneer goed en kan de meeste vragen beantwoorden."
    elif score >= 60:
        base = "Ik kan veel vragen beantwoorden, maar heb nog blinde vlekken."
    elif score >= 40:
        base = "Ik heb meer kennis nodig om bezoekers goed te helpen."
    else:
        base = "Mijn kennisbasis is nog beperkt. Ik heb dringend meer informatie nodig."

    details = []
    if gaps > 0:
        details.append(f"Er zijn {gaps} vragen die ik niet goed kon beantwoorden.")
    if conf < 0.5:
        details.append("Mijn gemiddelde zekerheid is laag — meer context zou me helpen.")
    if health["sources"] < 5:
        details.append("Voeg meer kennisbronnen toe (producten, FAQ, bedrijfsinfo).")

    return base + " " + " ".join(details)


# ═══════════════════════════════════════════════════════════════
# SELF-REVIEW STATS
# ═══════════════════════════════════════════════════════════════

@router.get("/self-review/{tenant_id}")
async def self_review_stats(
    tenant_id: str,
    days: int = Query(30, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated AI self-review statistics — how well is the AI performing?"""
    from app.services.self_review import get_self_review_stats
    return await get_self_review_stats(db, uuid.UUID(tenant_id), days)

"""
Self-Learning API — Shows shop admins how the AI learns from conversations.
Combines learning stats, cached Q&A pairs, knowledge gaps, and health scoring.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.models.tenant import Tenant
from app.models.source import Source, SourceType, SourceStatus
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.knowledge_gap import KnowledgeGap, GapStatus

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/self-learning", tags=["portal-self-learning"])


async def _tenant(tenant_id: str, db: AsyncSession) -> Tenant:
    return await get_tenant_safe(db, tenant_id)


@router.get("/{tenant_id}")
async def get_self_learning_dashboard(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Complete self-learning overview for shop admins."""
    tenant = await _tenant(tenant_id, db)
    tid = tenant.id
    now = datetime.now(timezone.utc)
    month_ago = now - timedelta(days=30)
    week_ago = now - timedelta(days=7)

    # ── Learned Q&A pairs (sources created by the learning loop) ──
    learned_sources_result = await db.execute(
        select(Source)
        .where(and_(
            Source.tenant_id == tid,
            Source.title.like("[AI Learned]%"),
        ))
        .order_by(desc(Source.created_at))
        .limit(50)
    )
    learned_sources = learned_sources_result.scalars().all()

    learned_total = len(learned_sources)
    learned_this_week = sum(1 for s in learned_sources if s.created_at and s.created_at >= week_ago)
    learned_this_month = sum(1 for s in learned_sources if s.created_at and s.created_at >= month_ago)

    # ── Resolved gaps (turned into knowledge) ──
    resolved_sources_result = await db.execute(
        select(Source)
        .where(and_(
            Source.tenant_id == tid,
            Source.title.like("[Resolved Gap]%"),
        ))
        .order_by(desc(Source.created_at))
        .limit(50)
    )
    resolved_sources = resolved_sources_result.scalars().all()

    # ── Knowledge gaps ──
    open_gaps_result = await db.execute(
        select(KnowledgeGap)
        .where(and_(KnowledgeGap.tenant_id == tid, KnowledgeGap.status == GapStatus.open.value))
        .order_by(desc(KnowledgeGap.frequency))
        .limit(20)
    )
    open_gaps = open_gaps_result.scalars().all()

    resolved_gaps_count = (await db.execute(
        select(func.count(KnowledgeGap.id))
        .where(and_(KnowledgeGap.tenant_id == tid, KnowledgeGap.status == GapStatus.resolved.value))
    )).scalar() or 0

    # ── Conversation stats (30 days) ──
    conv_count = (await db.execute(
        select(func.count(Conversation.id))
        .where(and_(Conversation.tenant_id == tid, Conversation.created_at >= month_ago))
    )).scalar() or 0

    # ── Confidence trend ──
    avg_conf = (await db.execute(
        select(func.avg(Message.confidence))
        .where(and_(
            Message.tenant_id == tid,
            Message.role == MessageRole.assistant,
            Message.confidence.isnot(None),
            Message.created_at >= month_ago,
        ))
    )).scalar() or 0

    avg_conf_prev = (await db.execute(
        select(func.avg(Message.confidence))
        .where(and_(
            Message.tenant_id == tid,
            Message.role == MessageRole.assistant,
            Message.confidence.isnot(None),
            Message.created_at >= month_ago - timedelta(days=30),
            Message.created_at < month_ago,
        ))
    )).scalar() or 0

    confidence_trend = round((avg_conf - avg_conf_prev) * 100, 1) if avg_conf_prev else 0

    # ── Total knowledge sources ──
    total_sources = (await db.execute(
        select(func.count(Source.id))
        .where(and_(Source.tenant_id == tid, Source.status == SourceStatus.indexed))
    )).scalar() or 0

    # ── Escalation rate ──
    escalated = (await db.execute(
        select(func.count(Message.id))
        .where(and_(
            Message.tenant_id == tid,
            Message.escalated == True,
            Message.created_at >= month_ago,
        ))
    )).scalar() or 0

    total_responses = (await db.execute(
        select(func.count(Message.id))
        .where(and_(
            Message.tenant_id == tid,
            Message.role == MessageRole.assistant,
            Message.created_at >= month_ago,
        ))
    )).scalar() or 1

    escalation_rate = round(escalated / max(total_responses, 1) * 100, 1)

    # ── AI Growth score (how much has the AI improved?) ──
    growth_score = min(100, round(
        min(50, learned_total * 5) +  # Up to 50 for learned items
        min(30, resolved_gaps_count * 3) +  # Up to 30 for resolved gaps
        min(20, total_sources * 2)  # Up to 20 for total knowledge
    ))

    # ── Build response ──
    return {
        "growth_score": growth_score,
        "confidence": {
            "current": round(avg_conf * 100, 1) if avg_conf else 0,
            "trend": confidence_trend,
            "label": "Stijgend" if confidence_trend > 0 else "Dalend" if confidence_trend < 0 else "Stabiel",
        },
        "stats": {
            "conversations_30d": conv_count,
            "total_knowledge_sources": total_sources,
            "learned_qa_total": learned_total,
            "learned_qa_this_week": learned_this_week,
            "learned_qa_this_month": learned_this_month,
            "resolved_gaps": resolved_gaps_count,
            "open_gaps": len(open_gaps),
            "escalation_rate": escalation_rate,
        },
        "learned_items": [
            {
                "id": str(s.id),
                "title": s.title.replace("[AI Learned] ", ""),
                "content": s.content[:300] if s.content else "",
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "status": s.status.value if hasattr(s.status, "value") else str(s.status),
            }
            for s in learned_sources[:20]
        ],
        "resolved_items": [
            {
                "id": str(s.id),
                "title": s.title.replace("[Resolved Gap] ", ""),
                "content": s.content[:300] if s.content else "",
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in resolved_sources[:10]
        ],
        "open_gaps": [
            {
                "id": str(g.id),
                "question": g.question,
                "category": g.category if isinstance(g.category, str) else (g.category.value if hasattr(g.category, "value") else str(g.category)),
                "frequency": g.frequency,
                "avg_confidence": round(g.avg_confidence * 100, 1),
                "escalated": g.escalated,
                "last_asked_at": g.last_asked_at.isoformat() if g.last_asked_at else None,
            }
            for g in open_gaps
        ],
    }

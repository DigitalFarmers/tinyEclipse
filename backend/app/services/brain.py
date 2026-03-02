"""
TinyEclipse AI Brain Service
The intelligence layer that makes TinyEclipse smarter with every interaction.

Responsibilities:
1. Knowledge health scoring — how well does the AI know this tenant?
2. Gap management — persist, deduplicate, categorize knowledge gaps
3. Visitor profiling — build and maintain persistent visitor profiles
4. Self-improvement report — what does the AI need to get smarter?
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from sqlalchemy import select, and_, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.knowledge_gap import KnowledgeGap, GapStatus, GapCategory, VisitorProfile
from app.models.source import Source, SourceType, SourceStatus
from app.models.embedding import Embedding
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, MessageRole
from app.models.visitor import VisitorSession, PageView
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════
# GAP CATEGORIZATION
# ═══════════════════════════════════════════════════════════════

CATEGORY_KEYWORDS = {
    GapCategory.product: ["product", "artikel", "chocolade", "assortiment", "smaak", "ingrediënt", "item", "collectie"],
    GapCategory.pricing: ["prijs", "kosten", "tarief", "price", "cost", "euro", "korting", "aanbieding", "discount"],
    GapCategory.shipping: ["levering", "verzending", "shipping", "bezorg", "delivery", "track", "pakket"],
    GapCategory.returns: ["retour", "terugsturen", "return", "ruil", "omruil", "geld terug", "refund"],
    GapCategory.hours: ["openingstijd", "geopend", "gesloten", "open", "dicht", "uur", "hours", "wanneer"],
    GapCategory.contact: ["contact", "telefoon", "email", "adres", "bellen", "bereikbaar", "locatie"],
    GapCategory.process: ["bestelling", "bestellen", "order", "account", "registreren", "betalen", "betaling"],
    GapCategory.technical: ["website", "error", "fout", "laden", "werkt niet", "bug", "pagina"],
    GapCategory.policy: ["voorwaarden", "privacy", "garantie", "beleid", "terms", "policy"],
}


def categorize_question(question: str) -> str:
    """Auto-categorize a question based on keywords."""
    q = question.lower()
    scores = {}
    for cat, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in q)
        if score > 0:
            scores[cat] = score
    if scores:
        best = max(scores, key=scores.get)
        return best.value
    return GapCategory.other.value


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE GAP MANAGEMENT
# ═══════════════════════════════════════════════════════════════

async def persist_knowledge_gap(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    question: str,
    confidence: float,
    escalated: bool,
    conversation_id: Optional[uuid.UUID] = None,
) -> KnowledgeGap:
    """Store or update a knowledge gap. Deduplicates by fuzzy matching."""
    # Normalize for matching
    q_normalized = question.strip().lower()[:200]

    # Check for existing similar gap (simple substring match on first 80 chars)
    existing_result = await db.execute(
        select(KnowledgeGap)
        .where(and_(
            KnowledgeGap.tenant_id == tenant_id,
            KnowledgeGap.status.in_([GapStatus.open.value, GapStatus.in_progress.value]),
            func.lower(func.left(KnowledgeGap.question, 80)).contains(q_normalized[:60]),
        ))
        .limit(1)
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        # Increment frequency and update
        existing.frequency += 1
        existing.last_asked_at = datetime.now(timezone.utc)
        existing.avg_confidence = (existing.avg_confidence * (existing.frequency - 1) + confidence) / existing.frequency
        if not existing.sample_conversation_id and conversation_id:
            existing.sample_conversation_id = conversation_id
        await db.flush()
        return existing

    # Create new gap
    gap = KnowledgeGap(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        question=question[:1000],
        category=categorize_question(question),
        status=GapStatus.open.value,
        frequency=1,
        avg_confidence=confidence,
        escalated=escalated,
        sample_conversation_id=conversation_id,
    )
    db.add(gap)
    await db.flush()
    logger.info(f"[brain] New knowledge gap for tenant {tenant_id}: {question[:80]}...")

    try:
        from app.services.event_bus import emit
        await emit(db, domain="ai", action="knowledge_gap_new", title=f"New gap: {question[:120]}", severity="warning", tenant_id=tenant_id, source="brain", data={"category": gap.category, "confidence": confidence, "escalated": escalated})
    except Exception:
        pass

    return gap


async def resolve_gap(
    db: AsyncSession,
    gap_id: uuid.UUID,
    answer: str,
    resolved_by: str = "admin",
    create_source: bool = True,
) -> dict:
    """Resolve a knowledge gap by adding the answer to the knowledge base."""
    gap = await db.get(KnowledgeGap, gap_id)
    if not gap:
        return {"error": "Gap not found"}

    gap.status = GapStatus.resolved.value
    gap.resolved_by = resolved_by
    gap.resolved_answer = answer
    gap.updated_at = datetime.now(timezone.utc)

    result = {"gap_id": str(gap.id), "status": "resolved"}

    # Optionally create a knowledge source from the answer
    if create_source and answer.strip():
        from app.services.embeddings import ingest_source

        source = Source(
            id=uuid.uuid4(),
            tenant_id=gap.tenant_id,
            type=SourceType.faq,
            title=f"[Resolved Gap] {gap.question[:200]}",
            content=f"Vraag: {gap.question}\n\nAntwoord: {answer}",
            status=SourceStatus.pending,
        )
        db.add(source)
        await db.flush()

        try:
            chunks = await ingest_source(db, source)
            gap.source_id = source.id
            result["source_id"] = str(source.id)
            result["chunks_indexed"] = chunks
        except Exception as e:
            logger.error(f"[brain] Failed to ingest resolved gap answer: {e}")

    try:
        from app.services.event_bus import emit
        await emit(db, domain="ai", action="knowledge_gap_resolved", title=f"Gap resolved: {gap.question[:120]}", severity="success", tenant_id=gap.tenant_id, source="brain", data={"gap_id": str(gap.id), "resolved_by": resolved_by, "source_created": "source_id" in result})
    except Exception:
        pass

    await db.flush()
    return result


# ═══════════════════════════════════════════════════════════════
# KNOWLEDGE HEALTH SCORING
# ═══════════════════════════════════════════════════════════════

async def get_knowledge_health(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    """Calculate the AI's knowledge health score for a tenant.

    Returns a comprehensive health report with scores and recommendations.
    """
    tid = tenant_id

    # Count knowledge sources
    source_count = (await db.execute(
        select(func.count(Source.id)).where(and_(Source.tenant_id == tid, Source.status == SourceStatus.indexed))
    )).scalar() or 0

    # Count embeddings (chunks)
    embedding_count = (await db.execute(
        select(func.count(Embedding.id)).where(Embedding.tenant_id == tid)
    )).scalar() or 0

    # Count open gaps
    open_gaps = (await db.execute(
        select(func.count(KnowledgeGap.id)).where(and_(KnowledgeGap.tenant_id == tid, KnowledgeGap.status == GapStatus.open.value))
    )).scalar() or 0

    # Count resolved gaps
    resolved_gaps = (await db.execute(
        select(func.count(KnowledgeGap.id)).where(and_(KnowledgeGap.tenant_id == tid, KnowledgeGap.status == GapStatus.resolved.value))
    )).scalar() or 0

    # Top recurring gaps (most frequently asked unanswered questions)
    top_gaps_result = await db.execute(
        select(KnowledgeGap)
        .where(and_(KnowledgeGap.tenant_id == tid, KnowledgeGap.status == GapStatus.open.value))
        .order_by(desc(KnowledgeGap.frequency))
        .limit(10)
    )
    top_gaps = top_gaps_result.scalars().all()

    # Conversation stats (last 30 days)
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    conv_count = (await db.execute(
        select(func.count(Conversation.id)).where(and_(
            Conversation.tenant_id == tid, Conversation.created_at >= month_ago
        ))
    )).scalar() or 0

    # Average confidence (last 30 days)
    avg_conf_result = await db.execute(
        select(func.avg(Message.confidence)).where(and_(
            Message.tenant_id == tid,
            Message.role == MessageRole.assistant,
            Message.confidence.isnot(None),
            Message.created_at >= month_ago,
        ))
    )
    avg_confidence = avg_conf_result.scalar() or 0

    # Escalation rate
    escalated_count = (await db.execute(
        select(func.count(Message.id)).where(and_(
            Message.tenant_id == tid,
            Message.escalated == True,
            Message.created_at >= month_ago,
        ))
    )).scalar() or 0

    total_responses = (await db.execute(
        select(func.count(Message.id)).where(and_(
            Message.tenant_id == tid,
            Message.role == MessageRole.assistant,
            Message.created_at >= month_ago,
        ))
    )).scalar() or 1

    escalation_rate = escalated_count / max(total_responses, 1)

    # Gap categories distribution
    category_dist_result = await db.execute(
        select(KnowledgeGap.category, func.count(KnowledgeGap.id))
        .where(and_(KnowledgeGap.tenant_id == tid, KnowledgeGap.status == GapStatus.open.value))
        .group_by(KnowledgeGap.category)
    )
    category_dist = {row[0]: row[1] for row in category_dist_result.all()}

    # ── Calculate health score (0-100) ──
    # Factors: source coverage, confidence, escalation rate, gap resolution
    source_score = min(100, source_count * 5)  # 20 sources = 100
    confidence_score = avg_confidence * 100 if avg_confidence else 0
    escalation_score = max(0, 100 - escalation_rate * 500)  # 0% = 100, 20% = 0
    gap_resolution_score = (resolved_gaps / max(resolved_gaps + open_gaps, 1)) * 100

    health_score = round(
        source_score * 0.25 +
        confidence_score * 0.35 +
        escalation_score * 0.25 +
        gap_resolution_score * 0.15
    )

    # ── Self-improvement suggestions ──
    suggestions = []
    if source_count < 5:
        suggestions.append({
            "priority": "high",
            "action": "add_knowledge",
            "message": "De AI heeft nog maar weinig kennisbronnen. Voeg productinfo, FAQ's en bedrijfsinformatie toe.",
        })
    if open_gaps > 5:
        suggestions.append({
            "priority": "high",
            "action": "resolve_gaps",
            "message": f"Er zijn {open_gaps} onbeantwoorde vragen. Los de meest gestelde eerst op.",
        })
    if avg_confidence < 0.6 and conv_count > 5:
        suggestions.append({
            "priority": "high",
            "action": "improve_context",
            "message": "De AI antwoordt met lage zekerheid. Voeg meer gedetailleerde informatie toe over je producten en diensten.",
        })
    if escalation_rate > 0.15:
        suggestions.append({
            "priority": "medium",
            "action": "reduce_escalations",
            "message": f"Escalatiepercentage is {escalation_rate:.0%}. Voeg antwoorden toe voor veelgestelde vragen.",
        })
    if not suggestions:
        suggestions.append({
            "priority": "low",
            "action": "maintain",
            "message": "De AI presteert goed! Blijf kennisbronnen up-to-date houden.",
        })

    return {
        "health_score": health_score,
        "sources": source_count,
        "embeddings": embedding_count,
        "open_gaps": open_gaps,
        "resolved_gaps": resolved_gaps,
        "conversations_30d": conv_count,
        "avg_confidence": round(avg_confidence, 3) if avg_confidence else 0,
        "escalation_rate": round(escalation_rate, 3),
        "category_distribution": category_dist,
        "top_gaps": [
            {
                "id": str(g.id),
                "question": g.question,
                "category": g.category if g.category else "other",
                "frequency": g.frequency,
                "avg_confidence": round(g.avg_confidence, 3),
                "escalated": g.escalated,
                "last_asked_at": g.last_asked_at.isoformat() if g.last_asked_at else None,
            }
            for g in top_gaps
        ],
        "suggestions": suggestions,
    }


# ═══════════════════════════════════════════════════════════════
# VISITOR PROFILE MANAGEMENT
# ═══════════════════════════════════════════════════════════════

async def upsert_visitor_profile(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    visitor_id: str,
    session_data: Optional[dict] = None,
) -> VisitorProfile:
    """Create or update a visitor profile. Called on every session/pageview."""
    # Find existing profile
    result = await db.execute(
        select(VisitorProfile).where(and_(
            VisitorProfile.tenant_id == tenant_id,
            VisitorProfile.visitor_id == visitor_id,
        ))
    )
    profile = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    sd = session_data or {}

    if profile:
        # Update existing profile
        profile.total_sessions += 1
        profile.last_seen_at = now

        # Enrich identity if new data available
        if sd.get("name") and not profile.name:
            profile.name = sd["name"]
        if sd.get("email") and not profile.email:
            profile.email = sd["email"]
        if sd.get("phone") and not profile.phone:
            profile.phone = sd["phone"]

        # Update journey snapshot (keep last 20 pages)
        journey = profile.journey or {}
        last_pages = journey.get("last_pages", [])
        if sd.get("landing_page"):
            last_pages.append({
                "url": sd["landing_page"],
                "ts": now.isoformat(),
            })
            journey["last_pages"] = last_pages[-20:]

        # Update tags/interests based on pages visited
        tags = set(journey.get("tags", []))
        if sd.get("landing_page"):
            page = sd["landing_page"].lower()
            if "product" in page or "shop" in page:
                tags.add("shopper")
            if "contact" in page:
                tags.add("contact_seeker")
            if "faq" in page or "help" in page:
                tags.add("help_seeker")
            if "blog" in page or "news" in page:
                tags.add("content_reader")
        journey["tags"] = list(tags)[:20]
        profile.journey = journey

        # Recalculate scores
        days_active = max(1, (now - profile.first_seen_at).days)
        profile.loyalty_score = min(100, (profile.total_sessions / max(days_active, 1)) * 30 + profile.total_conversations * 10)
        profile.engagement_score = min(100, profile.total_pageviews * 2 + profile.total_conversations * 15 + profile.total_events * 0.5)

    else:
        # Create new profile
        profile = VisitorProfile(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            visitor_id=visitor_id,
            total_sessions=1,
            country=sd.get("country"),
            city=sd.get("city"),
            language=sd.get("language"),
            device_type=sd.get("device_type"),
            browser=sd.get("browser"),
            journey={"last_pages": [], "tags": [], "interests": []},
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(profile)

    await db.flush()
    return profile


async def get_visitor_profiles(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    sort_by: str = "last_seen_at",
) -> dict:
    """Get visitor profiles for a tenant with stats."""
    # Total count
    total = (await db.execute(
        select(func.count(VisitorProfile.id)).where(VisitorProfile.tenant_id == tenant_id)
    )).scalar() or 0

    # Sorting
    sort_col = getattr(VisitorProfile, sort_by, VisitorProfile.last_seen_at)
    profiles_result = await db.execute(
        select(VisitorProfile)
        .where(VisitorProfile.tenant_id == tenant_id)
        .order_by(desc(sort_col))
        .limit(limit)
        .offset(offset)
    )
    profiles = profiles_result.scalars().all()

    return {
        "total": total,
        "profiles": [
            {
                "id": str(p.id),
                "visitor_id": p.visitor_id,
                "name": p.name,
                "email": p.email,
                "phone": p.phone,
                "country": p.country,
                "city": p.city,
                "language": p.language,
                "device_type": p.device_type,
                "browser": p.browser,
                "total_sessions": p.total_sessions,
                "total_pageviews": p.total_pageviews,
                "total_conversations": p.total_conversations,
                "engagement_score": round(p.engagement_score, 1),
                "intent_score": round(p.intent_score, 1),
                "loyalty_score": round(p.loyalty_score, 1),
                "journey": p.journey,
                "first_seen_at": p.first_seen_at.isoformat() if p.first_seen_at else None,
                "last_seen_at": p.last_seen_at.isoformat() if p.last_seen_at else None,
            }
            for p in profiles
        ],
    }


async def get_visitor_detail(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    profile_id: uuid.UUID,
) -> Optional[dict]:
    """Get detailed visitor profile with conversation history."""
    profile = await db.get(VisitorProfile, profile_id)
    if not profile or profile.tenant_id != tenant_id:
        return None

    # Get conversations for this visitor
    convos_result = await db.execute(
        select(Conversation)
        .where(and_(
            Conversation.tenant_id == tenant_id,
            Conversation.session_id.in_(
                select(VisitorSession.session_id).where(and_(
                    VisitorSession.tenant_id == tenant_id,
                    VisitorSession.visitor_id == profile.visitor_id,
                ))
            ),
        ))
        .order_by(desc(Conversation.created_at))
        .limit(20)
    )
    conversations = convos_result.scalars().all()

    # Get recent sessions
    sessions_result = await db.execute(
        select(VisitorSession)
        .where(and_(
            VisitorSession.tenant_id == tenant_id,
            VisitorSession.visitor_id == profile.visitor_id,
        ))
        .order_by(desc(VisitorSession.created_at))
        .limit(20)
    )
    sessions = sessions_result.scalars().all()

    return {
        "profile": {
            "id": str(profile.id),
            "visitor_id": profile.visitor_id,
            "name": profile.name,
            "email": profile.email,
            "phone": profile.phone,
            "country": profile.country,
            "city": profile.city,
            "language": profile.language,
            "device_type": profile.device_type,
            "browser": profile.browser,
            "total_sessions": profile.total_sessions,
            "total_pageviews": profile.total_pageviews,
            "total_conversations": profile.total_conversations,
            "engagement_score": round(profile.engagement_score, 1),
            "intent_score": round(profile.intent_score, 1),
            "loyalty_score": round(profile.loyalty_score, 1),
            "journey": profile.journey,
            "first_seen_at": profile.first_seen_at.isoformat() if profile.first_seen_at else None,
            "last_seen_at": profile.last_seen_at.isoformat() if profile.last_seen_at else None,
        },
        "conversations": [
            {
                "id": str(c.id),
                "status": c.status.value,
                "message_count": len(c.messages) if c.messages else 0,
                "visitor_name": c.visitor_name,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "summary": (c.visitor_identity or {}).get("conversation_summary", {}).get("summary"),
            }
            for c in conversations
        ],
        "sessions": [
            {
                "id": str(s.id),
                "session_id": s.session_id,
                "landing_page": s.landing_page,
                "page_count": s.page_count,
                "duration_seconds": s.duration_seconds,
                "is_bounce": s.is_bounce,
                "chat_initiated": s.chat_initiated,
                "device_type": s.device_type,
                "country": s.country,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sessions
        ],
    }

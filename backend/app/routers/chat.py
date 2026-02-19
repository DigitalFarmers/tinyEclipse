"""
/api/chat — The Core Loop

INPUT → RETRIEVAL → RESPONSE → CONFIDENCE → LOG → ESCALATE
"""
import uuid
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.rate_limit import limiter
from app.models.consent import Consent
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, MessageRole
from app.models.tenant import Tenant, TenantStatus
from app.models.usage_log import UsageLog
from app.services.confidence import (
    calculate_confidence,
    should_escalate,
    should_refuse,
    ESCALATION_MESSAGE,
    REFUSE_MESSAGE,
)
from app.services.escalation import escalate_conversation
from app.services.llm import generate_response
from app.services.rag import retrieve_relevant_chunks, build_context
from app.models.monitor import MonitorCheck, Alert, CheckStatus
from app.models.module_event import ModuleEvent
from app.models.contact import Contact
from app.models.lead import Lead

logger = structlog.get_logger()
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    tenant_id: str
    session_id: str
    message: str
    channel: str = "widget"


class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    confidence: float
    escalated: bool
    sources: list[dict] = []


@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """Core chat endpoint — implements the full TinyEclipse loop."""

    tenant_uuid = uuid.UUID(body.tenant_id)

    # ─── [1] INPUT: Validate tenant ───
    tenant = await db.get(Tenant, tenant_uuid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status != TenantStatus.active:
        raise HTTPException(status_code=403, detail="Tenant is suspended")

    # ─── [1b] INPUT: Check consent ───
    consent_result = await db.execute(
        select(Consent)
        .where(Consent.tenant_id == tenant_uuid)
        .where(Consent.session_id == body.session_id)
        .where(Consent.accepted == True)
        .order_by(Consent.created_at.desc())
        .limit(1)
    )
    consent = consent_result.scalar_one_or_none()
    if not consent:
        raise HTTPException(
            status_code=451,
            detail="Consent required before using AI services",
        )

    # ─── Get or create conversation ───
    conv_result = await db.execute(
        select(Conversation)
        .where(Conversation.tenant_id == tenant_uuid)
        .where(Conversation.session_id == body.session_id)
        .where(Conversation.status == ConversationStatus.active)
        .order_by(Conversation.created_at.desc())
        .limit(1)
    )
    conversation = conv_result.scalar_one_or_none()

    if not conversation:
        conversation = Conversation(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            session_id=body.session_id,
            channel=body.channel,
        )
        db.add(conversation)
        await db.flush()

    # ─── Store user message ───
    user_msg = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        tenant_id=tenant_uuid,
        role=MessageRole.user,
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # ─── [2] RETRIEVAL: Vector search ───
    chunks = await retrieve_relevant_chunks(
        db=db,
        tenant_id=tenant_uuid,
        query=body.message,
        top_k=5,
    )
    context = build_context(chunks)

    # ─── Build conversation history ───
    history_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .where(Message.role != MessageRole.system)
        .order_by(Message.created_at)
    )
    history_messages = history_result.scalars().all()
    conversation_history = [
        {"role": m.role.value, "content": m.content}
        for m in history_messages[-10:]
    ]

    # ─── [2b] MONITORING: Gather site health context ───
    monitoring_context = None
    if tenant.plan in (tenant.plan.pro, tenant.plan.pro_plus):
        try:
            checks_result = await db.execute(
                select(MonitorCheck).where(MonitorCheck.tenant_id == tenant_uuid)
            )
            checks = checks_result.scalars().all()
            if checks:
                lines = [f"Site: {tenant.domain or 'unknown'}"]
                for c in checks:
                    status_icon = "✅" if c.last_status == CheckStatus.ok else "⚠️" if c.last_status == CheckStatus.warning else "❌"
                    lines.append(f"{status_icon} {c.check_type.value}: {c.last_status.value} (last check: {c.last_checked_at.isoformat() if c.last_checked_at else 'never'})")
                # Check for active alerts
                alerts_result = await db.execute(
                    select(Alert).where(Alert.tenant_id == tenant_uuid, Alert.resolved == False)
                )
                active_alerts = alerts_result.scalars().all()
                if active_alerts:
                    lines.append(f"\n⚠️ ACTIVE ALERTS ({len(active_alerts)}):")
                    for a in active_alerts[:5]:
                        lines.append(f"  - [{a.severity.value}] {a.title}")
                monitoring_context = "\n".join(lines)
        except Exception:
            pass  # Don't break chat if monitoring fails

    # ─── [2c] GEO/TIME CONTEXT: Location & time awareness ───
    geo_time_context = None
    try:
        import zoneinfo
        geo = tenant.geo_context or {}
        tz_name = geo.get("timezone", "Europe/Brussels")
        try:
            local_tz = zoneinfo.ZoneInfo(tz_name)
            local_now = datetime.now(local_tz)
        except Exception:
            local_now = datetime.utcnow()

        lines_gt = []
        # Time awareness
        day_nl = {"Monday": "maandag", "Tuesday": "dinsdag", "Wednesday": "woensdag", "Thursday": "donderdag", "Friday": "vrijdag", "Saturday": "zaterdag", "Sunday": "zondag"}
        lines_gt.append(f"Huidige lokale tijd: {local_now.strftime('%H:%M')} ({day_nl.get(local_now.strftime('%A'), local_now.strftime('%A'))} {local_now.strftime('%d/%m/%Y')})")
        if local_now.weekday() >= 5:
            lines_gt.append("Het is weekend.")
        if local_now.hour >= 22 or local_now.hour < 7:
            lines_gt.append("Het is nacht — de meeste winkels zijn gesloten.")
        elif local_now.hour >= 18:
            lines_gt.append("Het is avond.")

        # Location awareness
        if geo.get("neighborhood_description"):
            lines_gt.append(geo["neighborhood_description"])
        elif geo.get("city"):
            lines_gt.append(f"Dit bedrijf is gevestigd in {geo['city']}, {geo.get('country', '')}.")

        geo_time_context = "\n".join(lines_gt)
    except Exception:
        pass

    # ─── [2d] BUSINESS CONTEXT: Live data from module events ───
    business_context = None
    try:
        from datetime import timedelta
        from sqlalchemy import desc, func as sqlfunc
        week_ago = datetime.utcnow() - timedelta(days=7)

        # Recent orders
        orders_result = await db.execute(
            select(ModuleEvent)
            .where(ModuleEvent.tenant_id == tenant_uuid)
            .where(ModuleEvent.event_type.in_(["order_placed", "order_completed"]))
            .where(ModuleEvent.created_at >= week_ago)
            .order_by(desc(ModuleEvent.created_at))
            .limit(5)
        )
        recent_orders = orders_result.scalars().all()

        # Recent form submissions
        forms_result = await db.execute(
            select(ModuleEvent)
            .where(ModuleEvent.tenant_id == tenant_uuid)
            .where(ModuleEvent.event_type == "form_submitted")
            .where(ModuleEvent.created_at >= week_ago)
            .order_by(desc(ModuleEvent.created_at))
            .limit(3)
        )
        recent_forms = forms_result.scalars().all()

        # Contact count
        contact_count = (await db.execute(
            select(sqlfunc.count(Contact.id)).where(Contact.tenant_id == tenant_uuid)
        )).scalar() or 0

        lines = []
        if recent_orders:
            lines.append(f"Recente bestellingen ({len(recent_orders)} deze week):")
            for o in recent_orders[:3]:
                lines.append(f"  - {o.title}")
        if recent_forms:
            lines.append(f"Recente formulierinzendingen ({len(recent_forms)}):")
            for f in recent_forms[:2]:
                lines.append(f"  - {f.title}")
        if contact_count > 0:
            lines.append(f"Totaal bekende klanten/contacten: {contact_count}")

        if lines:
            business_context = "\n".join(lines)
    except Exception:
        pass  # Don't break chat if business context fails

    # ─── Combine all context ───
    full_context = context
    if geo_time_context:
        full_context += f"\n\n--- LOCATIE & TIJD ---\n{geo_time_context}\n--- EINDE LOCATIE & TIJD ---"
    if business_context:
        full_context += f"\n\n--- LIVE BEDRIJFSDATA ---\n{business_context}\n--- EINDE BEDRIJFSDATA ---"

    # ─── [3] RESPONSE: Generate with LLM ───
    llm_result = await generate_response(
        user_message=body.message,
        context=full_context,
        plan=tenant.plan,
        conversation_history=conversation_history,
        monitoring_context=monitoring_context,
        tenant_name=tenant.name or "het bedrijf",
        lang=getattr(tenant, "lang", "nl") or "nl",
    )

    # ─── [4] CONFIDENCE: Score the response ───
    confidence = calculate_confidence(chunks, llm_result["content"])

    # ─── Determine final response ───
    escalated = False
    final_content = llm_result["content"]

    if should_refuse(confidence):
        final_content = REFUSE_MESSAGE
        escalated = True
    elif should_escalate(confidence):
        final_content = llm_result["content"] + "\n\n---\n" + ESCALATION_MESSAGE
        escalated = True

    # ─── [5] LOG: Store everything ───
    sources_used = [
        {"source_id": c["source_id"], "similarity": c["similarity"]}
        for c in chunks
    ]

    assistant_msg = Message(
        id=uuid.uuid4(),
        conversation_id=conversation.id,
        tenant_id=tenant_uuid,
        role=MessageRole.assistant,
        content=final_content,
        confidence=confidence,
        sources_used=sources_used,
        escalated=escalated,
    )
    db.add(assistant_msg)

    usage = UsageLog(
        id=uuid.uuid4(),
        tenant_id=tenant_uuid,
        tokens_in=llm_result["tokens_in"],
        tokens_out=llm_result["tokens_out"],
        model=llm_result["model"],
        endpoint="/api/chat",
    )
    db.add(usage)
    await db.flush()

    logger.info(
        "chat_response",
        tenant_id=str(tenant_uuid),
        conversation_id=str(conversation.id),
        confidence=confidence,
        escalated=escalated,
        tokens_in=llm_result["tokens_in"],
        tokens_out=llm_result["tokens_out"],
    )

    # ─── [6] ESCALATE: If needed ───
    if escalated:
        await escalate_conversation(
            db=db,
            conversation=conversation,
            reason="low_confidence",
            confidence=confidence,
        )

    return ChatResponse(
        conversation_id=str(conversation.id),
        message=final_content,
        confidence=confidence,
        escalated=escalated,
        sources=sources_used,
    )

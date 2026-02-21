"""
/api/chat — The Core Loop

INPUT → RETRIEVAL → RESPONSE → CONFIDENCE → LOG → ESCALATE
"""
import re
import uuid
import hashlib
from datetime import datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
try:
    from user_agents import parse as parse_ua
except ImportError:
    parse_ua = None

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


def _extract_visitor_fingerprint(request: Request) -> dict:
    """Extract visitor identity from HTTP request headers."""
    ua_string = request.headers.get("user-agent", "")

    # Get real IP (behind proxy/cloudflare)
    ip = (
        request.headers.get("cf-connecting-ip")
        or request.headers.get("x-real-ip")
        or request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )

    # Device & browser detection
    device = "desktop"
    browser = "Unknown"
    os_name = "Unknown"
    if parse_ua:
        ua = parse_ua(ua_string)
        if ua.is_mobile:
            device = "mobile"
        elif ua.is_tablet:
            device = "tablet"
        browser = f"{ua.browser.family} {ua.browser.version_string}".strip()
        os_name = f"{ua.os.family} {ua.os.version_string}".strip()
    else:
        # Fallback without user-agents library
        ua_lower = ua_string.lower()
        if "mobile" in ua_lower or "android" in ua_lower or "iphone" in ua_lower:
            device = "mobile"
        elif "tablet" in ua_lower or "ipad" in ua_lower:
            device = "tablet"
        if "chrome" in ua_lower:
            browser = "Chrome"
        elif "firefox" in ua_lower:
            browser = "Firefox"
        elif "safari" in ua_lower:
            browser = "Safari"

    # Language from Accept-Language header
    accept_lang = request.headers.get("accept-language", "")
    language = accept_lang.split(",")[0].split("-")[0].strip()[:2] if accept_lang else None

    return {
        "ip": ip,
        "device": device,
        "browser": browser,
        "os": os_name,
        "language": language,
        "ua_string": ua_string[:200],
        "ip_hash": hashlib.sha256(ip.encode()).hexdigest()[:16] if ip else None,
    }


def _extract_identity_from_dialog(messages: list) -> dict:
    """Try to extract visitor name/email from conversation content."""
    identity = {}
    for msg in messages:
        if msg.get("role") != "user":
            continue
        text = msg.get("content", "")

        # Email detection
        email_match = re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', text)
        if email_match:
            identity["email"] = email_match.group(0).lower()

        # Name detection (common patterns)
        name_patterns = [
            r'(?:ik ben|mijn naam is|je spreekt met|dit is|ik heet)\s+([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?)',
            r'(?:my name is|i am|this is)\s+([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?)',
            r'(?:je parle avec|je suis|mon nom est)\s+([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+)?)',
        ]
        for pattern in name_patterns:
            name_match = re.search(pattern, text, re.IGNORECASE)
            if name_match:
                identity["name"] = name_match.group(1).strip()
                break

        # Phone detection
        phone_match = re.search(r'(?:\+32|0)\s*\d[\d\s]{7,}', text)
        if phone_match:
            identity["phone"] = re.sub(r'\s+', '', phone_match.group(0))

    return identity


async def _match_visitor_to_contact(db: AsyncSession, tenant_id: uuid.UUID, fingerprint: dict, dialog_identity: dict) -> Contact | None:
    """Try to match visitor to existing contact using email, phone, or IP history."""
    email = dialog_identity.get("email")
    phone = dialog_identity.get("phone")

    if not email and not phone:
        return None

    conditions = []
    if email:
        conditions.append(Contact.email == email)
    if phone:
        conditions.append(Contact.phone == phone)

    result = await db.execute(
        select(Contact)
        .where(Contact.tenant_id == tenant_id)
        .where(or_(*conditions))
        .limit(1)
    )
    return result.scalar_one_or_none()


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

    # ─── Visitor Fingerprinting ───
    fingerprint = _extract_visitor_fingerprint(request)

    if not conversation:
        conversation = Conversation(
            id=uuid.uuid4(),
            tenant_id=tenant_uuid,
            session_id=body.session_id,
            channel=body.channel,
            visitor_ip=fingerprint.get("ip"),
            visitor_device=fingerprint.get("device"),
            visitor_browser=fingerprint.get("browser"),
            visitor_language=fingerprint.get("language"),
            visitor_identity=fingerprint,
        )
        db.add(conversation)
        await db.flush()
    elif not conversation.visitor_ip and fingerprint.get("ip"):
        # Update fingerprint if missing on existing conversation
        conversation.visitor_ip = fingerprint.get("ip")
        conversation.visitor_device = fingerprint.get("device")
        conversation.visitor_browser = fingerprint.get("browser")
        conversation.visitor_language = fingerprint.get("language")
        conversation.visitor_identity = fingerprint

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

    # ─── [5b] IDENTITY: Extract from dialog and match to contact ───
    try:
        dialog_identity = _extract_identity_from_dialog(conversation_history + [{"role": "user", "content": body.message}])
        if dialog_identity:
            if dialog_identity.get("name") and not conversation.visitor_name:
                conversation.visitor_name = dialog_identity["name"]
            if dialog_identity.get("email") and not conversation.visitor_email:
                conversation.visitor_email = dialog_identity["email"]

            # Try to match to existing contact
            if not conversation.contact_id:
                contact = await _match_visitor_to_contact(db, tenant_uuid, fingerprint, dialog_identity)
                if contact:
                    conversation.contact_id = contact.id
                    conversation.visitor_name = conversation.visitor_name or contact.name
                    conversation.visitor_email = conversation.visitor_email or contact.email
                    conversation.visitor_city = conversation.visitor_city or contact.city
                    conversation.visitor_country = conversation.visitor_country or contact.country
                    # Update contact stats
                    contact.total_conversations = (contact.total_conversations or 0) + 1
                    contact.last_seen_at = datetime.utcnow()

            # Update identity blob
            current_identity = conversation.visitor_identity or {}
            current_identity.update({k: v for k, v in dialog_identity.items() if v})
            conversation.visitor_identity = current_identity
    except Exception:
        pass  # Never break chat for identity extraction

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

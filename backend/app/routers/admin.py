"""Admin overview and utility endpoints."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, TenantStatus
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message
from app.models.usage_log import UsageLog

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/overview/")
async def overview(db: AsyncSession = Depends(get_db)):
    """Admin overview — situational awareness."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Active tenants
    active_tenants = await db.execute(
        select(func.count()).select_from(Tenant).where(Tenant.status == TenantStatus.active)
    )

    # Total tenants
    total_tenants = await db.execute(
        select(func.count()).select_from(Tenant)
    )

    # Conversations today
    convs_today = await db.execute(
        select(func.count()).select_from(Conversation).where(Conversation.created_at >= today_start)
    )

    # Escalations today
    escalations_today = await db.execute(
        select(func.count())
        .select_from(Conversation)
        .where(Conversation.created_at >= today_start)
        .where(Conversation.status == ConversationStatus.escalated)
    )

    # Token usage today
    usage_today = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
        ).where(UsageLog.created_at >= today_start)
    )
    tokens_in_today, tokens_out_today = usage_today.one()

    # Token usage this month
    usage_month = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
        ).where(UsageLog.created_at >= month_start)
    )
    tokens_in_month, tokens_out_month = usage_month.one()

    return {
        "tenants": {
            "active": active_tenants.scalar(),
            "total": total_tenants.scalar(),
        },
        "today": {
            "conversations": convs_today.scalar(),
            "escalations": escalations_today.scalar(),
            "tokens_in": tokens_in_today,
            "tokens_out": tokens_out_today,
        },
        "month": {
            "tokens_in": tokens_in_month,
            "tokens_out": tokens_out_month,
        },
    }


@router.get("/conversations/")
async def list_conversations(
    tenant_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List recent conversations with filters."""
    query = select(Conversation).order_by(Conversation.created_at.desc()).limit(limit)

    if tenant_id:
        query = query.where(Conversation.tenant_id == uuid.UUID(tenant_id))
    if status:
        query = query.where(Conversation.status == ConversationStatus(status))

    result = await db.execute(query)
    conversations = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "tenant_id": str(c.tenant_id),
            "session_id": c.session_id,
            "channel": c.channel,
            "status": c.status.value,
            "created_at": c.created_at.isoformat(),
            "message_count": len(c.messages) if c.messages else 0,
            "visitor_name": getattr(c, 'visitor_name', None),
            "visitor_email": getattr(c, 'visitor_email', None),
            "visitor_ip": getattr(c, 'visitor_ip', None),
            "visitor_country": getattr(c, 'visitor_country', None),
            "visitor_city": getattr(c, 'visitor_city', None),
            "visitor_device": getattr(c, 'visitor_device', None),
            "visitor_browser": getattr(c, 'visitor_browser', None),
            "visitor_language": getattr(c, 'visitor_language', None),
            "contact_id": str(c.contact_id) if getattr(c, 'contact_id', None) else None,
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get full conversation with messages."""
    conversation = await db.get(Conversation, uuid.UUID(conversation_id))
    if not conversation:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at)
    )
    messages = msg_result.scalars().all()

    return {
        "id": str(conversation.id),
        "tenant_id": str(conversation.tenant_id),
        "session_id": conversation.session_id,
        "channel": conversation.channel,
        "status": conversation.status.value,
        "created_at": conversation.created_at.isoformat(),
        "visitor_name": getattr(conversation, 'visitor_name', None),
        "visitor_email": getattr(conversation, 'visitor_email', None),
        "visitor_ip": getattr(conversation, 'visitor_ip', None),
        "visitor_country": getattr(conversation, 'visitor_country', None),
        "visitor_city": getattr(conversation, 'visitor_city', None),
        "visitor_device": getattr(conversation, 'visitor_device', None),
        "visitor_browser": getattr(conversation, 'visitor_browser', None),
        "visitor_language": getattr(conversation, 'visitor_language', None),
        "contact_id": str(conversation.contact_id) if getattr(conversation, 'contact_id', None) else None,
        "visitor_identity": getattr(conversation, 'visitor_identity', None),
        "messages": [
            {
                "id": str(m.id),
                "role": m.role.value,
                "content": m.content,
                "confidence": m.confidence,
                "sources_used": m.sources_used,
                "escalated": m.escalated,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.patch("/tenants/{tenant_id}/domain")
async def change_tenant_domain(
    tenant_id: str,
    domain: str,
    db: AsyncSession = Depends(get_db),
):
    """Change a tenant's domain — for site migrations/verhuizingen.
    All monitoring checks, analytics, and AI data are preserved.
    Only the domain reference and monitoring targets are updated.
    """
    from app.models.monitor import MonitorCheck

    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tenant not found")

    old_domain = tenant.domain
    tenant.domain = domain

    # Update all monitoring check targets to new domain
    checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.tenant_id == tenant.id)
    )
    checks = checks_result.scalars().all()
    updated_checks = 0
    for check in checks:
        if old_domain and old_domain in (check.target or ""):
            check.target = check.target.replace(old_domain, domain)
            updated_checks += 1

    await db.flush()

    return {
        "status": "domain_updated",
        "old_domain": old_domain,
        "new_domain": domain,
        "monitoring_checks_updated": updated_checks,
        "message": f"Tenant migrated from {old_domain} to {domain}. All data preserved.",
    }


@router.get("/tenants/{tenant_id}/embed-config")
async def get_embed_config(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get the embed configuration for a tenant — used by plugins and integrations."""
    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tenant not found")

    return {
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value if hasattr(tenant.plan, 'value') else tenant.plan,
        "api_base": "https://api.tinyeclipse.digitalfarmers.be",
        "widget_url": "https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js",
        "embed_code": f'<script src="https://api.tinyeclipse.digitalfarmers.be/widget/v1/widget.js" data-tenant="{tenant.id}" data-api="https://api.tinyeclipse.digitalfarmers.be" async></script>',
    }


@router.get("/usage/")
async def usage_overview(
    tenant_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Usage statistics overview."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    base_query = select(
        func.coalesce(func.sum(UsageLog.tokens_in), 0),
        func.coalesce(func.sum(UsageLog.tokens_out), 0),
        func.count(),
    )

    if tenant_id:
        base_query = base_query.where(UsageLog.tenant_id == uuid.UUID(tenant_id))

    # Today
    today_result = await db.execute(base_query.where(UsageLog.created_at >= today_start))
    t_in, t_out, t_count = today_result.one()

    # This month
    month_result = await db.execute(base_query.where(UsageLog.created_at >= month_start))
    m_in, m_out, m_count = month_result.one()

    # All time
    all_result = await db.execute(base_query)
    a_in, a_out, a_count = all_result.one()

    return {
        "today": {"tokens_in": t_in, "tokens_out": t_out, "requests": t_count},
        "month": {"tokens_in": m_in, "tokens_out": m_out, "requests": m_count},
        "all_time": {"tokens_in": a_in, "tokens_out": a_out, "requests": a_count},
    }

"""Admin overview and utility endpoints."""
import uuid
from datetime import datetime, timedelta, timezone

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


@router.get("/overview")
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


@router.get("/conversations")
async def list_conversations(
    tenant_id: str | None = None,
    status: str | None = None,
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


@router.get("/usage")
async def usage_overview(
    tenant_id: str | None = None,
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

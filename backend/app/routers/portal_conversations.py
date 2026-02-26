"""
Portal Conversations — Client-safe read-only access to their own conversations.
No admin key required, scoped to tenant_id only.
"""
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.models.tenant import Tenant
from app.models.conversation import Conversation
from app.models.message import Message

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/conversations", tags=["portal-conversations"])


@router.get("/{tenant_id}")
async def list_portal_conversations(
    tenant_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """List conversations for a tenant — client-safe, no admin key."""
    tid = uuid.UUID(tenant_id)
    tenant = await get_tenant_safe(db, tenant_id)

    result = await db.execute(
        select(Conversation)
        .where(Conversation.tenant_id == tid)
        .order_by(desc(Conversation.created_at))
        .limit(limit)
    )
    conversations = result.scalars().all()

    items = []
    for c in conversations:
        msg_count = await db.execute(
            select(func.count(Message.id)).where(Message.conversation_id == c.id)
        )
        items.append({
            "id": str(c.id),
            "session_id": c.session_id,
            "status": c.status.value,
            "message_count": msg_count.scalar() or 0,
            "created_at": c.created_at.isoformat(),
        })

    return items


@router.get("/{tenant_id}/{conversation_id}")
async def get_portal_conversation(
    tenant_id: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single conversation with messages — scoped to tenant."""
    tid = uuid.UUID(tenant_id)
    cid = uuid.UUID(conversation_id)

    conversation = await db.execute(
        select(Conversation).where(
            and_(Conversation.id == cid, Conversation.tenant_id == tid)
        )
    )
    conv = conversation.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msg_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == cid)
        .order_by(Message.created_at)
    )
    messages = msg_result.scalars().all()

    return {
        "id": str(conv.id),
        "session_id": conv.session_id,
        "status": conv.status.value,
        "created_at": conv.created_at.isoformat(),
        "messages": [
            {
                "role": m.role.value,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }

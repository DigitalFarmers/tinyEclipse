import uuid
import structlog

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationStatus

logger = structlog.get_logger()


async def escalate_conversation(
    db: AsyncSession,
    conversation: Conversation,
    reason: str,
    confidence: float,
) -> None:
    """Mark a conversation as escalated and log the event.

    In Day Zero, escalation means:
    1. Mark conversation status as escalated
    2. Log the event with reason and confidence
    3. (Future: create ticket, notify human, send webhook)
    """
    conversation.status = ConversationStatus.escalated
    await db.flush()

    logger.warning(
        "conversation_escalated",
        conversation_id=str(conversation.id),
        tenant_id=str(conversation.tenant_id),
        reason=reason,
        confidence=confidence,
    )

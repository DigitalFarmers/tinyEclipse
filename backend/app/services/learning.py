"""
TinyEclipse AI Learning Loop
Automatically learns from conversations:
1. Summarize completed conversations
2. Cache high-confidence Q&A pairs as knowledge
3. Track unanswered questions for knowledge gap analysis
"""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select, and_, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, MessageRole
from app.models.source import Source, SourceType, SourceStatus
from app.services.embeddings import ingest_source

logger = logging.getLogger(__name__)

# Minimum confidence to consider a Q&A pair worth caching
MIN_CACHE_CONFIDENCE = 0.75
# Minimum messages in a conversation to generate a summary
MIN_MESSAGES_FOR_SUMMARY = 4
# Maximum Q&A pairs to cache per conversation
MAX_QA_CACHE_PER_CONV = 3


async def summarize_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> dict | None:
    """Generate a summary of a conversation and store it.

    Returns summary dict or None if conversation is too short.
    """
    from app.services.llm import generate_response
    from app.models.tenant import Tenant

    conv = await db.get(Conversation, conversation_id)
    if not conv:
        return None

    # Get all messages
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .where(Message.role != MessageRole.system)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    if len(messages) < MIN_MESSAGES_FOR_SUMMARY:
        return None

    tenant = await db.get(Tenant, conv.tenant_id)
    tenant_name = tenant.name if tenant else "het bedrijf"

    # Build conversation text for summarization
    conv_text = "\n".join([
        f"{'Bezoeker' if m.role == MessageRole.user else 'AI'}: {m.content[:500]}"
        for m in messages
    ])

    # Generate summary using LLM
    try:
        result = await generate_response(
            user_message=f"Vat het volgende gesprek samen in 2-3 zinnen. Focus op: wat de bezoeker wilde, of het antwoord gegeven werd, en of er actie nodig is.\n\nGesprek:\n{conv_text[:3000]}",
            context="",
            plan=tenant.plan if tenant else "tiny",
            tenant_name=tenant_name,
            lang="nl",
        )
        summary = result["content"]
    except Exception as e:
        logger.error(f"[learning] Failed to summarize conversation {conversation_id}: {e}")
        return None

    # Extract key topics
    user_messages = [m.content for m in messages if m.role == MessageRole.user]
    avg_confidence = sum(m.confidence or 0 for m in messages if m.confidence) / max(1, sum(1 for m in messages if m.confidence))
    was_escalated = any(m.escalated for m in messages)

    summary_data = {
        "summary": summary,
        "message_count": len(messages),
        "avg_confidence": round(avg_confidence, 3),
        "escalated": was_escalated,
        "visitor_name": conv.visitor_name,
        "visitor_email": conv.visitor_email,
        "topics": _extract_topics(user_messages),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # Store summary in conversation's visitor_identity (extend it)
    current_identity = conv.visitor_identity or {}
    current_identity["conversation_summary"] = summary_data
    conv.visitor_identity = current_identity

    await db.flush()
    logger.info(f"[learning] Summarized conversation {conversation_id}: {summary[:100]}...")

    return summary_data


async def cache_qa_pairs(db: AsyncSession, conversation_id: uuid.UUID) -> int:
    """Extract high-confidence Q&A pairs from a conversation and save them as knowledge sources.

    Returns number of Q&A pairs cached.
    """
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        return 0

    # Get messages in order
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    # Find high-confidence Q&A pairs
    qa_pairs = []
    for i, msg in enumerate(messages):
        if msg.role != MessageRole.user:
            continue
        # Find the next assistant message
        for j in range(i + 1, len(messages)):
            if messages[j].role == MessageRole.assistant:
                answer = messages[j]
                if answer.confidence and answer.confidence >= MIN_CACHE_CONFIDENCE and not answer.escalated:
                    # Skip very short answers or generic responses
                    if len(answer.content) > 50 and len(msg.content) > 10:
                        qa_pairs.append({
                            "question": msg.content,
                            "answer": answer.content,
                            "confidence": answer.confidence,
                        })
                break

    if not qa_pairs:
        return 0

    # Sort by confidence, take top N
    qa_pairs.sort(key=lambda x: x["confidence"], reverse=True)
    qa_pairs = qa_pairs[:MAX_QA_CACHE_PER_CONV]

    # Check for duplicate questions already in knowledge base
    cached = 0
    for qa in qa_pairs:
        # Check if similar question already exists as a learned source
        existing = await db.execute(
            select(Source)
            .where(and_(
                Source.tenant_id == conv.tenant_id,
                Source.type == SourceType.faq,
                Source.title.ilike(f"%{qa['question'][:50]}%"),
            ))
            .limit(1)
        )
        if existing.scalar_one_or_none():
            continue  # Skip duplicate

        # Create new FAQ source from learned Q&A
        source = Source(
            id=uuid.uuid4(),
            tenant_id=conv.tenant_id,
            type=SourceType.faq,
            title=f"[AI Learned] {qa['question'][:200]}",
            content=f"Vraag: {qa['question']}\n\nAntwoord: {qa['answer']}",
            status=SourceStatus.pending,
        )
        db.add(source)
        await db.flush()

        # Ingest immediately so it's searchable
        try:
            await ingest_source(db, source)
            cached += 1
            logger.info(f"[learning] Cached Q&A pair for tenant {conv.tenant_id}: {qa['question'][:80]}...")
        except Exception as e:
            logger.error(f"[learning] Failed to ingest learned Q&A: {e}")

    await db.flush()
    return cached


async def track_knowledge_gaps(db: AsyncSession, conversation_id: uuid.UUID) -> list[dict]:
    """Identify questions the AI couldn't answer well (low confidence / escalated).

    Returns list of knowledge gap items.
    """
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        return []

    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = msgs_result.scalars().all()

    gaps = []
    for i, msg in enumerate(messages):
        if msg.role != MessageRole.user:
            continue
        # Find the next assistant message
        for j in range(i + 1, len(messages)):
            if messages[j].role == MessageRole.assistant:
                answer = messages[j]
                if answer.escalated or (answer.confidence and answer.confidence < 0.4):
                    gaps.append({
                        "question": msg.content,
                        "confidence": answer.confidence or 0,
                        "escalated": answer.escalated,
                        "tenant_id": str(conv.tenant_id),
                        "conversation_id": str(conversation_id),
                    })
                break

    return gaps


async def process_completed_conversation(db: AsyncSession, conversation_id: uuid.UUID) -> dict:
    """Full learning pipeline for a completed conversation.

    1. Summarize
    2. Cache high-confidence Q&A
    3. Track knowledge gaps

    Returns processing results.
    """
    results = {
        "conversation_id": str(conversation_id),
        "summary": None,
        "qa_cached": 0,
        "knowledge_gaps": [],
    }

    try:
        summary = await summarize_conversation(db, conversation_id)
        results["summary"] = summary
    except Exception as e:
        logger.error(f"[learning] Summary failed for {conversation_id}: {e}")

    try:
        cached = await cache_qa_pairs(db, conversation_id)
        results["qa_cached"] = cached
    except Exception as e:
        logger.error(f"[learning] Q&A caching failed for {conversation_id}: {e}")

    try:
        gaps = await track_knowledge_gaps(db, conversation_id)
        results["knowledge_gaps"] = gaps
    except Exception as e:
        logger.error(f"[learning] Gap tracking failed for {conversation_id}: {e}")

    await db.commit()
    logger.info(f"[learning] Processed conversation {conversation_id}: summary={'yes' if results['summary'] else 'no'}, cached={results['qa_cached']}, gaps={len(results['knowledge_gaps'])}")

    return results


async def process_stale_conversations(db: AsyncSession, inactive_minutes: int = 30) -> list[dict]:
    """Find conversations that have been inactive and process them.

    This should be called periodically (e.g., every 5 minutes).
    """
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=inactive_minutes)

    # Find active conversations where last message is older than cutoff
    # and that haven't been summarized yet
    result = await db.execute(
        select(Conversation)
        .where(and_(
            Conversation.status == ConversationStatus.active,
            Conversation.created_at < cutoff,
        ))
        .limit(20)
    )
    stale_convos = result.scalars().all()

    results = []
    for conv in stale_convos:
        # Check if already summarized
        identity = conv.visitor_identity or {}
        if identity.get("conversation_summary"):
            continue

        # Check last message time
        last_msg = await db.execute(
            select(Message.created_at)
            .where(Message.conversation_id == conv.id)
            .order_by(desc(Message.created_at))
            .limit(1)
        )
        last_msg_time = last_msg.scalar()
        if not last_msg_time or last_msg_time > cutoff:
            continue  # Still active

        # Close and process
        conv.status = ConversationStatus.closed
        try:
            r = await process_completed_conversation(db, conv.id)
            results.append(r)
        except Exception as e:
            logger.error(f"[learning] Failed to process stale conversation {conv.id}: {e}")

    return results


def _extract_topics(user_messages: list[str]) -> list[str]:
    """Extract key topics from user messages using simple heuristics."""
    topics = set()
    keywords = {
        "prijs": "pricing", "kosten": "pricing", "price": "pricing", "tarief": "pricing",
        "bestelling": "orders", "order": "orders", "bestellen": "orders",
        "levering": "shipping", "verzending": "shipping", "delivery": "shipping",
        "retour": "returns", "terugsturen": "returns", "return": "returns",
        "openingstijden": "hours", "open": "hours", "gesloten": "hours",
        "contact": "contact", "telefoon": "contact", "email": "contact",
        "product": "products", "artikel": "products",
        "betaling": "payment", "betalen": "payment", "payment": "payment",
        "korting": "discount", "actie": "discount", "sale": "discount",
        "klacht": "complaint", "probleem": "complaint", "issue": "complaint",
        "account": "account", "inloggen": "account", "login": "account",
    }

    for msg in user_messages:
        msg_lower = msg.lower()
        for keyword, topic in keywords.items():
            if keyword in msg_lower:
                topics.add(topic)

    return list(topics)[:5]

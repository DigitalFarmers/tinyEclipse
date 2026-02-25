"""
TinyEclipse AI Self-Review — Critical Self-Evaluation After Every Interaction.

After each chat response, the AI critically evaluates itself:
- Was the answer helpful, accurate, complete?
- What could have been done 100x better?
- What knowledge is missing?
- Should this have been escalated differently?

Reviews are stored and aggregated for continuous improvement.
Fire-and-forget: never slows down the chat response.
"""
import uuid
import json
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List

from sqlalchemy import select, func, and_, desc, String, Text, Float, Boolean, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session

logger = logging.getLogger(__name__)


async def self_review_interaction(
    tenant_id: uuid.UUID,
    tenant_name: str,
    conversation_id: uuid.UUID,
    user_message: str,
    ai_response: str,
    confidence: float,
    escalated: bool,
    sources_used: list,
    language: str,
    context_snippet: str = "",
):
    """
    Fire-and-forget self-review of an AI interaction.
    Runs asynchronously AFTER the chat response is returned.
    Stores review in system_events for tracking.
    """
    try:
        review = _evaluate_response(
            user_message=user_message,
            ai_response=ai_response,
            confidence=confidence,
            escalated=escalated,
            sources_count=len(sources_used),
            language=language,
            context_available=bool(context_snippet),
        )

        # Store review as system event
        async with async_session() as db:
            from app.services.event_bus import emit
            await emit(
                db, domain="ai", action="self_review",
                title=f"Self-review: {review['grade']} ({review['score']}/100)",
                severity="info" if review["score"] >= 70 else "warning",
                tenant_id=tenant_id, source="self_review",
                data={
                    "conversation_id": str(conversation_id),
                    "score": review["score"],
                    "grade": review["grade"],
                    "strengths": review["strengths"],
                    "improvements": review["improvements"],
                    "missing_knowledge": review["missing_knowledge"],
                    "escalation_correct": review["escalation_correct"],
                    "language_correct": review["language_correct"],
                    "confidence_calibration": review["confidence_calibration"],
                    "user_intent": review["user_intent"],
                },
            )
            await db.commit()

            # If score is very low, also persist as knowledge gap
            if review["score"] < 40 and review["missing_knowledge"]:
                try:
                    from app.services.brain import persist_knowledge_gap
                    for gap in review["missing_knowledge"][:2]:
                        await persist_knowledge_gap(
                            db=db,
                            tenant_id=tenant_id,
                            question=gap,
                            source="self_review",
                        )
                    await db.commit()
                except Exception:
                    pass

    except Exception as e:
        logger.warning(f"[self_review] Error: {e}")


def _evaluate_response(
    user_message: str,
    ai_response: str,
    confidence: float,
    escalated: bool,
    sources_count: int,
    language: str,
    context_available: bool,
) -> Dict:
    """
    Rule-based self-evaluation of an AI response.
    Fast, deterministic, no LLM call needed.
    """
    score = 50  # Base score
    strengths = []
    improvements = []
    missing_knowledge = []

    msg_lower = user_message.lower()
    resp_lower = ai_response.lower()
    msg_len = len(user_message)
    resp_len = len(ai_response)

    # ── 1. Response length appropriateness ──
    if msg_len < 20 and resp_len > 500:
        improvements.append("Response too long for a short question")
        score -= 5
    elif msg_len > 100 and resp_len < 50:
        improvements.append("Response too short for a detailed question")
        score -= 10
    else:
        strengths.append("Response length matches question complexity")
        score += 5

    # ── 2. Confidence calibration ──
    confidence_calibration = "appropriate"
    if confidence >= 0.8 and sources_count == 0:
        confidence_calibration = "overconfident"
        improvements.append("High confidence without source backing — potential hallucination risk")
        score -= 15
    elif confidence < 0.3 and sources_count >= 3:
        confidence_calibration = "underconfident"
        improvements.append("Low confidence despite having relevant sources")
        score -= 5
    elif confidence >= 0.5 and sources_count >= 1:
        strengths.append("Confidence backed by source material")
        score += 10

    # ── 3. Escalation analysis ──
    escalation_correct = True
    question_indicators = {
        "personal": ["mijn bestelling", "my order", "ma commande", "factuur", "invoice", "facture", "account", "wachtwoord", "password"],
        "general": ["openingstijden", "opening hours", "horaires", "prijs", "price", "prix", "waar", "where", "où", "wat", "what", "quoi"],
    }

    is_personal = any(ind in msg_lower for ind in question_indicators["personal"])
    is_general = any(ind in msg_lower for ind in question_indicators["general"])

    if escalated and is_general and not is_personal:
        escalation_correct = False
        improvements.append("Escalated a general question that could have been answered")
        score -= 15
    elif not escalated and is_personal and confidence < 0.3:
        escalation_correct = False
        improvements.append("Should have escalated — personal question with low confidence")
        score -= 10
    elif escalated and is_personal:
        strengths.append("Correctly escalated a personal account question")
        score += 5
    elif not escalated and confidence >= 0.5:
        strengths.append("Handled question without unnecessary escalation")
        score += 10

    # ── 4. Language analysis ──
    language_correct = True
    lang_indicators = {
        "nl": ["de", "het", "een", "van", "en", "voor", "met"],
        "en": ["the", "and", "for", "with", "this", "that", "have"],
        "fr": ["le", "la", "les", "des", "pour", "avec", "est"],
    }

    if language in lang_indicators:
        expected_words = lang_indicators[language]
        resp_words = resp_lower.split()[:50]
        matches = sum(1 for w in resp_words if w in expected_words)
        if matches < 2 and len(resp_words) > 10:
            language_correct = False
            improvements.append(f"Response may not be in the expected language ({language})")
            score -= 20
        else:
            strengths.append(f"Response correctly in {language}")
            score += 5

    # ── 5. Helpfulness indicators ──
    helpful_patterns = [
        "kan ik", "can i", "puis-je",  # Offer more help
        "website", "pagina", "page",  # References
        "neem contact", "contact us", "contactez",  # Referral
    ]
    unhelpful_patterns = [
        "ik weet het niet", "i don't know", "je ne sais pas",
        "geen informatie", "no information", "aucune information",
    ]

    helpful_count = sum(1 for p in helpful_patterns if p in resp_lower)
    unhelpful_count = sum(1 for p in unhelpful_patterns if p in resp_lower)

    if helpful_count >= 2:
        strengths.append("Proactively offered alternatives and references")
        score += 10
    if unhelpful_count > 0:
        improvements.append("Used negative phrasing — should offer alternatives instead")
        score -= 10

    # ── 6. Context usage ──
    if not context_available and not escalated:
        improvements.append("Answered without context — verify accuracy")
        score -= 5
    elif context_available and sources_count >= 1:
        strengths.append("Used available knowledge sources")
        score += 5

    # ── 7. Intent detection ──
    user_intent = "information"
    if any(w in msg_lower for w in ["kopen", "buy", "acheter", "bestellen", "order", "commander", "prijs", "price", "prix"]):
        user_intent = "purchase"
    elif any(w in msg_lower for w in ["probleem", "problem", "problème", "werkt niet", "doesn't work", "ne fonctionne pas", "kapot", "broken"]):
        user_intent = "support"
    elif any(w in msg_lower for w in ["hoe", "how", "comment", "wat is", "what is", "qu'est-ce"]):
        user_intent = "how_to"
    elif any(w in msg_lower for w in ["klacht", "complaint", "plainte", "ontevreden", "unhappy", "mécontent"]):
        user_intent = "complaint"
        if not escalated:
            improvements.append("Complaint detected but not escalated — consider escalation")
            score -= 5

    # ── 8. Missing knowledge detection ──
    if confidence < 0.4:
        # Try to identify what knowledge is missing
        if "?" in user_message:
            missing_knowledge.append(user_message.strip())
    if escalated and not is_personal:
        missing_knowledge.append(f"Need better knowledge to answer: {user_message[:200]}")

    # ── Final score ──
    score = max(0, min(100, score))
    grade = (
        "A+" if score >= 90 else "A" if score >= 80 else "B" if score >= 70 else
        "C" if score >= 60 else "D" if score >= 40 else "F"
    )

    return {
        "score": score,
        "grade": grade,
        "strengths": strengths[:5],
        "improvements": improvements[:5],
        "missing_knowledge": missing_knowledge[:3],
        "escalation_correct": escalation_correct,
        "language_correct": language_correct,
        "confidence_calibration": confidence_calibration,
        "user_intent": user_intent,
    }


async def get_self_review_stats(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    days: int = 30,
) -> Dict:
    """Get aggregated self-review statistics for a tenant."""
    from app.models.system_event import SystemEvent

    since = datetime.now(timezone.utc) - timedelta(days=days)

    reviews_result = await db.execute(
        select(SystemEvent)
        .where(and_(
            SystemEvent.tenant_id == tenant_id,
            SystemEvent.action == "self_review",
            SystemEvent.created_at >= since,
        ))
        .order_by(desc(SystemEvent.created_at))
        .limit(200)
    )
    reviews = reviews_result.scalars().all()

    if not reviews:
        return {"total_reviews": 0, "avg_score": 0, "grade": "N/A"}

    scores = []
    grade_counts = {}
    all_improvements = {}
    all_strengths = {}
    intents = {}
    lang_issues = 0
    escalation_issues = 0

    for r in reviews:
        data = r.data or {}
        score = data.get("score", 0)
        scores.append(score)

        grade = data.get("grade", "?")
        grade_counts[grade] = grade_counts.get(grade, 0) + 1

        for imp in data.get("improvements", []):
            all_improvements[imp] = all_improvements.get(imp, 0) + 1

        for s in data.get("strengths", []):
            all_strengths[s] = all_strengths.get(s, 0) + 1

        intent = data.get("user_intent", "unknown")
        intents[intent] = intents.get(intent, 0) + 1

        if not data.get("language_correct", True):
            lang_issues += 1

        if not data.get("escalation_correct", True):
            escalation_issues += 1

    avg = round(sum(scores) / len(scores), 1)
    overall_grade = (
        "A+" if avg >= 90 else "A" if avg >= 80 else "B" if avg >= 70 else
        "C" if avg >= 60 else "D" if avg >= 40 else "F"
    )

    # Top improvements needed (sorted by frequency)
    top_improvements = sorted(all_improvements.items(), key=lambda x: x[1], reverse=True)[:5]
    top_strengths = sorted(all_strengths.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "total_reviews": len(reviews),
        "avg_score": avg,
        "grade": overall_grade,
        "grade_distribution": grade_counts,
        "top_improvements": [{"issue": k, "count": v} for k, v in top_improvements],
        "top_strengths": [{"strength": k, "count": v} for k, v in top_strengths],
        "intent_distribution": intents,
        "language_issues": lang_issues,
        "escalation_issues": escalation_issues,
        "language_issue_rate": round(lang_issues / len(reviews) * 100, 1),
        "escalation_issue_rate": round(escalation_issues / len(reviews) * 100, 1),
    }

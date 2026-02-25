from __future__ import annotations
from app.config import get_settings

settings = get_settings()


def calculate_confidence(
    chunks: list[dict],
    response_content: str,
) -> float:
    """Calculate confidence score for an AI response.

    Factors:
    - retrieval_similarity (0.4 weight): average similarity of retrieved chunks
    - source_coverage (0.3 weight): how many chunks were retrieved vs requested
    - answer_coherence (0.3 weight): basic heuristic on response quality

    Returns float between 0.0 and 1.0
    """
    if not chunks:
        return 0.2  # Low but not zero — AI can still give useful general guidance

    # Factor 1: Average retrieval similarity
    similarities = [c.get("similarity", 0.0) for c in chunks]
    retrieval_similarity = sum(similarities) / len(similarities) if similarities else 0.0

    # Factor 2: Source coverage (more relevant chunks = higher confidence)
    # Normalize: 1 chunk = 0.3, 3+ chunks = 1.0 (lowered from 5 to be less strict)
    source_coverage = min(len(chunks) / 3.0, 1.0)

    # Factor 3: Answer coherence heuristic
    answer_coherence = 1.0
    if len(response_content) < 30:
        answer_coherence *= 0.5
    # Only penalize for strong refusal signals, not mild uncertainty
    strong_refusal_markers = [
        "ik kan deze vraag niet beantwoorden",
        "ik heb hier geen informatie over",
        "i cannot answer", "i don't have information",
    ]
    mild_uncertainty_markers = [
        "niet zeker", "not certain", "geen informatie",
        "ik weet het niet", "i don't know",
    ]
    lower = response_content.lower()
    for marker in strong_refusal_markers:
        if marker in lower:
            answer_coherence *= 0.3
            break
    else:
        for marker in mild_uncertainty_markers:
            if marker in lower:
                answer_coherence *= 0.6  # Less harsh penalty for mild uncertainty
                break

    confidence = (
        retrieval_similarity * 0.4
        + source_coverage * 0.3
        + answer_coherence * 0.3
    )

    return round(min(max(confidence, 0.0), 1.0), 3)


def should_escalate(confidence: float) -> bool:
    """Determine if the response should be escalated to a human.
    Lowered threshold — we want the AI to try harder before escalating."""
    return confidence < settings.confidence_escalate_threshold


def should_refuse(confidence: float) -> bool:
    """Determine if the AI should refuse to answer.
    Very low threshold — only refuse when truly clueless."""
    return confidence < settings.confidence_refuse_threshold


ESCALATION_MESSAGE = (
    "\n\n💬 Wil je liever met een medewerker spreken? "
    "Ons team staat voor je klaar! Neem gerust contact op via de contactpagina "
    "of stuur een berichtje — we helpen je graag persoonlijk verder."
)

REFUSE_MESSAGE = (
    "Dat is een goede vraag! Daar kan ik je het beste persoonlijk mee helpen. "
    "Neem gerust contact op via onze contactpagina of stuur ons een berichtje — "
    "we reageren zo snel mogelijk! 😊"
)

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
        return 0.1  # Very low confidence if no sources found

    # Factor 1: Average retrieval similarity
    similarities = [c.get("similarity", 0.0) for c in chunks]
    retrieval_similarity = sum(similarities) / len(similarities) if similarities else 0.0

    # Factor 2: Source coverage (more relevant chunks = higher confidence)
    # Normalize: 1 chunk = 0.2, 5+ chunks = 1.0
    source_coverage = min(len(chunks) / 5.0, 1.0)

    # Factor 3: Answer coherence heuristic
    # - Penalize very short answers
    # - Penalize answers that contain uncertainty markers
    answer_coherence = 1.0
    if len(response_content) < 50:
        answer_coherence *= 0.5
    uncertainty_markers = [
        "i'm not sure", "i don't know", "i cannot", "i can't",
        "unclear", "not certain", "no information",
        "ik weet het niet", "niet zeker", "geen informatie",
    ]
    for marker in uncertainty_markers:
        if marker in response_content.lower():
            answer_coherence *= 0.4
            break

    confidence = (
        retrieval_similarity * 0.4
        + source_coverage * 0.3
        + answer_coherence * 0.3
    )

    return round(min(max(confidence, 0.0), 1.0), 3)


def should_escalate(confidence: float) -> bool:
    """Determine if the response should be escalated to a human."""
    return confidence < settings.confidence_escalate_threshold


def should_refuse(confidence: float) -> bool:
    """Determine if the AI should refuse to answer."""
    return confidence < settings.confidence_refuse_threshold


ESCALATION_MESSAGE = (
    "I don't have enough confidence to answer this question accurately. "
    "I'm forwarding this to a human team member who can help you better. "
    "They will get back to you as soon as possible."
)

REFUSE_MESSAGE = (
    "I'm unable to answer this question based on the information available to me. "
    "Please contact our support team directly for assistance."
)

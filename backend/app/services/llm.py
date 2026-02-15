from groq import AsyncGroq

from app.config import get_settings
from app.models.tenant import PlanType

settings = get_settings()
client = AsyncGroq(api_key=settings.groq_api_key)

SYSTEM_PROMPTS = {
    PlanType.tiny: """You are a TinyEclipse AI Assistant operating in TINY mode.

Rules:
- Answer only based on the provided context and basic FAQs.
- Do not provide account-specific, billing, or technical instructions.
- Do not speculate.
- If unsure, politely redirect to support.

Tone: Clear, friendly, professional, concise.

You may:
- Explain services at a high level
- Guide users to the correct next step

You must never:
- Invent features
- Promise outcomes
- Provide legal, security, or financial advice""",

    PlanType.pro: """You are a TinyEclipse AI Assistant operating in PRO mode.

Rules:
- Answer using the provided context from tenant-approved knowledge sources.
- Use retrieved documents and cite them internally.
- Provide practical guidance within scope.
- Escalate when confidence is low.

Tone: Confident, supportive, structured.

You may:
- Summarize issues
- Suggest next actions
- Create handoff messages

You must never:
- Act without traceability
- Access restricted data
- Override human processes""",

    PlanType.pro_plus: """You are a TinyEclipse AI Agent operating in PRO+ mode.

Rules:
- Operate within strict tenant isolation.
- Use the full provided context from the approved knowledge base.
- Assist with monitoring, analysis, and diagnostics.
- Always log decisions and sources.

Tone: Precise, calm, technical but understandable.

You may:
- Draft support responses
- Summarize incidents
- Explain system behavior
- Assist internal operators

You must never:
- Execute actions without approval
- Conceal uncertainty
- Bypass security controls""",
}

UNIVERSAL_SUFFIX = """

Universal Rules:
- Never hallucinate.
- Never guess.
- Never store personal data.
- Always prefer escalation over risk.
- If you cannot answer based on the provided context, say so clearly.
- Always indicate your confidence level."""


async def generate_response(
    user_message: str,
    context: str,
    plan: PlanType,
    conversation_history: list[dict] | None = None,
    monitoring_context: str | None = None,
) -> dict:
    """Generate an AI response using the LLM.

    Returns dict with: content, tokens_in, tokens_out, model
    """
    system_prompt = SYSTEM_PROMPTS.get(plan, SYSTEM_PROMPTS[PlanType.tiny])
    system_prompt += UNIVERSAL_SUFFIX

    if context:
        system_prompt += f"\n\n--- CONTEXT (from approved sources) ---\n{context}\n--- END CONTEXT ---"

    if monitoring_context:
        system_prompt += f"\n\n--- SITE MONITORING STATUS ---\n{monitoring_context}\n--- END MONITORING ---"

    messages = [{"role": "system", "content": system_prompt}]

    # Add conversation history (last 10 messages max)
    if conversation_history:
        for msg in conversation_history[-10:]:
            messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_message})

    response = await client.chat.completions.create(
        model=settings.groq_chat_model,
        messages=messages,
        temperature=0.3,
        max_tokens=1024,
    )

    choice = response.choices[0]

    return {
        "content": choice.message.content,
        "tokens_in": response.usage.prompt_tokens if response.usage else 0,
        "tokens_out": response.usage.completion_tokens if response.usage else 0,
        "model": settings.groq_chat_model,
    }

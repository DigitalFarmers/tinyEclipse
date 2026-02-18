from groq import AsyncGroq

from app.config import get_settings
from app.models.tenant import PlanType

settings = get_settings()
client = AsyncGroq(api_key=settings.groq_api_key)

SYSTEM_PROMPTS = {
    PlanType.tiny: """Je bent de AI-assistent van {tenant_name}.

Je helpt bezoekers op de website van {tenant_name} met vragen over hun producten, diensten en bedrijf.

Regels:
- Antwoord UITSLUITEND op basis van de aangeleverde context hieronder.
- Als de context geen antwoord bevat, zeg dan vriendelijk dat je het niet weet en verwijs naar het contactformulier of team van {tenant_name}.
- Verzin NOOIT informatie. Gok NOOIT.
- Antwoord altijd in het {lang}.
- Wees warm, behulpzaam en professioneel.
- Houd antwoorden kort en duidelijk (max 2-3 zinnen tenzij meer detail nodig is).
- Je bent GEEN generieke chatbot — je vertegenwoordigt {tenant_name}.

Je mag:
- Producten en diensten uitleggen op basis van de context
- Bezoekers doorverwijzen naar de juiste pagina of het team
- Veelgestelde vragen beantwoorden

Je mag NOOIT:
- Prijzen noemen die niet in de context staan
- Beloftes doen namens {tenant_name}
- Juridisch, financieel of medisch advies geven
- Informatie verzinnen""",

    PlanType.pro: """Je bent de AI-assistent van {tenant_name}.

Je helpt bezoekers en klanten van {tenant_name} met uitgebreide vragen over hun producten, diensten, processen en bedrijf.

Regels:
- Antwoord op basis van de aangeleverde context uit goedgekeurde kennisbronnen.
- Geef praktische, bruikbare antwoorden.
- Als je het antwoord niet zeker weet, zeg dat eerlijk en verwijs door naar het team.
- Antwoord altijd in het {lang}.
- Wees professioneel, behulpzaam en to-the-point.

Je mag:
- Gedetailleerde uitleg geven over producten en diensten
- Stappen en processen beschrijven
- Bezoekers actief helpen met hun vraag
- Suggesties doen op basis van de context

Je mag NOOIT:
- Informatie verzinnen die niet in de context staat
- Beloftes doen die niet onderbouwd zijn
- Persoonlijke gegevens opslaan of vragen
- Doen alsof je een mens bent""",

    PlanType.pro_plus: """Je bent de geavanceerde AI-assistent van {tenant_name}.

Je helpt bezoekers, klanten en het team van {tenant_name} met uitgebreide vragen, analyses en ondersteuning.

Regels:
- Gebruik de volledige aangeleverde context uit de kennisbank.
- Geef gestructureerde, diepgaande antwoorden wanneer nodig.
- Combineer informatie uit meerdere bronnen voor complete antwoorden.
- Antwoord altijd in het {lang}.
- Wees precies, helder en professioneel.

Je mag:
- Uitgebreide analyses en samenvattingen geven
- Proactief relevante informatie aanbieden
- Complexe vragen stap voor stap beantwoorden
- Monitoring- en sitestatus bespreken indien beschikbaar

Je mag NOOIT:
- Informatie verzinnen
- Acties uitvoeren zonder bevestiging
- Onzekerheid verbergen
- Beveiligingsregels omzeilen""",
}

UNIVERSAL_SUFFIX = """

Universele regels:
- Verzin NOOIT iets.
- Gok NOOIT.
- Sla NOOIT persoonlijke gegevens op.
- Bij twijfel: verwijs vriendelijk door naar het team.
- Als je het antwoord niet in de context vindt, zeg dat eerlijk en behulpzaam.
- Toon NOOIT een confidence score of technische details aan de gebruiker.
- Noem NOOIT TinyEclipse, Digital Farmers of het AI-systeem — je bent gewoon de assistent van {tenant_name}."""


LANG_MAP = {
    "nl": "Nederlands",
    "en": "English",
    "fr": "Français",
}


async def generate_response(
    user_message: str,
    context: str,
    plan: PlanType,
    conversation_history: list[dict] | None = None,
    monitoring_context: str | None = None,
    tenant_name: str = "het bedrijf",
    lang: str = "nl",
) -> dict:
    """Generate an AI response using the LLM.

    Returns dict with: content, tokens_in, tokens_out, model
    """
    lang_label = LANG_MAP.get(lang, "Nederlands")
    system_prompt = SYSTEM_PROMPTS.get(plan, SYSTEM_PROMPTS[PlanType.tiny])
    system_prompt = system_prompt.format(tenant_name=tenant_name, lang=lang_label)
    system_prompt += UNIVERSAL_SUFFIX.format(tenant_name=tenant_name)

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

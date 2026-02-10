# TinyEclipse — Start Here

This document defines HOW we start, HOW we build, and HOW we decide.
Everything else derives from this.

If something is unclear, this document wins.
1. WHAT “STARTING” MEANS AT TINYECLIPSE

Starting does NOT mean:

building all features

finishing all documents

perfecting the UI

Starting means:

the system can run

the system can answer

the system can say “I don’t know”

the system can escalate

the system can be sold

If it can do those five things, we are live.

2. THE NON-NEGOTIABLE LOOP (CORE EXECUTION LOOP)

Every TinyEclipse feature MUST fit this loop:

INPUT → RETRIEVAL → RESPONSE → CONFIDENCE → LOG → ESCALATE (if needed)


If a feature skips a step:

it does not ship

no exceptions

This loop applies to:

AI chat

monitoring

support

admin actions

internal tools

3. TENANT-FIRST RULE (MOST IMPORTANT RULE)

Everything in TinyEclipse is tenant-scoped.

One tenant = one company

One company = one AI brain

No shared memory

No shared embeddings

No cross-tenant inference

WHMCS Client ID is the root identity.

If a function does not explicitly include tenant_id,
it is considered a bug.

4. WHAT SHIPS ON DAY ZERO (NO EXCUSES)
Required to go live:
AI

One Website AI Agent

RAG with:

website pages

product descriptions

FAQ

Confidence scoring

Escalation message

Backend

/chat endpoint

Rate limiting

Logging

Frontend

One embeddable widget

Minimal admin panel:

tenants

usage

conversations

Legal

AI Terms

Consent logging

Hard block without consent

If ANY of these is missing → do not add features.

5. WHAT DOES NOT SHIP ON DAY ZERO (ON PURPOSE)

Explicitly excluded:

Fine-tuning

Multiple models

Fancy dashboards

Advanced analytics

Automation actions

“Smart” decision-making

These come later.
Control comes first.

6. DECISION RULES (HOW WE CHOOSE FAST)

When in doubt, apply in this order:

Safety beats intelligence

Clarity beats cleverness

Isolation beats convenience

Logs beat assumptions

Shipping beats debating

If a discussion lasts more than 15 minutes,
the simplest option wins.

7. FAILURE IS A FEATURE (HOW WE HANDLE IT)

TinyEclipse is designed to fail gracefully.

When something goes wrong:

AI says it does not know

AI escalates

Human takes over

System logs everything

Silent failure is forbidden.

8. WHO OWNS WHAT (VERY PRACTICAL)
Infrastructure (Sahanur)

servers

monitoring

WHMCS hooks

limits & gating

Platform (Arif)

repo structure

admin UI

data models

ingestion flows

Direction (Founder)

vision

priorities

“yes / no”

what NOT to build

Overlap causes bugs.
Ownership creates speed.

9. THE FIRST SUCCESS METRIC

Not revenue.
Not usage.
Not features.

The first success metric is:

“Can we clearly explain what the AI did yesterday?”

If yes → we are building correctly.
If no → stop and fix logging.

10. THE PROMISE

TinyEclipse will never:

guess

hide uncertainty

act without traceability

sell magic

TinyEclipse will always:

explain itself

respect boundaries

defer to humans

grow carefully

This is how we scale without breaking trust.

END

If you are unsure what to do next:

read this again

pick the smallest step

ship it

Start tiny.
Eclipse everything else.


---

## WHY THIS DOCUMENT IS *THE* KILLER STARTER

Because it:
- 🧠 **prevents overengineering**
- 🛑 **kills scope creep**
- ⚖️ **enforces discipline**
- 🚀 **allows speed without chaos**
- 👥 **aligns humans before code**

Most teams skip this.  
They pay for it later.

You won’t.

---

## NEXT (VERY SHORT)
If you want, next I can:

1️⃣ Write **`ARCHITECTURE.md`** (dataflow + RAG isolation, diagram in words)  
2️⃣ Write **`WHMCS-INTEGRATION.md`** (exact hooks, payloads, edge cases)  
3️⃣ Write **`FIRST-DEPLOYMENT.md`** (Hetzner, Docker, secrets, rollback)

Just give me the number.  
TinyEclipse is officially real now. 🌘

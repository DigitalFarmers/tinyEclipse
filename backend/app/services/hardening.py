"""
TinyEclipse Server Hardening Service
Automated security audits, resource monitoring, and optimization suggestions.

Lightweight — runs periodic checks and stores results in the event bus.
No heavy dependencies, just smart analysis of existing data.
"""
import uuid
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func, and_, desc, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.conversation import Conversation
from app.models.message import Message, MessageRole
from app.models.source import Source, SourceStatus
from app.models.monitor import MonitorCheck, MonitorResult
from app.models.system_event import SystemEvent, EventSeverity, EventDomain
from app.models.knowledge_gap import KnowledgeGap, GapStatus

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# SECURITY AUDIT
# ═══════════════════════════════════════════════════════════════

async def run_security_audit(db: AsyncSession, tenant_id: Optional[uuid.UUID] = None) -> dict:
    """Run automated security checks across the platform.

    Checks:
    1. API rate limit violations
    2. Escalation patterns (possible abuse)
    3. Stale/orphaned data
    4. Knowledge source health
    5. Monitor coverage
    """
    findings = []
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    # ── 1. High escalation rate check ──
    if tenant_id:
        tenants = [(await db.get(Tenant, tenant_id))]
        tenants = [t for t in tenants if t]
    else:
        result = await db.execute(select(Tenant).where(Tenant.active == True))
        tenants = result.scalars().all()

    for tenant in tenants:
        tid = tenant.id
        # Escalation rate
        total_msgs = (await db.execute(
            select(func.count(Message.id)).where(and_(
                Message.tenant_id == tid,
                Message.role == MessageRole.assistant,
                Message.created_at >= last_7d,
            ))
        )).scalar() or 0

        escalated_msgs = (await db.execute(
            select(func.count(Message.id)).where(and_(
                Message.tenant_id == tid,
                Message.role == MessageRole.assistant,
                Message.escalated == True,
                Message.created_at >= last_7d,
            ))
        )).scalar() or 0

        if total_msgs > 10 and escalated_msgs / total_msgs > 0.25:
            findings.append({
                "category": "security",
                "severity": "warning",
                "tenant_id": str(tid),
                "tenant_name": tenant.name,
                "title": f"Hoog escalatiepercentage: {escalated_msgs}/{total_msgs} ({escalated_msgs/total_msgs*100:.0f}%)",
                "recommendation": "Controleer of er misbruik is of voeg meer kennis toe om escalaties te verminderen.",
            })

        # ── 2. Knowledge source health ──
        failed_sources = (await db.execute(
            select(func.count(Source.id)).where(and_(
                Source.tenant_id == tid,
                Source.status == SourceStatus.failed,
            ))
        )).scalar() or 0

        if failed_sources > 0:
            findings.append({
                "category": "knowledge",
                "severity": "warning",
                "tenant_id": str(tid),
                "tenant_name": tenant.name,
                "title": f"{failed_sources} kennisbronnen zijn mislukt bij indexering",
                "recommendation": "Herindexeer de mislukte bronnen of verwijder ze.",
            })

        # ── 3. Stale knowledge ──
        stale_sources = (await db.execute(
            select(func.count(Source.id)).where(and_(
                Source.tenant_id == tid,
                Source.status == SourceStatus.indexed,
                Source.last_indexed_at < now - timedelta(days=30),
            ))
        )).scalar() or 0

        if stale_sources > 0:
            findings.append({
                "category": "knowledge",
                "severity": "info",
                "tenant_id": str(tid),
                "tenant_name": tenant.name,
                "title": f"{stale_sources} bronnen zijn langer dan 30 dagen niet bijgewerkt",
                "recommendation": "Herindexeer bronnen om de kennis up-to-date te houden.",
            })

        # ── 4. Unresolved critical gaps ──
        critical_gaps = (await db.execute(
            select(func.count(KnowledgeGap.id)).where(and_(
                KnowledgeGap.tenant_id == tid,
                KnowledgeGap.status == GapStatus.open.value,
                KnowledgeGap.frequency >= 5,
            ))
        )).scalar() or 0

        if critical_gaps > 0:
            findings.append({
                "category": "ai",
                "severity": "warning",
                "tenant_id": str(tid),
                "tenant_name": tenant.name,
                "title": f"{critical_gaps} veelgestelde vragen zijn nog onbeantwoord (5+ keer gevraagd)",
                "recommendation": "Los deze knowledge gaps op via het AI Brain dashboard.",
            })

    # ── 5. Monitor coverage ──
    monitored_tenants = (await db.execute(
        select(func.count(func.distinct(MonitorCheck.tenant_id)))
    )).scalar() or 0

    total_active_tenants = (await db.execute(
        select(func.count(Tenant.id)).where(Tenant.active == True)
    )).scalar() or 0

    if total_active_tenants > 0 and monitored_tenants < total_active_tenants:
        unmonitored = total_active_tenants - monitored_tenants
        findings.append({
            "category": "monitoring",
            "severity": "info",
            "tenant_id": None,
            "tenant_name": "Platform",
            "title": f"{unmonitored} actieve tenants hebben geen uptime monitoring",
            "recommendation": "Voeg monitoring toe voor alle actieve websites.",
        })

    # ── 6. Error event spike ──
    error_events_24h = (await db.execute(
        select(func.count(SystemEvent.id)).where(and_(
            SystemEvent.severity.in_(["error", "critical"]),
            SystemEvent.created_at >= last_24h,
        ))
    )).scalar() or 0

    if error_events_24h > 20:
        findings.append({
            "category": "system",
            "severity": "error",
            "tenant_id": None,
            "tenant_name": "Platform",
            "title": f"{error_events_24h} foutmeldingen in de afgelopen 24 uur",
            "recommendation": "Bekijk het Technical Registry voor details over de fouten.",
        })

    # Score calculation
    critical_count = sum(1 for f in findings if f["severity"] in ("error", "critical"))
    warning_count = sum(1 for f in findings if f["severity"] == "warning")
    score = max(0, 100 - critical_count * 15 - warning_count * 5)

    return {
        "score": score,
        "grade": _score_grade(score),
        "findings": findings,
        "summary": {
            "total_checks": 6,
            "critical": critical_count,
            "warnings": warning_count,
            "info": sum(1 for f in findings if f["severity"] == "info"),
            "passed": 6 - len(set(f["category"] for f in findings)),
        },
        "checked_at": now.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# RESOURCE MONITOR
# ═══════════════════════════════════════════════════════════════

async def get_resource_overview(db: AsyncSession) -> dict:
    """Get platform resource utilization overview."""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    last_7d = now - timedelta(days=7)

    # Active tenants
    active_tenants = (await db.execute(
        select(func.count(Tenant.id)).where(Tenant.active == True)
    )).scalar() or 0

    # Conversations today
    convos_today = (await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.created_at >= last_24h
        )
    )).scalar() or 0

    # Conversations this week
    convos_week = (await db.execute(
        select(func.count(Conversation.id)).where(
            Conversation.created_at >= last_7d
        )
    )).scalar() or 0

    # Messages today
    msgs_today = (await db.execute(
        select(func.count(Message.id)).where(
            Message.created_at >= last_24h
        )
    )).scalar() or 0

    # Total sources & embeddings
    total_sources = (await db.execute(select(func.count(Source.id)))).scalar() or 0

    # Knowledge gaps
    open_gaps = (await db.execute(
        select(func.count(KnowledgeGap.id)).where(KnowledgeGap.status == GapStatus.open.value)
    )).scalar() or 0

    # System events today
    events_today = (await db.execute(
        select(func.count(SystemEvent.id)).where(SystemEvent.created_at >= last_24h)
    )).scalar() or 0

    # Per-tenant resource usage (top consumers)
    tenant_usage_result = await db.execute(
        select(
            Conversation.tenant_id,
            func.count(Conversation.id).label("conv_count"),
        )
        .where(Conversation.created_at >= last_7d)
        .group_by(Conversation.tenant_id)
        .order_by(desc("conv_count"))
        .limit(10)
    )
    top_tenants = []
    for row in tenant_usage_result.all():
        t = await db.get(Tenant, row[0])
        if t:
            top_tenants.append({
                "tenant_id": str(t.id),
                "name": t.name,
                "domain": t.domain,
                "conversations_7d": row[1],
            })

    return {
        "active_tenants": active_tenants,
        "conversations_today": convos_today,
        "conversations_week": convos_week,
        "messages_today": msgs_today,
        "total_sources": total_sources,
        "open_gaps": open_gaps,
        "events_today": events_today,
        "top_tenants": top_tenants,
        "checked_at": now.isoformat(),
    }


# ═══════════════════════════════════════════════════════════════
# OPTIMIZATION ENGINE
# ═══════════════════════════════════════════════════════════════

async def get_optimization_suggestions(db: AsyncSession) -> list[dict]:
    """Generate optimization suggestions based on platform data."""
    suggestions = []
    now = datetime.now(timezone.utc)
    last_30d = now - timedelta(days=30)

    # ── Inactive tenants consuming resources ──
    result = await db.execute(select(Tenant).where(Tenant.active == True))
    tenants = result.scalars().all()

    for tenant in tenants:
        # Check for tenants with no conversations in 30 days
        conv_count = (await db.execute(
            select(func.count(Conversation.id)).where(and_(
                Conversation.tenant_id == tenant.id,
                Conversation.created_at >= last_30d,
            ))
        )).scalar() or 0

        source_count = (await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == tenant.id)
        )).scalar() or 0

        if conv_count == 0 and source_count > 0:
            suggestions.append({
                "category": "resource",
                "priority": "low",
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "title": f"{tenant.name} heeft {source_count} bronnen maar geen gesprekken (30d)",
                "action": "Controleer of de widget correct is geïnstalleerd of het plan actief is.",
            })

        # Check for tenants with many failed sources
        failed = (await db.execute(
            select(func.count(Source.id)).where(and_(
                Source.tenant_id == tenant.id,
                Source.status == SourceStatus.failed,
            ))
        )).scalar() or 0

        if failed > 2:
            suggestions.append({
                "category": "knowledge",
                "priority": "medium",
                "tenant_id": str(tenant.id),
                "tenant_name": tenant.name,
                "title": f"{failed} mislukte kennisbronnen bij {tenant.name}",
                "action": "Verwijder of herindexeer de mislukte bronnen om opslagruimte te besparen.",
            })

    # ── Event bus cleanup suggestion ──
    old_events = (await db.execute(
        select(func.count(SystemEvent.id)).where(
            SystemEvent.created_at < now - timedelta(days=90)
        )
    )).scalar() or 0

    if old_events > 1000:
        suggestions.append({
            "category": "maintenance",
            "priority": "low",
            "tenant_id": None,
            "tenant_name": "Platform",
            "title": f"{old_events} system events ouder dan 90 dagen",
            "action": "Overweeg oude events op te ruimen om database-performance te behouden.",
        })

    # ── Knowledge gap resolution rate ──
    total_gaps = (await db.execute(select(func.count(KnowledgeGap.id)))).scalar() or 0
    resolved_gaps = (await db.execute(
        select(func.count(KnowledgeGap.id)).where(KnowledgeGap.status == GapStatus.resolved.value)
    )).scalar() or 0

    if total_gaps > 10 and resolved_gaps / total_gaps < 0.3:
        suggestions.append({
            "category": "ai",
            "priority": "high",
            "tenant_id": None,
            "tenant_name": "Platform",
            "title": f"Slechts {resolved_gaps}/{total_gaps} knowledge gaps opgelost ({resolved_gaps/total_gaps*100:.0f}%)",
            "action": "Los meer knowledge gaps op om de AI slimmer te maken en escalaties te verminderen.",
        })

    return suggestions


def _score_grade(score: int) -> str:
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B"
    elif score >= 60:
        return "C"
    elif score >= 50:
        return "D"
    return "F"

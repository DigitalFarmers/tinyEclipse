"""
TinyEclipse Portfolio Intelligence — The Agency Layer.
One view above ALL sites, ALL clients, ALL domains.
Deeper than DirectAdmin. Smarter than any hosting panel.

Key features:
- Agency-wide bird's-eye overview (all clients, all domains, health scores)
- Client portfolio deep-dive (one client's domains compared side-by-side)
- Cross-domain knowledge sharing opportunities
- Unified timeline across all domains
- Domain comparison matrix
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

from sqlalchemy import select, func, and_, desc, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client_account import ClientAccount
from app.models.tenant import Tenant, TenantStatus
from app.models.source import Source
from app.models.embedding import Embedding
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.visitor import VisitorSession, PageView
from app.models.monitor import MonitorCheck, MonitorResult
from app.models.knowledge_gap import KnowledgeGap, VisitorProfile, GapStatus
from app.models.system_event import SystemEvent
from app.models.module_event import ModuleEvent
from app.models.lead import Lead
from app.models.contact import Contact

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# AGENCY OVERVIEW — bird's-eye view of ALL clients & domains
# ═══════════════════════════════════════════════════════════════

async def get_agency_overview(db: AsyncSession) -> Dict:
    """Complete agency overview — all clients, all domains, aggregated health."""
    now = datetime.now(timezone.utc)
    last_30d = now - timedelta(days=30)
    last_24h = now - timedelta(hours=24)

    # All client accounts with tenants
    accounts_result = await db.execute(
        select(ClientAccount).order_by(ClientAccount.created_at)
    )
    accounts = accounts_result.scalars().all()

    clients = []
    total_domains = 0
    total_conversations_30d = 0
    total_sessions_30d = 0
    total_sources = 0
    total_leads = 0

    for account in accounts:
        tenants_result = await db.execute(
            select(Tenant).where(Tenant.client_account_id == account.id)
        )
        tenants = tenants_result.scalars().all()

        prod_tenants = [t for t in tenants if str(getattr(t, 'environment', 'production')) == 'production' or (hasattr(t.environment, 'value') and t.environment.value == 'production')]
        staging_tenants = [t for t in tenants if t not in prod_tenants]

        domains = []
        client_conversations = 0
        client_sessions = 0
        client_sources = 0
        client_leads = 0
        client_health_scores = []

        for t in prod_tenants:
            tid = t.id

            # Conversations (30d)
            convs = (await db.execute(
                select(func.count(Conversation.id)).where(and_(
                    Conversation.tenant_id == tid,
                    Conversation.created_at >= last_30d,
                ))
            )).scalar() or 0

            # Sessions (30d)
            sessions = (await db.execute(
                select(func.count(VisitorSession.id)).where(and_(
                    VisitorSession.tenant_id == tid,
                    VisitorSession.created_at >= last_30d,
                ))
            )).scalar() or 0

            # Sources
            sources = (await db.execute(
                select(func.count(Source.id)).where(Source.tenant_id == tid)
            )).scalar() or 0

            # Leads
            leads = (await db.execute(
                select(func.count(Lead.id)).where(Lead.tenant_id == tid)
            )).scalar() or 0

            # Open gaps
            open_gaps = (await db.execute(
                select(func.count(KnowledgeGap.id)).where(and_(
                    KnowledgeGap.tenant_id == tid,
                    KnowledgeGap.status == GapStatus.open.value,
                ))
            )).scalar() or 0

            # Uptime check
            uptime_check = (await db.execute(
                select(MonitorCheck).where(and_(
                    MonitorCheck.tenant_id == tid,
                    MonitorCheck.check_type == "uptime",
                    MonitorCheck.enabled == True,
                ))
            )).scalars().first()

            response_ms = uptime_check.last_response_ms if uptime_check and uptime_check.last_response_ms else None
            uptime_status = uptime_check.last_status.value if uptime_check and uptime_check.last_status else "unknown"

            # Site rating from settings
            site_rating = (t.settings or {}).get("site_rating", None)

            # Calibration
            cal_score = t.calibration_score

            # Health score (simple composite)
            health = _calculate_domain_health(sources, open_gaps, cal_score, response_ms, convs)
            client_health_scores.append(health)

            domains.append({
                "tenant_id": str(tid),
                "name": t.name,
                "domain": t.domain,
                "plan": t.plan.value if hasattr(t.plan, 'value') else str(t.plan),
                "status": t.status.value if hasattr(t.status, 'value') else str(t.status),
                "conversations_30d": convs,
                "sessions_30d": sessions,
                "sources": sources,
                "leads": leads,
                "open_gaps": open_gaps,
                "response_ms": response_ms,
                "uptime_status": uptime_status,
                "site_rating": site_rating,
                "calibration_score": cal_score,
                "health_score": health,
            })

            client_conversations += convs
            client_sessions += sessions
            client_sources += sources
            client_leads += leads

        total_domains += len(prod_tenants)
        total_conversations_30d += client_conversations
        total_sessions_30d += client_sessions
        total_sources += client_sources
        total_leads += client_leads

        avg_health = round(sum(client_health_scores) / max(len(client_health_scores), 1))

        clients.append({
            "account_id": str(account.id),
            "whmcs_client_id": account.whmcs_client_id,
            "name": account.name,
            "email": account.email,
            "company": account.company,
            "production_domains": len(prod_tenants),
            "staging_domains": len(staging_tenants),
            "total_conversations_30d": client_conversations,
            "total_sessions_30d": client_sessions,
            "total_sources": client_sources,
            "total_leads": client_leads,
            "avg_health_score": avg_health,
            "domains": domains,
        })

    # Sort clients by health (worst first for attention)
    clients.sort(key=lambda c: c["avg_health_score"])

    # Agency-level events today
    events_today = (await db.execute(
        select(func.count(SystemEvent.id)).where(SystemEvent.created_at >= last_24h)
    )).scalar() or 0

    return {
        "generated_at": now.isoformat(),
        "totals": {
            "clients": len(accounts),
            "production_domains": total_domains,
            "conversations_30d": total_conversations_30d,
            "sessions_30d": total_sessions_30d,
            "sources": total_sources,
            "leads": total_leads,
            "events_today": events_today,
        },
        "clients": clients,
    }


# ═══════════════════════════════════════════════════════════════
# CLIENT PORTFOLIO — deep dive into one client's domains
# ═══════════════════════════════════════════════════════════════

async def get_client_portfolio(
    db: AsyncSession,
    client_account_id: uuid.UUID,
) -> Dict:
    """Deep portfolio view for one client — all domains compared."""
    account = await db.get(ClientAccount, client_account_id)
    if not account:
        return {"error": "Client account not found"}

    now = datetime.now(timezone.utc)
    last_30d = now - timedelta(days=30)
    last_7d = now - timedelta(days=7)

    tenants_result = await db.execute(
        select(Tenant).where(Tenant.client_account_id == client_account_id)
    )
    tenants = tenants_result.scalars().all()
    prod_tenants = [t for t in tenants if str(getattr(t, 'environment', 'production')) == 'production' or (hasattr(t.environment, 'value') and t.environment.value == 'production')]

    domains = []
    for t in prod_tenants:
        tid = t.id
        domain_data = await _get_domain_deep_stats(db, t, last_30d, last_7d)
        domains.append(domain_data)

    # Cross-domain knowledge sharing opportunities
    knowledge_sharing = await _find_knowledge_sharing(db, prod_tenants)

    # Unified recent events
    tenant_ids = [t.id for t in prod_tenants]
    recent_events = []
    if tenant_ids:
        events_result = await db.execute(
            select(SystemEvent)
            .where(SystemEvent.tenant_id.in_(tenant_ids))
            .order_by(desc(SystemEvent.created_at))
            .limit(20)
        )
        for e in events_result.scalars().all():
            # Find which tenant this event belongs to
            tenant_name = next((t.name for t in prod_tenants if t.id == e.tenant_id), "Platform")
            recent_events.append({
                "id": str(e.id),
                "tenant_name": tenant_name,
                "domain": e.domain if e.domain else "system",
                "severity": e.severity if e.severity else "info",
                "action": e.action,
                "title": e.title,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            })

    return {
        "account": {
            "id": str(account.id),
            "name": account.name,
            "email": account.email,
            "company": account.company,
            "whmcs_client_id": account.whmcs_client_id,
        },
        "generated_at": now.isoformat(),
        "domain_count": len(prod_tenants),
        "staging_count": len(tenants) - len(prod_tenants),
        "domains": domains,
        "knowledge_sharing": knowledge_sharing,
        "recent_events": recent_events,
    }


# ═══════════════════════════════════════════════════════════════
# DOMAIN COMPARISON — side-by-side metrics
# ═══════════════════════════════════════════════════════════════

async def get_domain_comparison(
    db: AsyncSession,
    client_account_id: uuid.UUID,
) -> Dict:
    """Side-by-side domain comparison matrix for a client."""
    account = await db.get(ClientAccount, client_account_id)
    if not account:
        return {"error": "Client account not found"}

    now = datetime.now(timezone.utc)
    last_30d = now - timedelta(days=30)

    tenants_result = await db.execute(
        select(Tenant).where(and_(
            Tenant.client_account_id == client_account_id,
        ))
    )
    tenants = tenants_result.scalars().all()
    prod_tenants = [t for t in tenants if str(getattr(t, 'environment', 'production')) == 'production' or (hasattr(t.environment, 'value') and t.environment.value == 'production')]

    if len(prod_tenants) < 2:
        return {"error": "Minstens 2 productie-domeinen nodig voor vergelijking", "domains": []}

    metrics = []
    for t in prod_tenants:
        tid = t.id

        # Sessions
        sessions_30d = (await db.execute(
            select(func.count(VisitorSession.id)).where(and_(
                VisitorSession.tenant_id == tid,
                VisitorSession.created_at >= last_30d,
            ))
        )).scalar() or 0

        # Conversations
        convs_30d = (await db.execute(
            select(func.count(Conversation.id)).where(and_(
                Conversation.tenant_id == tid,
                Conversation.created_at >= last_30d,
            ))
        )).scalar() or 0

        # Messages
        msgs_30d = (await db.execute(
            select(func.count(Message.id)).where(and_(
                Message.tenant_id == tid,
                Message.created_at >= last_30d,
            ))
        )).scalar() or 0

        # Sources
        sources = (await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == tid)
        )).scalar() or 0

        # Embeddings
        embeddings = (await db.execute(
            select(func.count(Embedding.id)).where(Embedding.tenant_id == tid)
        )).scalar() or 0

        # Leads
        leads = (await db.execute(
            select(func.count(Lead.id)).where(Lead.tenant_id == tid)
        )).scalar() or 0

        # Contacts
        contacts = (await db.execute(
            select(func.count(Contact.id)).where(Contact.tenant_id == tid)
        )).scalar() or 0

        # Open gaps
        gaps = (await db.execute(
            select(func.count(KnowledgeGap.id)).where(and_(
                KnowledgeGap.tenant_id == tid,
                KnowledgeGap.status == GapStatus.open.value,
            ))
        )).scalar() or 0

        # Avg confidence
        avg_conf = (await db.execute(
            select(func.avg(Message.confidence)).where(and_(
                Message.tenant_id == tid,
                Message.confidence.isnot(None),
                Message.created_at >= last_30d,
            ))
        )).scalar()

        # Uptime
        uptime_check = (await db.execute(
            select(MonitorCheck).where(and_(
                MonitorCheck.tenant_id == tid,
                MonitorCheck.check_type == "uptime",
                MonitorCheck.enabled == True,
            ))
        )).scalars().first()

        response_ms = uptime_check.last_response_ms if uptime_check and uptime_check.last_response_ms else None

        # Site rating & languages from settings
        settings = t.settings or {}
        site_rating = settings.get("site_rating", None)
        languages = settings.get("languages", [])
        content_units = settings.get("content_units", {})

        # Health
        health = _calculate_domain_health(sources, gaps, t.calibration_score, response_ms, convs_30d)

        metrics.append({
            "tenant_id": str(tid),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value if hasattr(t.plan, 'value') else str(t.plan),
            "sessions_30d": sessions_30d,
            "conversations_30d": convs_30d,
            "messages_30d": msgs_30d,
            "sources": sources,
            "embeddings": embeddings,
            "leads": leads,
            "contacts": contacts,
            "open_gaps": gaps,
            "avg_confidence": round(avg_conf * 100, 1) if avg_conf else 0,
            "response_ms": response_ms,
            "site_rating": site_rating,
            "languages": languages,
            "content_units": content_units,
            "calibration_score": t.calibration_score,
            "health_score": health,
        })

    # Determine winner per metric
    comparison_keys = [
        "sessions_30d", "conversations_30d", "sources", "leads",
        "avg_confidence", "health_score",
    ]
    winners = {}
    for key in comparison_keys:
        best = max(metrics, key=lambda m: m.get(key, 0) or 0)
        winners[key] = best["tenant_id"]

    # Worst response time = worst
    if any(m["response_ms"] for m in metrics):
        fastest = min((m for m in metrics if m["response_ms"]), key=lambda m: m["response_ms"])
        winners["response_ms"] = fastest["tenant_id"]

    return {
        "account_name": account.name,
        "generated_at": now.isoformat(),
        "domains": metrics,
        "winners": winners,
    }


# ═══════════════════════════════════════════════════════════════
# UNIFIED TIMELINE — cross-domain event stream
# ═══════════════════════════════════════════════════════════════

async def get_unified_timeline(
    db: AsyncSession,
    client_account_id: uuid.UUID,
    hours: int = 168,
    limit: int = 50,
) -> Dict:
    """Unified event timeline across all domains for a client."""
    tenants_result = await db.execute(
        select(Tenant).where(Tenant.client_account_id == client_account_id)
    )
    tenants = tenants_result.scalars().all()
    tenant_ids = [t.id for t in tenants]
    tenant_map = {t.id: {"name": t.name, "domain": t.domain} for t in tenants}

    if not tenant_ids:
        return {"events": [], "total": 0}

    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Count
    total = (await db.execute(
        select(func.count(SystemEvent.id)).where(and_(
            SystemEvent.tenant_id.in_(tenant_ids),
            SystemEvent.created_at >= since,
        ))
    )).scalar() or 0

    # Events
    events_result = await db.execute(
        select(SystemEvent)
        .where(and_(
            SystemEvent.tenant_id.in_(tenant_ids),
            SystemEvent.created_at >= since,
        ))
        .order_by(desc(SystemEvent.created_at))
        .limit(limit)
    )

    events = []
    for e in events_result.scalars().all():
        t_info = tenant_map.get(e.tenant_id, {"name": "Unknown", "domain": None})
        events.append({
            "id": str(e.id),
            "tenant_name": t_info["name"],
            "tenant_domain": t_info["domain"],
            "domain": e.domain if e.domain else "system",
            "severity": e.severity if e.severity else "info",
            "action": e.action,
            "title": e.title,
            "detail": e.detail,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {"total": total, "events": events}


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _calculate_domain_health(
    sources: int, open_gaps: int, calibration_score: Optional[float],
    response_ms: Optional[int], conversations_30d: int,
) -> int:
    """Calculate a 0-100 health score for a single domain."""
    score = 50  # Base

    # Sources (max +20)
    score += min(20, sources * 2)

    # Gaps penalty (max -15)
    score -= min(15, open_gaps * 3)

    # Calibration (max +15)
    if calibration_score and calibration_score > 0:
        score += min(15, int(calibration_score * 15))

    # Response time (max +10, penalty if slow)
    if response_ms:
        if response_ms < 500:
            score += 10
        elif response_ms < 1000:
            score += 5
        elif response_ms > 2000:
            score -= 5

    # Activity bonus (max +5)
    if conversations_30d > 10:
        score += 5
    elif conversations_30d > 0:
        score += 2

    return max(0, min(100, score))


async def _get_domain_deep_stats(
    db: AsyncSession, tenant: Tenant,
    last_30d: datetime, last_7d: datetime,
) -> Dict:
    """Get comprehensive stats for a single domain."""
    tid = tenant.id

    # Sessions
    sessions_30d = (await db.execute(
        select(func.count(VisitorSession.id)).where(and_(
            VisitorSession.tenant_id == tid,
            VisitorSession.created_at >= last_30d,
        ))
    )).scalar() or 0

    sessions_7d = (await db.execute(
        select(func.count(VisitorSession.id)).where(and_(
            VisitorSession.tenant_id == tid,
            VisitorSession.created_at >= last_7d,
        ))
    )).scalar() or 0

    # Conversations
    convs_30d = (await db.execute(
        select(func.count(Conversation.id)).where(and_(
            Conversation.tenant_id == tid,
            Conversation.created_at >= last_30d,
        ))
    )).scalar() or 0

    convs_7d = (await db.execute(
        select(func.count(Conversation.id)).where(and_(
            Conversation.tenant_id == tid,
            Conversation.created_at >= last_7d,
        ))
    )).scalar() or 0

    # Sources & embeddings
    sources = (await db.execute(
        select(func.count(Source.id)).where(Source.tenant_id == tid)
    )).scalar() or 0

    embeddings = (await db.execute(
        select(func.count(Embedding.id)).where(Embedding.tenant_id == tid)
    )).scalar() or 0

    # Leads
    leads = (await db.execute(
        select(func.count(Lead.id)).where(Lead.tenant_id == tid)
    )).scalar() or 0

    # Knowledge gaps
    open_gaps = (await db.execute(
        select(func.count(KnowledgeGap.id)).where(and_(
            KnowledgeGap.tenant_id == tid,
            KnowledgeGap.status == GapStatus.open.value,
        ))
    )).scalar() or 0

    resolved_gaps = (await db.execute(
        select(func.count(KnowledgeGap.id)).where(and_(
            KnowledgeGap.tenant_id == tid,
            KnowledgeGap.status == GapStatus.resolved.value,
        ))
    )).scalar() or 0

    # Avg confidence
    avg_conf = (await db.execute(
        select(func.avg(Message.confidence)).where(and_(
            Message.tenant_id == tid,
            Message.confidence.isnot(None),
            Message.created_at >= last_30d,
        ))
    )).scalar()

    # Module events (orders, forms)
    orders_30d = (await db.execute(
        select(func.count(ModuleEvent.id)).where(and_(
            ModuleEvent.tenant_id == tid,
            ModuleEvent.event_type.in_(["order_placed", "order_completed"]),
            ModuleEvent.created_at >= last_30d,
        ))
    )).scalar() or 0

    # Uptime
    uptime_check = (await db.execute(
        select(MonitorCheck).where(and_(
            MonitorCheck.tenant_id == tid,
            MonitorCheck.check_type == "uptime",
            MonitorCheck.enabled == True,
        ))
    )).scalars().first()

    response_ms = uptime_check.last_response_ms if uptime_check and uptime_check.last_response_ms else None
    uptime_status = uptime_check.last_status.value if uptime_check and uptime_check.last_status else "unknown"

    # Settings-derived data
    settings = tenant.settings or {}
    site_rating = settings.get("site_rating", None)
    languages = settings.get("languages", [])
    content_units = settings.get("content_units", {})
    deep_scan = settings.get("deep_scan", {})
    connector_version = settings.get("connector_version", None)

    health = _calculate_domain_health(sources, open_gaps, tenant.calibration_score, response_ms, convs_30d)

    # Growth: compare 7d to projected from 30d
    sessions_daily_avg = sessions_30d / 30 if sessions_30d else 0
    sessions_7d_expected = sessions_daily_avg * 7
    growth = round(((sessions_7d - sessions_7d_expected) / max(sessions_7d_expected, 1)) * 100, 1) if sessions_7d_expected > 0 else 0

    return {
        "tenant_id": str(tid),
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value if hasattr(tenant.plan, 'value') else str(tenant.plan),
        "status": tenant.status.value if hasattr(tenant.status, 'value') else str(tenant.status),
        "health_score": health,
        "traffic": {
            "sessions_30d": sessions_30d,
            "sessions_7d": sessions_7d,
            "growth_pct": growth,
        },
        "ai": {
            "conversations_30d": convs_30d,
            "conversations_7d": convs_7d,
            "avg_confidence": round(avg_conf * 100, 1) if avg_conf else 0,
            "sources": sources,
            "embeddings": embeddings,
            "open_gaps": open_gaps,
            "resolved_gaps": resolved_gaps,
            "calibration_score": tenant.calibration_score,
        },
        "business": {
            "leads": leads,
            "orders_30d": orders_30d,
        },
        "technical": {
            "response_ms": response_ms,
            "uptime_status": uptime_status,
            "site_rating": site_rating,
            "connector_version": connector_version,
            "languages": languages,
            "content_units": content_units,
        },
    }


async def _find_knowledge_sharing(
    db: AsyncSession,
    tenants: List[Tenant],
) -> List[Dict]:
    """Find opportunities to share knowledge between sibling domains."""
    opportunities = []

    if len(tenants) < 2:
        return opportunities

    # Gather gap data per tenant
    tenant_gaps: Dict[str, List[Dict]] = {}
    tenant_sources: Dict[str, int] = {}

    for t in tenants:
        # Gaps
        gaps_result = await db.execute(
            select(KnowledgeGap)
            .where(and_(
                KnowledgeGap.tenant_id == t.id,
                KnowledgeGap.status == GapStatus.open.value,
            ))
            .order_by(desc(KnowledgeGap.frequency))
            .limit(20)
        )
        gaps = gaps_result.scalars().all()
        tenant_gaps[str(t.id)] = [
            {"question": g.question, "category": g.category, "frequency": g.frequency}
            for g in gaps
        ]

        # Source count
        src_count = (await db.execute(
            select(func.count(Source.id)).where(Source.tenant_id == t.id)
        )).scalar() or 0
        tenant_sources[str(t.id)] = src_count

    # Check if one tenant has much more knowledge than another
    for i, t1 in enumerate(tenants):
        for t2 in tenants[i + 1:]:
            t1_id, t2_id = str(t1.id), str(t2.id)
            s1, s2 = tenant_sources.get(t1_id, 0), tenant_sources.get(t2_id, 0)

            # Knowledge imbalance
            if s1 > 0 and s2 > 0:
                ratio = max(s1, s2) / min(s1, s2)
                if ratio > 2:
                    richer = t1 if s1 > s2 else t2
                    poorer = t2 if s1 > s2 else t1
                    opportunities.append({
                        "type": "knowledge_imbalance",
                        "title": f"{richer.name} heeft {max(s1, s2)} bronnen vs {min(s1, s2)} bij {poorer.name}",
                        "description": f"Overweeg gedeelde kennisbronnen (FAQ, productinfo) te kopiëren van {richer.domain} naar {poorer.domain}.",
                        "impact": "high" if ratio > 3 else "medium",
                        "from_domain": richer.domain,
                        "to_domain": poorer.domain,
                    })

            # Overlapping gaps (same category of questions on both sites)
            g1_cats = set(g["category"] for g in tenant_gaps.get(t1_id, []))
            g2_cats = set(g["category"] for g in tenant_gaps.get(t2_id, []))
            shared_cats = g1_cats & g2_cats

            for cat in shared_cats:
                g1_in_cat = [g for g in tenant_gaps.get(t1_id, []) if g["category"] == cat]
                g2_in_cat = [g for g in tenant_gaps.get(t2_id, []) if g["category"] == cat]
                total_freq = sum(g["frequency"] for g in g1_in_cat + g2_in_cat)

                if total_freq >= 3:
                    opportunities.append({
                        "type": "shared_gap",
                        "title": f"Gedeelde kennislacune: '{cat}' op zowel {t1.name} als {t2.name}",
                        "description": f"Beide sites missen kennis over '{cat}' ({total_freq}× gevraagd). Eén antwoord kan beide sites helpen.",
                        "impact": "high" if total_freq >= 5 else "medium",
                        "category": cat,
                        "affected_domains": [t1.domain, t2.domain],
                    })

    # Sort by impact
    impact_order = {"high": 0, "medium": 1, "low": 2}
    opportunities.sort(key=lambda o: impact_order.get(o.get("impact", "low"), 2))

    return opportunities

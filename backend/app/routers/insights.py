"""
AI Insights Engine — Smart summaries, improvement suggestions, growth tracking.
The brain that turns raw data into actionable intelligence for Mo (superadmin) and clients.

Endpoints:
- GET /api/admin/insights/{tenant_id}/summary — AI-generated period summary
- GET /api/admin/insights/{tenant_id}/suggestions — Improvement suggestions for Windsurf/Mo
- GET /api/admin/insights/global — Cross-client intelligence for superadmin
- GET /api/portal/insights/{tenant_id}/summary — Client-facing summary
- GET /api/portal/insights/{tenant_id}/growth — Growth tracker for client
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_, case
from sqlalchemy.ext.asyncio import AsyncSession
from groq import AsyncGroq

from app.database import get_db
from app.config import get_settings
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, PlanType, TenantStatus, TenantEnvironment
from app.models.client_account import ClientAccount
from app.models.monitor import MonitorCheck, MonitorResult, Alert, CheckType, CheckStatus
from app.models.visitor import VisitorSession, PageView
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message
from app.models.usage_log import UsageLog
from app.models.source import Source
from app.models.site_module import SiteModule
from app.models.module_event import ModuleEvent

logger = logging.getLogger(__name__)
settings = get_settings()


# ═══════════════════════════════════════════════════════════
#  ADMIN INSIGHTS (Superadmin — Mo)
# ═══════════════════════════════════════════════════════════

admin_router = APIRouter(
    prefix="/api/admin/insights",
    tags=["admin-insights"],
    dependencies=[Depends(verify_admin_key)],
)


async def _gather_tenant_stats(db: AsyncSession, tenant: Tenant, since: datetime, until: datetime) -> dict:
    """Gather comprehensive stats for a single tenant over a period."""
    tid = tenant.id
    prev_since = since - (until - since)  # Previous period for comparison

    # Current period
    sessions_q = await db.execute(
        select(func.count(VisitorSession.id)).where(
            and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= since, VisitorSession.created_at < until)
        )
    )
    sessions = sessions_q.scalar() or 0

    prev_sessions_q = await db.execute(
        select(func.count(VisitorSession.id)).where(
            and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= prev_since, VisitorSession.created_at < since)
        )
    )
    prev_sessions = prev_sessions_q.scalar() or 0

    pageviews_q = await db.execute(
        select(func.count(PageView.id)).where(
            and_(PageView.tenant_id == tid, PageView.created_at >= since, PageView.created_at < until)
        )
    )
    pageviews = pageviews_q.scalar() or 0

    convs_q = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(Conversation.tenant_id == tid, Conversation.created_at >= since, Conversation.created_at < until)
        )
    )
    conversations = convs_q.scalar() or 0

    prev_convs_q = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(Conversation.tenant_id == tid, Conversation.created_at >= prev_since, Conversation.created_at < since)
        )
    )
    prev_conversations = prev_convs_q.scalar() or 0

    escalations_q = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(Conversation.tenant_id == tid, Conversation.created_at >= since,
                 Conversation.status == ConversationStatus.escalated)
        )
    )
    escalations = escalations_q.scalar() or 0

    alerts_q = await db.execute(
        select(func.count(Alert.id)).where(
            and_(Alert.tenant_id == tid, Alert.created_at >= since, Alert.created_at < until)
        )
    )
    alerts = alerts_q.scalar() or 0

    unresolved_q = await db.execute(
        select(func.count(Alert.id)).where(
            and_(Alert.tenant_id == tid, Alert.resolved == False)
        )
    )
    unresolved = unresolved_q.scalar() or 0

    # Uptime
    uptime_check_q = await db.execute(
        select(MonitorCheck).where(
            and_(MonitorCheck.tenant_id == tid, MonitorCheck.check_type == CheckType.uptime)
        )
    )
    uptime_check = uptime_check_q.scalar_one_or_none()
    uptime_pct = None
    avg_response_ms = None
    if uptime_check:
        results_q = await db.execute(
            select(MonitorResult).where(
                and_(MonitorResult.check_id == uptime_check.id, MonitorResult.created_at >= since)
            )
        )
        results = results_q.scalars().all()
        if results:
            ok = sum(1 for r in results if r.status == CheckStatus.ok)
            uptime_pct = round(ok / len(results) * 100, 2)
            resp_times = [r.response_ms for r in results if r.response_ms]
            avg_response_ms = round(sum(resp_times) / max(len(resp_times), 1)) if resp_times else None

    # Sources
    sources_q = await db.execute(
        select(func.count(Source.id)).where(Source.tenant_id == tid)
    )
    sources = sources_q.scalar() or 0

    # Modules
    modules_q = await db.execute(
        select(SiteModule.module_type).where(SiteModule.tenant_id == tid)
    )
    modules = [r[0] for r in modules_q.all()]

    # Module events
    module_events_q = await db.execute(
        select(func.count(ModuleEvent.id)).where(
            and_(ModuleEvent.tenant_id == tid, ModuleEvent.created_at >= since)
        )
    )
    module_events = module_events_q.scalar() or 0

    # Top pages
    top_pages_q = await db.execute(
        select(PageView.path, func.count(PageView.id).label("views"))
        .where(and_(PageView.tenant_id == tid, PageView.created_at >= since))
        .group_by(PageView.path)
        .order_by(func.count(PageView.id).desc())
        .limit(5)
    )
    top_pages = [{"path": r[0], "views": r[1]} for r in top_pages_q.all()]

    def pct_change(current, previous):
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round((current - previous) / previous * 100, 1)

    return {
        "tenant_id": str(tid),
        "name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
        "sessions": sessions,
        "sessions_change": pct_change(sessions, prev_sessions),
        "pageviews": pageviews,
        "conversations": conversations,
        "conversations_change": pct_change(conversations, prev_conversations),
        "escalations": escalations,
        "escalation_rate": round(escalations / max(conversations, 1) * 100, 1),
        "alerts": alerts,
        "unresolved_alerts": unresolved,
        "uptime_pct": uptime_pct,
        "avg_response_ms": avg_response_ms,
        "sources": sources,
        "modules": modules,
        "module_events": module_events,
        "top_pages": top_pages,
    }


async def _generate_ai_summary(stats: dict, period: str, for_client: bool = False) -> dict:
    """Use LLM to generate a smart summary with actionable insights."""
    audience = "de klant (website-eigenaar)" if for_client else "Mo, de superadmin van Digital Farmers"

    prompt = f"""Je bent de AI-analist van TinyEclipse, het website intelligence platform van Digital Farmers.

Genereer een {period} samenvatting voor {audience}.

DATA:
- Website: {stats['name']} ({stats['domain']})
- Plan: {stats['plan']}
- Bezoekers: {stats['sessions']} ({stats['sessions_change']:+.1f}% vs vorige periode)
- Pageviews: {stats['pageviews']}
- AI Gesprekken: {stats['conversations']} ({stats['conversations_change']:+.1f}% vs vorige periode)
- Escalaties: {stats['escalations']} ({stats['escalation_rate']}% escalation rate)
- Monitoring alerts: {stats['alerts']} (waarvan {stats['unresolved_alerts']} onopgelost)
- Uptime: {stats['uptime_pct']}%
- Gem. responstijd: {stats['avg_response_ms']}ms
- Kennisbronnen: {stats['sources']}
- Actieve modules: {', '.join(stats['modules']) if stats['modules'] else 'geen'}
- Module events: {stats['module_events']}
- Top paginas: {', '.join(p['path'] + ' (' + str(p['views']) + 'x)' for p in stats['top_pages'][:3]) if stats['top_pages'] else 'geen data'}

Geef terug in dit EXACT JSON format (geen markdown, alleen pure JSON):
{{
  "headline": "Korte krachtige samenvatting in 1 zin",
  "summary": "2-3 zinnen samenvatting van de belangrijkste trends",
  "highlights": ["positief punt 1", "positief punt 2"],
  "concerns": ["aandachtspunt 1 als er zijn"],
  "suggestions": [
    {{"title": "Suggestie titel", "description": "Wat te doen en waarom", "impact": "high/medium/low", "category": "seo/content/performance/security/conversion/ai"}}
  ],
  "growth_score": 0-100,
  "health_score": 0-100
}}

{"Richt suggesties op wat Mo kan verbeteren via Windsurf/code en wat hij als dienst aan de klant kan aanbieden." if not for_client else "Richt suggesties op wat de klant zelf kan doen of bij Digital Farmers kan aanvragen."}
Wees concreet en specifiek, geen vage adviezen. Maximaal 5 suggesties."""

    try:
        groq = AsyncGroq(api_key=settings.groq_api_key)
        response = await groq.chat.completions.create(
            model=settings.groq_chat_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1500,
            response_format={"type": "json_object"},
        )
        import json
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        logger.error(f"AI summary generation failed: {e}")
        return {
            "headline": f"Samenvatting voor {stats['name']}",
            "summary": f"{stats['sessions']} bezoekers, {stats['conversations']} gesprekken, {stats['alerts']} alerts in deze periode.",
            "highlights": [],
            "concerns": [str(e)] if stats["unresolved_alerts"] > 0 else [],
            "suggestions": [],
            "growth_score": 50,
            "health_score": 50,
        }


def _period_range(period: str) -> tuple[datetime, datetime]:
    """Get start/end datetime for a period."""
    now = datetime.now(timezone.utc)
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(weeks=1)
    elif period == "month":
        since = now - timedelta(days=30)
    elif period == "year":
        since = now - timedelta(days=365)
    else:
        since = now - timedelta(weeks=1)
    return since, now


@admin_router.get("/{tenant_id}/summary")
async def admin_tenant_summary(
    tenant_id: str,
    period: str = Query("week", pattern="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db),
):
    """AI-generated summary for a specific tenant — for Mo."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    since, until = _period_range(period)
    stats = await _gather_tenant_stats(db, tenant, since, until)
    ai = await _generate_ai_summary(stats, period, for_client=False)

    return {
        "tenant_id": tenant_id,
        "period": period,
        "from": since.isoformat(),
        "to": until.isoformat(),
        "stats": stats,
        "ai": ai,
    }


@admin_router.get("/{tenant_id}/suggestions")
async def admin_improvement_suggestions(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Detailed improvement suggestions for Mo to execute via Windsurf."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    since, until = _period_range("month")
    stats = await _gather_tenant_stats(db, tenant, since, until)

    # Build detailed suggestion prompt
    prompt = f"""Je bent de technische adviseur van Digital Farmers (Mo's bedrijf).
Mo gebruikt Windsurf (AI code editor) om websites te verbeteren.

Analyseer deze website en geef CONCRETE, UITVOERBARE verbetervoorstellen:

Website: {stats['name']} ({stats['domain']})
Plan: {stats['plan']}
Bezoekers/maand: {stats['sessions']}
AI Gesprekken/maand: {stats['conversations']}
Escalatie rate: {stats['escalation_rate']}%
Kennisbronnen: {stats['sources']}
Modules: {', '.join(stats['modules']) if stats['modules'] else 'geen'}
Uptime: {stats['uptime_pct']}%
Responstijd: {stats['avg_response_ms']}ms
Onopgeloste alerts: {stats['unresolved_alerts']}
Top paginas: {', '.join(p['path'] for p in stats['top_pages'][:5]) if stats['top_pages'] else 'geen data'}

Geef terug als JSON array met objecten:
[
  {{
    "title": "Concrete actie",
    "description": "Wat precies te doen",
    "how": "Stap-voor-stap hoe Mo dit kan doen (via Windsurf, WordPress admin, of server)",
    "impact": "high/medium/low",
    "effort": "quick/medium/large",
    "category": "seo/content/performance/security/conversion/ai/monitoring",
    "sellable": true/false,
    "sell_price_suggestion": "€XX" of null,
    "sell_description": "Hoe dit aan de klant te verkopen als dienst" of null
  }}
]

Focus op:
1. SEO verbeteringen die Mo via Windsurf kan doen
2. Content gaps (kennisbank verbeteren)
3. Performance optimalisaties
4. Security hardening
5. Conversie optimalisatie
6. AI chatbot verbetering (meer bronnen, betere antwoorden)
7. Monitoring uitbreiding
8. Dingen die Mo als extra dienst kan verkopen

Maximaal 10 suggesties, gesorteerd op impact."""

    try:
        groq = AsyncGroq(api_key=settings.groq_api_key)
        response = await groq.chat.completions.create(
            model=settings.groq_chat_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        import json
        raw = json.loads(response.choices[0].message.content)
        suggestions = raw if isinstance(raw, list) else raw.get("suggestions", raw.get("items", []))
    except Exception as e:
        logger.error(f"Suggestions generation failed: {e}")
        suggestions = []

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "suggestions": suggestions,
    }


@admin_router.get("/global")
async def admin_global_insights(
    period: str = Query("week", pattern="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db),
):
    """Cross-client intelligence dashboard for Mo — the helicopter view."""
    since, until = _period_range(period)

    # Get all production tenants
    tenants_q = await db.execute(
        select(Tenant).where(
            and_(Tenant.status == TenantStatus.active, Tenant.environment == TenantEnvironment.production)
        ).order_by(Tenant.name)
    )
    tenants = tenants_q.scalars().all()

    all_stats = []
    for tenant in tenants:
        try:
            stats = await _gather_tenant_stats(db, tenant, since, until)
            all_stats.append(stats)
        except Exception as e:
            logger.warning(f"Failed to gather stats for {tenant.name}: {e}")

    # Aggregates
    total_sessions = sum(s["sessions"] for s in all_stats)
    total_conversations = sum(s["conversations"] for s in all_stats)
    total_escalations = sum(s["escalations"] for s in all_stats)
    total_alerts = sum(s["alerts"] for s in all_stats)
    total_unresolved = sum(s["unresolved_alerts"] for s in all_stats)

    # Rankings
    by_sessions = sorted(all_stats, key=lambda s: s["sessions"], reverse=True)
    by_growth = sorted(all_stats, key=lambda s: s["sessions_change"], reverse=True)
    needs_attention = [s for s in all_stats if s["unresolved_alerts"] > 0 or (s["uptime_pct"] is not None and s["uptime_pct"] < 99.5)]

    # Generate global AI summary
    prompt = f"""Je bent de AI-analist van TinyEclipse voor Mo (superadmin, Digital Farmers).

Geef een {period} overzicht van ALLE klant-websites:

Totalen:
- {len(all_stats)} actieve websites
- {total_sessions} bezoekers totaal
- {total_conversations} AI gesprekken
- {total_escalations} escalaties
- {total_alerts} alerts ({total_unresolved} onopgelost)

Top 3 drukste sites: {', '.join(f"{s['name']} ({s['sessions']})" for s in by_sessions[:3])}
Top 3 snelst groeiend: {', '.join(f"{s['name']} ({s['sessions_change']:+.1f}%)" for s in by_growth[:3])}
Sites die aandacht nodig hebben: {', '.join(f"{s['name']} ({s['unresolved_alerts']} alerts)" for s in needs_attention[:5]) if needs_attention else 'geen'}

Geef terug als JSON:
{{
  "headline": "Korte krachtige samenvatting",
  "summary": "2-3 zinnen overzicht",
  "top_performers": ["site die het goed doet + waarom"],
  "needs_attention": ["site die aandacht nodig heeft + waarom"],
  "opportunities": ["kans om extra diensten te verkopen aan specifieke klant"],
  "platform_health": 0-100
}}"""

    try:
        groq = AsyncGroq(api_key=settings.groq_api_key)
        response = await groq.chat.completions.create(
            model=settings.groq_chat_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=1000,
            response_format={"type": "json_object"},
        )
        import json
        ai_global = json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Global insights failed: {e}")
        ai_global = {"headline": f"{len(all_stats)} sites actief", "summary": "", "top_performers": [], "needs_attention": [], "opportunities": [], "platform_health": 50}

    return {
        "period": period,
        "from": since.isoformat(),
        "to": until.isoformat(),
        "totals": {
            "sites": len(all_stats),
            "sessions": total_sessions,
            "conversations": total_conversations,
            "escalations": total_escalations,
            "alerts": total_alerts,
            "unresolved_alerts": total_unresolved,
        },
        "sites": all_stats,
        "rankings": {
            "by_sessions": [{"name": s["name"], "sessions": s["sessions"]} for s in by_sessions[:5]],
            "by_growth": [{"name": s["name"], "change": s["sessions_change"]} for s in by_growth[:5]],
            "needs_attention": [{"name": s["name"], "alerts": s["unresolved_alerts"], "uptime": s["uptime_pct"]} for s in needs_attention],
        },
        "ai": ai_global,
    }


# ═══════════════════════════════════════════════════════════
#  PORTAL INSIGHTS (Client-facing)
# ═══════════════════════════════════════════════════════════

portal_router = APIRouter(
    prefix="/api/portal/insights",
    tags=["portal-insights"],
)


@portal_router.get("/{tenant_id}/summary")
async def portal_tenant_summary(
    tenant_id: str,
    period: str = Query("week", pattern="^(day|week|month|year)$"),
    db: AsyncSession = Depends(get_db),
):
    """Client-facing AI summary — what happened on their site."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    since, until = _period_range(period)
    stats = await _gather_tenant_stats(db, tenant, since, until)
    ai = await _generate_ai_summary(stats, period, for_client=True)

    return {
        "tenant_id": tenant_id,
        "period": period,
        "from": since.isoformat(),
        "to": until.isoformat(),
        "stats": {
            "sessions": stats["sessions"],
            "sessions_change": stats["sessions_change"],
            "pageviews": stats["pageviews"],
            "conversations": stats["conversations"],
            "conversations_change": stats["conversations_change"],
            "top_pages": stats["top_pages"],
            "uptime_pct": stats["uptime_pct"],
            "modules": stats["modules"],
        },
        "ai": ai,
    }


@portal_router.get("/{tenant_id}/growth")
async def portal_growth_tracker(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Growth tracker — show client how their site is growing over time."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    now = datetime.now(timezone.utc)
    periods = {
        "day": (now - timedelta(days=1), now),
        "week": (now - timedelta(weeks=1), now),
        "month": (now - timedelta(days=30), now),
        "year": (now - timedelta(days=365), now),
    }

    growth = {}
    for period_name, (since, until) in periods.items():
        prev_since = since - (until - since)

        sessions_q = await db.execute(
            select(func.count(VisitorSession.id)).where(
                and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= since)
            )
        )
        sessions = sessions_q.scalar() or 0

        prev_sessions_q = await db.execute(
            select(func.count(VisitorSession.id)).where(
                and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= prev_since, VisitorSession.created_at < since)
            )
        )
        prev_sessions = prev_sessions_q.scalar() or 0

        convs_q = await db.execute(
            select(func.count(Conversation.id)).where(
                and_(Conversation.tenant_id == tid, Conversation.created_at >= since)
            )
        )
        convs = convs_q.scalar() or 0

        prev_convs_q = await db.execute(
            select(func.count(Conversation.id)).where(
                and_(Conversation.tenant_id == tid, Conversation.created_at >= prev_since, Conversation.created_at < since)
            )
        )
        prev_convs = prev_convs_q.scalar() or 0

        def pct(c, p):
            if p == 0:
                return 100.0 if c > 0 else 0.0
            return round((c - p) / p * 100, 1)

        growth[period_name] = {
            "sessions": sessions,
            "sessions_prev": prev_sessions,
            "sessions_change": pct(sessions, prev_sessions),
            "conversations": convs,
            "conversations_prev": prev_convs,
            "conversations_change": pct(convs, prev_convs),
        }

    # Monthly trend (last 6 months)
    monthly_trend = []
    for i in range(6):
        month_end = now - timedelta(days=30 * i)
        month_start = month_end - timedelta(days=30)
        s_q = await db.execute(
            select(func.count(VisitorSession.id)).where(
                and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= month_start, VisitorSession.created_at < month_end)
            )
        )
        c_q = await db.execute(
            select(func.count(Conversation.id)).where(
                and_(Conversation.tenant_id == tid, Conversation.created_at >= month_start, Conversation.created_at < month_end)
            )
        )
        monthly_trend.append({
            "month": month_start.strftime("%Y-%m"),
            "sessions": s_q.scalar() or 0,
            "conversations": c_q.scalar() or 0,
        })

    monthly_trend.reverse()

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name,
        "periods": growth,
        "monthly_trend": monthly_trend,
    }

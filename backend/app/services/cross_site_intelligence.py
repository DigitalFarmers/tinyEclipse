"""
Cross-Site Intelligence Service
Detects patterns, opportunities, and risks across sibling tenants within a ClientAccount.
Generates actionable AI recommendations scored by estimated revenue impact.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant
from app.models.client_account import ClientAccount
from app.models.visitor import VisitorSession, PageView
from app.models.monitor import MonitorCheck, Alert, CheckStatus, AlertSeverity
from app.models.module_event import ModuleEvent

logger = logging.getLogger(__name__)


class InsightType:
    PRODUCT_OPPORTUNITY = "product_opportunity"
    TRAFFIC_INSIGHT = "traffic_insight"
    TRANSLATION_GAP = "translation_gap"
    SECURITY_SHARED = "security_shared"
    PERFORMANCE_COMPARISON = "performance_comparison"
    CUSTOMER_OVERLAP = "customer_overlap"
    PRICING_MISMATCH = "pricing_mismatch"
    CHECKOUT_ISSUE = "checkout_issue"


async def generate_cross_site_insights(
    db: AsyncSession,
    client_account_id: uuid.UUID,
) -> Dict:
    """Generate AI-driven cross-site insights for a client account."""

    # Get all production tenants for this client
    tenants_result = await db.execute(
        select(Tenant).where(and_(
            Tenant.client_account_id == client_account_id,
            Tenant.environment == "production",
        ))
    )
    tenants = tenants_result.scalars().all()

    if len(tenants) < 2:
        return {"insights": [], "summary": "Minstens 2 productie-sites nodig voor cross-site analyse."}

    since = datetime.now(timezone.utc) - timedelta(days=30)
    insights = []

    # Gather per-tenant stats
    tenant_stats = {}
    for t in tenants:
        stats = await _gather_tenant_analytics(db, t, since)
        tenant_stats[str(t.id)] = {**stats, "tenant": t}

    # ── 1. Traffic Comparison ──
    traffic_insights = _analyze_traffic_patterns(tenant_stats)
    insights.extend(traffic_insights)

    # ── 2. Language/Audience Gap ──
    language_insights = _analyze_language_gaps(tenant_stats)
    insights.extend(language_insights)

    # ── 3. Shared Security Issues ──
    security_insights = await _analyze_shared_security(db, tenants, since)
    insights.extend(security_insights)

    # ── 4. Performance Comparison ──
    perf_insights = await _analyze_performance(db, tenants)
    insights.extend(perf_insights)

    # ── 5. Bounce Rate / Checkout Analysis ──
    checkout_insights = _analyze_conversion_patterns(tenant_stats)
    insights.extend(checkout_insights)

    # Sort by impact score
    insights.sort(key=lambda x: x.get("impact_score", 0), reverse=True)

    # Summary
    high_impact = [i for i in insights if i.get("impact_score", 0) >= 70]
    medium_impact = [i for i in insights if 40 <= i.get("impact_score", 0) < 70]

    return {
        "client_account_id": str(client_account_id),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tenant_count": len(tenants),
        "tenants": [{"id": str(t.id), "name": t.name, "domain": t.domain} for t in tenants],
        "summary": {
            "total_insights": len(insights),
            "high_impact": len(high_impact),
            "medium_impact": len(medium_impact),
        },
        "insights": insights[:20],
    }


async def _gather_tenant_analytics(db: AsyncSession, tenant: Tenant, since: datetime) -> Dict:
    """Gather key metrics for a single tenant."""
    tid = tenant.id

    # Sessions
    sessions_q = await db.execute(
        select(VisitorSession).where(and_(
            VisitorSession.tenant_id == tid,
            VisitorSession.created_at >= since,
        ))
    )
    sessions = sessions_q.scalars().all()

    total = len(sessions)
    bounces = sum(1 for s in sessions if s.is_bounce)
    conversions = sum(1 for s in sessions if s.has_conversion)
    avg_duration = sum(s.duration_seconds for s in sessions) / max(total, 1)

    # Language breakdown
    languages = {}
    for s in sessions:
        lang = (s.language or "unknown").split("-")[0].lower()
        languages[lang] = languages.get(lang, 0) + 1

    # Country breakdown
    countries = {}
    for s in sessions:
        c = s.country or "unknown"
        countries[c] = countries.get(c, 0) + 1

    # Device breakdown
    devices = {}
    for s in sessions:
        d = s.device_type or "unknown"
        devices[d] = devices.get(d, 0) + 1

    # Referrer breakdown
    referrers = {}
    for s in sessions:
        ref = s.utm_source or "organic"
        referrers[ref] = referrers.get(ref, 0) + 1

    return {
        "sessions": total,
        "bounce_rate": round(bounces / max(total, 1) * 100, 1),
        "conversion_rate": round(conversions / max(total, 1) * 100, 1),
        "avg_duration": round(avg_duration, 1),
        "languages": languages,
        "countries": countries,
        "devices": devices,
        "referrers": referrers,
    }


def _analyze_traffic_patterns(tenant_stats: Dict) -> List[Dict]:
    """Compare traffic between sites — identify imbalances and opportunities."""
    insights = []
    tenants = list(tenant_stats.values())

    if len(tenants) < 2:
        return insights

    # Find the highest and lowest traffic sites
    sorted_by_sessions = sorted(tenants, key=lambda t: t["sessions"], reverse=True)
    highest = sorted_by_sessions[0]
    lowest = sorted_by_sessions[-1]

    if highest["sessions"] > 0 and lowest["sessions"] > 0:
        ratio = highest["sessions"] / max(lowest["sessions"], 1)
        if ratio > 3:
            insights.append({
                "type": InsightType.TRAFFIC_INSIGHT,
                "title": f"{highest['tenant'].name} heeft {ratio:.0f}× meer verkeer dan {lowest['tenant'].name}",
                "description": f"{highest['tenant'].domain} ontvangt {highest['sessions']} sessies vs {lowest['sessions']} voor {lowest['tenant'].domain}. Overweeg cross-promotie of gedeelde marketingcampagnes.",
                "impact_score": min(80, int(ratio * 10)),
                "category": "traffic",
                "action": "Cross-promotie banner toevoegen op de drukste site",
                "affected_tenants": [str(highest["tenant"].id), str(lowest["tenant"].id)],
            })

    # Check if one site has way better conversion
    conv_rates = [(t["tenant"].name, t["conversion_rate"], t["tenant"].id) for t in tenants if t["sessions"] > 10]
    if len(conv_rates) >= 2:
        conv_rates.sort(key=lambda x: x[1], reverse=True)
        best_name, best_rate, best_id = conv_rates[0]
        worst_name, worst_rate, worst_id = conv_rates[-1]
        if best_rate > worst_rate * 2 and worst_rate < 5:
            insights.append({
                "type": InsightType.CHECKOUT_ISSUE,
                "title": f"{worst_name} converteert {best_rate / max(worst_rate, 0.1):.1f}× slechter dan {best_name}",
                "description": f"Conversieratio {worst_name}: {worst_rate}% vs {best_name}: {best_rate}%. Check checkout flow, betalingsmethoden en vertrouwenssignalen.",
                "impact_score": 75,
                "category": "conversion",
                "action": "Checkout flow vergelijken en best practices overnemen",
                "affected_tenants": [str(best_id), str(worst_id)],
            })

    return insights


def _analyze_language_gaps(tenant_stats: Dict) -> List[Dict]:
    """Detect language/audience gaps between sites."""
    insights = []
    tenants = list(tenant_stats.values())

    for t in tenants:
        if t["sessions"] < 20:
            continue

        total = t["sessions"]
        for lang, count in t["languages"].items():
            if lang == "unknown":
                continue
            pct = round(count / total * 100, 1)

            # Significant audience (>15%) in a language that might not have translations
            if pct >= 15:
                # Check if other sites serve this language better
                other_sites = [o for o in tenants if o["tenant"].id != t["tenant"].id]
                for other in other_sites:
                    other_lang_pct = round(other["languages"].get(lang, 0) / max(other["sessions"], 1) * 100, 1)
                    if other_lang_pct < 5 and pct > 20:
                        insights.append({
                            "type": InsightType.TRANSLATION_GAP,
                            "title": f"{pct}% van {t['tenant'].name} bezoekers spreken {lang.upper()} — {other['tenant'].name} mist deze doelgroep",
                            "description": f"{t['tenant'].domain} heeft {count} {lang.upper()}-sessies ({pct}%). {other['tenant'].domain} heeft slechts {other_lang_pct}%. Overweeg vertalingen toe te voegen.",
                            "impact_score": min(70, int(pct * 2)),
                            "category": "translation",
                            "action": f"Vertalingen voor {lang.upper()} toevoegen op {other['tenant'].domain}",
                            "affected_tenants": [str(t["tenant"].id), str(other["tenant"].id)],
                        })

    return insights


async def _analyze_shared_security(db: AsyncSession, tenants: List[Tenant], since: datetime) -> List[Dict]:
    """Detect security issues shared across multiple sites."""
    insights = []

    # Check for common unresolved alerts
    alert_types: Dict[str, List[str]] = {}  # check_type → [tenant_names]
    for t in tenants:
        alerts_q = await db.execute(
            select(Alert).where(and_(
                Alert.tenant_id == t.id,
                Alert.resolved == False,
            ))
        )
        alerts = alerts_q.scalars().all()
        for a in alerts:
            ct = a.title.split(" ")[0].lower() if a.title else "unknown"
            if ct not in alert_types:
                alert_types[ct] = []
            alert_types[ct].append(t.name)

    # Find issues affecting multiple sites
    for check_type, affected in alert_types.items():
        if len(affected) >= 2:
            insights.append({
                "type": InsightType.SECURITY_SHARED,
                "title": f"{check_type.upper()} probleem op {len(affected)} sites",
                "description": f"Gedeeld beveiligingsprobleem op: {', '.join(affected)}. Fix dit centraal voor alle sites tegelijk.",
                "impact_score": 85,
                "category": "security",
                "action": f"Fix {check_type} op alle {len(affected)} sites via auto-fix",
                "affected_sites": affected,
            })

    return insights


async def _analyze_performance(db: AsyncSession, tenants: List[Tenant]) -> List[Dict]:
    """Compare performance metrics between sites."""
    insights = []

    perf_data = []
    for t in tenants:
        check_q = await db.execute(
            select(MonitorCheck).where(and_(
                MonitorCheck.tenant_id == t.id,
                MonitorCheck.check_type == "uptime",
                MonitorCheck.enabled == True,
            ))
        )
        check = check_q.scalars().first()
        if check and check.last_response_ms:
            perf_data.append({
                "tenant": t,
                "response_ms": check.last_response_ms,
                "status": check.last_status.value if check.last_status else "unknown",
            })

    if len(perf_data) >= 2:
        perf_data.sort(key=lambda x: x["response_ms"])
        fastest = perf_data[0]
        slowest = perf_data[-1]

        if slowest["response_ms"] > fastest["response_ms"] * 2 and slowest["response_ms"] > 1000:
            insights.append({
                "type": InsightType.PERFORMANCE_COMPARISON,
                "title": f"{slowest['tenant'].name} is {slowest['response_ms'] / max(fastest['response_ms'], 1):.1f}× trager dan {fastest['tenant'].name}",
                "description": f"{slowest['tenant'].domain}: {slowest['response_ms']}ms vs {fastest['tenant'].domain}: {fastest['response_ms']}ms. Check hosting, caching en plugin configuratie.",
                "impact_score": 65,
                "category": "performance",
                "action": "Hosting en caching configuratie vergelijken",
                "affected_tenants": [str(slowest["tenant"].id), str(fastest["tenant"].id)],
            })

    return insights


def _analyze_conversion_patterns(tenant_stats: Dict) -> List[Dict]:
    """Analyze bounce rates and conversion patterns across sites."""
    insights = []
    tenants = list(tenant_stats.values())

    # High bounce rate comparison
    bounce_rates = [(t["tenant"].name, t["bounce_rate"], t["tenant"].id) for t in tenants if t["sessions"] > 20]
    if len(bounce_rates) >= 2:
        bounce_rates.sort(key=lambda x: x[1])
        best_name, best_bounce, _ = bounce_rates[0]
        worst_name, worst_bounce, worst_id = bounce_rates[-1]

        if worst_bounce > 70 and worst_bounce > best_bounce * 1.5:
            insights.append({
                "type": InsightType.CHECKOUT_ISSUE,
                "title": f"{worst_name} heeft {worst_bounce}% bounce rate — {best_name} slechts {best_bounce}%",
                "description": f"Hoge bounce rate op {worst_name} wijst mogelijk op UX problemen, trage laadtijden of irrelevante content.",
                "impact_score": 60,
                "category": "ux",
                "action": "Landing pages en laadtijden optimaliseren",
                "affected_tenants": [str(worst_id)],
            })

    # Mobile vs desktop disparity
    for t in tenants:
        if t["sessions"] < 30:
            continue
        mobile = t["devices"].get("mobile", 0)
        desktop = t["devices"].get("desktop", 0)
        total = mobile + desktop
        if total > 0:
            mobile_pct = round(mobile / total * 100, 1)
            if mobile_pct > 60:
                insights.append({
                    "type": InsightType.TRAFFIC_INSIGHT,
                    "title": f"{mobile_pct}% van {t['tenant'].name} verkeer is mobiel",
                    "description": f"Hoog mobiel percentage op {t['tenant'].domain}. Zorg dat de mobiele ervaring optimaal is.",
                    "impact_score": 45,
                    "category": "mobile",
                    "action": "Mobile UX audit uitvoeren",
                    "affected_tenants": [str(t["tenant"].id)],
                })

    return insights

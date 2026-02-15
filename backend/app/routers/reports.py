"""
PRO+ Reports API — AI-driven site health reports, competitive analysis, insights.
The intelligence layer that makes Eclipse invaluable.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant, PlanType
from app.models.monitor import MonitorCheck, MonitorResult, Alert, CheckType, CheckStatus, AlertSeverity
from app.models.visitor import VisitorSession, PageView, VisitorEvent
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message
from app.models.usage_log import UsageLog
from app.models.source import Source

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/reports",
    tags=["admin-reports"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── Health Score Calculator ───

def _calculate_health_score(checks: list[MonitorCheck]) -> dict:
    """Calculate a 0-100 health score based on monitoring checks."""
    if not checks:
        return {"score": 0, "grade": "N/A", "breakdown": {}}

    weights = {
        CheckType.uptime: 30,
        CheckType.ssl: 20,
        CheckType.performance: 15,
        CheckType.security_headers: 15,
        CheckType.dns: 10,
        CheckType.forms: 5,
        CheckType.content_change: 3,
        CheckType.smtp: 2,
    }

    total_weight = 0
    weighted_score = 0
    breakdown = {}

    for check in checks:
        w = weights.get(check.check_type, 5)
        total_weight += w

        if check.last_status == CheckStatus.ok:
            s = 100
        elif check.last_status == CheckStatus.warning:
            s = 60
        elif check.last_status == CheckStatus.critical:
            s = 10
        else:
            s = 50

        weighted_score += s * w
        breakdown[check.check_type.value] = {
            "status": check.last_status.value,
            "score": s,
            "weight": w,
        }

    final_score = round(weighted_score / max(total_weight, 1), 1)

    if final_score >= 90:
        grade = "A+"
    elif final_score >= 80:
        grade = "A"
    elif final_score >= 70:
        grade = "B"
    elif final_score >= 60:
        grade = "C"
    elif final_score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {"score": final_score, "grade": grade, "breakdown": breakdown}


# ─── Site Health Report ───

@router.get("/health/{tenant_id}")
async def site_health_report(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Comprehensive site health report — the core PRO+ deliverable."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Monitoring checks
    checks_result = await db.execute(
        select(MonitorCheck).where(MonitorCheck.tenant_id == tid)
    )
    checks = checks_result.scalars().all()
    health = _calculate_health_score(checks)

    # Active alerts
    alerts_result = await db.execute(
        select(Alert).where(and_(Alert.tenant_id == tid, Alert.resolved == False))
    )
    active_alerts = alerts_result.scalars().all()

    # Uptime last 30 days
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    uptime_checks = [c for c in checks if c.check_type == CheckType.uptime]
    uptime_pct = 100.0
    if uptime_checks:
        uptime_results = await db.execute(
            select(MonitorResult).where(
                and_(
                    MonitorResult.check_id == uptime_checks[0].id,
                    MonitorResult.created_at >= thirty_days_ago,
                )
            )
        )
        results = uptime_results.scalars().all()
        if results:
            ok_count = sum(1 for r in results if r.status == CheckStatus.ok)
            uptime_pct = round(ok_count / len(results) * 100, 2)

    # Performance trend (last 7 days avg response time)
    perf_checks = [c for c in checks if c.check_type == CheckType.performance]
    perf_trend = []
    if perf_checks:
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        perf_results = await db.execute(
            select(MonitorResult).where(
                and_(
                    MonitorResult.check_id == perf_checks[0].id,
                    MonitorResult.created_at >= seven_days_ago,
                )
            ).order_by(MonitorResult.created_at)
        )
        for r in perf_results.scalars().all():
            if r.response_ms:
                perf_trend.append({
                    "timestamp": r.created_at.isoformat(),
                    "response_ms": r.response_ms,
                })

    # SSL details — fetch from latest result
    ssl_checks = [c for c in checks if c.check_type == CheckType.ssl]
    ssl_info = None
    if ssl_checks:
        ssl_result = await db.execute(
            select(MonitorResult).where(MonitorResult.check_id == ssl_checks[0].id)
            .order_by(MonitorResult.created_at.desc()).limit(1)
        )
        ssl_r = ssl_result.scalar_one_or_none()
        if ssl_r:
            ssl_info = ssl_r.details

    # Security headers details — fetch from latest result
    sec_checks = [c for c in checks if c.check_type == CheckType.security_headers]
    security_info = None
    if sec_checks:
        sec_result = await db.execute(
            select(MonitorResult).where(MonitorResult.check_id == sec_checks[0].id)
            .order_by(MonitorResult.created_at.desc()).limit(1)
        )
        sec_r = sec_result.scalar_one_or_none()
        if sec_r:
            security_info = sec_r.details

    # Build recommendations
    recommendations = []
    for check in checks:
        if check.last_status == CheckStatus.critical:
            recommendations.append({
                "priority": "critical",
                "category": check.check_type.value,
                "title": f"{check.check_type.value.replace('_', ' ').title()} needs immediate attention",
                "description": _get_recommendation(check),
            })
        elif check.last_status == CheckStatus.warning:
            recommendations.append({
                "priority": "warning",
                "category": check.check_type.value,
                "title": f"{check.check_type.value.replace('_', ' ').title()} can be improved",
                "description": _get_recommendation(check),
            })

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "health": health,
        "uptime": {
            "percentage_30d": uptime_pct,
            "checks_count": len(uptime_checks),
        },
        "ssl": ssl_info,
        "security": security_info,
        "performance": {
            "trend_7d": perf_trend[-20:],
            "avg_response_ms": round(sum(p["response_ms"] for p in perf_trend) / max(len(perf_trend), 1)) if perf_trend else None,
        },
        "active_alerts": len(active_alerts),
        "alerts": [
            {
                "severity": a.severity.value,
                "title": a.title,
                "message": a.message,
                "created_at": a.created_at.isoformat(),
            }
            for a in active_alerts
        ],
        "recommendations": sorted(recommendations, key=lambda r: 0 if r["priority"] == "critical" else 1),
        "checks_summary": {c.check_type.value: c.last_status.value for c in checks},
    }


def _get_recommendation(check: MonitorCheck) -> str:
    """Generate a human-readable recommendation based on check type and status."""
    recs = {
        CheckType.security_headers: "Add missing security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) to your web server configuration. This protects against XSS, clickjacking, and MIME-type attacks.",
        CheckType.ssl: "Your SSL certificate needs attention. Check expiry date, certificate chain, and ensure all subdomains are covered.",
        CheckType.uptime: "Your site experienced downtime. Check server logs, hosting provider status, and consider implementing a CDN or failover.",
        CheckType.performance: "Page load time is above optimal thresholds. Consider image optimization, caching, minification, and CDN usage.",
        CheckType.dns: "DNS configuration issues detected. Verify A/AAAA records, check for propagation issues, and ensure redundant nameservers.",
        CheckType.forms: "Form security issues detected. Ensure all forms have CSRF protection, CAPTCHA, and honeypot fields.",
        CheckType.content_change: "Unexpected content changes detected. Verify no unauthorized modifications were made. Consider implementing file integrity monitoring.",
        CheckType.smtp: "Email delivery issues detected. Check SPF, DKIM, and DMARC records. Verify SMTP server configuration.",
    }
    return recs.get(check.check_type, "Review this check and take appropriate action.")


# ─── Weekly/Monthly Report ───

@router.get("/periodic/{tenant_id}")
async def periodic_report(
    tenant_id: str,
    period: str = Query("week", pattern="^(week|month)$"),
    db: AsyncSession = Depends(get_db),
):
    """Weekly or monthly report — monitoring + analytics + AI usage combined."""
    tid = uuid.UUID(tenant_id)
    tenant = await db.get(Tenant, tid)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    days = 7 if period == "week" else 30
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Monitoring: alert count by severity
    alerts_result = await db.execute(
        select(Alert.severity, func.count(Alert.id))
        .where(and_(Alert.tenant_id == tid, Alert.created_at >= since))
        .group_by(Alert.severity)
    )
    alerts_by_severity = {str(r[0].value): r[1] for r in alerts_result.all()}

    # Monitoring: uptime percentage
    uptime_check = await db.execute(
        select(MonitorCheck).where(
            and_(MonitorCheck.tenant_id == tid, MonitorCheck.check_type == CheckType.uptime)
        )
    )
    uptime_c = uptime_check.scalar_one_or_none()
    uptime_pct = 100.0
    if uptime_c:
        results = await db.execute(
            select(MonitorResult).where(
                and_(MonitorResult.check_id == uptime_c.id, MonitorResult.created_at >= since)
            )
        )
        all_results = results.scalars().all()
        if all_results:
            ok = sum(1 for r in all_results if r.status == CheckStatus.ok)
            uptime_pct = round(ok / len(all_results) * 100, 2)

    # Analytics: sessions, pageviews, bounce, conversions
    sessions_result = await db.execute(
        select(VisitorSession).where(
            and_(VisitorSession.tenant_id == tid, VisitorSession.created_at >= since)
        )
    )
    sessions = sessions_result.scalars().all()
    total_sessions = len(sessions)
    bounces = sum(1 for s in sessions if s.is_bounce)
    conversions = sum(1 for s in sessions if s.has_conversion)
    chats = sum(1 for s in sessions if s.chat_initiated)
    avg_duration = round(sum(s.duration_seconds for s in sessions) / max(total_sessions, 1), 1)

    pv_result = await db.execute(
        select(func.count(PageView.id)).where(
            and_(PageView.tenant_id == tid, PageView.created_at >= since)
        )
    )
    total_pv = pv_result.scalar() or 0

    # Top pages
    top_pages_result = await db.execute(
        select(PageView.path, func.count(PageView.id).label("views"))
        .where(and_(PageView.tenant_id == tid, PageView.created_at >= since))
        .group_by(PageView.path)
        .order_by(func.count(PageView.id).desc())
        .limit(10)
    )
    top_pages = [{"path": r[0], "views": r[1]} for r in top_pages_result.all()]

    # AI usage
    usage_result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
            func.count(UsageLog.id),
        ).where(and_(UsageLog.tenant_id == tid, UsageLog.created_at >= since))
    )
    tokens_in, tokens_out, ai_requests = usage_result.one()

    # Conversations
    convs_result = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(Conversation.tenant_id == tid, Conversation.created_at >= since)
        )
    )
    total_convs = convs_result.scalar() or 0

    escalations_result = await db.execute(
        select(func.count(Conversation.id)).where(
            and_(
                Conversation.tenant_id == tid,
                Conversation.created_at >= since,
                Conversation.status == ConversationStatus.escalated,
            )
        )
    )
    total_escalations = escalations_result.scalar() or 0

    # Daily breakdown for charts
    daily_sessions = {}
    for s in sessions:
        day = s.created_at.strftime("%Y-%m-%d")
        daily_sessions[day] = daily_sessions.get(day, 0) + 1

    return {
        "tenant_id": tenant_id,
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "period": period,
        "period_days": days,
        "from": since.isoformat(),
        "to": datetime.now(timezone.utc).isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "monitoring": {
            "uptime_percentage": uptime_pct,
            "alerts_total": sum(alerts_by_severity.values()),
            "alerts_by_severity": alerts_by_severity,
        },
        "analytics": {
            "sessions": total_sessions,
            "pageviews": total_pv,
            "bounce_rate": round(bounces / max(total_sessions, 1) * 100, 1),
            "conversion_rate": round(conversions / max(total_sessions, 1) * 100, 1),
            "chat_engagement_rate": round(chats / max(total_sessions, 1) * 100, 1),
            "avg_duration_seconds": avg_duration,
            "top_pages": top_pages,
            "daily_sessions": daily_sessions,
        },
        "ai": {
            "conversations": total_convs,
            "escalations": total_escalations,
            "escalation_rate": round(total_escalations / max(total_convs, 1) * 100, 1),
            "requests": ai_requests,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
        },
    }


# ─── Multi-Tenant Comparison ───

@router.get("/comparison/")
async def tenant_comparison(
    db: AsyncSession = Depends(get_db),
):
    """Compare all tenants side-by-side — the bird's eye view."""
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.name))
    tenants = tenants_result.scalars().all()

    since_24h = datetime.now(timezone.utc) - timedelta(hours=24)
    since_30d = datetime.now(timezone.utc) - timedelta(days=30)

    comparison = []
    for tenant in tenants:
        # Health score
        checks_result = await db.execute(
            select(MonitorCheck).where(MonitorCheck.tenant_id == tenant.id)
        )
        checks = checks_result.scalars().all()
        health = _calculate_health_score(checks)

        # Active alerts
        alerts_result = await db.execute(
            select(func.count(Alert.id)).where(
                and_(Alert.tenant_id == tenant.id, Alert.resolved == False)
            )
        )
        active_alerts = alerts_result.scalar() or 0

        # Sessions 24h
        sessions_result = await db.execute(
            select(func.count(VisitorSession.id)).where(
                and_(VisitorSession.tenant_id == tenant.id, VisitorSession.created_at >= since_24h)
            )
        )
        sessions_24h = sessions_result.scalar() or 0

        # Conversations 30d
        convs_result = await db.execute(
            select(func.count(Conversation.id)).where(
                and_(Conversation.tenant_id == tenant.id, Conversation.created_at >= since_30d)
            )
        )
        convs_30d = convs_result.scalar() or 0

        comparison.append({
            "tenant_id": str(tenant.id),
            "name": tenant.name,
            "domain": tenant.domain,
            "plan": tenant.plan.value,
            "status": tenant.status.value,
            "health_score": health["score"],
            "health_grade": health["grade"],
            "active_alerts": active_alerts,
            "sessions_24h": sessions_24h,
            "conversations_30d": convs_30d,
        })

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_tenants": len(tenants),
        "tenants": sorted(comparison, key=lambda t: t["health_score"]),
    }


# ─── Uptime History ───

@router.get("/uptime/{tenant_id}")
async def uptime_history(
    tenant_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Detailed uptime history with daily breakdown."""
    tid = uuid.UUID(tenant_id)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    uptime_check = await db.execute(
        select(MonitorCheck).where(
            and_(MonitorCheck.tenant_id == tid, MonitorCheck.check_type == CheckType.uptime)
        )
    )
    check = uptime_check.scalar_one_or_none()
    if not check:
        return {"tenant_id": tenant_id, "days": days, "uptime_percentage": None, "daily": [], "message": "No uptime check configured"}

    results_query = await db.execute(
        select(MonitorResult).where(
            and_(MonitorResult.check_id == check.id, MonitorResult.created_at >= since)
        ).order_by(MonitorResult.created_at)
    )
    results = results_query.scalars().all()

    # Daily breakdown
    daily = {}
    for r in results:
        day = r.created_at.strftime("%Y-%m-%d")
        if day not in daily:
            daily[day] = {"total": 0, "ok": 0, "avg_ms": []}
        daily[day]["total"] += 1
        if r.status == CheckStatus.ok:
            daily[day]["ok"] += 1
        if r.response_ms:
            daily[day]["avg_ms"].append(r.response_ms)

    daily_list = []
    for day, data in sorted(daily.items()):
        daily_list.append({
            "date": day,
            "uptime_pct": round(data["ok"] / max(data["total"], 1) * 100, 2),
            "checks": data["total"],
            "avg_response_ms": round(sum(data["avg_ms"]) / max(len(data["avg_ms"]), 1)) if data["avg_ms"] else None,
        })

    total_ok = sum(1 for r in results if r.status == CheckStatus.ok)
    overall_pct = round(total_ok / max(len(results), 1) * 100, 2)

    return {
        "tenant_id": tenant_id,
        "days": days,
        "uptime_percentage": overall_pct,
        "total_checks": len(results),
        "total_ok": total_ok,
        "total_failures": len(results) - total_ok,
        "daily": daily_list,
    }


# ─── Alert History & Trends ───

@router.get("/alert-trends/{tenant_id}")
async def alert_trends(
    tenant_id: str,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Alert trends over time — frequency, severity, resolution time."""
    tid = uuid.UUID(tenant_id)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    alerts_result = await db.execute(
        select(Alert).where(
            and_(Alert.tenant_id == tid, Alert.created_at >= since)
        ).order_by(Alert.created_at)
    )
    alerts = alerts_result.scalars().all()

    # By severity
    by_severity = {}
    for a in alerts:
        sev = a.severity.value
        by_severity[sev] = by_severity.get(sev, 0) + 1

    # By day
    by_day = {}
    for a in alerts:
        day = a.created_at.strftime("%Y-%m-%d")
        by_day[day] = by_day.get(day, 0) + 1

    # Resolution stats
    resolved = [a for a in alerts if a.resolved and a.resolved_at]
    avg_resolution_hours = None
    if resolved:
        total_hours = sum(
            (a.resolved_at - a.created_at).total_seconds() / 3600
            for a in resolved
        )
        avg_resolution_hours = round(total_hours / len(resolved), 1)

    return {
        "tenant_id": tenant_id,
        "period_days": days,
        "total_alerts": len(alerts),
        "resolved": len(resolved),
        "unresolved": len(alerts) - len(resolved),
        "avg_resolution_hours": avg_resolution_hours,
        "by_severity": by_severity,
        "by_day": dict(sorted(by_day.items())),
    }

"""
Email Digest Service — Unified weekly/daily email replacing scattered plugin mails.
Replaces: Wordfence, Sucuri, WP Activity Log, Fluent Forms summaries, NitroPack reports.
One beautiful branded email per client with everything they need.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant, TenantStatus, TenantEnvironment
from app.models.conversation import Conversation
from app.models.monitor import MonitorCheck, Alert
from app.models.client_account import ClientAccount
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


async def build_client_digest(db: AsyncSession, whmcs_client_id: int, period_days: int = 7) -> dict:
    """Build a complete digest for a WHMCS client across all their sites."""
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    # Get client info
    ca_q = await db.execute(select(ClientAccount).where(ClientAccount.whmcs_client_id == whmcs_client_id))
    client = ca_q.scalar_one_or_none()
    client_name = client.company_name or client.name if client else f"Klant #{whmcs_client_id}"
    client_email = client.email if client else None

    # Get all production tenants
    tenants_q = await db.execute(
        select(Tenant).where(
            and_(Tenant.whmcs_client_id == whmcs_client_id,
                 Tenant.status == TenantStatus.active,
                 Tenant.environment == TenantEnvironment.production)
        ).order_by(Tenant.name)
    )
    tenants = tenants_q.scalars().all()

    if not tenants:
        return {"skip": True, "reason": "no_active_tenants"}

    sites = []
    total_chats = 0
    total_alerts = 0
    total_resolved = 0
    total_visitors = 0

    for tenant in tenants:
        # Conversations
        chat_count = await db.execute(
            select(func.count()).select_from(Conversation).where(
                and_(Conversation.tenant_id == tenant.id, Conversation.created_at >= since)
            )
        )
        chats = chat_count.scalar() or 0

        # Alerts
        alert_count = await db.execute(
            select(func.count()).select_from(Alert).where(
                and_(Alert.tenant_id == tenant.id, Alert.created_at >= since)
            )
        )
        alerts = alert_count.scalar() or 0

        resolved_count = await db.execute(
            select(func.count()).select_from(Alert).where(
                and_(Alert.tenant_id == tenant.id, Alert.created_at >= since, Alert.resolved == True)
            )
        )
        resolved = resolved_count.scalar() or 0

        unresolved_count = await db.execute(
            select(func.count()).select_from(Alert).where(
                and_(Alert.tenant_id == tenant.id, Alert.resolved == False)
            )
        )
        unresolved = unresolved_count.scalar() or 0

        # Security from tenant settings
        security = tenant.settings.get("security_audit", {})
        security_score = security.get("score", None)

        # Plugin version from heartbeat
        connector_version = tenant.settings.get("connector_version", "?")

        site_data = {
            "name": tenant.name,
            "domain": tenant.domain,
            "plan": tenant.plan.value,
            "chats": chats,
            "alerts_new": alerts,
            "alerts_resolved": resolved,
            "alerts_open": unresolved,
            "security_score": security_score,
            "connector_version": connector_version,
            "status": "healthy" if unresolved == 0 else "attention",
        }
        sites.append(site_data)

        total_chats += chats
        total_alerts += alerts
        total_resolved += resolved

    # Overall health
    sites_needing_attention = [s for s in sites if s["status"] == "attention"]
    overall_health = "healthy" if len(sites_needing_attention) == 0 else "attention"

    return {
        "skip": False,
        "client_name": client_name,
        "client_email": client_email,
        "whmcs_client_id": whmcs_client_id,
        "period_days": period_days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "overall_health": overall_health,
        "totals": {
            "sites": len(sites),
            "chats": total_chats,
            "alerts_new": total_alerts,
            "alerts_resolved": total_resolved,
        },
        "sites": sites,
        "sites_needing_attention": [s["name"] for s in sites_needing_attention],
    }


def render_digest_html(digest: dict) -> str:
    """Render the digest as a beautiful branded HTML email."""
    if digest.get("skip"):
        return ""

    client_name = digest["client_name"]
    period = digest["period_days"]
    totals = digest["totals"]
    sites = digest["sites"]
    health = digest["overall_health"]
    health_color = "#22c55e" if health == "healthy" else "#f59e0b"
    health_label = "Alles in orde ✓" if health == "healthy" else "Aandacht nodig"

    # Build site rows
    site_rows = ""
    for s in sites:
        status_dot = "🟢" if s["status"] == "healthy" else "🟡"
        sec = f'{s["security_score"]}/100' if s["security_score"] is not None else "—"
        site_rows += f"""
        <tr style="border-bottom:1px solid #1e1e2e;">
          <td style="padding:12px 16px;font-size:14px;color:#e2e8f0;">
            {status_dot} <strong>{s['name']}</strong>
            <br><span style="font-size:11px;color:#64748b;">{s['domain']}</span>
          </td>
          <td style="padding:12px 8px;text-align:center;font-size:14px;color:#94a3b8;">{s['chats']}</td>
          <td style="padding:12px 8px;text-align:center;font-size:14px;color:#94a3b8;">{s['alerts_new']}</td>
          <td style="padding:12px 8px;text-align:center;font-size:14px;color:#94a3b8;">{sec}</td>
          <td style="padding:12px 8px;text-align:center;">
            <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:{'#22c55e20' if s['status']=='healthy' else '#f59e0b20'};color:{'#22c55e' if s['status']=='healthy' else '#f59e0b'};">
              {s['plan'].upper()}
            </span>
          </td>
        </tr>"""

    # Attention section
    attention_html = ""
    if digest["sites_needing_attention"]:
        items = "".join(f'<li style="color:#f59e0b;font-size:13px;padding:4px 0;">⚠️ {name}</li>' for name in digest["sites_needing_attention"])
        attention_html = f"""
        <div style="margin:24px 0;padding:16px 20px;background:#f59e0b10;border:1px solid #f59e0b30;border-radius:12px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#f59e0b;">Aandachtspunten</p>
          <ul style="margin:0;padding-left:16px;">{items}</ul>
        </div>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;padding:32px 0;">
      <div style="font-size:28px;font-weight:800;color:#e2e8f0;">⚡ TinyEclipse</div>
      <p style="margin:8px 0 0;font-size:14px;color:#64748b;">
        {'Wekelijks' if period == 7 else 'Dagelijks'} overzicht voor <strong style="color:#a78bfa;">{client_name}</strong>
      </p>
    </div>

    <!-- Health Banner -->
    <div style="background:linear-gradient(135deg,#1e1b4b,#0f172a);border:1px solid #334155;border-radius:16px;padding:24px;text-align:center;">
      <div style="font-size:16px;font-weight:700;color:{health_color};">{health_label}</div>
      <div style="margin-top:16px;display:flex;justify-content:center;gap:32px;">
        <div>
          <div style="font-size:28px;font-weight:800;color:#e2e8f0;">{totals['sites']}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Sites</div>
        </div>
        <div>
          <div style="font-size:28px;font-weight:800;color:#818cf8;">{totals['chats']}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Gesprekken</div>
        </div>
        <div>
          <div style="font-size:28px;font-weight:800;color:#f59e0b;">{totals['alerts_new']}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Alerts</div>
        </div>
        <div>
          <div style="font-size:28px;font-weight:800;color:#22c55e;">{totals['alerts_resolved']}</div>
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Opgelost</div>
        </div>
      </div>
    </div>

    {attention_html}

    <!-- Sites Table -->
    <div style="margin-top:24px;background:#0f172a;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#1e1b4b;">
            <th style="padding:12px 16px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Site</th>
            <th style="padding:12px 8px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Chats</th>
            <th style="padding:12px 8px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Alerts</th>
            <th style="padding:12px 8px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Security</th>
            <th style="padding:12px 8px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Plan</th>
          </tr>
        </thead>
        <tbody>
          {site_rows}
        </tbody>
      </table>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-top:32px;">
      <a href="https://tinyeclipse.digitalfarmers.be" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:12px;">
        Open Eclipse Hub →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #1e293b;">
      <p style="font-size:11px;color:#475569;">
        Dit is een automatisch overzicht van TinyEclipse · Digital Farmers<br>
        Je ontvangt dit omdat je klant bent bij Digital Farmers.
      </p>
    </div>

  </div>
</body>
</html>"""


async def build_admin_digest(db: AsyncSession, period_days: int = 7) -> dict:
    """Build a platform-wide digest for Mo (superadmin)."""
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    # All active production tenants
    tenants_q = await db.execute(
        select(Tenant).where(
            and_(Tenant.status == TenantStatus.active,
                 Tenant.environment == TenantEnvironment.production)
        )
    )
    tenants = tenants_q.scalars().all()

    total_chats = 0
    total_alerts = 0
    sites_with_issues = []

    for tenant in tenants:
        chat_count = await db.execute(
            select(func.count()).select_from(Conversation).where(
                and_(Conversation.tenant_id == tenant.id, Conversation.created_at >= since)
            )
        )
        chats = chat_count.scalar() or 0
        total_chats += chats

        unresolved = await db.execute(
            select(func.count()).select_from(Alert).where(
                and_(Alert.tenant_id == tenant.id, Alert.resolved == False)
            )
        )
        open_alerts = unresolved.scalar() or 0
        total_alerts += open_alerts

        if open_alerts > 0:
            sites_with_issues.append({"name": tenant.name, "domain": tenant.domain, "open_alerts": open_alerts})

    return {
        "period_days": period_days,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total_sites": len(tenants),
        "total_chats": total_chats,
        "total_open_alerts": total_alerts,
        "sites_with_issues": sites_with_issues,
    }

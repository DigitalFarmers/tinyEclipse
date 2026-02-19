"""
Portal Account API — Full linked client profile (WHMCS + Eclipse).

Pulls EVERYTHING together:
- WHMCS client info (name, email, company, address)
- WHMCS products/services (plan, domain, status, next due date)
- WHMCS invoices (recent + unpaid)
- WHMCS domains
- Eclipse tenants (all projects with stats)
- Eclipse usage (conversations, sources, modules)
- Plan limits & usage tracking
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.client_account import ClientAccount
from app.models.tenant import Tenant, TenantEnvironment, PlanType
from app.models.site_module import SiteModule, ModuleStatus
from app.models.conversation import Conversation
from app.models.monitor import MonitorCheck, Alert, CheckStatus
from app.models.source import Source, SourceStatus
from app.models.usage_log import UsageLog
from app.models.module_event import ModuleEvent
from app.services.whmcs import get_whmcs_client, WHMCSError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/portal/account", tags=["portal-account"])

# Plan limits
PLAN_LIMITS = {
    "tiny": {"messages_month": 50, "pages": 5, "monitoring": ["uptime"], "events_days": 1, "price": "Gratis"},
    "pro": {"messages_month": 500, "pages": 50, "monitoring": ["uptime", "ssl", "dns"], "events_days": 7, "price": "€9,99/mo"},
    "pro_plus": {"messages_month": -1, "pages": -1, "monitoring": ["uptime", "ssl", "dns", "server"], "events_days": 30, "price": "€24,99/mo"},
}


@router.get("/{whmcs_client_id}")
async def get_full_account(
    whmcs_client_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Full linked client profile — WHMCS billing + Eclipse operational data.
    One endpoint to rule them all.
    """
    # ── 1. Eclipse data ──
    account_result = await db.execute(
        select(ClientAccount).where(ClientAccount.whmcs_client_id == whmcs_client_id)
    )
    account = account_result.scalar_one_or_none()

    tenants_result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == whmcs_client_id).order_by(Tenant.created_at)
    )
    tenants = tenants_result.scalars().all()

    if not tenants and not account:
        raise HTTPException(status_code=404, detail="Client niet gevonden")

    tenant_ids = [t.id for t in tenants]
    prod_tenants = [t for t in tenants if t.environment == TenantEnvironment.production]
    now = datetime.now(timezone.utc)
    since_30d = now - timedelta(days=30)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Aggregated Eclipse stats
    total_chats_month = 0
    total_sources = 0
    total_tokens_in = 0
    total_tokens_out = 0

    if tenant_ids:
        chats_month = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id.in_(tenant_ids), Conversation.created_at >= month_start))
        )
        total_chats_month = chats_month.scalar() or 0

        sources_count = await db.execute(
            select(func.count(Source.id))
            .where(and_(Source.tenant_id.in_(tenant_ids), Source.status == SourceStatus.indexed))
        )
        total_sources = sources_count.scalar() or 0

        usage = await db.execute(
            select(
                func.coalesce(func.sum(UsageLog.tokens_in), 0),
                func.coalesce(func.sum(UsageLog.tokens_out), 0),
            ).where(and_(UsageLog.tenant_id.in_(tenant_ids), UsageLog.created_at >= month_start))
        )
        total_tokens_in, total_tokens_out = usage.one()

    # Per-project details
    projects = []
    for t in tenants:
        t_chats = await db.execute(
            select(func.count(Conversation.id))
            .where(and_(Conversation.tenant_id == t.id, Conversation.created_at >= month_start))
        )
        t_sources = await db.execute(
            select(func.count(Source.id))
            .where(and_(Source.tenant_id == t.id, Source.status == SourceStatus.indexed))
        )
        t_alerts = await db.execute(
            select(func.count(Alert.id))
            .where(and_(Alert.tenant_id == t.id, Alert.resolved == False))
        )
        mods = await db.execute(
            select(SiteModule).where(and_(
                SiteModule.tenant_id == t.id,
                SiteModule.status == ModuleStatus.active,
            ))
        )
        # Monitoring
        checks = await db.execute(
            select(MonitorCheck).where(MonitorCheck.tenant_id == t.id)
        )
        check_list = checks.scalars().all()
        monitoring_ok = all(c.last_status == CheckStatus.ok for c in check_list) if check_list else None

        projects.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "plan": t.plan.value,
            "status": t.status.value,
            "environment": t.environment.value,
            "created_at": t.created_at.isoformat(),
            "monitoring_ok": monitoring_ok,
            "stats": {
                "chats_month": t_chats.scalar() or 0,
                "sources": t_sources.scalar() or 0,
                "open_alerts": t_alerts.scalar() or 0,
            },
            "modules": [
                {"type": m.module_type.value, "name": m.name}
                for m in mods.scalars().all()
            ],
        })

    # Determine active plan (highest across all tenants)
    plan_priority = {"tiny": 0, "pro": 1, "pro_plus": 2}
    active_plan = "tiny"
    for t in tenants:
        if plan_priority.get(t.plan.value, 0) > plan_priority.get(active_plan, 0):
            active_plan = t.plan.value

    limits = PLAN_LIMITS.get(active_plan, PLAN_LIMITS["tiny"])
    msg_limit = limits["messages_month"]
    pages_limit = limits["pages"]

    # ── 2. WHMCS data (live from API) ──
    whmcs_data = {
        "client": None,
        "products": [],
        "invoices": [],
        "domains": [],
        "available": False,
    }

    whmcs = get_whmcs_client()
    if whmcs.configured:
        try:
            # Client details
            client_info = await whmcs.get_client(whmcs_client_id)
            whmcs_data["available"] = True
            whmcs_data["client"] = {
                "id": client_info.get("id") or client_info.get("userid"),
                "firstname": client_info.get("firstname", ""),
                "lastname": client_info.get("lastname", ""),
                "email": client_info.get("email", ""),
                "company": client_info.get("companyname", ""),
                "address": client_info.get("address1", ""),
                "address2": client_info.get("address2", ""),
                "city": client_info.get("city", ""),
                "state": client_info.get("state", ""),
                "postcode": client_info.get("postcode", ""),
                "country": client_info.get("country", ""),
                "phone": client_info.get("phonenumber", ""),
                "status": client_info.get("status", ""),
                "currency": client_info.get("currency_code", "EUR"),
                "language": client_info.get("language", ""),
                "created_at": client_info.get("datecreated", ""),
                "notes": client_info.get("notes", ""),
            }

            # Products/services
            try:
                products_data = await whmcs.get_client_products(whmcs_client_id)
                raw_products = products_data.get("products", {}).get("product", [])
                for p in raw_products:
                    eclipse_plan = whmcs.product_id_to_plan(p.get("pid"))
                    whmcs_data["products"].append({
                        "id": p.get("id"),
                        "product_id": p.get("pid"),
                        "name": p.get("name", ""),
                        "groupname": p.get("groupname", ""),
                        "domain": p.get("domain", ""),
                        "status": p.get("status", ""),
                        "billing_cycle": p.get("billingcycle", ""),
                        "amount": p.get("recurringamount", ""),
                        "next_due": p.get("nextduedate", ""),
                        "reg_date": p.get("regdate", ""),
                        "eclipse_plan": eclipse_plan,
                        "dedicated_ip": p.get("dedicatedip", ""),
                        "server": p.get("servername", ""),
                    })
            except WHMCSError as e:
                logger.warning(f"Failed to fetch WHMCS products for {whmcs_client_id}: {e}")

            # Invoices (last 10)
            try:
                invoices_data = await whmcs.get_invoices(client_id=whmcs_client_id, status="")
                raw_invoices = invoices_data.get("invoices", {}).get("invoice", [])
                for inv in raw_invoices[:10]:
                    whmcs_data["invoices"].append({
                        "id": inv.get("id"),
                        "date": inv.get("date", ""),
                        "due_date": inv.get("duedate", ""),
                        "total": inv.get("total", ""),
                        "status": inv.get("status", ""),
                        "payment_method": inv.get("paymentmethod", ""),
                    })
            except WHMCSError as e:
                logger.warning(f"Failed to fetch WHMCS invoices for {whmcs_client_id}: {e}")

            # Domains
            try:
                domains_data = await whmcs.get_client_domains(whmcs_client_id)
                raw_domains = domains_data.get("domains", {}).get("domain", [])
                for d in raw_domains:
                    whmcs_data["domains"].append({
                        "id": d.get("id"),
                        "domain": d.get("domainname", ""),
                        "status": d.get("status", ""),
                        "reg_date": d.get("registrationdate", ""),
                        "expiry_date": d.get("expirydate", ""),
                        "next_due": d.get("nextduedate", ""),
                        "registrar": d.get("registrar", ""),
                        "auto_renew": d.get("autorecalc", ""),
                    })
            except WHMCSError as e:
                logger.warning(f"Failed to fetch WHMCS domains for {whmcs_client_id}: {e}")

        except WHMCSError as e:
            logger.warning(f"Failed to fetch WHMCS client {whmcs_client_id}: {e}")

    # ── 3. Build response ──
    return {
        "account": {
            "id": str(account.id) if account else None,
            "whmcs_client_id": whmcs_client_id,
            "name": account.name if account else (tenants[0].name if tenants else "Unknown"),
            "email": account.email if account else (whmcs_data["client"]["email"] if whmcs_data["client"] else None),
            "company": account.company if account else (whmcs_data["client"]["company"] if whmcs_data["client"] else None),
        },
        "plan": {
            "current": active_plan,
            "label": {"tiny": "Tiny", "pro": "Pro", "pro_plus": "Pro+"}.get(active_plan, active_plan),
            "price": limits["price"],
            "limits": {
                "messages_month": msg_limit,
                "pages": pages_limit,
                "monitoring_types": limits["monitoring"],
                "events_retention_days": limits["events_days"],
            },
        },
        "usage": {
            "messages_month": total_chats_month,
            "messages_limit": msg_limit,
            "messages_pct": round((total_chats_month / msg_limit * 100), 1) if msg_limit > 0 else 0,
            "sources_indexed": total_sources,
            "sources_limit": pages_limit,
            "sources_pct": round((total_sources / pages_limit * 100), 1) if pages_limit > 0 else 0,
            "tokens_in_month": total_tokens_in,
            "tokens_out_month": total_tokens_out,
        },
        "projects": projects,
        "whmcs": whmcs_data,
    }

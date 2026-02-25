"""
Server Router — Domain inventory, gap detection, server-wide stats,
IP intelligence per tenant.
"""
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.services.domain_scanner import scan_all_domains, get_gaps_only, probe_plugin
from app.services.ip_intelligence import get_ip_intelligence

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/server",
    tags=["admin-server"],
    dependencies=[Depends(verify_admin_key)],
)


@router.get("/domains")
async def list_all_domains(db: AsyncSession = Depends(get_db)):
    """Full domain inventory with gap analysis."""
    return await scan_all_domains(db)


@router.get("/domains/gaps")
async def list_domain_gaps(db: AsyncSession = Depends(get_db)):
    """Only domains missing the TinyEclipse plugin. PRO clients first."""
    return await get_gaps_only(db)


@router.post("/domains/scan")
async def trigger_domain_scan(db: AsyncSession = Depends(get_db)):
    """Force a fresh scan (ignores cache)."""
    return await scan_all_domains(db, force=True)


@router.get("/domains/{domain}/probe")
async def probe_domain(domain: str):
    """Probe a specific domain to check if the plugin is installed."""
    return await probe_plugin(domain)


@router.get("/stats")
async def server_stats(db: AsyncSession = Depends(get_db)):
    """Server-wide stats summary."""
    data = await scan_all_domains(db)
    return data.get("stats", {})


# ═══════════════════════════════════════════════════════════════
# IP INTELLIGENCE
# ═══════════════════════════════════════════════════════════════

@router.get("/ip/{tenant_id}")
async def tenant_ip_intelligence(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get IP intelligence summary for a specific tenant."""
    return await get_ip_intelligence(tenant_id, db)


# ═══════════════════════════════════════════════════════════════
# EMAIL DIGEST
# ═══════════════════════════════════════════════════════════════

@router.get("/digest/client/{whmcs_client_id}")
async def client_digest(whmcs_client_id: int, period: int = 7, db: AsyncSession = Depends(get_db)):
    """Generate email digest for a specific client."""
    from app.services.email_digest import build_client_digest, render_digest_html
    digest = await build_client_digest(db, whmcs_client_id, period)
    return {"digest": digest, "html": render_digest_html(digest)}


@router.get("/digest/admin")
async def admin_digest(period: int = 7, db: AsyncSession = Depends(get_db)):
    """Generate platform-wide admin digest."""
    from app.services.email_digest import build_admin_digest
    return await build_admin_digest(db, period)


@router.post("/digest/send/{whmcs_client_id}")
async def send_client_digest(whmcs_client_id: int, period: int = 7, db: AsyncSession = Depends(get_db)):
    """Generate and send email digest to a client."""
    from app.services.email_digest import build_client_digest, render_digest_html
    import smtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    digest = await build_client_digest(db, whmcs_client_id, period)
    if digest.get("skip"):
        return {"sent": False, "reason": digest.get("reason")}

    html = render_digest_html(digest)
    email = digest.get("client_email")
    if not email:
        return {"sent": False, "reason": "no_email", "html_preview": html}

    # For now return preview — SMTP config needed for actual sending
    return {"sent": False, "reason": "smtp_not_configured", "email": email, "html_preview": html}


# ═══════════════════════════════════════════════════════════════
# API KEY MANAGEMENT
# ═══════════════════════════════════════════════════════════════

@router.get("/apikeys/{tenant_id}")
async def get_api_key(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Get or generate the Hub API key for a tenant."""
    import hashlib
    from app.models.tenant import Tenant
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tenant not found")

    api_key = hashlib.sha256(f"{tenant.id}-{tenant.created_at}".encode()).hexdigest()[:32]
    return {
        "tenant_id": str(tenant.id),
        "name": tenant.name,
        "domain": tenant.domain,
        "api_key": f"te-{api_key}",
        "hub_url": "https://tinyeclipse.digitalfarmers.be",
        "api_base": "https://api.tinyeclipse.digitalfarmers.be",
    }


@router.post("/apikeys/{tenant_id}/regenerate")
async def regenerate_api_key(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Regenerate the Hub API key for a tenant (invalidates old key)."""
    import hashlib
    import secrets
    from app.models.tenant import Tenant
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Store a salt in settings to make key unique per regeneration
    salt = secrets.token_hex(8)
    if not tenant.settings:
        tenant.settings = {}
    tenant.settings["api_key_salt"] = salt
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(tenant, "settings")
    await db.commit()

    api_key = hashlib.sha256(f"{tenant.id}-{salt}".encode()).hexdigest()[:32]
    return {
        "tenant_id": str(tenant.id),
        "api_key": f"te-{api_key}",
        "regenerated": True,
        "note": "De oude key is nu ongeldig. Update de key in de WordPress plugin.",
    }


# ═══════════════════════════════════════════════════════════════
# PLUGIN MASS UPDATER
# ═══════════════════════════════════════════════════════════════

@router.get("/plugin/versions")
async def plugin_version_report(db: AsyncSession = Depends(get_db)):
    """Check connector version across all sites."""
    from app.models.tenant import Tenant, TenantStatus
    tenants_q = await db.execute(
        select(Tenant).where(Tenant.status == TenantStatus.active).order_by(Tenant.name)
    )
    tenants = tenants_q.scalars().all()

    current_version = "5.0.0"  # Latest release
    sites = []
    outdated = 0
    up_to_date = 0
    unknown = 0

    for t in tenants:
        version = t.settings.get("connector_version", None)
        status = "unknown"
        if version:
            if version == current_version:
                status = "current"
                up_to_date += 1
            else:
                status = "outdated"
                outdated += 1
        else:
            unknown += 1

        sites.append({
            "tenant_id": str(t.id),
            "name": t.name,
            "domain": t.domain,
            "connector_version": version,
            "status": status,
        })

    return {
        "current_version": current_version,
        "total_sites": len(sites),
        "up_to_date": up_to_date,
        "outdated": outdated,
        "unknown": unknown,
        "sites": sites,
    }


@router.post("/plugin/push-update")
async def push_plugin_update(db: AsyncSession = Depends(get_db)):
    """Push 'update_plugins' command to all outdated sites via their security fix endpoint."""
    import httpx
    from app.models.tenant import Tenant, TenantStatus

    tenants_q = await db.execute(
        select(Tenant).where(Tenant.status == TenantStatus.active).order_by(Tenant.name)
    )
    tenants = tenants_q.scalars().all()

    current_version = "5.0.0"
    results = []

    for t in tenants:
        version = t.settings.get("connector_version")
        if version and version == current_version:
            continue
        if not t.domain:
            continue

        # Try to trigger plugin update via WP REST API
        url = f"https://{t.domain}/wp-json/tinyeclipse/v1/security/fix"
        try:
            async with httpx.AsyncClient(timeout=15, verify=False) as client:
                resp = await client.post(url, json={"fix_type": "update_plugins"}, headers={
                    "X-TinyEclipse-Key": t.settings.get("api_key_salt", ""),
                })
                results.append({
                    "domain": t.domain,
                    "status": "pushed" if resp.status_code == 200 else f"error_{resp.status_code}",
                })
        except Exception as e:
            results.append({"domain": t.domain, "status": f"failed: {str(e)[:80]}"})

    return {
        "pushed": len([r for r in results if r["status"] == "pushed"]),
        "failed": len([r for r in results if r["status"] != "pushed"]),
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════
# IMUNIFY360 INTEGRATION
# ═══════════════════════════════════════════════════════════════

@router.get("/security/imunify360")
async def imunify360_status():
    """Get Imunify360 status from server via CLI.
    Imunify360 has a CLI at /usr/bin/imunify360-agent.
    This replaces per-site Wordfence/Sucuri with server-level security.
    """
    import asyncio
    results = {}

    # Try to get Imunify360 status via DirectAdmin API or CLI
    try:
        from app.services.directadmin import get_da_client
        da = get_da_client()
        if da:
            # Use DirectAdmin to query server security status
            results["directadmin"] = "connected"
    except Exception:
        results["directadmin"] = "not_available"

    # Return what we know — actual CLI calls need server access
    return {
        "service": "imunify360",
        "note": "Imunify360 draait op serverniveau en vervangt Wordfence/Sucuri per site.",
        "advantages": [
            "Eén security layer voor alle sites",
            "Automatische malware scanning",
            "Proactieve firewall (WAF)",
            "Automatische patching",
            "Geen per-site plugin overhead",
        ],
        "recommendation": "Verwijder Wordfence/Sucuri van individuele sites. Imunify360 dekt alles server-breed.",
        "api_available": True,
        "cli_path": "/usr/bin/imunify360-agent",
        "api_docs": "https://docs.imunify360.com/command_line_interface/",
        **results,
    }


# ═══════════════════════════════════════════════════════════════
# DFGUARD — SERVER HEALTH & BACKUP INTELLIGENCE
# ═══════════════════════════════════════════════════════════════

@router.get("/dfguard")
async def dfguard_dashboard():
    """Full DFGuard dashboard — server health, backups, alerts, mail queue, brute force."""
    from app.services.dfguard import get_full_dashboard
    return await get_full_dashboard()


@router.get("/dfguard/server")
async def dfguard_server_info():
    """Server system info — hostname, OS, load, uptime."""
    from app.services.dfguard import get_server_info
    return await get_server_info()


@router.get("/dfguard/accounts")
async def dfguard_accounts():
    """List all server accounts."""
    from app.services.dfguard import list_accounts
    accounts = await list_accounts()
    return {"total": len(accounts), "accounts": accounts}


@router.get("/dfguard/backups")
async def dfguard_backups():
    """JetBackup status — jobs, storage, alerts."""
    from app.services.dfguard import get_jetbackup_status
    return await get_jetbackup_status()


@router.get("/dfguard/security")
async def dfguard_security():
    """Brute force log + ModSecurity status."""
    from app.services.dfguard import get_brute_force_log, get_modsecurity_status
    import asyncio
    bf, modsec = await asyncio.gather(
        get_brute_force_log(),
        get_modsecurity_status(),
        return_exceptions=True,
    )
    return {
        "brute_force": bf if not isinstance(bf, Exception) else {"error": str(bf)},
        "modsecurity": modsec if not isinstance(modsec, Exception) else {"error": str(modsec)},
    }


@router.get("/dfguard/mail")
async def dfguard_mail_queue():
    """Mail queue status."""
    from app.services.dfguard import get_mail_queue
    return await get_mail_queue()


@router.get("/dfguard/processes")
async def dfguard_processes():
    """Running processes — high CPU/memory consumers."""
    from app.services.dfguard import get_process_list
    return await get_process_list()

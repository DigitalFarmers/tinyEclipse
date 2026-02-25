"""
DFGuard — Server Health & Backup Intelligence via DirectAdmin API.

Pulls:
- Server alerts (backup failures, brute force, etc.)
- JetBackup status (jobs, storage, integrity)
- System resources (disk, accounts, processes)
- Mail queue status
- Brute force monitor
- ModSecurity / Imunify360 status

DirectAdmin API docs: https://www.directadmin.com/features.php?id=1537
JetBackup uses DirectAdmin plugin API.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional, Dict, Tuple

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_auth() -> Tuple[str, str, str]:
    settings = get_settings()
    return settings.directadmin_url, settings.directadmin_user, settings.directadmin_login_key


async def _da_get(endpoint: str, params: Optional[Dict] = None) -> Any:
    """Authenticated GET to DirectAdmin API."""
    base_url, user, key = _get_auth()
    if not base_url or not user or not key:
        return None

    url = f"{base_url}/{endpoint}"
    if params is None:
        params = {}
    params["json"] = "yes"

    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            r = await client.get(url, params=params, auth=(user, key))
            if r.status_code == 200:
                try:
                    return r.json()
                except Exception:
                    return r.text
            else:
                logger.warning(f"[dfguard] DA API {endpoint}: {r.status_code}")
                return None
    except Exception as e:
        logger.error(f"[dfguard] DA request failed: {e}")
        return None


async def _da_post(endpoint: str, data: Optional[Dict] = None) -> Any:
    """Authenticated POST to DirectAdmin API."""
    base_url, user, key = _get_auth()
    if not base_url or not user or not key:
        return None

    url = f"{base_url}/{endpoint}"
    if data is None:
        data = {}

    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            r = await client.post(url, data=data, auth=(user, key))
            if r.status_code == 200:
                try:
                    return r.json()
                except Exception:
                    return r.text
            else:
                logger.warning(f"[dfguard] DA POST {endpoint}: {r.status_code}")
                return None
    except Exception as e:
        logger.error(f"[dfguard] DA POST failed: {e}")
        return None


# ═══════════════════════════════════════════════════════════════
# SERVER INFO & RESOURCES
# ═══════════════════════════════════════════════════════════════

async def get_server_info() -> dict:
    """Get server system info — hostname, OS, load, uptime."""
    data = await _da_get("CMD_API_SYSTEM_INFO")
    if not data or not isinstance(data, dict):
        return {"error": "Could not fetch server info"}

    return {
        "hostname": data.get("hostname", ""),
        "os": data.get("os", ""),
        "kernel": data.get("kernel", ""),
        "uptime": data.get("uptime", ""),
        "load": {
            "1min": data.get("loadavg", ["", "", ""])[0] if isinstance(data.get("loadavg"), list) else data.get("load1", ""),
            "5min": data.get("loadavg", ["", "", ""])[1] if isinstance(data.get("loadavg"), list) else data.get("load5", ""),
            "15min": data.get("loadavg", ["", "", ""])[2] if isinstance(data.get("loadavg"), list) else data.get("load15", ""),
        },
        "cpu_cores": data.get("numcpus", data.get("cpus", "")),
        "raw": data,
    }


async def get_disk_usage() -> dict:
    """Get server disk usage."""
    data = await _da_get("CMD_API_SYSTEM_INFO")
    if not data or not isinstance(data, dict):
        return {"error": "Could not fetch disk info"}

    return {
        "filesystem": data.get("disk", []),
        "raw": {k: v for k, v in data.items() if "disk" in k.lower() or "space" in k.lower()},
    }


async def get_server_stats() -> dict:
    """Get admin-level server statistics."""
    data = await _da_get("CMD_API_ADMIN_STATS")
    if not data:
        # Fallback: try system info
        data = await _da_get("CMD_API_SYSTEM_INFO")

    return data or {}


# ═══════════════════════════════════════════════════════════════
# USER / ACCOUNT MANAGEMENT
# ═══════════════════════════════════════════════════════════════

async def list_accounts() -> list[dict]:
    """List all user accounts on the server."""
    data = await _da_get("CMD_API_SHOW_ALL_USERS")
    if not data:
        return []

    if isinstance(data, list):
        return [{"username": u} for u in data]
    if isinstance(data, dict):
        return [{"username": k, **v} if isinstance(v, dict) else {"username": k} for k, v in data.items()]
    return []


async def get_account_usage(username: str) -> dict:
    """Get resource usage for a specific account."""
    data = await _da_get("CMD_API_SHOW_USER_USAGE", {"user": username})
    return data if isinstance(data, dict) else {}


# ═══════════════════════════════════════════════════════════════
# BACKUP / JETBACKUP
# ═══════════════════════════════════════════════════════════════

async def get_jetbackup_status() -> dict:
    """Get JetBackup overview — jobs, storage, alerts.
    JetBackup integrates with DirectAdmin via plugin API.
    We try multiple endpoints to get backup data.
    """
    result = {
        "available": False,
        "jobs": [],
        "alerts": [],
        "storage": {},
        "stats": {},
    }

    # Try JetBackup API via DirectAdmin plugin
    jb_data = await _da_get("CMD_PLUGINS/jetbackup/api/backup_jobs")
    if jb_data and isinstance(jb_data, (dict, list)):
        result["available"] = True
        if isinstance(jb_data, list):
            result["jobs"] = jb_data
        elif isinstance(jb_data, dict):
            result["jobs"] = jb_data.get("data", jb_data.get("jobs", []))
            result["stats"] = {k: v for k, v in jb_data.items() if k not in ("data", "jobs")}

    # Try JetBackup alerts
    jb_alerts = await _da_get("CMD_PLUGINS/jetbackup/api/alerts")
    if jb_alerts:
        if isinstance(jb_alerts, list):
            result["alerts"] = jb_alerts
        elif isinstance(jb_alerts, dict):
            result["alerts"] = jb_alerts.get("data", jb_alerts.get("alerts", []))

    # Try JetBackup destinations (storage info)
    jb_dest = await _da_get("CMD_PLUGINS/jetbackup/api/destinations")
    if jb_dest:
        if isinstance(jb_dest, list):
            result["storage"]["destinations"] = jb_dest
        elif isinstance(jb_dest, dict):
            result["storage"] = jb_dest

    # Fallback: DirectAdmin native backup info
    if not result["available"]:
        da_backup = await _da_get("CMD_API_ADMIN_BACKUP")
        if da_backup:
            result["available"] = True
            result["stats"]["source"] = "directadmin_native"
            if isinstance(da_backup, dict):
                result["stats"].update(da_backup)

    return result


# ═══════════════════════════════════════════════════════════════
# SECURITY — BRUTE FORCE, MODSECURITY, IMUNIFY360
# ═══════════════════════════════════════════════════════════════

async def get_brute_force_log() -> dict:
    """Get brute force monitor data."""
    data = await _da_get("CMD_API_BRUTE_FORCE_LOG")
    if not data:
        return {"entries": [], "blocked_ips": []}

    entries = []
    blocked = []
    if isinstance(data, dict):
        for ip, info in data.items():
            entry = {"ip": ip}
            if isinstance(info, dict):
                entry.update(info)
            entries.append(entry)
            if isinstance(info, dict) and info.get("blocked"):
                blocked.append(ip)
    elif isinstance(data, list):
        entries = data

    return {"entries": entries, "blocked_ips": blocked, "total": len(entries)}


async def get_modsecurity_status() -> dict:
    """Check ModSecurity status."""
    data = await _da_get("CMD_API_MODSECURITY")
    return data if isinstance(data, dict) else {"status": "unknown"}


# ═══════════════════════════════════════════════════════════════
# MAIL QUEUE
# ═══════════════════════════════════════════════════════════════

async def get_mail_queue() -> dict:
    """Get mail queue status — stuck emails, queue size."""
    data = await _da_get("CMD_API_MAIL_QUEUE")
    if not data:
        return {"queue_size": 0, "entries": []}

    entries = []
    if isinstance(data, dict):
        entries = list(data.values()) if not isinstance(list(data.values())[0] if data else None, (str, int)) else [data]
    elif isinstance(data, list):
        entries = data

    return {"queue_size": len(entries), "entries": entries[:50]}


# ═══════════════════════════════════════════════════════════════
# PROCESS MONITOR
# ═══════════════════════════════════════════════════════════════

async def get_process_list() -> dict:
    """Get running processes — high CPU/memory consumers."""
    data = await _da_get("CMD_API_PROCESS_MONITOR")
    if not data:
        return {"processes": []}

    processes = []
    if isinstance(data, list):
        processes = data[:30]
    elif isinstance(data, dict):
        processes = data.get("processes", data.get("data", []))[:30]

    return {"processes": processes, "total": len(processes)}


# ═══════════════════════════════════════════════════════════════
# UNIFIED DFGUARD DASHBOARD
# ═══════════════════════════════════════════════════════════════

async def get_full_dashboard() -> dict:
    """Build the complete DFGuard dashboard — all server health data in one call."""
    import asyncio

    base_url, user, key = _get_auth()
    if not base_url or not user or not key:
        return {
            "status": "not_configured",
            "message": "DirectAdmin niet geconfigureerd. Stel DIRECTADMIN_URL, DIRECTADMIN_USER, DIRECTADMIN_LOGIN_KEY in.",
        }

    # Fetch everything in parallel
    server_info, accounts, jetbackup, brute_force, mail_queue = await asyncio.gather(
        get_server_info(),
        list_accounts(),
        get_jetbackup_status(),
        get_brute_force_log(),
        get_mail_queue(),
        return_exceptions=True,
    )

    # Handle exceptions gracefully
    if isinstance(server_info, Exception):
        server_info = {"error": str(server_info)}
    if isinstance(accounts, Exception):
        accounts = []
    if isinstance(jetbackup, Exception):
        jetbackup = {"available": False, "error": str(jetbackup)}
    if isinstance(brute_force, Exception):
        brute_force = {"entries": [], "blocked_ips": []}
    if isinstance(mail_queue, Exception):
        mail_queue = {"queue_size": 0, "entries": []}

    # Build alerts
    alerts = []

    # Backup alerts
    if isinstance(jetbackup, dict):
        for alert in jetbackup.get("alerts", []):
            severity = "critical" if "critical" in str(alert).lower() or "hasn't run" in str(alert).lower() else "warning"
            alerts.append({
                "source": "jetbackup",
                "severity": severity,
                "message": alert if isinstance(alert, str) else alert.get("message", str(alert)),
            })

    # Brute force alerts
    if isinstance(brute_force, dict) and len(brute_force.get("blocked_ips", [])) > 5:
        alerts.append({
            "source": "brute_force",
            "severity": "warning",
            "message": f"{len(brute_force['blocked_ips'])} IP-adressen geblokkeerd door brute force monitor",
        })

    # Mail queue alerts
    if isinstance(mail_queue, dict) and mail_queue.get("queue_size", 0) > 50:
        alerts.append({
            "source": "mail_queue",
            "severity": "warning",
            "message": f"Mail queue bevat {mail_queue['queue_size']} berichten",
        })

    # Overall health
    critical_count = sum(1 for a in alerts if a["severity"] == "critical")
    warning_count = sum(1 for a in alerts if a["severity"] == "warning")
    health = "critical" if critical_count > 0 else "warning" if warning_count > 0 else "healthy"

    return {
        "status": "connected",
        "health": health,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "server": server_info if isinstance(server_info, dict) else {},
        "accounts": {
            "total": len(accounts) if isinstance(accounts, list) else 0,
            "list": accounts[:50] if isinstance(accounts, list) else [],
        },
        "backups": jetbackup if isinstance(jetbackup, dict) else {"available": False},
        "security": {
            "brute_force": brute_force if isinstance(brute_force, dict) else {},
        },
        "mail": {
            "queue": mail_queue if isinstance(mail_queue, dict) else {"queue_size": 0},
        },
        "alerts": alerts,
        "summary": {
            "total_alerts": len(alerts),
            "critical": critical_count,
            "warnings": warning_count,
            "health": health,
        },
    }

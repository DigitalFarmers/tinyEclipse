"""
Heartbeat API — Sites register themselves and send periodic pings.
If a site goes silent, Eclipse raises an alarm. This is the watchdog.
"""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# ─── Public endpoints (called by sites) ───
public_router = APIRouter(prefix="/api/heartbeat", tags=["heartbeat"])

# ─── Admin endpoints ───
admin_router = APIRouter(
    prefix="/api/admin/heartbeat",
    tags=["admin-heartbeat"],
    dependencies=[Depends(verify_admin_key)],
)


class HeartbeatPing(BaseModel):
    tenant_id: str
    version: Optional[str] = None
    php_version: Optional[str] = None
    wp_version: Optional[str] = None
    plugin_version: Optional[str] = None
    active_plugins: Optional[List[str]] = None
    theme: Optional[str] = None
    memory_usage_mb: Optional[float] = None
    disk_usage_percent: Optional[float] = None
    db_size_mb: Optional[float] = None
    error_count_24h: Optional[int] = None
    warning_count_24h: Optional[int] = None
    cron_healthy: Optional[bool] = None
    last_backup: Optional[str] = None
    custom_data: dict = {}


# In-memory heartbeat store (will be replaced with DB table in production)
# For now this is fast and sufficient — the scheduler checks this
_heartbeats: Dict[str, dict] = {}


@public_router.post("/ping")
async def heartbeat_ping(body: HeartbeatPing, request: Request, db: AsyncSession = Depends(get_db)):
    """Receive a heartbeat ping from a site. Called periodically by the WP plugin or embed script."""
    tenant = await db.get(Tenant, uuid.UUID(body.tenant_id))
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    now = datetime.now(timezone.utc)
    ip = request.client.host if request.client else None

    _heartbeats[body.tenant_id] = {
        "tenant_id": body.tenant_id,
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "last_ping": now.isoformat(),
        "ip": ip,
        "version": body.version,
        "php_version": body.php_version,
        "wp_version": body.wp_version,
        "plugin_version": body.plugin_version,
        "active_plugins": body.active_plugins,
        "theme": body.theme,
        "memory_usage_mb": body.memory_usage_mb,
        "disk_usage_percent": body.disk_usage_percent,
        "db_size_mb": body.db_size_mb,
        "error_count_24h": body.error_count_24h,
        "warning_count_24h": body.warning_count_24h,
        "cron_healthy": body.cron_healthy,
        "last_backup": body.last_backup,
        "custom_data": body.custom_data,
        "consecutive_pings": _heartbeats.get(body.tenant_id, {}).get("consecutive_pings", 0) + 1,
    }

    logger.info(f"Heartbeat from {tenant.name} ({tenant.domain})")
    return {"status": "pong", "server_time": now.isoformat()}


@public_router.get("/status/{tenant_id}")
async def heartbeat_status_public(tenant_id: str):
    """Public status check — is this site's heartbeat alive?"""
    hb = _heartbeats.get(tenant_id)
    if not hb:
        return {"status": "unknown", "message": "No heartbeat received yet"}

    last_ping = datetime.fromisoformat(hb["last_ping"])
    age_seconds = (datetime.now(timezone.utc) - last_ping).total_seconds()

    if age_seconds < 600:  # 10 minutes
        status = "alive"
    elif age_seconds < 3600:  # 1 hour
        status = "stale"
    else:
        status = "dead"

    return {
        "status": status,
        "last_ping": hb["last_ping"],
        "age_seconds": int(age_seconds),
        "domain": hb.get("domain"),
    }


# ─── Admin Endpoints ───

@admin_router.get("/all/")
async def all_heartbeats():
    """Get all heartbeat statuses — the watchdog overview."""
    now = datetime.now(timezone.utc)
    result = []

    for tid, hb in _heartbeats.items():
        last_ping = datetime.fromisoformat(hb["last_ping"])
        age = (now - last_ping).total_seconds()

        if age < 600:
            status = "alive"
        elif age < 3600:
            status = "stale"
        else:
            status = "dead"

        result.append({
            "tenant_id": tid,
            "tenant_name": hb.get("tenant_name"),
            "domain": hb.get("domain"),
            "status": status,
            "last_ping": hb["last_ping"],
            "age_seconds": int(age),
            "ip": hb.get("ip"),
            "plugin_version": hb.get("plugin_version"),
            "wp_version": hb.get("wp_version"),
            "php_version": hb.get("php_version"),
            "memory_usage_mb": hb.get("memory_usage_mb"),
            "disk_usage_percent": hb.get("disk_usage_percent"),
            "error_count_24h": hb.get("error_count_24h"),
            "cron_healthy": hb.get("cron_healthy"),
            "consecutive_pings": hb.get("consecutive_pings", 0),
        })

    # Sort: dead first, then stale, then alive
    order = {"dead": 0, "stale": 1, "alive": 2}
    result.sort(key=lambda x: order.get(x["status"], 3))

    alive = sum(1 for r in result if r["status"] == "alive")
    stale = sum(1 for r in result if r["status"] == "stale")
    dead = sum(1 for r in result if r["status"] == "dead")

    return {
        "total": len(result),
        "alive": alive,
        "stale": stale,
        "dead": dead,
        "sites": result,
    }


@admin_router.get("/detail/{tenant_id}")
async def heartbeat_detail(tenant_id: str):
    """Full heartbeat detail for a specific site — all system info."""
    hb = _heartbeats.get(tenant_id)
    if not hb:
        raise HTTPException(status_code=404, detail="No heartbeat data for this tenant")

    last_ping = datetime.fromisoformat(hb["last_ping"])
    age = (datetime.now(timezone.utc) - last_ping).total_seconds()

    if age < 600:
        status = "alive"
    elif age < 3600:
        status = "stale"
    else:
        status = "dead"

    return {
        **hb,
        "status": status,
        "age_seconds": int(age),
    }


@admin_router.get("/stale/")
async def stale_heartbeats(threshold_minutes: int = 30):
    """Get sites that haven't pinged within the threshold — potential problems."""
    now = datetime.now(timezone.utc)
    threshold = timedelta(minutes=threshold_minutes)
    stale = []

    for tid, hb in _heartbeats.items():
        last_ping = datetime.fromisoformat(hb["last_ping"])
        age = now - last_ping
        if age > threshold:
            stale.append({
                "tenant_id": tid,
                "tenant_name": hb.get("tenant_name"),
                "domain": hb.get("domain"),
                "last_ping": hb["last_ping"],
                "silent_minutes": int(age.total_seconds() / 60),
            })

    stale.sort(key=lambda x: x["silent_minutes"], reverse=True)
    return {"threshold_minutes": threshold_minutes, "count": len(stale), "sites": stale}

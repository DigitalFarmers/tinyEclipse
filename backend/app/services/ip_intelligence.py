"""
IP Intelligence Service — Tracks IP access patterns per tenant,
detects new IPs, multiple IPs per user, and geo-IP enrichment.
"""
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Dict

import httpx
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

# In-memory IP cache per tenant (tenant_id -> {ip_hash -> info})
_ip_cache: Dict[str, Dict[str, dict]] = {}


def hash_ip(ip: str) -> str:
    """Hash IP for privacy-safe storage."""
    return hashlib.sha256(ip.encode()).hexdigest()[:16]


async def geo_lookup(ip: str) -> dict:
    """Free geo-IP lookup via ip-api.com (no key needed, 45 req/min)."""
    if ip.startswith(("127.", "10.", "192.168.", "172.")) or ip == "::1":
        return {"country": "Local", "city": "Local", "isp": "Local", "org": "Local"}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,region,isp,org,as,query")
            if r.status_code == 200:
                data = r.json()
                if data.get("status") == "success":
                    return {
                        "country": data.get("country", ""),
                        "country_code": data.get("countryCode", ""),
                        "city": data.get("city", ""),
                        "region": data.get("region", ""),
                        "isp": data.get("isp", ""),
                        "org": data.get("org", ""),
                        "as": data.get("as", ""),
                    }
    except Exception as e:
        logger.debug(f"[ip-intel] Geo lookup failed for {ip}: {e}")
    return {}


async def record_access(
    tenant_id: str,
    ip: str,
    user_agent: str = "",
    endpoint: str = "",
    user_id: Optional[str] = None,
    db: Optional[AsyncSession] = None,
) -> dict:
    """
    Record an IP access event. Returns intelligence about the access.
    Stores in tenant settings as a lightweight log (no new DB table needed).
    """
    ip_hash = hash_ip(ip)
    now = datetime.now(timezone.utc)

    # Initialize cache for tenant
    if tenant_id not in _ip_cache:
        _ip_cache[tenant_id] = {}

    is_new = ip_hash not in _ip_cache[tenant_id]
    geo = {}

    if is_new:
        geo = await geo_lookup(ip)
        _ip_cache[tenant_id][ip_hash] = {
            "first_seen": now.isoformat(),
            "last_seen": now.isoformat(),
            "access_count": 1,
            "geo": geo,
            "user_agent": user_agent[:200],
            "user_ids": [user_id] if user_id else [],
        }
    else:
        entry = _ip_cache[tenant_id][ip_hash]
        entry["last_seen"] = now.isoformat()
        entry["access_count"] = entry.get("access_count", 0) + 1
        entry["user_agent"] = user_agent[:200]
        if user_id and user_id not in entry.get("user_ids", []):
            entry["user_ids"].append(user_id)
        geo = entry.get("geo", {})

    # Persist to tenant settings periodically (every 10 accesses or new IP)
    if db and (is_new or _ip_cache[tenant_id][ip_hash]["access_count"] % 10 == 0):
        await _persist_ip_log(tenant_id, db)

    return {
        "ip_hash": ip_hash,
        "is_new": is_new,
        "geo": geo,
        "access_count": _ip_cache[tenant_id][ip_hash]["access_count"],
    }


async def _persist_ip_log(tenant_id: str, db: AsyncSession):
    """Persist IP log to tenant settings."""
    try:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if not tenant:
            return

        settings = dict(tenant.settings) if tenant.settings else {}

        # Keep only last 50 IPs per tenant
        ip_log = _ip_cache.get(tenant_id, {})
        sorted_ips = sorted(
            ip_log.items(),
            key=lambda x: x[1].get("last_seen", ""),
            reverse=True,
        )[:50]

        settings["ip_log"] = {k: v for k, v in sorted_ips}
        settings["ip_log_updated"] = datetime.now(timezone.utc).isoformat()

        tenant.settings = settings
        await db.commit()
    except Exception as e:
        logger.error(f"[ip-intel] Failed to persist IP log for {tenant_id}: {e}")


async def get_ip_intelligence(tenant_id: str, db: AsyncSession) -> dict:
    """Get IP intelligence summary for a tenant."""
    # Try cache first
    cached = _ip_cache.get(tenant_id, {})

    # Fall back to stored data
    if not cached:
        result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()
        if tenant and tenant.settings:
            cached = tenant.settings.get("ip_log", {})
            _ip_cache[tenant_id] = cached

    if not cached:
        return {"unique_ips": 0, "ips": [], "alerts": []}

    now = datetime.now(timezone.utc)
    ips = []
    alerts = []

    for ip_hash, info in cached.items():
        last_seen = info.get("last_seen", "")
        geo = info.get("geo", {})
        user_ids = info.get("user_ids", [])

        entry = {
            "ip_hash": ip_hash,
            "first_seen": info.get("first_seen"),
            "last_seen": last_seen,
            "access_count": info.get("access_count", 0),
            "country": geo.get("country", "Onbekend"),
            "country_code": geo.get("country_code", ""),
            "city": geo.get("city", ""),
            "isp": geo.get("isp", ""),
            "org": geo.get("org", ""),
            "user_agent": info.get("user_agent", ""),
            "user_ids": user_ids,
        }
        ips.append(entry)

        # Alert: multiple user IDs from same IP
        if len(user_ids) > 1:
            alerts.append({
                "type": "multi_user_ip",
                "severity": "warning",
                "message": f"IP {ip_hash[:8]}... wordt gebruikt door {len(user_ids)} verschillende gebruikers",
                "ip_hash": ip_hash,
                "user_count": len(user_ids),
            })

        # Alert: new IP in last 24h
        if last_seen:
            try:
                ls = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
                fs = datetime.fromisoformat(info.get("first_seen", last_seen).replace("Z", "+00:00"))
                if (now - fs) < timedelta(hours=24) and info.get("access_count", 0) <= 3:
                    alerts.append({
                        "type": "new_ip",
                        "severity": "info",
                        "message": f"Nieuw IP gedetecteerd: {geo.get('city', '?')}, {geo.get('country', '?')} ({geo.get('isp', '?')})",
                        "ip_hash": ip_hash,
                    })
            except (ValueError, TypeError):
                pass

    # Sort by last seen
    ips.sort(key=lambda x: x.get("last_seen", ""), reverse=True)

    # Unique countries
    countries = list(set(ip.get("country", "") for ip in ips if ip.get("country")))

    return {
        "unique_ips": len(ips),
        "unique_countries": len(countries),
        "countries": countries,
        "ips": ips[:30],
        "alerts": alerts,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

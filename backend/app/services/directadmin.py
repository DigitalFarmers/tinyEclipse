"""
DirectAdmin API Integration — Mail management for tenant domains.

Provides:
- List email accounts per domain
- Get mailbox usage/quota
- Get email forwarders
- Get autoresponders
- SMTP/mail health check

Uses DirectAdmin's JSON API (CMD_API_ endpoints).
"""
from __future__ import annotations
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, List, Union, Tuple

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def _get_auth() -> Tuple[str, str, str]:
    """Get DirectAdmin connection details."""
    settings = get_settings()
    return settings.directadmin_url, settings.directadmin_user, settings.directadmin_login_key


async def _da_request(endpoint: str, params: Optional[Dict] = None) -> Optional[Union[Dict, List]]:
    """Make an authenticated request to DirectAdmin API."""
    base_url, user, key = _get_auth()
    if not base_url or not user or not key:
        logger.warning("DirectAdmin not configured")
        return None

    url = f"{base_url}/{endpoint}"
    if params is None:
        params = {}
    params["json"] = "yes"

    try:
        async with httpx.AsyncClient(timeout=15, verify=False) as client:
            r = await client.get(
                url,
                params=params,
                auth=(user, key),
            )
            if r.status_code == 200:
                return r.json()
            else:
                logger.warning(f"DirectAdmin API error: {r.status_code} {r.text[:200]}")
                return None
    except Exception as e:
        logger.error(f"DirectAdmin request failed: {e}")
        return None


async def list_email_accounts(domain: str) -> list[dict]:
    """List all email accounts for a domain."""
    data = await _da_request("CMD_API_POP", {"domain": domain, "action": "list"})
    if not data or not isinstance(data, list):
        return []

    accounts = []
    for email in data:
        # Get quota info for each account
        quota_data = await _da_request("CMD_API_POP", {
            "domain": domain,
            "action": "quota",
            "user": email,
        })

        accounts.append({
            "email": f"{email}@{domain}",
            "username": email,
            "quota_mb": quota_data.get("quota", 0) if isinstance(quota_data, dict) else 0,
            "usage_mb": quota_data.get("usage", 0) if isinstance(quota_data, dict) else 0,
        })

    return accounts


async def list_forwarders(domain: str) -> list[dict]:
    """List email forwarders for a domain."""
    data = await _da_request("CMD_API_EMAIL_FORWARDERS", {"domain": domain})
    if not data or not isinstance(data, dict):
        return []

    forwarders = []
    for source, dest in data.items():
        forwarders.append({
            "from": f"{source}@{domain}" if "@" not in source else source,
            "to": dest if isinstance(dest, str) else ", ".join(dest) if isinstance(dest, list) else str(dest),
        })
    return forwarders


async def list_autoresponders(domain: str) -> list[dict]:
    """List autoresponders for a domain."""
    data = await _da_request("CMD_API_EMAIL_AUTORESPONDER", {"domain": domain})
    if not data or not isinstance(data, list):
        return []

    return [{"email": f"{ar}@{domain}"} for ar in data]


async def get_domain_mail_summary(domain: str) -> dict:
    """Get a complete mail summary for a domain."""
    accounts = await list_email_accounts(domain)
    forwarders = await list_forwarders(domain)
    autoresponders = await list_autoresponders(domain)

    total_usage = sum(a.get("usage_mb", 0) for a in accounts)
    total_quota = sum(a.get("quota_mb", 0) for a in accounts)

    return {
        "domain": domain,
        "accounts": accounts,
        "account_count": len(accounts),
        "forwarders": forwarders,
        "forwarder_count": len(forwarders),
        "autoresponders": autoresponders,
        "autoresponder_count": len(autoresponders),
        "total_usage_mb": total_usage,
        "total_quota_mb": total_quota,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }


async def check_mail_health(domain: str) -> dict:
    """Basic mail health check — verify MX records and SMTP connectivity."""
    import asyncio
    import socket

    health = {
        "domain": domain,
        "mx_records": [],
        "smtp_reachable": False,
        "issues": [],
    }

    # Check MX records
    try:
        loop = asyncio.get_event_loop()
        mx_records = await loop.run_in_executor(None, lambda: socket.getaddrinfo(f"mail.{domain}", 25, socket.AF_INET))
        if mx_records:
            health["mx_records"] = [f"mail.{domain}"]
            health["smtp_reachable"] = True
    except socket.gaierror:
        health["issues"].append(f"No MX/A record found for mail.{domain}")

    # Try DNS MX lookup
    try:
        import dns.resolver
        answers = dns.resolver.resolve(domain, "MX")
        health["mx_records"] = [str(r.exchange).rstrip(".") for r in answers]
    except Exception:
        if not health["mx_records"]:
            health["issues"].append("Could not resolve MX records")

    return health

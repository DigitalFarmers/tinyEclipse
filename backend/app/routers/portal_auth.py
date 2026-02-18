"""
Portal Auth — SSO from WHMCS Client Area + token-based portal access.
Allows clients to auto-login from my.digitalfarmers.be into their TinyEclipse dashboard.
"""
import hashlib
import hmac
import time
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.models.tenant import Tenant, TenantStatus

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/portal", tags=["portal-auth"])


def _sign(tenant_id: str, timestamp: int) -> str:
    """Create HMAC signature for SSO token."""
    msg = f"{tenant_id}:{timestamp}"
    return hmac.new(
        settings.app_secret_key.encode(),
        msg.encode(),
        hashlib.sha256,
    ).hexdigest()


# ─── SSO Login (from WHMCS Client Area) ───

@router.get("/sso")
async def sso_login(
    client_id: int = Query(..., description="WHMCS Client ID"),
    ts: int = Query(..., description="Unix timestamp"),
    sig: str = Query(..., description="HMAC signature"),
    db: AsyncSession = Depends(get_db),
):
    """
    SSO entry point. WHMCS generates a signed link:
    /api/portal/sso?client_id=123&ts=1708300000&sig=abc123

    Validates signature, finds tenant by whmcs_client_id, returns a portal session token.
    The frontend redirects to /portal with this token.
    """
    # Verify timestamp (max 5 min old)
    now = int(time.time())
    if abs(now - ts) > 300:
        raise HTTPException(status_code=403, detail="Link verlopen. Probeer opnieuw vanuit je clientarea.")

    # Find tenant by WHMCS client ID
    result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == client_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Geen TinyEclipse account gevonden voor dit klantnummer.")

    # Verify signature
    expected = _sign(str(tenant.id), ts)
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=403, detail="Ongeldige handtekening.")

    if tenant.status != TenantStatus.active:
        raise HTTPException(status_code=403, detail="Account is gedeactiveerd.")

    # Generate a short-lived portal token
    portal_ts = int(time.time())
    portal_sig = _sign(str(tenant.id), portal_ts)

    return {
        "status": "authenticated",
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
        "token": f"{portal_ts}:{portal_sig}",
        "redirect_url": f"https://tinyeclipse.digitalfarmers.be/portal?sso={str(tenant.id)}:{portal_ts}:{portal_sig}",
    }


# ─── Generate SSO Link (admin endpoint, for WHMCS integration) ───

@router.get("/sso/generate")
async def generate_sso_link(
    client_id: int = Query(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate an SSO link for a WHMCS client. Called by WHMCS hooks or admin panel.
    No auth required — the link itself is signed and time-limited.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == client_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found for this WHMCS client ID")

    ts = int(time.time())
    sig = _sign(str(tenant.id), ts)

    base = "https://api.tinyeclipse.digitalfarmers.be"
    sso_url = f"{base}/api/portal/sso?client_id={client_id}&ts={ts}&sig={sig}"

    return {
        "sso_url": sso_url,
        "portal_url": f"https://tinyeclipse.digitalfarmers.be/portal?sso={str(tenant.id)}:{ts}:{sig}",
        "expires_in": 300,
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
    }


# ─── Verify Portal Token ───

@router.get("/verify")
async def verify_portal_token(
    tenant_id: str = Query(...),
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Verify a portal session token. Used by frontend to validate SSO sessions."""
    try:
        ts_str, sig = token.split(":", 1)
        ts = int(ts_str)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=403, detail="Ongeldig token formaat.")

    # Tokens valid for 24 hours
    now = int(time.time())
    if abs(now - ts) > 86400:
        raise HTTPException(status_code=403, detail="Sessie verlopen. Log opnieuw in.")

    expected = _sign(tenant_id, ts)
    if not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=403, detail="Ongeldig token.")

    tenant = await db.get(Tenant, uuid.UUID(tenant_id))
    if not tenant or tenant.status != TenantStatus.active:
        raise HTTPException(status_code=404, detail="Account niet gevonden of gedeactiveerd.")

    return {
        "verified": True,
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.name,
        "domain": tenant.domain,
        "plan": tenant.plan.value,
    }

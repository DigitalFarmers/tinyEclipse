"""
Portal Auth — Email+Password login + SSO from WHMCS Client Area.
Allows clients to login with email/password or auto-login from WHMCS.
"""
from __future__ import annotations
import hashlib
import hmac
import time
import uuid
import secrets
import logging
from datetime import datetime, timezone
from typing import Dict

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import get_settings
from app.models.tenant import Tenant, TenantStatus, TenantEnvironment
from app.models.client_account import ClientAccount

logger = logging.getLogger(__name__)
settings = get_settings()

# In-memory reset tokens (production: use Redis or DB)
_reset_tokens: Dict[str, dict] = {}

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


# ─── Email + Password Login ───

class LoginRequest(BaseModel):
    email: str
    password: str


class SetPasswordRequest(BaseModel):
    email: str
    password: str
    confirm_password: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _build_session(client: ClientAccount, tenants: list[Tenant]) -> dict:
    """Build portal session data from client account + tenants."""
    # Pick first production tenant as default
    prod_tenants = [t for t in tenants if t.environment == TenantEnvironment.production]
    default_tenant = prod_tenants[0] if prod_tenants else tenants[0] if tenants else None

    # Generate token
    portal_ts = int(time.time())
    portal_sig = _sign(str(default_tenant.id) if default_tenant else str(client.id), portal_ts)

    return {
        "status": "authenticated",
        "client_id": client.whmcs_client_id,
        "client_name": client.name,
        "email": client.email,
        "tenant_id": str(default_tenant.id) if default_tenant else None,
        "tenant_name": default_tenant.name if default_tenant else None,
        "domain": default_tenant.domain if default_tenant else None,
        "plan": default_tenant.plan.value if default_tenant else "tiny",
        "token": f"{portal_ts}:{portal_sig}",
        "projects": [
            {
                "tenant_id": str(t.id),
                "name": t.name,
                "domain": t.domain,
                "plan": t.plan.value,
                "environment": t.environment.value,
            }
            for t in tenants
            if t.environment == TenantEnvironment.production
        ],
    }


@router.post("/login")
async def email_login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Login with email + password. Returns portal session."""
    email = body.email.strip().lower()

    # Find client account by email
    result = await db.execute(
        select(ClientAccount).where(func.lower(ClientAccount.email) == email)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=401, detail="Ongeldig e-mailadres of wachtwoord.")

    if not client.password_hash:
        raise HTTPException(
            status_code=403,
            detail="Je hebt nog geen wachtwoord ingesteld. Gebruik 'Wachtwoord instellen' om je eerste wachtwoord aan te maken.",
        )

    if not _verify_password(body.password, client.password_hash):
        raise HTTPException(status_code=401, detail="Ongeldig e-mailadres of wachtwoord.")

    # Get tenants
    result = await db.execute(
        select(Tenant).where(Tenant.whmcs_client_id == client.whmcs_client_id)
        .order_by(Tenant.created_at)
    )
    tenants = list(result.scalars().all())

    if not tenants:
        raise HTTPException(status_code=404, detail="Geen websites gevonden voor dit account.")

    return _build_session(client, tenants)


@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Set password for the first time (for existing clients without a password)."""
    email = body.email.strip().lower()

    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Wachtwoorden komen niet overeen.")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Wachtwoord moet minimaal 8 tekens zijn.")

    result = await db.execute(
        select(ClientAccount).where(func.lower(ClientAccount.email) == email)
    )
    client = result.scalar_one_or_none()

    if not client:
        raise HTTPException(status_code=404, detail="Geen account gevonden met dit e-mailadres.")

    if client.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Er is al een wachtwoord ingesteld. Gebruik 'Wachtwoord vergeten' om het te resetten.",
        )

    client.password_hash = _hash_password(body.password)
    await db.commit()

    return {"status": "password_set", "message": "Wachtwoord succesvol ingesteld. Je kunt nu inloggen."}


@router.post("/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a password reset. Generates a token (in production: sends email)."""
    email = body.email.strip().lower()

    result = await db.execute(
        select(ClientAccount).where(func.lower(ClientAccount.email) == email)
    )
    client = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if not client:
        return {"status": "sent", "message": "Als dit e-mailadres bij ons bekend is, ontvang je een reset-link."}

    # Generate reset token
    token = secrets.token_urlsafe(32)
    _reset_tokens[token] = {
        "client_id": client.id,
        "email": email,
        "created_at": time.time(),
    }

    reset_url = f"https://tinyeclipse.digitalfarmers.be/portal/login?reset={token}"
    logger.info(f"Password reset requested for {email}, token: {token}, url: {reset_url}")

    # Send email if SMTP configured
    try:
        if settings.smtp_host:
            import aiosmtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            html = f"""
            <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0;">
                    <h2 style="color: white; margin: 0;">⚡ TinyEclipse</h2>
                </div>
                <div style="background: #1a1a2e; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid rgba(255,255,255,0.1); border-top: none;">
                    <p style="color: rgba(255,255,255,0.7); font-size: 14px;">Hallo {client.name},</p>
                    <p style="color: rgba(255,255,255,0.5); font-size: 13px;">Je hebt een wachtwoord reset aangevraagd. Klik op de knop hieronder om een nieuw wachtwoord in te stellen:</p>
                    <a href="{reset_url}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Wachtwoord resetten</a>
                    <p style="color: rgba(255,255,255,0.3); font-size: 11px;">Deze link is 1 uur geldig. Heb je dit niet aangevraagd? Negeer deze email.</p>
                </div>
            </div>
            """
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "⚡ TinyEclipse — Wachtwoord resetten"
            msg["From"] = settings.smtp_from
            msg["To"] = email
            msg.attach(MIMEText(html, "html"))

            await aiosmtplib.send(
                msg,
                hostname=settings.smtp_host,
                port=settings.smtp_port,
                username=settings.smtp_user,
                password=settings.smtp_pass,
                use_tls=True,
            )
    except Exception as e:
        logger.error(f"Failed to send reset email: {e}")

    return {"status": "sent", "message": "Als dit e-mailadres bij ons bekend is, ontvang je een reset-link."}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a token from forgot-password."""
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Wachtwoorden komen niet overeen.")

    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Wachtwoord moet minimaal 8 tekens zijn.")

    token_data = _reset_tokens.get(body.token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Ongeldige of verlopen reset-link.")

    # Token valid for 1 hour
    if time.time() - token_data["created_at"] > 3600:
        del _reset_tokens[body.token]
        raise HTTPException(status_code=400, detail="Reset-link is verlopen. Vraag een nieuwe aan.")

    client = await db.get(ClientAccount, token_data["client_id"])
    if not client:
        raise HTTPException(status_code=404, detail="Account niet gevonden.")

    client.password_hash = _hash_password(body.password)
    await db.commit()

    # Clean up token
    del _reset_tokens[body.token]

    return {"status": "password_reset", "message": "Wachtwoord succesvol gewijzigd. Je kunt nu inloggen."}

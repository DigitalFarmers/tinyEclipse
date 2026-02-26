"""
Portal Commands — Allowed commands that clients can execute on their own sites.

Clients authenticate via portal token (tenant_id + HMAC signature).
Only whitelisted commands are allowed — no arbitrary execution.
"""
import uuid
import hmac
import hashlib
import time
import logging
from typing import Optional, Dict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.helpers import get_tenant_safe
from app.config import get_settings
from app.models.tenant import Tenant, TenantStatus
from app.services.command_queue import (
    queue_command, get_pending_commands, CommandPriority, CommandType
)

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/portal/commands", tags=["portal-commands"])


# ─── Allowed Commands per Plan ───
# Only these commands can be executed by clients. Anything else is rejected.

ALLOWED_COMMANDS = {
    "tiny": {
        "sync":          {"label": "Sync Content",       "description": "Synchronize website content with AI knowledge base", "icon": "refresh-cw",    "priority": CommandPriority.normal.value, "cooldown": 300},
        "heartbeat":     {"label": "Health Check",        "description": "Run a quick health check on your site",              "icon": "heart-pulse",   "priority": CommandPriority.normal.value, "cooldown": 120},
    },
    "pro": {
        "sync":          {"label": "Sync Content",       "description": "Synchronize website content with AI knowledge base", "icon": "refresh-cw",    "priority": CommandPriority.normal.value, "cooldown": 300},
        "heartbeat":     {"label": "Health Check",        "description": "Run a quick health check on your site",              "icon": "heart-pulse",   "priority": CommandPriority.normal.value, "cooldown": 120},
        "flush_cache":   {"label": "Flush Cache",         "description": "Clear all caches (page, object, CDN)",               "icon": "trash-2",       "priority": CommandPriority.high.value,   "cooldown": 60},
        "security_scan": {"label": "Security Scan",       "description": "Run a full security audit on your site",             "icon": "shield-check",  "priority": CommandPriority.normal.value, "cooldown": 600},
        "deep_scan":     {"label": "Deep Scan",           "description": "Full site intelligence scan (WPML, SEO, content)",   "icon": "scan-search",   "priority": CommandPriority.normal.value, "cooldown": 900},
        "report":        {"label": "Generate Report",     "description": "Generate a full site status report",                 "icon": "file-text",     "priority": CommandPriority.low.value,    "cooldown": 1800},
    },
    "pro_plus": {
        "sync":          {"label": "Sync Content",       "description": "Synchronize website content with AI knowledge base", "icon": "refresh-cw",    "priority": CommandPriority.normal.value, "cooldown": 120},
        "heartbeat":     {"label": "Health Check",        "description": "Run a quick health check on your site",              "icon": "heart-pulse",   "priority": CommandPriority.normal.value, "cooldown": 60},
        "flush_cache":   {"label": "Flush Cache",         "description": "Clear all caches (page, object, CDN)",               "icon": "trash-2",       "priority": CommandPriority.high.value,   "cooldown": 30},
        "security_scan": {"label": "Security Scan",       "description": "Run a full security audit on your site",             "icon": "shield-check",  "priority": CommandPriority.normal.value, "cooldown": 300},
        "deep_scan":     {"label": "Deep Scan",           "description": "Full site intelligence scan (WPML, SEO, content)",   "icon": "scan-search",   "priority": CommandPriority.normal.value, "cooldown": 600},
        "report":        {"label": "Generate Report",     "description": "Generate a full site status report",                 "icon": "file-text",     "priority": CommandPriority.low.value,    "cooldown": 900},
        "update_config": {"label": "Push Config",         "description": "Push latest configuration to your site",             "icon": "upload",        "priority": CommandPriority.high.value,   "cooldown": 60},
        "scan":          {"label": "Quick Scan",          "description": "Fast scan of site vitals and modules",               "icon": "zap",           "priority": CommandPriority.normal.value, "cooldown": 120},
    },
}

# In-memory cooldown tracker: {tenant_id:command_type -> last_executed_timestamp}
_cooldowns: Dict[str, float] = {}


def _verify_portal_token(tenant_id: str, token: str) -> bool:
    """Verify portal HMAC token (same logic as portal_auth.py)."""
    try:
        ts_str, sig = token.split(":", 1)
        ts = int(ts_str)
    except (ValueError, AttributeError):
        return False
    # 24h validity
    if abs(time.time() - ts) > 86400:
        return False
    msg = f"{tenant_id}:{ts}"
    expected = hmac.new(
        settings.app_secret_key.encode(), msg.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig, expected)


# ─── List Available Commands ───

@router.get("/available/{tenant_id}")
async def get_available_commands(
    tenant_id: str,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Return the list of commands this client is allowed to execute."""
    if not _verify_portal_token(tenant_id, token):
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    tenant = await get_tenant_safe(db, tenant_id, require_active=True)

    plan = tenant.plan.value
    commands = ALLOWED_COMMANDS.get(plan, ALLOWED_COMMANDS["tiny"])

    # Add cooldown status
    result = {}
    now = time.time()
    for cmd_type, meta in commands.items():
        cooldown_key = f"{tenant_id}:{cmd_type}"
        last_run = _cooldowns.get(cooldown_key, 0)
        remaining = max(0, meta["cooldown"] - (now - last_run))
        result[cmd_type] = {
            **meta,
            "cooldown_remaining": int(remaining),
            "available": remaining == 0,
        }

    return {
        "tenant_id": tenant_id,
        "plan": plan,
        "commands": result,
    }


# ─── Execute Command ───

class ExecuteCommandRequest(BaseModel):
    tenant_id: str
    token: str
    command_type: str
    payload: Dict = {}


@router.post("/execute")
async def execute_command(
    body: ExecuteCommandRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute an allowed command on the client's site."""
    if not _verify_portal_token(body.tenant_id, body.token):
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    tenant = await get_tenant_safe(db, body.tenant_id, require_active=True)

    plan = tenant.plan.value
    allowed = ALLOWED_COMMANDS.get(plan, ALLOWED_COMMANDS["tiny"])

    if body.command_type not in allowed:
        raise HTTPException(
            status_code=403,
            detail=f"Command '{body.command_type}' is not available on the {plan} plan"
        )

    # Check cooldown
    now = time.time()
    cooldown_key = f"{body.tenant_id}:{body.command_type}"
    last_run = _cooldowns.get(cooldown_key, 0)
    cooldown = allowed[body.command_type]["cooldown"]
    remaining = cooldown - (now - last_run)

    if remaining > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Cooldown active. Try again in {int(remaining)} seconds."
        )

    # Queue the command
    command_id = await queue_command(
        db=db,
        tenant_id=uuid.UUID(body.tenant_id),
        command_type=body.command_type,
        payload={
            **body.payload,
            "source": "portal",
            "requested_by": "client",
        },
        priority=allowed[body.command_type]["priority"],
    )

    # Update cooldown
    _cooldowns[cooldown_key] = now

    logger.info(f"[portal-cmd] Client executed {body.command_type} on tenant {body.tenant_id}")

    return {
        "status": "queued",
        "command_id": str(command_id),
        "command_type": body.command_type,
        "message": f"{allowed[body.command_type]['label']} is gestart",
    }


# ─── Command History ───

@router.get("/history/{tenant_id}")
async def get_command_history(
    tenant_id: str,
    token: str = Query(...),
    limit: int = Query(default=20, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Get recent command history for this tenant (portal-initiated only)."""
    if not _verify_portal_token(tenant_id, token):
        raise HTTPException(status_code=403, detail="Invalid or expired token")

    commands = await get_pending_commands(
        db=db,
        limit=limit,
        tenant_id=uuid.UUID(tenant_id),
    )

    return {
        "tenant_id": tenant_id,
        "total": len(commands),
        "commands": commands,
    }

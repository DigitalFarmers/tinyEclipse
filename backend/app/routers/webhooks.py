"""
Webhooks API — Push notifications to Slack, Discord, email, custom URLs.
When Eclipse detects something, the world knows instantly.
"""
import uuid
import hmac
import hashlib
import logging
from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import Optional, List, Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import verify_admin_key
from app.models.tenant import Tenant

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/admin/webhooks",
    tags=["admin-webhooks"],
    dependencies=[Depends(verify_admin_key)],
)


# ─── In-memory webhook store (DB migration later) ───
_webhooks: Dict[str, dict] = {}
_webhook_logs: List[dict] = []


class WebhookType(str, PyEnum):
    slack = "slack"
    discord = "discord"
    telegram = "telegram"
    email = "email"
    custom = "custom"


class WebhookEvent(str, PyEnum):
    alert_created = "alert.created"
    alert_resolved = "alert.resolved"
    uptime_down = "uptime.down"
    uptime_recovered = "uptime.recovered"
    ssl_expiring = "ssl.expiring"
    security_critical = "security.critical"
    heartbeat_dead = "heartbeat.dead"
    report_generated = "report.generated"
    tenant_created = "tenant.created"
    conversation_escalated = "conversation.escalated"
    all = "all"


class WebhookCreate(BaseModel):
    tenant_id: Optional[str] = None  # None = global (all tenants)
    name: str
    type: str  # slack, discord, email, custom
    url: str  # webhook URL or email address
    events: List[str] = ["all"]
    secret: Optional[str] = None  # for HMAC signing
    enabled: bool = True


class WebhookUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    events: Optional[List[str]] = None
    secret: Optional[str] = None
    enabled: Optional[bool] = None


# ─── CRUD ───

@router.get("/")
async def list_webhooks():
    """List all configured webhooks."""
    return {
        "total": len(_webhooks),
        "webhooks": list(_webhooks.values()),
    }


@router.post("/", status_code=201)
async def create_webhook(body: WebhookCreate):
    """Create a new webhook subscription."""
    wh_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat()

    webhook = {
        "id": wh_id,
        "tenant_id": body.tenant_id,
        "name": body.name,
        "type": body.type,
        "url": body.url,
        "events": body.events,
        "secret": body.secret,
        "enabled": body.enabled,
        "created_at": now,
        "last_triggered": None,
        "trigger_count": 0,
        "last_status": None,
    }
    _webhooks[wh_id] = webhook
    return {"status": "created", "id": wh_id, "webhook": webhook}


@router.get("/{webhook_id}")
async def get_webhook(webhook_id: str):
    """Get webhook details."""
    wh = _webhooks.get(webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")
    return wh


@router.patch("/{webhook_id}")
async def update_webhook(webhook_id: str, body: WebhookUpdate):
    """Update a webhook."""
    wh = _webhooks.get(webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    if body.name is not None:
        wh["name"] = body.name
    if body.url is not None:
        wh["url"] = body.url
    if body.events is not None:
        wh["events"] = body.events
    if body.secret is not None:
        wh["secret"] = body.secret
    if body.enabled is not None:
        wh["enabled"] = body.enabled

    return {"status": "updated", "webhook": wh}


@router.delete("/{webhook_id}")
async def delete_webhook(webhook_id: str):
    """Delete a webhook."""
    if webhook_id not in _webhooks:
        raise HTTPException(status_code=404, detail="Webhook not found")
    del _webhooks[webhook_id]
    return {"status": "deleted"}


# ─── Test & Trigger ───

@router.post("/{webhook_id}/test")
async def test_webhook(webhook_id: str):
    """Send a test payload to a webhook."""
    wh = _webhooks.get(webhook_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found")

    test_payload = {
        "event": "test",
        "message": "This is a test from Eclipse — your webhook is working!",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "webhook_id": webhook_id,
    }

    result = await _dispatch_webhook(wh, test_payload)
    return {"status": "test_sent", "result": result}


@router.get("/logs/")
async def webhook_logs(limit: int = 50):
    """Get recent webhook delivery logs."""
    return {
        "total": len(_webhook_logs),
        "logs": _webhook_logs[-limit:][::-1],
    }


# ─── Dispatch Engine ───

async def dispatch_event(event: str, tenant_id: Optional[str], payload: Dict):
    """Dispatch an event to all matching webhooks. Called internally by other services."""
    for wh in _webhooks.values():
        if not wh["enabled"]:
            continue

        # Check tenant match
        if wh["tenant_id"] and tenant_id and wh["tenant_id"] != tenant_id:
            continue

        # Check event match
        if "all" not in wh["events"] and event not in wh["events"]:
            continue

        full_payload = {
            "event": event,
            "tenant_id": tenant_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **payload,
        }

        try:
            result = await _dispatch_webhook(wh, full_payload)
            logger.info(f"Webhook {wh['id']} dispatched for {event}: {result}")
        except Exception as e:
            logger.error(f"Webhook {wh['id']} failed for {event}: {e}")


async def _dispatch_webhook(webhook: dict, payload: dict) -> dict:
    """Send payload to a webhook endpoint."""
    import httpx

    url = webhook["url"]
    wh_type = webhook["type"]
    now = datetime.now(timezone.utc)

    # Format payload based on type
    if wh_type == "slack":
        body = _format_slack(payload)
    elif wh_type == "discord":
        body = _format_discord(payload)
    elif wh_type == "telegram":
        body = _format_telegram(payload)
    else:
        body = payload

    # Sign payload if secret is set
    headers = {"Content-Type": "application/json"}
    if webhook.get("secret") and wh_type not in ("telegram",):
        import json
        raw = json.dumps(body, sort_keys=True)
        sig = hmac.new(webhook["secret"].encode(), raw.encode(), hashlib.sha256).hexdigest()
        headers["X-Eclipse-Signature"] = f"sha256={sig}"

    # Telegram uses Bot API — URL format: https://api.telegram.org/bot<TOKEN>/sendMessage
    # The webhook URL should be the bot token, and secret should be the chat_id
    if wh_type == "telegram":
        bot_token = url
        chat_id = webhook.get("secret", "")
        tg_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        body["chat_id"] = chat_id
        url = tg_url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=body, headers=headers)

        result = {
            "status_code": resp.status_code,
            "success": 200 <= resp.status_code < 300,
        }
    except Exception as e:
        result = {"status_code": None, "success": False, "error": str(e)}

    # Update webhook stats
    webhook["last_triggered"] = now.isoformat()
    webhook["trigger_count"] = webhook.get("trigger_count", 0) + 1
    webhook["last_status"] = "ok" if result["success"] else "failed"

    # Log
    _webhook_logs.append({
        "webhook_id": webhook["id"],
        "webhook_name": webhook["name"],
        "event": payload.get("event"),
        "timestamp": now.isoformat(),
        **result,
    })

    # Keep logs bounded
    if len(_webhook_logs) > 500:
        _webhook_logs[:] = _webhook_logs[-250:]

    return result


def _format_slack(payload: dict) -> dict:
    """Format payload for Slack incoming webhook."""
    event = payload.get("event", "unknown")
    message = payload.get("message", "")
    tenant = payload.get("tenant_name", payload.get("tenant_id", ""))
    domain = payload.get("domain", "")

    emoji = {
        "alert.created": ":rotating_light:",
        "alert.resolved": ":white_check_mark:",
        "uptime.down": ":red_circle:",
        "uptime.recovered": ":large_green_circle:",
        "ssl.expiring": ":lock:",
        "security.critical": ":shield:",
        "heartbeat.dead": ":skull:",
        "conversation.escalated": ":loudspeaker:",
        "test": ":zap:",
    }.get(event, ":bell:")

    text = f"{emoji} *Eclipse Alert — {event}*\n"
    if tenant:
        text += f"*Site:* {tenant}"
        if domain:
            text += f" ({domain})"
        text += "\n"
    if message:
        text += f"{message}\n"
    text += f"_Timestamp: {payload.get('timestamp', '')}_"

    return {"text": text}


def _format_telegram(payload: dict) -> dict:
    """Format payload for Telegram Bot API sendMessage."""
    event = payload.get("event", "unknown")
    message = payload.get("message", "")
    tenant = payload.get("tenant_name", payload.get("tenant_id", ""))
    domain = payload.get("domain", "")
    severity = payload.get("severity", "")

    emoji = {
        "alert.created": "🚨", "alert.resolved": "✅",
        "uptime.down": "🔴", "uptime.recovered": "🟢",
        "ssl.expiring": "🔒", "security.critical": "🛡️",
        "heartbeat.dead": "💀", "conversation.escalated": "📢",
        "test": "⚡",
    }.get(event, "🔔")

    text = f"{emoji} *Eclipse — {event}*\n"
    if tenant:
        text += f"*Site:* {tenant}"
        if domain:
            text += f" ({domain})"
        text += "\n"
    if severity:
        text += f"*Severity:* {severity.upper()}\n"
    if message:
        text += f"\n{message}\n"
    text += f"\n_{payload.get('timestamp', '')[:19]}_"

    return {"text": text, "parse_mode": "Markdown"}


def _format_discord(payload: dict) -> dict:
    """Format payload for Discord webhook."""
    event = payload.get("event", "unknown")
    message = payload.get("message", "")
    tenant = payload.get("tenant_name", payload.get("tenant_id", ""))

    color_map = {
        "alert.created": 0xFF0000,
        "alert.resolved": 0x00FF00,
        "uptime.down": 0xFF0000,
        "uptime.recovered": 0x00FF00,
        "ssl.expiring": 0xFFAA00,
        "security.critical": 0xFF0000,
        "heartbeat.dead": 0x000000,
        "test": 0x6366F1,
    }

    return {
        "embeds": [{
            "title": f"Eclipse — {event}",
            "description": message or "Event triggered",
            "color": color_map.get(event, 0x6366F1),
            "fields": [
                {"name": "Site", "value": tenant or "Global", "inline": True},
                {"name": "Event", "value": event, "inline": True},
            ],
            "timestamp": payload.get("timestamp"),
            "footer": {"text": "TinyEclipse by Digital Farmers"},
        }],
    }

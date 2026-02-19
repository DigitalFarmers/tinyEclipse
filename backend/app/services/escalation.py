"""
Escalation Service — When AI can't help, humans take over.

Flow:
1. Mark conversation as escalated in DB
2. Send webhook notification (Slack/Discord/custom)
3. Send email notification to Digital Farmers
4. Optionally create WHMCS support ticket

All notification steps are fire-and-forget — they never block the chat response.
"""
import uuid
import asyncio
import json
import logging
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.conversation import Conversation, ConversationStatus
from app.models.message import Message, MessageRole
from app.models.tenant import Tenant

logger = structlog.get_logger()
settings = get_settings()


async def escalate_conversation(
    db: AsyncSession,
    conversation: Conversation,
    reason: str,
    confidence: float,
) -> None:
    """Mark a conversation as escalated and notify all channels."""
    conversation.status = ConversationStatus.escalated
    await db.flush()

    logger.warning(
        "conversation_escalated",
        conversation_id=str(conversation.id),
        tenant_id=str(conversation.tenant_id),
        reason=reason,
        confidence=confidence,
    )

    # Gather context for notifications
    tenant = await db.get(Tenant, conversation.tenant_id)
    tenant_name = tenant.name if tenant else "Onbekend"
    tenant_domain = tenant.domain if tenant else "onbekend"

    # Get last few messages for context
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(6)
    )
    messages = list(reversed(msgs_result.scalars().all()))
    chat_preview = "\n".join(
        f"{'Bezoeker' if m.role == MessageRole.user else 'AI'}: {m.content[:200]}"
        for m in messages
    )

    context = {
        "conversation_id": str(conversation.id),
        "tenant_id": str(conversation.tenant_id),
        "tenant_name": tenant_name,
        "tenant_domain": tenant_domain,
        "reason": reason,
        "confidence": confidence,
        "chat_preview": chat_preview,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "portal_url": f"https://tinyeclipse.digitalfarmers.be/admin/tenants/{conversation.tenant_id}",
    }

    # Fire-and-forget notifications
    asyncio.create_task(_send_webhook(context))
    asyncio.create_task(_send_email_notification(context))


async def _send_webhook(context: dict) -> None:
    """Send escalation to Slack/Discord/custom webhook."""
    url = settings.escalation_webhook_url
    if not url:
        return

    try:
        # Detect if Slack or Discord based on URL
        if "hooks.slack.com" in url:
            payload = _build_slack_payload(context)
        elif "discord.com/api/webhooks" in url:
            payload = _build_discord_payload(context)
        else:
            payload = _build_generic_payload(context)

        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
            logger.info("escalation_webhook_sent", status=r.status_code, url=url[:50])
    except Exception as e:
        logger.error("escalation_webhook_failed", error=str(e))


def _build_slack_payload(ctx: dict) -> dict:
    """Build Slack Block Kit message."""
    conf_pct = round(ctx["confidence"] * 100)
    color = "#e74c3c" if conf_pct < 30 else "#f39c12"
    return {
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"🚨 Escalatie — {ctx['tenant_name']}"}
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Website:*\n{ctx['tenant_domain']}"},
                        {"type": "mrkdwn", "text": f"*Confidence:*\n{conf_pct}%"},
                        {"type": "mrkdwn", "text": f"*Reden:*\n{ctx['reason']}"},
                        {"type": "mrkdwn", "text": f"*Tijd:*\n{ctx['timestamp'][:19]}"},
                    ]
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Gesprek:*\n```{ctx['chat_preview'][:500]}```"}
                },
                {
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {"type": "plain_text", "text": "Bekijk in TinyEclipse"},
                        "url": ctx["portal_url"],
                        "style": "primary",
                    }]
                }
            ]
        }]
    }


def _build_discord_payload(ctx: dict) -> dict:
    """Build Discord embed message."""
    conf_pct = round(ctx["confidence"] * 100)
    return {
        "embeds": [{
            "title": f"🚨 Escalatie — {ctx['tenant_name']}",
            "color": 0xe74c3c if conf_pct < 30 else 0xf39c12,
            "fields": [
                {"name": "Website", "value": ctx["tenant_domain"], "inline": True},
                {"name": "Confidence", "value": f"{conf_pct}%", "inline": True},
                {"name": "Reden", "value": ctx["reason"], "inline": True},
                {"name": "Gesprek", "value": f"```{ctx['chat_preview'][:500]}```"},
            ],
            "url": ctx["portal_url"],
            "timestamp": ctx["timestamp"],
        }]
    }


def _build_generic_payload(ctx: dict) -> dict:
    """Generic JSON webhook payload."""
    return {
        "event": "escalation",
        "tenant_name": ctx["tenant_name"],
        "tenant_domain": ctx["tenant_domain"],
        "conversation_id": ctx["conversation_id"],
        "confidence": ctx["confidence"],
        "reason": ctx["reason"],
        "chat_preview": ctx["chat_preview"],
        "portal_url": ctx["portal_url"],
        "timestamp": ctx["timestamp"],
    }


async def _send_email_notification(context: dict) -> None:
    """Send escalation email to Digital Farmers."""
    if not settings.smtp_host or not settings.escalation_email:
        return

    try:
        import aiosmtplib

        conf_pct = round(context["confidence"] * 100)
        subject = f"🚨 TinyEclipse Escalatie — {context['tenant_name']} ({conf_pct}%)"

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px 24px; border-radius: 12px 12px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 18px;">🚨 AI Escalatie</h2>
                <p style="color: rgba(255,255,255,0.7); margin: 4px 0 0; font-size: 13px;">{context['tenant_name']} — {context['tenant_domain']}</p>
            </div>
            <div style="background: #1a1a2e; padding: 24px; border: 1px solid rgba(255,255,255,0.1); border-top: none; border-radius: 0 0 12px 12px;">
                <table style="width: 100%; font-size: 13px; color: rgba(255,255,255,0.7);">
                    <tr><td style="padding: 4px 0; color: rgba(255,255,255,0.4);">Confidence:</td><td style="padding: 4px 0; font-weight: bold; color: {'#e74c3c' if conf_pct < 30 else '#f39c12'};">{conf_pct}%</td></tr>
                    <tr><td style="padding: 4px 0; color: rgba(255,255,255,0.4);">Reden:</td><td style="padding: 4px 0;">{context['reason']}</td></tr>
                </table>
                <div style="margin-top: 16px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="margin: 0 0 8px; font-size: 11px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 1px;">Gesprek</p>
                    <pre style="margin: 0; font-size: 12px; color: rgba(255,255,255,0.6); white-space: pre-wrap; font-family: inherit;">{context['chat_preview'][:800]}</pre>
                </div>
                <a href="{context['portal_url']}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600;">Bekijk in TinyEclipse →</a>
            </div>
        </div>
        """

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.smtp_from
        msg["To"] = settings.escalation_email
        msg.attach(MIMEText(html, "html"))

        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_pass,
            use_tls=True,
        )
        logger.info("escalation_email_sent", to=settings.escalation_email)
    except ImportError:
        logger.warning("escalation_email_skipped", reason="aiosmtplib not installed")
    except Exception as e:
        logger.error("escalation_email_failed", error=str(e))

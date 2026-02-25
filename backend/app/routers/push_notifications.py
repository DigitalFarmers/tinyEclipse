"""
Push Notifications API Endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.responses import JSONResponse
from typing import List, Optional
import logging

from app.models.push_notifications import PushSubscription, PushPayload
from app.services.push_service import push_service
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/push", tags=["push"])


@router.post("/vapid-keys")
async def get_vapid_keys(tenant_id: Optional[str] = None):
    """Get VAPID public key for push subscription"""
    try:
        public_key, _ = await push_service.initialize_vapid_keys(tenant_id)
        return {"public_key": public_key}
    except Exception as e:
        logger.error(f"Failed to generate VAPID keys: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate VAPID keys")


@router.post("/subscribe")
async def subscribe(
    user_id: str = Body(...),
    tenant_id: str = Body(...),
    subscription: dict = Body(...)
):
    """Register a new push subscription"""
    try:
        push_sub = await push_service.subscribe_user(user_id, tenant_id, subscription)
        return {"subscription_id": str(push_sub.id), "status": "subscribed"}
    except Exception as e:
        logger.error(f"Failed to subscribe user: {e}")
        raise HTTPException(status_code=500, detail="Failed to subscribe")


@router.post("/unsubscribe")
async def unsubscribe(subscription_id: str = Body(...)):
    """Remove a push subscription"""
    try:
        success = await push_service.unsubscribe(subscription_id)
        return {"status": "unsubscribed" if success else "not_found"}
    except Exception as e:
        logger.error(f"Failed to unsubscribe: {e}")
        raise HTTPException(status_code=500, detail="Failed to unsubscribe")


@router.post("/send")
async def send_notification(
    user_id: str = Body(...),
    payload: PushPayload = Body(...),
    tenant_id: Optional[str] = Body(None)
):
    """Send a push notification to a user"""
    try:
        notifications = await push_service.send_notification(user_id, payload, tenant_id)
        return {
            "sent_count": len(notifications),
            "notifications": [{"id": str(n.id), "status": n.status} for n in notifications]
        }
    except Exception as e:
        logger.error(f"Failed to send notification: {e}")
        raise HTTPException(status_code=500, detail="Failed to send notification")


@router.post("/send-to-tenant")
async def send_to_tenant_admins(
    tenant_id: str = Body(...),
    payload: PushPayload = Body(...)
):
    """Send notification to all tenant admins"""
    try:
        notifications = await push_service.send_to_tenant_admins(tenant_id, payload)
        return {
            "sent_count": len(notifications),
            "notifications": [{"id": str(n.id), "status": n.status} for n in notifications]
        }
    except Exception as e:
        logger.error(f"Failed to send to tenant admins: {e}")
        raise HTTPException(status_code=500, detail="Failed to send notification")


@router.get("/subscriptions/{user_id}")
async def get_user_subscriptions(user_id: str, tenant_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    """Get user's push subscriptions"""
    query = select(PushSubscription).where(PushSubscription.user_id == user_id)
    if tenant_id:
        query = query.where(PushSubscription.tenant_id == tenant_id)
    
    subscriptions = (await db.execute(query)).scalars().all()
    return {
            "subscriptions": [
                {
                    "id": str(sub.id),
                    "endpoint": sub.endpoint,
                    "user_agent": sub.user_agent,
                    "is_active": sub.is_active,
                    "created_at": sub.created_at.isoformat(),
                    "last_used": sub.last_used.isoformat() if sub.last_used else None
                }
                for sub in subscriptions
            ]
        }


@router.delete("/subscriptions/{subscription_id}")
async def delete_subscription(subscription_id: str):
    """Delete a push subscription"""
    try:
        success = await push_service.unsubscribe(subscription_id)
        if success:
            return {"status": "deleted"}
        else:
            raise HTTPException(status_code=404, detail="Subscription not found")
    except Exception as e:
        logger.error(f"Failed to delete subscription: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete subscription")

"""
Push Notification Service - Handles Web Push API notifications
"""
import asyncio
import json
import logging
import base64
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone

from pywebpush import WebPusher, webpush
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend

from app.models.push_notifications import PushSubscription, PushNotification, PushPayload, VapidKeys
from app.database import async_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

logger = logging.getLogger(__name__)


class PushService:
    """Service for managing push notifications"""
    
    def __init__(self):
        self.vapid_private_key = None
        self.vapid_public_key = None
        self.vapid_subject = "mailto:admin@tinyeclipse.digitalfarmers.be"
    
    async def initialize_vapid_keys(self, tenant_id: Optional[str] = None) -> Tuple[str, str]:
        """Generate or get VAPID keys for a tenant"""
        async with async_session() as db:
            # Check if keys exist for tenant
            if tenant_id:
                result = await db.execute(
                    select(VapidKeys).where(VapidKeys.tenant_id == tenant_id, VapidKeys.is_active == True)
                )
                result = result.first()
                if result:
                    return result.public_key, result.private_key
            
            # Generate new keys
            private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
            private_pem = private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption()
            ).decode()
            
            public_key = private_key.public_key()
            public_pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode()
            
            # Extract the raw key for webpush
            public_bytes = public_key.public_numbers().encode_point()
            public_key_b64 = base64.urlsafe_b64encode(public_bytes).rstrip(b'=').decode()
            private_key_b64 = base64.urlsafe_b64encode(
                private_key.private_numbers().private_value.to_bytes(32, 'big')
            ).rstrip(b'=').decode()
            
            # Store in database
            vapid_keys = VapidKeys(
                tenant_id=tenant_id,
                public_key=public_key_b64,
                private_key=private_key_b64,
                subject=self.vapid_subject
            )
            db.add(vapid_keys)
            await db.commit()
            
            return public_key_b64, private_key_b64
    
    async def subscribe_user(self, user_id: str, tenant_id: str, subscription_info: dict) -> PushSubscription:
        """Register a new push subscription"""
        async with async_session() as db:
            # Check if subscription already exists
            existing = await db.execute(
                select(PushSubscription).where(
                    PushSubscription.user_id == user_id,
                    PushSubscription.endpoint == subscription_info['endpoint']
                )
            )
            existing = existing.first()
            
            if existing:
                # Update existing subscription
                existing.p256dh_key = subscription_info['keys']['p256dh']
                existing.auth_key = subscription_info['keys']['auth']
                existing.is_active = True
                existing.last_used = datetime.now(timezone.utc)
                await db.commit()
                return existing
            
            # Create new subscription
            subscription = PushSubscription(
                user_id=user_id,
                tenant_id=tenant_id,
                endpoint=subscription_info['endpoint'],
                p256dh_key=subscription_info['keys']['p256dh'],
                auth_key=subscription_info['keys']['auth'],
                user_agent=subscription_info.get('userAgent'),
                is_active=True
            )
            db.add(subscription)
            await db.commit()
            await db.refresh(subscription)
            return subscription
    
    async def send_notification(
        self,
        user_id: str,
        payload: PushPayload,
        tenant_id: Optional[str] = None
    ) -> List[PushNotification]:
        """Send push notification to all user's active subscriptions"""
        results = []
        
        async with async_session() as db:
            # Get user's subscriptions
            query = select(PushSubscription).where(
                PushSubscription.user_id == user_id,
                PushSubscription.is_active == True
            )
            if tenant_id:
                query = query.where(PushSubscription.tenant_id == tenant_id)
            
            subscriptions = (await db.execute(query)).scalars().all()
            
            if not subscriptions:
                logger.warning(f"No active subscriptions found for user {user_id}")
                return results
            
            # Get VAPID keys
            public_key, private_key = await self.initialize_vapid_keys(tenant_id)
            
            # Send to each subscription
            for subscription in subscriptions:
                try:
                    # Prepare subscription info for pywebpush
                    subscription_info = {
                        "endpoint": subscription.endpoint,
                        "keys": {
                            "p256dh": subscription.p256dh_key,
                            "auth": subscription.auth_key
                        }
                    }
                    
                    # Prepare payload
                    payload_data = {
                        "title": payload.title,
                        "body": payload.body,
                        "icon": payload.icon,
                        "badge": payload.badge,
                        "tag": payload.tag,
                        "data": payload.data or {},
                        "actions": payload.actions or [],
                        "requireInteraction": payload.require_interaction,
                        "silent": payload.silent
                    }
                    
                    # Send push notification
                    webpush(
                        subscription_info=subscription_info,
                        data=json.dumps(payload_data),
                        vapid_private_key=private_key,
                        vapid_claims={
                            "sub": self.vapid_subject
                        }
                    )
                    
                    # Log successful send
                    notification = PushNotification(
                        subscription_id=subscription.id,
                        tenant_id=tenant_id,
                        title=payload.title,
                        body=payload.body,
                        payload=payload_data,
                        status="sent",
                        sent_at=datetime.now(timezone.utc)
                    )
                    db.add(notification)
                    
                    # Update last used
                    subscription.last_used = datetime.now(timezone.utc)
                    
                    logger.info(f"Push notification sent to user {user_id}")
                    
                except Exception as e:
                    # Log failed send
                    notification = PushNotification(
                        subscription_id=subscription.id,
                        tenant_id=tenant_id,
                        title=payload.title,
                        body=payload.body,
                        payload=payload_data,
                        status="failed",
                        error_message=str(e)
                    )
                    db.add(notification)
                    
                    # Deactivate subscription on permanent errors
                    if "410" in str(e) or "404" in str(e):
                        subscription.is_active = False
                        logger.warning(f"Deactivated subscription {subscription.id} due to error: {e}")
                    
                    logger.error(f"Failed to send push notification: {e}")
                
                results.append(notification)
            
            await db.commit()
            return results
    
    async def send_to_tenant_admins(self, tenant_id: str, payload: PushPayload) -> List[PushNotification]:
        """Send notification to all admins of a tenant"""
        # This would require getting all admin users for the tenant
        # For now, we'll use a placeholder implementation
        # In a real implementation, you'd have a user_roles table to track admins
        
        # Get all subscriptions for this tenant
        async with async_session() as db:
            subscriptions = (await db.execute(
                select(PushSubscription).where(
                    PushSubscription.tenant_id == tenant_id,
                    PushSubscription.is_active == True
                )
            )).scalars().all()
            
            results = []
            for subscription in subscriptions:
                # Send to each subscription (assuming all users of tenant are admins for now)
                user_results = await self.send_notification(
                    subscription.user_id, payload, tenant_id
                )
                results.extend(user_results)
            
            return results
    
    async def unsubscribe(self, subscription_id: str) -> bool:
        """Remove a push subscription"""
        async with async_session() as db:
            subscription = await db.execute(
                select(PushSubscription).where(PushSubscription.id == subscription_id)
            )
            subscription = subscription.first()
            
            if subscription:
                subscription.is_active = False
                await db.commit()
                return True
            return False


# Global push service instance
push_service = PushService()

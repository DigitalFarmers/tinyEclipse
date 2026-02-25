"""
Push Notification Service - Real-time alerts via Web Push API
Supports VAPID authentication for browser push notifications
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


@dataclass
class PushPayload:
    title: str
    body: str
    icon: Optional[str] = None
    badge: Optional[str] = None
    tag: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    actions: Optional[List[Dict[str, str]]] = None
    require_interaction: bool = False
    silent: bool = False


class PushSubscription(Base):
    """User's push notification subscription"""
    __tablename__ = "push_subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    endpoint: Mapped[str] = mapped_column(String(500), nullable=False)
    p256dh_key: Mapped[str] = mapped_column(String(255), nullable=False)
    auth_key: Mapped[str] = mapped_column(String(255), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_used: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="push_subscriptions")


class PushNotification(Base):
    """Sent push notifications log"""
    __tablename__ = "push_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    subscription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("push_subscriptions.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, sent, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    subscription = relationship("PushSubscription")
    tenant = relationship("Tenant")


class VapidKeys(Base):
    """VAPID keys for push authentication"""
    __tablename__ = "vapid_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    public_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    private_key: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="mailto:admin@tinyeclipse.digitalfarmers.be")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant")

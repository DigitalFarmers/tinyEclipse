"""
Alert Rules Engine - Configurable triggers for proactive notifications
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from enum import Enum

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text, func, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AlertType(str, Enum):
    """Types of alerts that can be triggered"""
    ABANDONED_CART = "abandoned_cart"
    CHECKOUT_FAILURE = "checkout_failure"
    SSL_EXPIRING = "ssl_expiring"
    UPTIME_DOWN = "uptime_down"
    FORM_SUBMISSION = "form_submission"
    HIGH_VALUE_ORDER = "high_value_order"
    LOW_STOCK = "low_stock"
    NEW_ORDER = "new_order"
    SECURITY_ISSUE = "security_issue"
    PERFORMANCE_ISSUE = "performance_issue"
    ERROR_SPIKE = "error_spike"


class AlertSeverity(str, Enum):
    """Severity levels for alerts"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    """Status of alert instances"""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"


class AlertRule(Base):
    """Configurable alert rules"""
    __tablename__ = "alert_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    alert_type: Mapped[AlertType] = mapped_column(String(50), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(String(20), nullable=False, default=AlertSeverity.MEDIUM)
    
    # Rule configuration
    conditions: Mapped[dict] = mapped_column(JSONB, nullable=False)  # Rule-specific conditions
    threshold_value: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    threshold_operator: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # >, <, =, >=, <=
    
    # Notification settings
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_push: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notify_email: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notify_webhook: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    webhook_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    # Cooldown and suppression
    cooldown_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)  # Min time between alerts
    auto_resolve_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Auto-resolve after X minutes
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="alert_rules")
    proactive_alerts = relationship("ProactiveAlert", back_populates="rule", cascade="all, delete-orphan")


class ProactiveAlert(Base):
    """Individual alert instances"""
    __tablename__ = "proactive_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    rule_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("alert_rules.id"), nullable=True)
    
    # Alert details
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    alert_type: Mapped[AlertType] = mapped_column(String(50), nullable=False)
    severity: Mapped[AlertSeverity] = mapped_column(String(20), nullable=False)
    status: Mapped[AlertStatus] = mapped_column(String(20), nullable=False, default=AlertStatus.ACTIVE)
    
    # Context data
    source_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # ID of source object
    source_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Type of source object
    context: Mapped[dict] = mapped_column(JSONB, nullable=False)  # Additional context data
    
    # Timestamps
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    rule = relationship("AlertRule", back_populates="proactive_alerts")
    tenant = relationship("Tenant", back_populates="proactive_alerts")


class AlertNotification(Base):
    """Log of sent alert notifications"""
    __tablename__ = "alert_notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("proactive_alerts.id"), nullable=False)
    
    # Notification details
    channel: Mapped[str] = mapped_column(String(20), nullable=False)  # push, email, webhook
    recipient: Mapped[str] = mapped_column(String(200), nullable=False)  # User ID, email, or webhook URL
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")  # pending, sent, failed
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    alert = relationship("ProactiveAlert")

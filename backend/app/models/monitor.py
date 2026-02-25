import enum
import uuid
import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, Text, Enum as SQLEnum, DateTime, ForeignKey, func, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CheckType(str, enum.Enum):
    uptime = "uptime"
    ssl = "ssl"
    smtp = "smtp"
    dns = "dns"
    forms = "forms"
    security_headers = "security_headers"
    performance = "performance"
    content_change = "content_change"


class CheckStatus(str, enum.Enum):
    ok = "ok"
    warning = "warning"
    critical = "critical"
    unknown = "unknown"


class AlertSeverity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


class MonitorCheck(Base):
    """Defines what to monitor for a tenant."""
    __tablename__ = "monitor_checks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    check_type: Mapped[CheckType] = mapped_column(SQLEnum(CheckType), nullable=False)
    target: Mapped[str] = mapped_column(String(500), nullable=False)  # URL, email, IP, etc.
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # Check-specific config
    last_status: Mapped[CheckStatus] = mapped_column(SQLEnum(CheckStatus), nullable=False, default=CheckStatus.unknown)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_response_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tenant = relationship("Tenant")
    results = relationship("MonitorResult", back_populates="check", lazy="dynamic", order_by="MonitorResult.created_at.desc()")


class MonitorResult(Base):
    """Individual check result — one row per check execution."""
    __tablename__ = "monitor_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    check_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("monitor_checks.id"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    status: Mapped[CheckStatus] = mapped_column(SQLEnum(CheckStatus), nullable=False)
    response_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # Full check output
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    check = relationship("MonitorCheck", back_populates="results")


class AlertClassification(str, enum.Enum):
    auto_fixable = "auto_fixable"
    needs_attention = "needs_attention"
    informational = "informational"
    suppressed = "suppressed"


class Alert(Base):
    """Alerts triggered by monitoring checks."""
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    check_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("monitor_checks.id"), nullable=False, index=True)
    severity: Mapped[AlertSeverity] = mapped_column(SQLEnum(AlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Deduplication
    dedup_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # AI Classification
    classification: Mapped[Optional[AlertClassification]] = mapped_column(SQLEnum(AlertClassification), nullable=True)
    priority_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    auto_fix_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    check = relationship("MonitorCheck")
    tenant = relationship("Tenant")

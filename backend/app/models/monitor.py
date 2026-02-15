import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Float, Boolean, Text, Enum, DateTime, ForeignKey, func
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
    check_type: Mapped[CheckType] = mapped_column(Enum(CheckType), nullable=False)
    target: Mapped[str] = mapped_column(String(500), nullable=False)  # URL, email, IP, etc.
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # Check-specific config
    last_status: Mapped[CheckStatus] = mapped_column(Enum(CheckStatus), nullable=False, default=CheckStatus.unknown)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
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
    status: Mapped[CheckStatus] = mapped_column(Enum(CheckStatus), nullable=False)
    response_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # Full check output
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    check = relationship("MonitorCheck", back_populates="results")


class Alert(Base):
    """Alerts triggered by monitoring checks."""
    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    check_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("monitor_checks.id"), nullable=False, index=True)
    severity: Mapped[AlertSeverity] = mapped_column(Enum(AlertSeverity), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    acknowledged: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    check = relationship("MonitorCheck")
    tenant = relationship("Tenant")

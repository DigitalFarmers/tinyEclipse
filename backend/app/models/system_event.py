"""
SystemEvent — Lightweight technical event bus.
Registers everything that happens in TinyEclipse:
deployments, syncs, security scans, API errors, plugin updates, health checks, etc.
Designed for minimal storage: JSONB payload, auto-cleanup after 90 days.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EventSeverity(str, enum.Enum):
    debug = "debug"
    info = "info"
    success = "success"
    warning = "warning"
    error = "error"
    critical = "critical"


class EventDomain(str, enum.Enum):
    system = "system"        # Core platform events
    security = "security"    # Security scans, threats, blocks
    sync = "sync"            # Data sync operations
    deploy = "deploy"        # Deployments, updates
    monitor = "monitor"      # Health checks, uptime
    ai = "ai"                # AI learning, knowledge changes
    server = "server"        # Server-level events (DFGuard)
    plugin = "plugin"        # WordPress plugin operations
    api = "api"              # API errors, rate limits


class SystemEvent(Base):
    """One technical event in the TinyEclipse ecosystem."""
    __tablename__ = "system_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)  # null = global event

    domain: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default=EventSeverity.info.value, index=True)

    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # e.g. "knowledge_sync", "ssl_check", "plugin_update"
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Flexible payload — keep it small
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Source identification
    source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # "scheduler", "admin", "webhook", "wp_plugin"
    ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    __table_args__ = (
        Index("ix_system_events_domain_created", "domain", "created_at"),
        Index("ix_system_events_tenant_created", "tenant_id", "created_at"),
    )

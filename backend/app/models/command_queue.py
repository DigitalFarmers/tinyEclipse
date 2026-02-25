"""
Command Queue Model — Centralized command processing for WordPress sites.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Enum as SQLEnum, DateTime, ForeignKey, func, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CommandStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class CommandQueue(Base):
    __tablename__ = "command_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    command_type: Mapped[str] = mapped_column(String(50), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[CommandStatus] = mapped_column(SQLEnum(CommandStatus), nullable=False, default=CommandStatus.pending)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="commands")

    # Indexes
    __table_args__ = (
        {"schema": None},
    )


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    enabled: Mapped[bool] = mapped_column(nullable=False, default=False)
    min_plugin_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SyncTracking(Base):
    __tablename__ = "sync_tracking"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)  # inbound/outbound
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

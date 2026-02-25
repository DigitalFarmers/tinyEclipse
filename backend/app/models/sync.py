"""
Cross-Site Sync Models
Links products, stock, and customers across sibling tenants within a ClientAccount.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, Text, Enum as SQLEnum, DateTime, ForeignKey, func, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SyncDirection(str, enum.Enum):
    bidirectional = "bidirectional"
    master_to_slave = "master_to_slave"


class SyncEntityType(str, enum.Enum):
    product = "product"
    stock = "stock"
    customer = "customer"
    order = "order"


class SyncStatus(str, enum.Enum):
    pending = "pending"
    syncing = "syncing"
    synced = "synced"
    conflict = "conflict"
    error = "error"


class SyncGroup(Base):
    """Links the same entity across multiple tenant sites.
    E.g., one SyncGroup for 'Chocolate Bonbons' linking chocotale.online product #42
    to tuchochocolate.com product #17."""
    __tablename__ = "sync_groups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("client_accounts.id"), nullable=False, index=True)
    entity_type: Mapped[SyncEntityType] = mapped_column(SQLEnum(SyncEntityType), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    direction: Mapped[SyncDirection] = mapped_column(SQLEnum(SyncDirection), nullable=False, default=SyncDirection.bidirectional)
    master_tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    members = relationship("SyncMember", back_populates="group", lazy="selectin")
    logs = relationship("SyncLog", back_populates="group", lazy="dynamic", order_by="SyncLog.created_at.desc()")


class SyncMember(Base):
    """One tenant's version of a synced entity."""
    __tablename__ = "sync_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sync_groups.id"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    remote_id: Mapped[str] = mapped_column(String(100), nullable=False)  # WooCommerce product/order ID
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[SyncStatus] = mapped_column(SQLEnum(SyncStatus), nullable=False, default=SyncStatus.pending)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    local_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # Cached snapshot
    overrides: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)  # Per-site overrides
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    group = relationship("SyncGroup", back_populates="members")
    tenant = relationship("Tenant")


class SyncLog(Base):
    """Audit log of sync operations."""
    __tablename__ = "sync_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sync_groups.id"), nullable=False, index=True)
    source_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    target_tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    entity_type: Mapped[SyncEntityType] = mapped_column(SQLEnum(SyncEntityType), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # created, updated, stock_changed, conflict_resolved
    changes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[SyncStatus] = mapped_column(SQLEnum(SyncStatus), nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    group = relationship("SyncGroup", back_populates="logs")

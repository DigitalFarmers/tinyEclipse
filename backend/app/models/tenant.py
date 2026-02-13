import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Enum, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PlanType(str, enum.Enum):
    tiny = "tiny"
    pro = "pro"
    pro_plus = "pro_plus"


class TenantStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    whmcs_client_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan: Mapped[PlanType] = mapped_column(Enum(PlanType), nullable=False, default=PlanType.tiny)
    status: Mapped[TenantStatus] = mapped_column(Enum(TenantStatus), nullable=False, default=TenantStatus.active)
    domain: Mapped[str] = mapped_column(String(255), nullable=True)
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    sources = relationship("Source", back_populates="tenant", lazy="selectin")
    conversations = relationship("Conversation", back_populates="tenant", lazy="selectin")
    consents = relationship("Consent", back_populates="tenant", lazy="selectin")

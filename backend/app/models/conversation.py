import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ConversationStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    escalated = "escalated"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(50), nullable=False, default="widget")
    status: Mapped[ConversationStatus] = mapped_column(Enum(ConversationStatus), nullable=False, default=ConversationStatus.active)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Visitor Identity — proactive fingerprinting
    visitor_ip: Mapped[str | None] = mapped_column(String(45), nullable=True, index=True)
    visitor_country: Mapped[str | None] = mapped_column(String(2), nullable=True)
    visitor_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    visitor_device: Mapped[str | None] = mapped_column(String(20), nullable=True)
    visitor_browser: Mapped[str | None] = mapped_column(String(50), nullable=True)
    visitor_language: Mapped[str | None] = mapped_column(String(10), nullable=True)
    visitor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    visitor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    visitor_identity: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", lazy="selectin", order_by="Message.created_at")

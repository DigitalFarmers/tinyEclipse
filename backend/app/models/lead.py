"""Lead model — stores visitor contact info captured from widget."""
import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Enum as SQLEnum, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LeadSource(str, enum.Enum):
    chat = "chat"
    exit_intent = "exit_intent"
    proactive = "proactive"
    manual = "manual"


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(255), nullable=True, index=True)
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[LeadSource] = mapped_column(SQLEnum(LeadSource), nullable=False, default=LeadSource.chat)
    page_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    tenant = relationship("Tenant")

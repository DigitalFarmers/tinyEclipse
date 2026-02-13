import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Text, Enum, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SourceType(str, enum.Enum):
    url = "url"
    pdf = "pdf"
    faq = "faq"
    text = "text"


class SourceStatus(str, enum.Enum):
    pending = "pending"
    indexed = "indexed"
    failed = "failed"


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SourceStatus] = mapped_column(Enum(SourceStatus), nullable=False, default=SourceStatus.pending)
    last_indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="sources")
    embeddings = relationship("Embedding", back_populates="source", lazy="selectin", cascade="all, delete-orphan")

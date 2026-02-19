"""
ChangeRequest — Klanten kunnen wijzigingen aanvragen via Eclipse.

Pagina's, producten, formulieren, content, SEO, vertalingen — alles.
PRO klanten: basis requests. PRO+ klanten: prioriteit + meer types.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Integer, Enum, DateTime, ForeignKey, Float, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RequestType(str, enum.Enum):
    page_edit = "page_edit"
    product_edit = "product_edit"
    form_edit = "form_edit"
    content_add = "content_add"
    seo_update = "seo_update"
    translation = "translation"
    design_change = "design_change"
    bug_report = "bug_report"
    feature_request = "feature_request"
    other = "other"


class RequestStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    rejected = "rejected"


class RequestPriority(str, enum.Enum):
    low = "low"
    normal = "normal"
    high = "high"
    urgent = "urgent"


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    whmcs_client_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    request_type: Mapped[RequestType] = mapped_column(Enum(RequestType), nullable=False, default=RequestType.other)
    priority: Mapped[RequestPriority] = mapped_column(Enum(RequestPriority), nullable=False, default=RequestPriority.normal)
    status: Mapped[RequestStatus] = mapped_column(Enum(RequestStatus), nullable=False, default=RequestStatus.pending)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    page_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Admin response
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata
    metadata: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

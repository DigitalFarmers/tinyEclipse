"""
ChangeRequest — Klanten kunnen wijzigingen aanvragen via Eclipse.

Pagina's, producten, formulieren, content, SEO, vertalingen — alles.
PRO klanten: basis requests. PRO+ klanten: prioriteit + meer types.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# Plain string constants — no SQLAlchemy Enum types needed
REQUEST_TYPES = ["page_edit", "product_edit", "form_edit", "content_add", "seo_update", "translation", "design_change", "bug_report", "feature_request", "other"]
REQUEST_STATUSES = ["pending", "in_progress", "completed", "rejected"]
REQUEST_PRIORITIES = ["low", "normal", "high", "urgent"]


class ChangeRequest(Base):
    __tablename__ = "change_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    whmcs_client_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    request_type: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    page_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Admin response
    admin_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata
    metadata: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

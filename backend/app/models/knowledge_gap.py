"""
KnowledgeGap + VisitorProfile — the AI Brain's memory.
Lightweight models that track what the AI doesn't know and who visits.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Text, Float, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class GapStatus(str, enum.Enum):
    open = "open"
    resolved = "resolved"
    dismissed = "dismissed"
    in_progress = "in_progress"


class GapCategory(str, enum.Enum):
    product = "product"
    pricing = "pricing"
    shipping = "shipping"
    returns = "returns"
    hours = "hours"
    contact = "contact"
    process = "process"
    technical = "technical"
    policy = "policy"
    other = "other"


class KnowledgeGap(Base):
    """A question the AI couldn't answer well. Persisted for admin action."""
    __tablename__ = "knowledge_gaps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False, default=GapCategory.other.value)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=GapStatus.open.value)

    # How often this gap was hit
    frequency: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    last_asked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Context
    avg_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sample_conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    escalated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Resolution
    resolved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # admin who resolved
    resolved_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # the answer that was added
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)  # linked source

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class VisitorProfile(Base):
    """Persistent visitor identity across sessions. Lightweight JSONB-heavy."""
    __tablename__ = "visitor_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    visitor_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # anonymous fingerprint from widget

    # Identity (enriched over time)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # Geo (first seen)
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Device profile
    device_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    browser: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Aggregated stats (updated incrementally — no heavy queries needed)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_pageviews: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_conversations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_events: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_time_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Scores (computed by brain service)
    engagement_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # 0-100
    intent_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # 0-100 purchase intent
    loyalty_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # 0-100 return visitor

    # Journey snapshot (lightweight JSONB — last N events, not all)
    journey: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # Structure: { "last_pages": [...], "last_actions": [...], "tags": [...], "interests": [...] }

    # Timestamps
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

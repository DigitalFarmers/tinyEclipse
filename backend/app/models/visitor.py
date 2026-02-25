"""
Visitor tracking models — the intelligence layer.
Tracks every visitor session, page view, event, and builds user journeys.
"""
import enum
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Enum as SQLEnum, DateTime, ForeignKey, func, Float, Boolean, JSON, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class VisitorSession(Base):
    """One visitor session on a tenant's site."""
    __tablename__ = "visitor_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    visitor_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # Anonymous fingerprint
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)

    # Source
    referrer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    utm_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    landing_page: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Device
    device_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # mobile, desktop, tablet
    browser: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    os: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    screen_width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    screen_height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Geo (from IP, privacy-safe)
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Session stats
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_bounce: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    has_conversion: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    chat_initiated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # AI insights
    intent_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1 purchase/conversion intent
    help_needed_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1 likelihood needs help
    engagement_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # 0-1 engagement level

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    page_views = relationship("PageView", back_populates="session", lazy="dynamic", order_by="PageView.created_at")
    events = relationship("VisitorEvent", back_populates="session", lazy="dynamic", order_by="VisitorEvent.created_at")


class PageView(Base):
    """Individual page view within a session."""
    __tablename__ = "page_views"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("visitor_sessions.session_id"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    url: Mapped[str] = mapped_column(Text, nullable=False)
    path: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Engagement
    time_on_page_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scroll_depth_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0-100
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("VisitorSession", back_populates="page_views")


class EventType(str, enum.Enum):
    click = "click"
    scroll = "scroll"
    form_start = "form_start"
    form_submit = "form_submit"
    form_abandon = "form_abandon"
    idle = "idle"
    rage_click = "rage_click"
    exit_intent = "exit_intent"
    chat_open = "chat_open"
    chat_message = "chat_message"
    conversion = "conversion"
    error = "error"
    custom = "custom"


class VisitorEvent(Base):
    """Behavioral events — clicks, scrolls, form interactions, idle detection, etc."""
    __tablename__ = "visitor_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(String(64), ForeignKey("visitor_sessions.session_id"), nullable=False, index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    event_type: Mapped[EventType] = mapped_column(SQLEnum(EventType), nullable=False, index=True)
    page_path: Mapped[str] = mapped_column(String(500), nullable=False)
    element: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # CSS selector or element description
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Event-specific value
    metadata_: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    session = relationship("VisitorSession", back_populates="events")

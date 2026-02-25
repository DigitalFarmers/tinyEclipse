"""
SiteModule — Detected modules/features per tenant site.

Auto-detected or manually configured modules like:
- jobs (vacatures, FluentForms job board)
- shop (WooCommerce, product catalog)
- giftcard (cadeaubon module)
- forms (FluentForms, Contact Form 7, etc.)
- mail (mailboxen via DirectAdmin)
- blog (WordPress posts)
- booking (reserveringen)
- forum (community/forum)
- services (diensten, uurprijs, vaste prijs)
- rental (verhuur, toestellen, ruimtes)
- portfolio (projecten, realisaties, showcase)
- packages (pakketten, arrangementen, bundels)
- custom (anything else)

Each module tracks its own stats and can feed into the events timeline.
"""
import uuid
import logging
from datetime import datetime, timezone
import enum
from typing import Optional

from sqlalchemy import String, Integer, Boolean, Enum as SQLEnum, DateTime, ForeignKey, func, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ModuleType(str, enum.Enum):
    jobs = "jobs"
    shop = "shop"
    giftcard = "giftcard"
    forms = "forms"
    mail = "mail"
    blog = "blog"
    booking = "booking"
    forum = "forum"
    services = "services"
    rental = "rental"
    portfolio = "portfolio"
    packages = "packages"
    custom = "custom"


class ModuleStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    error = "error"


class SiteModule(Base):
    """A detected or configured module on a tenant's site."""
    __tablename__ = "site_modules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    module_type: Mapped[ModuleType] = mapped_column(SQLEnum(ModuleType), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)  # e.g. "Vacatures", "Webshop", "Cadeaubonnen"
    status: Mapped[ModuleStatus] = mapped_column(SQLEnum(ModuleStatus), nullable=False, default=ModuleStatus.active)
    auto_detected: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Module-specific config
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # e.g. for jobs: {"form_id": 5, "listing_page": "/vacatures"}
    # e.g. for shop: {"woocommerce": true, "product_count": 42}
    # e.g. for mail: {"mailboxes": ["info@chocotale.online", "jobs@chocotale.online"]}

    # Stats (updated periodically)
    stats: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    # e.g. for jobs: {"total_listings": 5, "applications_30d": 12}
    # e.g. for shop: {"total_products": 42, "orders_30d": 8}

    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant", back_populates="site_modules")

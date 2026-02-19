"""
Contact Matcher — Unified identity resolution.
Finds or creates a Contact for any person we encounter across all touchpoints.
Matches on email (primary), phone (secondary), or creates new.
"""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact

logger = logging.getLogger(__name__)


async def find_or_create_contact(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    email: str | None = None,
    phone: str | None = None,
    name: str | None = None,
    company: str | None = None,
    city: str | None = None,
    country: str | None = None,
    address: str | None = None,
    language: str | None = None,
    source: str = "unknown",
) -> Contact:
    """
    Find existing contact by email or phone, or create a new one.
    Merges any new data into the existing contact.
    """
    email = email.strip().lower() if email else None
    phone = _normalize_phone(phone) if phone else None
    name = name.strip() if name else None

    if not email and not phone and not name:
        raise ValueError("At least email, phone, or name required")

    contact = None

    # Try to find by email first (strongest match)
    if email:
        result = await db.execute(
            select(Contact).where(Contact.tenant_id == tenant_id, Contact.email == email)
        )
        contact = result.scalar_one_or_none()

    # Try phone if no email match
    if not contact and phone:
        result = await db.execute(
            select(Contact).where(Contact.tenant_id == tenant_id, Contact.phone == phone)
        )
        contact = result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if contact:
        # Merge new data into existing contact
        if email and not contact.email:
            contact.email = email
        if phone and not contact.phone:
            contact.phone = phone
        if name and not contact.name:
            contact.name = name
        if company and not contact.company:
            contact.company = company
        if city and not contact.city:
            contact.city = city
        if country and not contact.country:
            contact.country = country
        if address and not contact.address:
            contact.address = address
        if language and not contact.language:
            contact.language = language
        contact.last_seen_at = now
        logger.info(f"[contact-matcher] Matched existing contact {contact.id} for {email or phone or name}")
    else:
        # Create new contact
        contact = Contact(
            tenant_id=tenant_id,
            email=email,
            phone=phone,
            name=name,
            company=company,
            city=city,
            country=country,
            address=address,
            language=language,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(contact)
        await db.flush()
        logger.info(f"[contact-matcher] Created new contact {contact.id} for {email or phone or name} (source: {source})")

    return contact


async def increment_contact_stat(
    db: AsyncSession,
    contact_id: uuid.UUID,
    stat: str,
    amount: int | float = 1,
):
    """Increment a stat on a contact (total_orders, total_spent, etc.)."""
    contact = await db.get(Contact, contact_id)
    if not contact:
        return
    current = getattr(contact, stat, 0) or 0
    setattr(contact, stat, current + amount)
    contact.last_seen_at = datetime.now(timezone.utc)


def _normalize_phone(phone: str | None) -> str | None:
    """Normalize phone number for matching."""
    if not phone:
        return None
    # Strip everything except digits and leading +
    cleaned = phone.strip()
    if cleaned.startswith("+"):
        digits = "+" + "".join(c for c in cleaned[1:] if c.isdigit())
    else:
        digits = "".join(c for c in cleaned if c.isdigit())
    # Belgian: convert 0x to +32x
    if digits.startswith("0") and len(digits) >= 9:
        digits = "+32" + digits[1:]
    return digits if len(digits) >= 8 else None

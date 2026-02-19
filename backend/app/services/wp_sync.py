"""
WordPress Full Sync Processor — processes bulk data from connector v4.
Creates unified contacts from orders, customers, form submissions.
"""
import uuid
import logging
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.services.contact_matcher import find_or_create_contact, increment_contact_stat

logger = logging.getLogger(__name__)


async def process_full_sync(db: AsyncSession, tenant_id: uuid.UUID, data: dict) -> dict:
    """
    Process a full sync payload from the WordPress connector v4.
    Creates/updates unified contacts from all data sources.
    Returns stats about what was processed.
    """
    stats = {
        "contacts_created": 0,
        "contacts_updated": 0,
        "orders_processed": 0,
        "customers_processed": 0,
        "form_submissions_processed": 0,
        "users_processed": 0,
        "comments_processed": 0,
    }

    # 1. Process orders → create contacts
    for order in data.get("orders", []):
        try:
            email = order.get("email")
            name = order.get("customer")
            phone = order.get("phone")
            if not email and not name:
                continue

            contact = await find_or_create_contact(
                db, tenant_id,
                email=email, phone=phone, name=name,
                city=order.get("city"), country=order.get("country"),
                address=order.get("address"), source="order_sync",
            )

            # Update order stats
            if contact.total_orders == 0:
                stats["contacts_created"] += 1
            else:
                stats["contacts_updated"] += 1

            stats["orders_processed"] += 1
        except Exception as e:
            logger.warning(f"[wp-sync] Order processing failed: {e}")

    # 2. Process customers → create/update contacts with spending data
    for customer in data.get("customers", []):
        try:
            email = customer.get("email")
            name = customer.get("name")
            phone = customer.get("phone")
            if not email and not name:
                continue

            contact = await find_or_create_contact(
                db, tenant_id,
                email=email, phone=phone, name=name,
                city=customer.get("city"), country=customer.get("country"),
                source="customer_sync",
            )

            # Set aggregated stats from WooCommerce
            order_count = customer.get("order_count", 0)
            total_spent = customer.get("total_spent", 0.0)
            if order_count > contact.total_orders:
                contact.total_orders = order_count
            if total_spent > contact.total_spent:
                contact.total_spent = total_spent

            stats["customers_processed"] += 1
        except Exception as e:
            logger.warning(f"[wp-sync] Customer processing failed: {e}")

    # 3. Process form submissions → create contacts
    for sub in data.get("form_submissions", []):
        try:
            email = sub.get("email")
            name = sub.get("name")
            phone = sub.get("phone")
            if not email and not name:
                continue

            contact = await find_or_create_contact(
                db, tenant_id,
                email=email, phone=phone, name=name,
                source="form_sync",
            )
            await increment_contact_stat(db, contact.id, "total_form_submissions")
            stats["form_submissions_processed"] += 1
        except Exception as e:
            logger.warning(f"[wp-sync] Form submission processing failed: {e}")

    # 4. Process users → create contacts (only customers/subscribers)
    for user in data.get("users", []):
        try:
            role = user.get("role", "")
            if "administrator" in role or "editor" in role:
                continue  # Skip admin/editor users
            email = user.get("email")
            name = user.get("name")
            if not email:
                continue

            await find_or_create_contact(
                db, tenant_id,
                email=email, name=name,
                source="user_sync",
            )
            stats["users_processed"] += 1
        except Exception as e:
            logger.warning(f"[wp-sync] User processing failed: {e}")

    # 5. Process comments → create contacts
    for comment in data.get("comments", []):
        try:
            email = comment.get("email")
            name = comment.get("author")
            if not email:
                continue

            await find_or_create_contact(
                db, tenant_id,
                email=email, name=name,
                source="comment_sync",
            )
            stats["comments_processed"] += 1
        except Exception as e:
            logger.warning(f"[wp-sync] Comment processing failed: {e}")

    await db.flush()

    total_processed = sum(stats.values())
    logger.info(f"[wp-sync] Full sync for tenant {tenant_id}: {total_processed} items processed")

    return stats

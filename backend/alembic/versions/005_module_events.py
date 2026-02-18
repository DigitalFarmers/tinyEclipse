"""Add module_events table for module-specific events (jobs, shop, forms, etc.)

Revision ID: 005
Revises: 004
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type
    module_event_type = sa.Enum(
        "job_application", "job_published", "job_expired",
        "order_placed", "order_completed", "order_refunded", "product_published",
        "giftcard_purchased", "giftcard_redeemed",
        "form_submitted",
        "mail_received", "mail_bounced",
        "booking_created", "booking_cancelled",
        "custom",
        name="moduleeventtype",
    )

    op.create_table(
        "module_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("module_type", sa.String(50), nullable=False),
        sa.Column("event_type", module_event_type, nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info"),
        sa.Column("data", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("source_url", sa.String(500), nullable=True),
        sa.Column("source_ip", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_module_events_tenant_id", "module_events", ["tenant_id"])
    op.create_index("ix_module_events_module_type", "module_events", ["module_type"])
    op.create_index("ix_module_events_event_type", "module_events", ["event_type"])
    op.create_index("ix_module_events_created_at", "module_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("module_events")
    op.execute("DROP TYPE IF EXISTS moduleeventtype")

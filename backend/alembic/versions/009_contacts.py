"""Add contacts table for unified identity.

Revision ID: 009
Revises: 008
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contacts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(50), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("address", sa.Text, nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("total_orders", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_spent", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_conversations", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_form_submissions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_leads", sa.Integer, nullable=False, server_default="0"),
        sa.Column("tags", JSONB, nullable=False, server_default="[]"),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    # Add contact_id to leads table
    op.add_column("leads", sa.Column("contact_id", UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column("leads", "contact_id")
    op.drop_table("contacts")

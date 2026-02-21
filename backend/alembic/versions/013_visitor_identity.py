"""Add visitor_identity JSONB to conversations for visitor fingerprinting.

Revision ID: 013
Revises: 012
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("conversations", sa.Column("visitor_identity", JSONB, nullable=True, server_default=None))
    op.add_column("conversations", sa.Column("visitor_ip", sa.String(45), nullable=True))
    op.add_column("conversations", sa.Column("visitor_country", sa.String(2), nullable=True))
    op.add_column("conversations", sa.Column("visitor_city", sa.String(100), nullable=True))
    op.add_column("conversations", sa.Column("visitor_device", sa.String(20), nullable=True))
    op.add_column("conversations", sa.Column("visitor_browser", sa.String(50), nullable=True))
    op.add_column("conversations", sa.Column("visitor_language", sa.String(10), nullable=True))
    op.add_column("conversations", sa.Column("visitor_name", sa.String(255), nullable=True))
    op.add_column("conversations", sa.Column("visitor_email", sa.String(255), nullable=True))
    op.add_column("conversations", sa.Column("contact_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_conversations_contact_id", "conversations", ["contact_id"])
    op.create_index("ix_conversations_visitor_ip", "conversations", ["visitor_ip"])


def downgrade() -> None:
    op.drop_index("ix_conversations_visitor_ip")
    op.drop_index("ix_conversations_contact_id")
    op.drop_column("conversations", "contact_id")
    op.drop_column("conversations", "visitor_email")
    op.drop_column("conversations", "visitor_name")
    op.drop_column("conversations", "visitor_language")
    op.drop_column("conversations", "visitor_browser")
    op.drop_column("conversations", "visitor_device")
    op.drop_column("conversations", "visitor_city")
    op.drop_column("conversations", "visitor_country")
    op.drop_column("conversations", "visitor_ip")
    op.drop_column("conversations", "visitor_identity")

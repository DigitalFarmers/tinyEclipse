"""System events — technical event bus

Revision ID: 020
Revises: 019
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "system_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("domain", sa.String(20), nullable=False, index=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="info", index=True),
        sa.Column("action", sa.String(100), nullable=False, index=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("detail", sa.Text, nullable=True),
        sa.Column("data", JSONB, nullable=False, server_default="{}"),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("ip", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )
    op.create_index("ix_system_events_domain_created", "system_events", ["domain", "created_at"])
    op.create_index("ix_system_events_tenant_created", "system_events", ["tenant_id", "created_at"])


def downgrade():
    op.drop_table("system_events")

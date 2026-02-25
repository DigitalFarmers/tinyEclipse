"""AI Brain — knowledge gaps + visitor profiles

Revision ID: 019
Revises: 018
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    # ── Knowledge Gaps ──
    op.create_table(
        "knowledge_gaps",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("question", sa.Text, nullable=False),
        sa.Column("category", sa.String(30), nullable=False, server_default="other"),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("frequency", sa.Integer, nullable=False, server_default="1"),
        sa.Column("last_asked_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("avg_confidence", sa.Float, nullable=False, server_default="0"),
        sa.Column("sample_conversation_id", UUID(as_uuid=True), nullable=True),
        sa.Column("escalated", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("resolved_by", sa.String(100), nullable=True),
        sa.Column("resolved_answer", sa.Text, nullable=True),
        sa.Column("source_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Visitor Profiles ──
    op.create_table(
        "visitor_profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("visitor_id", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=True, index=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("contact_id", UUID(as_uuid=True), nullable=True, index=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("device_type", sa.String(20), nullable=True),
        sa.Column("browser", sa.String(50), nullable=True),
        sa.Column("total_sessions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_pageviews", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_conversations", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_events", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_time_seconds", sa.Integer, nullable=False, server_default="0"),
        sa.Column("engagement_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("intent_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("loyalty_score", sa.Float, nullable=False, server_default="0"),
        sa.Column("journey", JSONB, nullable=False, server_default="{}"),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Unique constraint: one profile per visitor per tenant
    op.create_unique_constraint("uq_visitor_profile_tenant_visitor", "visitor_profiles", ["tenant_id", "visitor_id"])


def downgrade():
    op.drop_table("visitor_profiles")
    op.drop_table("knowledge_gaps")

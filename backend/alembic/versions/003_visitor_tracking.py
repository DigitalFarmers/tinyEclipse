"""Add visitor tracking tables: visitor_sessions, page_views, visitor_events

Revision ID: 003
Revises: 002
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Visitor Sessions
    op.create_table(
        "visitor_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("visitor_id", sa.String(64), nullable=False),
        sa.Column("session_id", sa.String(64), nullable=False, unique=True),
        sa.Column("referrer", sa.Text(), nullable=True),
        sa.Column("utm_source", sa.String(100), nullable=True),
        sa.Column("utm_medium", sa.String(100), nullable=True),
        sa.Column("utm_campaign", sa.String(100), nullable=True),
        sa.Column("landing_page", sa.Text(), nullable=True),
        sa.Column("device_type", sa.String(20), nullable=True),
        sa.Column("browser", sa.String(50), nullable=True),
        sa.Column("os", sa.String(50), nullable=True),
        sa.Column("screen_width", sa.Integer(), nullable=True),
        sa.Column("screen_height", sa.Integer(), nullable=True),
        sa.Column("country", sa.String(2), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("language", sa.String(10), nullable=True),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_bounce", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("has_conversion", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("chat_initiated", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("intent_score", sa.Float(), nullable=True),
        sa.Column("help_needed_score", sa.Float(), nullable=True),
        sa.Column("engagement_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_visitor_sessions_tenant_id", "visitor_sessions", ["tenant_id"])
    op.create_index("ix_visitor_sessions_visitor_id", "visitor_sessions", ["visitor_id"])
    op.create_index("ix_visitor_sessions_session_id", "visitor_sessions", ["session_id"])

    # Page Views
    op.create_table(
        "page_views",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("session_id", sa.String(64), sa.ForeignKey("visitor_sessions.session_id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("path", sa.String(500), nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("time_on_page_seconds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scroll_depth_percent", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("clicks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_page_views_session_id", "page_views", ["session_id"])
    op.create_index("ix_page_views_tenant_id", "page_views", ["tenant_id"])
    op.create_index("ix_page_views_path", "page_views", ["path"])

    # Visitor Events
    op.create_table(
        "visitor_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("session_id", sa.String(64), sa.ForeignKey("visitor_sessions.session_id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("event_type", sa.Enum(
            "click", "scroll", "form_start", "form_submit", "form_abandon",
            "idle", "rage_click", "exit_intent", "chat_open", "chat_message",
            "conversion", "error", "custom",
            name="eventtype"
        ), nullable=False),
        sa.Column("page_path", sa.String(500), nullable=False),
        sa.Column("element", sa.String(200), nullable=True),
        sa.Column("value", sa.Text(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_visitor_events_session_id", "visitor_events", ["session_id"])
    op.create_index("ix_visitor_events_tenant_id", "visitor_events", ["tenant_id"])
    op.create_index("ix_visitor_events_event_type", "visitor_events", ["event_type"])


def downgrade() -> None:
    op.drop_table("visitor_events")
    op.drop_table("page_views")
    op.drop_table("visitor_sessions")
    op.execute("DROP TYPE IF EXISTS eventtype")

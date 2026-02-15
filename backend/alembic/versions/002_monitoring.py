"""Add monitoring tables: monitor_checks, monitor_results, alerts

Revision ID: 002
Revises: 001
Create Date: 2026-02-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Monitor Checks
    op.create_table(
        "monitor_checks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("check_type", sa.Enum("uptime", "ssl", "smtp", "dns", "forms", "security_headers", "performance", "content_change", name="checktype"), nullable=False),
        sa.Column("target", sa.String(500), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("interval_minutes", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("last_status", sa.Enum("ok", "warning", "critical", "unknown", name="checkstatus"), nullable=False, server_default="unknown"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_response_ms", sa.Integer(), nullable=True),
        sa.Column("consecutive_failures", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_monitor_checks_tenant_id", "monitor_checks", ["tenant_id"])

    # Monitor Results
    op.create_table(
        "monitor_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("check_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitor_checks.id"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("status", sa.Enum("ok", "warning", "critical", "unknown", name="checkstatus", create_type=False), nullable=False),
        sa.Column("response_ms", sa.Integer(), nullable=True),
        sa.Column("details", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_monitor_results_check_id", "monitor_results", ["check_id"])
    op.create_index("ix_monitor_results_tenant_id", "monitor_results", ["tenant_id"])

    # Alerts
    op.create_table(
        "alerts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("check_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("monitor_checks.id"), nullable=False),
        sa.Column("severity", sa.Enum("info", "warning", "critical", name="alertseverity"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("acknowledged", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_alerts_tenant_id", "alerts", ["tenant_id"])
    op.create_index("ix_alerts_check_id", "alerts", ["check_id"])


def downgrade() -> None:
    op.drop_table("alerts")
    op.drop_table("monitor_results")
    op.drop_table("monitor_checks")
    op.execute("DROP TYPE IF EXISTS checktype")
    op.execute("DROP TYPE IF EXISTS checkstatus")
    op.execute("DROP TYPE IF EXISTS alertseverity")

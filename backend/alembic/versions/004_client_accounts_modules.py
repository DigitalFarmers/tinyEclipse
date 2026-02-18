"""Add client_accounts and site_modules tables, add client_account_id to tenants

Revision ID: 004
Revises: 003
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Client Accounts
    op.create_table(
        "client_accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("whmcs_client_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("company", sa.String(255), nullable=True),
        sa.Column("settings", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_client_accounts_whmcs_client_id", "client_accounts", ["whmcs_client_id"])

    # Site Modules
    op.create_table(
        "site_modules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("module_type", sa.Enum("jobs", "shop", "giftcard", "forms", "mail", "blog", "booking", "forum", "custom", name="moduletype"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("status", sa.Enum("active", "inactive", "error", name="modulestatus"), nullable=False, server_default="active"),
        sa.Column("auto_detected", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("config", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("stats", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_site_modules_tenant_id", "site_modules", ["tenant_id"])
    op.create_index("ix_site_modules_module_type", "site_modules", ["module_type"])

    # Add client_account_id to tenants
    op.add_column("tenants", sa.Column("client_account_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_tenants_client_account", "tenants", "client_accounts", ["client_account_id"], ["id"])
    op.create_index("ix_tenants_client_account_id", "tenants", ["client_account_id"])

    # Drop unique constraint on whmcs_client_id (allow multiple tenants per client)
    try:
        op.drop_constraint("tenants_whmcs_client_id_key", "tenants", type_="unique")
    except Exception:
        pass  # Constraint may not exist or have a different name


def downgrade() -> None:
    op.drop_index("ix_tenants_client_account_id", "tenants")
    op.drop_constraint("fk_tenants_client_account", "tenants", type_="foreignkey")
    op.drop_column("tenants", "client_account_id")
    op.drop_table("site_modules")
    op.drop_table("client_accounts")
    op.execute("DROP TYPE IF EXISTS moduletype")
    op.execute("DROP TYPE IF EXISTS modulestatus")

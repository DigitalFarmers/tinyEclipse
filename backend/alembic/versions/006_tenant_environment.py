"""Add environment column to tenants table (production/staging)

Revision ID: 006
Revises: 005
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum type
    op.execute("CREATE TYPE tenantenvironment AS ENUM ('production', 'staging')")

    # Add column with default
    op.add_column("tenants", sa.Column(
        "environment",
        sa.Enum("production", "staging", name="tenantenvironment", create_type=False),
        nullable=False,
        server_default="production",
    ))


def downgrade() -> None:
    op.drop_column("tenants", "environment")
    op.execute("DROP TYPE IF EXISTS tenantenvironment")

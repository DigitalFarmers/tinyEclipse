"""Add password_hash column to client_accounts for portal email+password login

Revision ID: 007
Revises: 006
Create Date: 2026-02-19
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("client_accounts", sa.Column(
        "password_hash",
        sa.String(255),
        nullable=True,
    ))


def downgrade() -> None:
    op.drop_column("client_accounts", "password_hash")

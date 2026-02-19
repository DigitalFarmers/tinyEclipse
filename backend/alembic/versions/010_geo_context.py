"""Add geo_context and calibration_score to tenants.

Revision ID: 010
Revises: 009
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("geo_context", JSONB, nullable=True))
    op.add_column("tenants", sa.Column("calibration_score", sa.Float, nullable=True, server_default="0"))
    op.add_column("tenants", sa.Column("last_calibrated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "last_calibrated_at")
    op.drop_column("tenants", "calibration_score")
    op.drop_column("tenants", "geo_context")

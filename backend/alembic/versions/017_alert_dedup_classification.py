"""Add alert deduplication and AI classification columns

Revision ID: 017
Revises: 016
Create Date: 2026-02-24 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '017'
down_revision: Union[str, None] = '016'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL for idempotent column adds (some may already exist from migration 015)
    cols = [
        ("dedup_key", "VARCHAR(64)"),
        ("occurrence_count", "INTEGER NOT NULL DEFAULT 1"),
        ("last_seen_at", "TIMESTAMPTZ"),
        ("classification", "VARCHAR(20)"),
        ("priority_score", "INTEGER"),
        ("auto_fix_status", "VARCHAR(20)"),
        ("resolved_by", "VARCHAR(50)"),
    ]
    for col_name, col_type in cols:
        op.execute(f"ALTER TABLE alerts ADD COLUMN IF NOT EXISTS {col_name} {col_type}")

    # Index for dedup lookups
    op.execute("CREATE INDEX IF NOT EXISTS ix_alerts_dedup_key ON alerts (dedup_key)")


def downgrade() -> None:
    op.drop_index('ix_alerts_dedup_key', table_name='alerts')
    op.drop_column('alerts', 'resolved_by')
    op.drop_column('alerts', 'auto_fix_status')
    op.drop_column('alerts', 'priority_score')
    op.drop_column('alerts', 'classification')
    op.drop_column('alerts', 'last_seen_at')
    op.drop_column('alerts', 'occurrence_count')
    op.drop_column('alerts', 'dedup_key')

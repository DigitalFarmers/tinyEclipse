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
    # Deduplication columns
    op.add_column('alerts', sa.Column('dedup_key', sa.String(64), nullable=True))
    op.add_column('alerts', sa.Column('occurrence_count', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('alerts', sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=True))

    # AI Classification columns
    op.add_column('alerts', sa.Column('classification', sa.String(20), nullable=True))
    op.add_column('alerts', sa.Column('priority_score', sa.Integer(), nullable=True))
    op.add_column('alerts', sa.Column('auto_fix_status', sa.String(20), nullable=True))
    op.add_column('alerts', sa.Column('resolved_by', sa.String(50), nullable=True))

    # Index for dedup lookups
    op.create_index('ix_alerts_dedup_key', 'alerts', ['dedup_key'])


def downgrade() -> None:
    op.drop_index('ix_alerts_dedup_key', table_name='alerts')
    op.drop_column('alerts', 'resolved_by')
    op.drop_column('alerts', 'auto_fix_status')
    op.drop_column('alerts', 'priority_score')
    op.drop_column('alerts', 'classification')
    op.drop_column('alerts', 'last_seen_at')
    op.drop_column('alerts', 'occurrence_count')
    op.drop_column('alerts', 'dedup_key')

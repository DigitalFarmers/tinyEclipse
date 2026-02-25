"""Add command queue, feature flags, and sync tracking tables

Revision ID: 014
Revises: 013
Create Date: 2026-02-22 17:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '014'
down_revision: Union[str, None] = '013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create command_queue table
    op.create_table('command_queue',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('command_type', sa.String(length=50), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('priority', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Index('ix_command_queue_tenant_status', 'tenant_id', 'status'),
        sa.Index('ix_command_queue_priority_status', 'priority', 'status'),
        sa.Index('ix_command_queue_scheduled_at', 'scheduled_at'),
    )

    # Create feature_flags table
    op.create_table('feature_flags',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('min_plugin_version', sa.String(length=20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )

    # Create sync_tracking table
    op.create_table('sync_tracking',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_id', sa.String(length=100), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('direction', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Index('ix_sync_tracking_entity', 'entity_type', 'entity_id'),
        sa.Index('ix_sync_tracking_source_direction', 'source', 'direction'),
        sa.Index('ix_sync_tracking_synced_at', 'synced_at'),
    )

    # Insert default feature flags
    op.execute("""
        INSERT INTO feature_flags (name, enabled, min_plugin_version, description) VALUES
        ('proactive_commands', true, '5.0.0', 'Enable proactive command pushing from Hub to sites'),
        ('bulk_operations', true, '5.0.0', 'Enable bulk operations for multiple sites'),
        ('feature_flags', true, '5.0.0', 'Enable feature flag system'),
        ('sync_tracking', true, '5.0.0', 'Enable sync tracking and monitoring'),
        ('whmcs_webhooks', true, '5.0.0', 'Enable WHMCS webhook integration'),
        ('version_negotiation', true, '5.0.0', 'Enable version capability negotiation'),
        ('graceful_degradation', true, '5.0.0', 'Enable graceful degradation for old versions')
    """)


def downgrade() -> None:
    op.drop_table('sync_tracking')
    op.drop_table('feature_flags')
    op.drop_table('command_queue')

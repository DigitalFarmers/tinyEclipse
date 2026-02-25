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
    op.execute("""
    CREATE TABLE IF NOT EXISTS command_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        command_type VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        priority INTEGER NOT NULL DEFAULT 5,
        retry_count INTEGER NOT NULL DEFAULT 0,
        scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        executed_at TIMESTAMPTZ,
        result JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_command_queue_tenant_status ON command_queue (tenant_id, status);
    CREATE INDEX IF NOT EXISTS ix_command_queue_priority_status ON command_queue (priority, status);
    CREATE INDEX IF NOT EXISTS ix_command_queue_scheduled_at ON command_queue (scheduled_at);

    CREATE TABLE IF NOT EXISTS feature_flags (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        enabled BOOLEAN NOT NULL DEFAULT false,
        min_plugin_version VARCHAR(20),
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS sync_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        source VARCHAR(50) NOT NULL,
        direction VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL,
        data JSONB,
        error_message TEXT,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_sync_tracking_entity ON sync_tracking (entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS ix_sync_tracking_source_direction ON sync_tracking (source, direction);
    CREATE INDEX IF NOT EXISTS ix_sync_tracking_synced_at ON sync_tracking (synced_at);

    INSERT INTO feature_flags (name, enabled, min_plugin_version, description)
    SELECT * FROM (VALUES
        ('proactive_commands', true, '5.0.0', 'Enable proactive command pushing from Hub to sites'),
        ('bulk_operations', true, '5.0.0', 'Enable bulk operations for multiple sites'),
        ('feature_flags', true, '5.0.0', 'Enable feature flag system'),
        ('sync_tracking', true, '5.0.0', 'Enable sync tracking and monitoring'),
        ('whmcs_webhooks', true, '5.0.0', 'Enable WHMCS webhook integration'),
        ('version_negotiation', true, '5.0.0', 'Enable version capability negotiation'),
        ('graceful_degradation', true, '5.0.0', 'Enable graceful degradation for old versions')
    ) AS v(name, enabled, min_plugin_version, description)
    WHERE NOT EXISTS (SELECT 1 FROM feature_flags LIMIT 1);
    """)


def downgrade() -> None:
    op.drop_table('sync_tracking')
    op.drop_table('feature_flags')
    op.drop_table('command_queue')

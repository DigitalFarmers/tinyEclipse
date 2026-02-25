"""Add cross-site sync tables (sync_groups, sync_members, sync_logs)

Revision ID: 018
Revises: 017
Create Date: 2026-02-24 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '018'
down_revision: Union[str, None] = '017'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE IF NOT EXISTS sync_groups (
        id UUID PRIMARY KEY,
        client_account_id UUID NOT NULL REFERENCES client_accounts(id),
        entity_type VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        direction VARCHAR(20) NOT NULL DEFAULT 'bidirectional',
        master_tenant_id UUID REFERENCES tenants(id),
        enabled BOOLEAN NOT NULL DEFAULT true,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS ix_sync_groups_client ON sync_groups (client_account_id);

    CREATE TABLE IF NOT EXISTS sync_members (
        id UUID PRIMARY KEY,
        group_id UUID NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        remote_id VARCHAR(100) NOT NULL,
        sku VARCHAR(100),
        title VARCHAR(500),
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        last_synced_at TIMESTAMPTZ,
        local_data JSONB NOT NULL DEFAULT '{}',
        overrides JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_sync_members_group ON sync_members (group_id);
    CREATE INDEX IF NOT EXISTS ix_sync_members_tenant ON sync_members (tenant_id);
    CREATE INDEX IF NOT EXISTS ix_sync_members_sku ON sync_members (sku);

    CREATE TABLE IF NOT EXISTS sync_logs (
        id UUID PRIMARY KEY,
        group_id UUID NOT NULL REFERENCES sync_groups(id) ON DELETE CASCADE,
        source_tenant_id UUID NOT NULL REFERENCES tenants(id),
        target_tenant_id UUID NOT NULL REFERENCES tenants(id),
        entity_type VARCHAR(20) NOT NULL,
        action VARCHAR(50) NOT NULL,
        changes JSONB NOT NULL DEFAULT '{}',
        status VARCHAR(20) NOT NULL,
        error TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_sync_logs_group ON sync_logs (group_id);
    """)


def downgrade() -> None:
    op.drop_table('sync_logs')
    op.drop_table('sync_members')
    op.drop_table('sync_groups')

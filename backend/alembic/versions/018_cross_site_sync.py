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
    op.create_table('sync_groups',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('client_account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('client_accounts.id'), nullable=False, index=True),
        sa.Column('entity_type', sa.String(20), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('direction', sa.String(20), nullable=False, server_default='bidirectional'),
        sa.Column('master_tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=True),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('config', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table('sync_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sync_groups.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('remote_id', sa.String(100), nullable=False),
        sa.Column('sku', sa.String(100), nullable=True, index=True),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('local_data', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('overrides', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table('sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('group_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sync_groups.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('source_tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('target_tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('entity_type', sa.String(20), nullable=False),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('changes', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('sync_logs')
    op.drop_table('sync_members')
    op.drop_table('sync_groups')

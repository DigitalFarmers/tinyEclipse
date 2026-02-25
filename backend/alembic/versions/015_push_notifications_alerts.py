"""Add push notifications and alerts system

Revision ID: 015
Revises: 014
Create Date: 2026-02-22 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '015'
down_revision: Union[str, None] = '014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create push_subscriptions table
    op.create_table('push_subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('endpoint', sa.String(length=500), nullable=False),
        sa.Column('p256dh_key', sa.String(length=255), nullable=False),
        sa.Column('auth_key', sa.String(length=255), nullable=False),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)
    op.create_index(op.f('ix_push_subscriptions_tenant_id'), 'push_subscriptions', ['tenant_id'], unique=False)

    # Create push_notifications table
    op.create_table('push_notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('subscription_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['subscription_id'], ['push_subscriptions.id'], ),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_push_notifications_tenant_id'), 'push_notifications', ['tenant_id'], unique=False)

    # Create vapid_keys table
    op.create_table('vapid_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('public_key', sa.String(length=255), nullable=False, unique=True),
        sa.Column('private_key', sa.String(length=255), nullable=False, unique=True),
        sa.Column('subject', sa.String(length=255), nullable=False, default='mailto:admin@tinyeclipse.digitalfarmers.be'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vapid_keys_tenant_id'), 'vapid_keys', ['tenant_id'], unique=False)

    # Create alert_rules table
    op.create_table('alert_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('alert_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False, default='medium'),
        sa.Column('conditions', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('threshold_value', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('threshold_operator', sa.String(length=10), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, default=True),
        sa.Column('notify_push', sa.Boolean(), nullable=False, default=True),
        sa.Column('notify_email', sa.Boolean(), nullable=False, default=False),
        sa.Column('notify_webhook', sa.Boolean(), nullable=False, default=False),
        sa.Column('webhook_url', sa.String(length=500), nullable=True),
        sa.Column('cooldown_minutes', sa.Integer(), nullable=False, default=60),
        sa.Column('auto_resolve_minutes', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alert_rules_tenant_id'), 'alert_rules', ['tenant_id'], unique=False)

    # Create alerts table
    op.create_table('alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.Column('rule_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['rule_id'], ['alert_rules.id'], ),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('alert_type', sa.String(length=50), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, default='active'),
        sa.Column('source_id', sa.String(length=100), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('context', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('triggered_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledged_by', sa.String(length=200), nullable=True),
        sa.Column('resolved_by', sa.String(length=200), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_alerts_tenant_id'), 'alerts', ['tenant_id'], unique=False)

    # Create alert_notifications table
    op.create_table('alert_notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('alert_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['alert_id'], ['alerts.id'], ),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('recipient', sa.String(length=200), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('alert_notifications')
    op.drop_table('alerts')
    op.drop_table('alert_rules')
    op.drop_table('vapid_keys')
    op.drop_table('push_notifications')
    op.drop_table('push_subscriptions')

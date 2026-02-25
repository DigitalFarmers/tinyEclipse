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
    # All IF NOT EXISTS — alerts table already exists from migration 002
    op.execute("""
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        tenant_id UUID REFERENCES tenants(id),
        endpoint VARCHAR(500) NOT NULL,
        p256dh_key VARCHAR(255) NOT NULL,
        auth_key VARCHAR(255) NOT NULL,
        user_agent VARCHAR(500),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_used TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id ON push_subscriptions (user_id);
    CREATE INDEX IF NOT EXISTS ix_push_subscriptions_tenant_id ON push_subscriptions (tenant_id);

    CREATE TABLE IF NOT EXISTS push_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        subscription_id UUID REFERENCES push_subscriptions(id),
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_push_notifications_tenant_id ON push_notifications (tenant_id);

    CREATE TABLE IF NOT EXISTS vapid_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id),
        public_key VARCHAR(255) NOT NULL UNIQUE,
        private_key VARCHAR(255) NOT NULL UNIQUE,
        subject VARCHAR(255) NOT NULL DEFAULT 'mailto:admin@tinyeclipse.digitalfarmers.be',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_vapid_keys_tenant_id ON vapid_keys (tenant_id);

    CREATE TABLE IF NOT EXISTS alert_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        name VARCHAR(200) NOT NULL,
        description TEXT,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        conditions JSONB NOT NULL,
        threshold_value NUMERIC(10,2),
        threshold_operator VARCHAR(10),
        is_enabled BOOLEAN NOT NULL DEFAULT true,
        notify_push BOOLEAN NOT NULL DEFAULT true,
        notify_email BOOLEAN NOT NULL DEFAULT false,
        notify_webhook BOOLEAN NOT NULL DEFAULT false,
        webhook_url VARCHAR(500),
        cooldown_minutes INTEGER NOT NULL DEFAULT 60,
        auto_resolve_minutes INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_alert_rules_tenant_id ON alert_rules (tenant_id);

    -- alerts table already exists from migration 002 (monitoring).
    -- Add missing columns that the proactive alert system needs.
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES alert_rules(id);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS title VARCHAR(200);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS alert_type VARCHAR(50);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_id VARCHAR(100);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS context JSONB DEFAULT '{}';
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ DEFAULT now();
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(200);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(200);
    ALTER TABLE alerts ADD COLUMN IF NOT EXISTS resolution_note TEXT;

    CREATE TABLE IF NOT EXISTS alert_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_id UUID NOT NULL REFERENCES alerts(id),
        channel VARCHAR(20) NOT NULL,
        recipient VARCHAR(200) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        sent_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """)


def downgrade() -> None:
    op.drop_table('alert_notifications')
    op.drop_table('alert_rules')
    op.drop_table('vapid_keys')
    op.drop_table('push_notifications')
    op.drop_table('push_subscriptions')

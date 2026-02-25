"""System events — technical event bus

Revision ID: 020
Revises: 019
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS system_events (
        id UUID PRIMARY KEY,
        tenant_id UUID,
        domain VARCHAR(20) NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'info',
        action VARCHAR(100) NOT NULL,
        title VARCHAR(500) NOT NULL,
        detail TEXT,
        data JSONB NOT NULL DEFAULT '{}',
        source VARCHAR(100),
        ip VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_system_events_tenant ON system_events (tenant_id);
    CREATE INDEX IF NOT EXISTS ix_system_events_domain ON system_events (domain);
    CREATE INDEX IF NOT EXISTS ix_system_events_severity ON system_events (severity);
    CREATE INDEX IF NOT EXISTS ix_system_events_action ON system_events (action);
    CREATE INDEX IF NOT EXISTS ix_system_events_created ON system_events (created_at);
    CREATE INDEX IF NOT EXISTS ix_system_events_domain_created ON system_events (domain, created_at);
    CREATE INDEX IF NOT EXISTS ix_system_events_tenant_created ON system_events (tenant_id, created_at);
    """)


def downgrade():
    op.drop_table("system_events")

"""AI Brain — knowledge gaps + visitor profiles

Revision ID: 019
Revises: 018
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS knowledge_gaps (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        question TEXT NOT NULL,
        category VARCHAR(30) NOT NULL DEFAULT 'other',
        status VARCHAR(20) NOT NULL DEFAULT 'open',
        frequency INTEGER NOT NULL DEFAULT 1,
        last_asked_at TIMESTAMPTZ DEFAULT now(),
        avg_confidence FLOAT NOT NULL DEFAULT 0,
        sample_conversation_id UUID,
        escalated BOOLEAN NOT NULL DEFAULT false,
        resolved_by VARCHAR(100),
        resolved_answer TEXT,
        source_id UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_knowledge_gaps_tenant ON knowledge_gaps (tenant_id);

    CREATE TABLE IF NOT EXISTS visitor_profiles (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        visitor_id VARCHAR(64) NOT NULL,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        contact_id UUID,
        country VARCHAR(2),
        city VARCHAR(100),
        language VARCHAR(10),
        device_type VARCHAR(20),
        browser VARCHAR(50),
        total_sessions INTEGER NOT NULL DEFAULT 0,
        total_pageviews INTEGER NOT NULL DEFAULT 0,
        total_conversations INTEGER NOT NULL DEFAULT 0,
        total_events INTEGER NOT NULL DEFAULT 0,
        total_time_seconds INTEGER NOT NULL DEFAULT 0,
        engagement_score FLOAT NOT NULL DEFAULT 0,
        intent_score FLOAT NOT NULL DEFAULT 0,
        loyalty_score FLOAT NOT NULL DEFAULT 0,
        journey JSONB NOT NULL DEFAULT '{}',
        first_seen_at TIMESTAMPTZ DEFAULT now(),
        last_seen_at TIMESTAMPTZ DEFAULT now(),
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        CONSTRAINT uq_visitor_profile_tenant_visitor UNIQUE (tenant_id, visitor_id)
    );
    CREATE INDEX IF NOT EXISTS ix_visitor_profiles_tenant ON visitor_profiles (tenant_id);
    CREATE INDEX IF NOT EXISTS ix_visitor_profiles_visitor ON visitor_profiles (visitor_id);
    CREATE INDEX IF NOT EXISTS ix_visitor_profiles_email ON visitor_profiles (email);
    CREATE INDEX IF NOT EXISTS ix_visitor_profiles_contact ON visitor_profiles (contact_id);
    """)


def downgrade():
    op.drop_table("visitor_profiles")
    op.drop_table("knowledge_gaps")

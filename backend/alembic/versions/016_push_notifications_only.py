"""Add push notifications system (alerts table already exists)

Revision ID: 016
Revises: 015
Create Date: 2026-02-22 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '016'
down_revision: Union[str, None] = '015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op: all tables already created in migration 015
    pass


def downgrade() -> None:
    # No-op: tables dropped in migration 015 downgrade
    pass

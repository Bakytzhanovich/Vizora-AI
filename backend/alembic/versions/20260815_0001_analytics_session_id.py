"""add session_id to analytics_events

Revision ID: 20260815_0001
Revises: 20260810_0001
Create Date: 2026-08-15 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260815_0001"
down_revision = "20260810_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("analytics_events", sa.Column("session_id", sa.String(), nullable=True))
    op.create_index("ix_analytics_events_session_id", "analytics_events", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_analytics_events_session_id", table_name="analytics_events")
    op.drop_column("analytics_events", "session_id")

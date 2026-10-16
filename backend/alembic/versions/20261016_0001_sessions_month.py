"""month the simulator session counter belongs to

Revision ID: 20261016_0001
Revises: 20261015_0001
Create Date: 2026-10-16 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261016_0001"
down_revision = "20261015_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sessions_month", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "sessions_month")

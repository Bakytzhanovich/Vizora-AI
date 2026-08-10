"""add security_logs table

Revision ID: 20260810_0001
Revises: 20260728_0003
Create Date: 2026-08-10 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260810_0001"
down_revision = "20260728_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "security_logs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_security_logs_event_type", "security_logs", ["event_type"])
    op.create_index("ix_security_logs_user_id", "security_logs", ["user_id"])
    op.create_index("ix_security_logs_created_at", "security_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_security_logs_created_at", table_name="security_logs")
    op.drop_index("ix_security_logs_user_id", table_name="security_logs")
    op.drop_index("ix_security_logs_event_type", table_name="security_logs")
    op.drop_table("security_logs")

"""manual Kaspi invoice payment requests

Revision ID: 20261015_0001
Revises: 20261003_0002
Create Date: 2026-10-15 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261015_0001"
down_revision = "20261003_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "payment_requests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("plan", sa.String(length=30), nullable=False),
        sa.Column("billing_period", sa.String(length=10), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.Column("resolved_by", sa.String(length=36), sa.ForeignKey("users.id"), nullable=True),
    )
    op.create_index("ix_payment_requests_user_id", "payment_requests", ["user_id"])
    op.create_index("ix_payment_requests_status", "payment_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_payment_requests_status", table_name="payment_requests")
    op.drop_index("ix_payment_requests_user_id", table_name="payment_requests")
    op.drop_table("payment_requests")

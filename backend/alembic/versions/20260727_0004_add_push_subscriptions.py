"""add push_subscriptions table

Revision ID: 20260727_0004
Revises: 20260727_0003
Create Date: 2026-07-27 06:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260727_0004"
down_revision = "20260727_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "push_subscriptions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("endpoint", sa.Text(), nullable=False),
        sa.Column("p256dh", sa.String(length=255), nullable=False),
        sa.Column("auth", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_push_subscriptions_user_id", "push_subscriptions", ["user_id"])
    op.create_unique_constraint("uq_push_subscriptions_endpoint", "push_subscriptions", ["endpoint"])


def downgrade() -> None:
    op.drop_constraint("uq_push_subscriptions_endpoint", "push_subscriptions", type_="unique")
    op.drop_index("ix_push_subscriptions_user_id", table_name="push_subscriptions")
    op.drop_table("push_subscriptions")

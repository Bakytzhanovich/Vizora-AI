"""add first-touch signup attribution columns to users

Revision ID: 20260919_0001
Revises: 20260914_0001
Create Date: 2026-09-19 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260919_0001"
down_revision = "20260914_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable with no server_default: existing users predate attribution and
    # must stay distinguishable from someone who genuinely arrived direct.
    op.add_column("users", sa.Column("signup_source", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("signup_medium", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("signup_campaign", sa.String(length=128), nullable=True))
    op.create_index("ix_users_signup_source", "users", ["signup_source"])


def downgrade() -> None:
    op.drop_index("ix_users_signup_source", table_name="users")
    op.drop_column("users", "signup_campaign")
    op.drop_column("users", "signup_medium")
    op.drop_column("users", "signup_source")

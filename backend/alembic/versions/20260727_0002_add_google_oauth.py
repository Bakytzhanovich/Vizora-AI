"""add google oauth fields to users

Revision ID: 20260727_0002
Revises: 20260714_0001
Create Date: 2026-07-27 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260727_0002"
down_revision = "20260714_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=True)
    op.add_column("users", sa.Column("oauth_provider", sa.String(length=20), nullable=True))
    op.add_column("users", sa.Column("oauth_id", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.create_unique_constraint(
        "uq_users_oauth_provider_id", "users", ["oauth_provider", "oauth_id"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_users_oauth_provider_id", "users", type_="unique")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "oauth_id")
    op.drop_column("users", "oauth_provider")
    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)

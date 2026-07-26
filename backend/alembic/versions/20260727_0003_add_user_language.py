"""add language preference to users

Revision ID: 20260727_0003
Revises: 20260727_0002
Create Date: 2026-07-27 01:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260727_0003"
down_revision = "20260727_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("language", sa.String(length=5), nullable=False, server_default="ru"),
    )
    op.alter_column("users", "language", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "language")

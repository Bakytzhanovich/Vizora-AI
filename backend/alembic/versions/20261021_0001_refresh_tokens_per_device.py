"""keep a refresh token per device

Revision ID: 20261021_0001
Revises: 20261018_0003
Create Date: 2026-10-21 00:00:00
"""

import sqlalchemy as sa
from alembic import op


revision = "20261021_0001"
down_revision = "20261018_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Space-separated hashes, one per signed-in device (routers/auth.py).
    with op.batch_alter_table("users") as batch:
        batch.alter_column("refresh_token_hash", type_=sa.Text(), existing_type=sa.String(255), existing_nullable=True)


def downgrade() -> None:
    # Keep only the newest device's hash so it fits the old column.
    op.execute("UPDATE users SET refresh_token_hash = substr(refresh_token_hash, 1, 64)")
    with op.batch_alter_table("users") as batch:
        batch.alter_column("refresh_token_hash", type_=sa.String(255), existing_type=sa.Text(), existing_nullable=True)

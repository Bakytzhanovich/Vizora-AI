"""add country_code and visa_type to knowledge_base

Revision ID: 20260914_0001
Revises: 20260815_0001
Create Date: 2026-09-14 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260914_0001"
down_revision = "20260815_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "knowledge_base",
        sa.Column("country_code", sa.String(length=10), nullable=False, server_default="USA"),
    )
    op.add_column(
        "knowledge_base",
        sa.Column("visa_type", sa.String(length=10), nullable=False, server_default="J1"),
    )


def downgrade() -> None:
    op.drop_column("knowledge_base", "visa_type")
    op.drop_column("knowledge_base", "country_code")

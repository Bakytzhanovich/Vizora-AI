"""add level_tests table

Revision ID: 20261002_0001
Revises: 20260919_0001
Create Date: 2026-10-02 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261002_0001"
down_revision = "20260919_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "level_tests",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("current_question", sa.Text(), nullable=False),
        sa.Column("current_level", sa.String(length=4), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("final_level", sa.String(length=4), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_level_tests_user_id", "level_tests", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_level_tests_user_id", table_name="level_tests")
    op.drop_table("level_tests")

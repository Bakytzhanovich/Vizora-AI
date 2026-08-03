"""add profession to student_profiles

Revision ID: 20260728_0001
Revises: 20260727_0005
Create Date: 2026-07-28 12:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260728_0001"
down_revision = "20260727_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "student_profiles",
        sa.Column("profession", sa.String(length=150), nullable=False, server_default="Студент"),
    )
    op.alter_column("student_profiles", "profession", server_default=None)


def downgrade() -> None:
    op.drop_column("student_profiles", "profession")

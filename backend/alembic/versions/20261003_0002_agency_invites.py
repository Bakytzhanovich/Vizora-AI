"""agencies invite existing students instead of linking them directly

Revision ID: 20261003_0002
Revises: 20261003_0001
Create Date: 2026-10-03 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261003_0002"
down_revision = "20261003_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agency_invites",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("agency_id", sa.String(length=36), sa.ForeignKey("agencies.id"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("assigned_manager_id", sa.String(length=36), sa.ForeignKey("agency_members.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("agency_id", "user_id", name="uq_agency_invites_agency_user"),
    )
    op.create_index("ix_agency_invites_agency_id", "agency_invites", ["agency_id"])
    op.create_index("ix_agency_invites_user_id", "agency_invites", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_agency_invites_user_id", table_name="agency_invites")
    op.drop_index("ix_agency_invites_agency_id", table_name="agency_invites")
    op.drop_table("agency_invites")

"""student feedback and session ratings

Revision ID: 20261018_0002
Revises: 20261018_0001
Create Date: 2026-10-18 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261018_0002"
down_revision = "20261018_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "feedback",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("page", sa.String(length=200), nullable=True),
        sa.Column(
            "session_id", sa.String(length=36), sa.ForeignKey("simulator_sessions.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "session_id", name="uq_feedback_user_session"),
    )
    op.create_index("ix_feedback_user_id", "feedback", ["user_id"])
    op.create_index("ix_feedback_kind", "feedback", ["kind"])


def downgrade() -> None:
    op.drop_index("ix_feedback_kind", table_name="feedback")
    op.drop_index("ix_feedback_user_id", table_name="feedback")
    op.drop_table("feedback")

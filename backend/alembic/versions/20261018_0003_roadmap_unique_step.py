"""one roadmap_progress row per user and step

Revision ID: 20261018_0003
Revises: 20261018_0002
Create Date: 2026-10-18 00:00:00
"""

from alembic import op


revision = "20261018_0003"
down_revision = "20261018_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Double taps could insert the same step twice; keep the newest row.
    op.execute(
        """
        DELETE FROM roadmap_progress
        WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (
                    PARTITION BY user_id, step_id ORDER BY created_at DESC, id DESC
                ) AS rn
                FROM roadmap_progress
            ) ranked
            WHERE rn > 1
        )
        """
    )
    with op.batch_alter_table("roadmap_progress") as batch:
        batch.create_unique_constraint("uq_roadmap_progress_user_step", ["user_id", "step_id"])


def downgrade() -> None:
    with op.batch_alter_table("roadmap_progress") as batch:
        batch.drop_constraint("uq_roadmap_progress_user_step", type_="unique")

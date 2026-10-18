"""job offer resale board

Revision ID: 20261018_0001
Revises: 20261016_0001
Create Date: 2026-10-18 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20261018_0001"
down_revision = "20261016_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "job_offers",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("employer", sa.String(length=120), nullable=False),
        sa.Column("position", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=40), nullable=False),
        sa.Column("city", sa.String(length=80), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("hourly_wage", sa.Numeric(6, 2), nullable=False),
        sa.Column("hours_per_week", sa.Integer(), nullable=False),
        sa.Column("housing", sa.String(length=200), nullable=True),
        sa.Column("sponsor", sa.String(length=120), nullable=False),
        sa.Column("agency", sa.String(length=120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_kzt", sa.Integer(), nullable=False),
        sa.Column("contact", sa.String(length=100), nullable=False),
        sa.Column("proof", sa.LargeBinary(), nullable=False),
        sa.Column("proof_type", sa.String(length=50), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("listing_fee", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("reject_reason", sa.String(length=300), nullable=True),
        sa.Column("reports_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_job_offers_user_id", "job_offers", ["user_id"])
    op.create_index("ix_job_offers_status", "job_offers", ["status"])
    op.create_table(
        "job_offer_reports",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("offer_id", sa.String(length=36), sa.ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.String(length=300), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("offer_id", "user_id", name="uq_job_offer_reports_offer_user"),
    )
    op.create_index("ix_job_offer_reports_offer_id", "job_offer_reports", ["offer_id"])


def downgrade() -> None:
    op.drop_index("ix_job_offer_reports_offer_id", table_name="job_offer_reports")
    op.drop_table("job_offer_reports")
    op.drop_index("ix_job_offers_status", table_name="job_offers")
    op.drop_index("ix_job_offers_user_id", table_name="job_offers")
    op.drop_table("job_offers")

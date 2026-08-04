"""add billing fields to agencies + agency support on subscription_events

Revision ID: 20260728_0003
Revises: 20260728_0002
Create Date: 2026-08-04 09:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260728_0003"
down_revision = "20260728_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("agencies", sa.Column("subscription_billing_period", sa.String(length=10), nullable=True))
    op.add_column("agencies", sa.Column("subscription_period_end", sa.DateTime(), nullable=True))
    op.add_column("agencies", sa.Column("kaspi_last_payment_id", sa.String(length=64), nullable=True))

    # "trial" is gone as a concept — an agency with no paid plan is simply
    # NULL and falls back to the 30-day free-period-since-signup display.
    op.alter_column("agencies", "subscription_plan", nullable=True, server_default=None)
    op.execute("UPDATE agencies SET subscription_plan = NULL WHERE subscription_plan = 'trial'")

    op.create_check_constraint(
        "ck_agencies_subscription_plan",
        "agencies",
        "subscription_plan IS NULL OR subscription_plan IN "
        "('agency_starter', 'agency_business', 'agency_partner')",
    )
    op.create_check_constraint(
        "ck_agencies_subscription_billing_period",
        "agencies",
        "subscription_billing_period IS NULL OR subscription_billing_period IN ('monthly', 'yearly')",
    )

    # subscription_events becomes shared between student (user_id) and
    # agency (agency_id) checkouts — exactly one of the two must be set.
    op.alter_column("subscription_events", "user_id", nullable=True)
    op.add_column("subscription_events", sa.Column("agency_id", sa.String(length=36), nullable=True))
    op.create_foreign_key(
        "fk_subscription_events_agency_id", "subscription_events", "agencies", ["agency_id"], ["id"]
    )
    op.create_index("ix_subscription_events_agency_id", "subscription_events", ["agency_id"])
    op.create_check_constraint(
        "ck_subscription_events_payer",
        "subscription_events",
        "(user_id IS NOT NULL AND agency_id IS NULL) OR (user_id IS NULL AND agency_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_subscription_events_payer", "subscription_events", type_="check")
    op.drop_index("ix_subscription_events_agency_id", table_name="subscription_events")
    op.drop_constraint("fk_subscription_events_agency_id", "subscription_events", type_="foreignkey")
    op.execute("DELETE FROM subscription_events WHERE agency_id IS NOT NULL")
    op.drop_column("subscription_events", "agency_id")
    op.alter_column("subscription_events", "user_id", nullable=False)

    op.drop_constraint("ck_agencies_subscription_billing_period", "agencies", type_="check")
    op.drop_constraint("ck_agencies_subscription_plan", "agencies", type_="check")
    op.execute("UPDATE agencies SET subscription_plan = 'trial' WHERE subscription_plan IS NULL")
    op.alter_column("agencies", "subscription_plan", nullable=False, server_default="trial")

    op.drop_column("agencies", "kaspi_last_payment_id")
    op.drop_column("agencies", "subscription_period_end")
    op.drop_column("agencies", "subscription_billing_period")

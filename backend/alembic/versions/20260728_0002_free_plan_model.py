"""replace trial system with permanent free plan

Revision ID: 20260728_0002
Revises: 20260728_0001
Create Date: 2026-08-03 10:00:00
"""

from alembic import op


revision = "20260728_0002"
down_revision = "20260728_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # subscription_plan used to allow "basic" as the cheapest paid tier —
    # the new model replaces it with a permanent "free" plan instead.
    op.drop_constraint("ck_users_subscription_plan", "users", type_="check")
    op.create_check_constraint(
        "ck_users_subscription_plan",
        "users",
        "subscription_plan IS NULL OR subscription_plan IN "
        "('free', 'standard', 'premium', 'agency_starter', 'agency_business', 'agency_partner')",
    )

    # Anyone still on the old trial/expired/basic model moves to permanent free.
    op.execute("UPDATE users SET subscription_plan = 'free' WHERE subscription_plan IS NULL OR subscription_plan = 'basic'")
    op.execute("UPDATE users SET subscription_status = 'active' WHERE subscription_status IN ('trial', 'expired')")


def downgrade() -> None:
    op.drop_constraint("ck_users_subscription_plan", "users", type_="check")
    op.create_check_constraint(
        "ck_users_subscription_plan",
        "users",
        "subscription_plan IS NULL OR subscription_plan IN "
        "('basic', 'standard', 'premium', 'agency_starter', 'agency_business', 'agency_partner')",
    )
    op.execute("UPDATE users SET subscription_plan = 'basic' WHERE subscription_plan = 'free'")

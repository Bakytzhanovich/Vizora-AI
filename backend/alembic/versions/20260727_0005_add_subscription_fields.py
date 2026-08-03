"""add trial/subscription fields to users + subscription_events table

Revision ID: 20260727_0005
Revises: 20260727_0004
Create Date: 2026-07-27 20:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260727_0005"
down_revision = "20260727_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("trial_started_at", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("trial_ends_at", sa.DateTime(), nullable=True))
    op.add_column(
        "users",
        sa.Column("subscription_status", sa.String(length=20), nullable=False, server_default="trial"),
    )
    op.add_column("users", sa.Column("subscription_plan", sa.String(length=30), nullable=True))
    op.add_column("users", sa.Column("subscription_billing_period", sa.String(length=10), nullable=True))
    op.add_column("users", sa.Column("subscription_period_end", sa.DateTime(), nullable=True))
    op.add_column("users", sa.Column("kaspi_last_payment_id", sa.String(length=64), nullable=True))
    op.add_column(
        "users",
        sa.Column("sessions_used_this_month", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "users",
        sa.Column("faq_used_today", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("faq_reset_date", sa.Date(), nullable=True))
    op.add_column(
        "users",
        sa.Column("trial_discount_shown", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Drop server defaults once existing rows are backfilled — new rows set these
    # explicitly at registration (see routers/auth.py), matching the pattern used
    # for `language` in 20260727_0003.
    op.alter_column("users", "subscription_status", server_default=None)
    op.alter_column("users", "sessions_used_this_month", server_default=None)
    op.alter_column("users", "faq_used_today", server_default=None)
    op.alter_column("users", "trial_discount_shown", server_default=None)

    op.create_check_constraint(
        "ck_users_subscription_status",
        "users",
        "subscription_status IN ('trial', 'expired', 'active', 'canceled', 'past_due')",
    )
    op.create_check_constraint(
        "ck_users_subscription_plan",
        "users",
        "subscription_plan IS NULL OR subscription_plan IN "
        "('basic', 'standard', 'premium', 'agency_starter', 'agency_business', 'agency_partner')",
    )
    op.create_check_constraint(
        "ck_users_subscription_billing_period",
        "users",
        "subscription_billing_period IS NULL OR subscription_billing_period IN ('monthly', 'yearly')",
    )

    # Existing users get a fresh 7-day trial starting now, so nobody is silently
    # locked out the moment this migration runs.
    op.execute(
        """
        UPDATE users SET
          trial_started_at = NOW(),
          trial_ends_at = NOW() + INTERVAL '7 days',
          subscription_status = 'trial'
        WHERE trial_started_at IS NULL
        """
    )

    op.create_table(
        "subscription_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("plan", sa.String(length=30), nullable=True),
        sa.Column("billing_period", sa.String(length=10), nullable=True),
        sa.Column("amount", sa.Numeric(10, 2), nullable=True),
        sa.Column("currency", sa.String(length=6), nullable=False, server_default="kzt"),
        sa.Column("kaspi_payment_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_subscription_events_user_id", "subscription_events", ["user_id"]
    )
    op.create_unique_constraint(
        "uq_subscription_events_kaspi_payment_id", "subscription_events", ["kaspi_payment_id"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_subscription_events_kaspi_payment_id", "subscription_events", type_="unique"
    )
    op.drop_index("ix_subscription_events_user_id", table_name="subscription_events")
    op.drop_table("subscription_events")

    op.drop_constraint("ck_users_subscription_billing_period", "users", type_="check")
    op.drop_constraint("ck_users_subscription_plan", "users", type_="check")
    op.drop_constraint("ck_users_subscription_status", "users", type_="check")

    op.drop_column("users", "trial_discount_shown")
    op.drop_column("users", "faq_reset_date")
    op.drop_column("users", "faq_used_today")
    op.drop_column("users", "sessions_used_this_month")
    op.drop_column("users", "kaspi_last_payment_id")
    op.drop_column("users", "subscription_period_end")
    op.drop_column("users", "subscription_billing_period")
    op.drop_column("users", "subscription_plan")
    op.drop_column("users", "subscription_status")
    op.drop_column("users", "trial_ends_at")
    op.drop_column("users", "trial_started_at")

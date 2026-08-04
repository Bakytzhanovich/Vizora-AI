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
    # Drop the constraint before touching data, not after — Postgres
    # validates a CHECK constraint against all existing rows the moment it's
    # (re)created, so updating rows to a value only the target constraint
    # allows, while either the old OR the new constraint is still active,
    # fails outright. Drop -> update -> recreate is the only ordering with no
    # window where the constraint disagrees with the data it's checking.
    #
    # IF EXISTS / guarded create: a prior failed deploy attempt left
    # production with this constraint already dropped (but never
    # recreated), so a plain drop_constraint() 404s with UndefinedObjectError
    # — this migration must be safe to (re-)run from any partial state.
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_subscription_plan")

    op.execute("UPDATE users SET subscription_plan = 'free' WHERE subscription_plan IS NULL OR subscription_plan = 'basic'")
    op.execute("UPDATE users SET subscription_status = 'active' WHERE subscription_status IN ('trial', 'expired')")

    # subscription_plan used to allow "basic" as the cheapest paid tier —
    # the new model replaces it with a permanent "free" plan instead.
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_subscription_plan') THEN
                ALTER TABLE users ADD CONSTRAINT ck_users_subscription_plan
                CHECK (subscription_plan IS NULL OR subscription_plan IN
                ('free', 'standard', 'premium', 'agency_starter', 'agency_business', 'agency_partner'));
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS ck_users_subscription_plan")

    op.execute("UPDATE users SET subscription_plan = 'basic' WHERE subscription_plan = 'free'")

    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_users_subscription_plan') THEN
                ALTER TABLE users ADD CONSTRAINT ck_users_subscription_plan
                CHECK (subscription_plan IS NULL OR subscription_plan IN
                ('basic', 'standard', 'premium', 'agency_starter', 'agency_business', 'agency_partner'));
            END IF;
        END $$;
        """
    )

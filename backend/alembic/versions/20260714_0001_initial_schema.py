"""initial schema

Revision ID: 20260714_0001
Revises:
Create Date: 2026-07-14 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260714_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=True),
        sa.Column("telegram_id", sa.String(length=20), nullable=True),
        sa.Column("telegram_username", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_telegram_id", "users", ["telegram_id"], unique=True)

    op.create_table(
        "agencies",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("country", sa.String(length=10), nullable=False),
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
        sa.Column("subscription_plan", sa.String(length=50), nullable=False),
        sa.Column("white_label_name", sa.String(length=200), nullable=True),
        sa.Column("white_label_logo_url", sa.String(length=500), nullable=True),
        sa.Column("white_label_primary_color", sa.String(length=20), nullable=True),
        sa.Column("white_label_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agencies_email", "agencies", ["email"], unique=True)

    op.create_table(
        "analytics_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("event", sa.String(), nullable=False),
        sa.Column("properties", sa.Text(), nullable=True),
        sa.Column("url", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_events_event", "analytics_events", ["event"], unique=False)
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"], unique=False)

    op.create_table(
        "early_access_emails",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_early_access_emails_email", "early_access_emails", ["email"], unique=True)

    op.create_table(
        "emergency_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("scenario_id", sa.String(length=50), nullable=False),
        sa.Column("answers", sa.Text(), nullable=True),
        sa.Column("action_plan", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_emergency_sessions_user_id", "emergency_sessions", ["user_id"], unique=False)

    op.create_table(
        "knowledge_base",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("trust_level", sa.String(length=80), nullable=False),
        sa.Column("source_url", sa.Text(), nullable=True),
        sa.Column("embedding", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_knowledge_base_category", "knowledge_base", ["category"], unique=False)

    op.create_table(
        "scraper_runs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("sources_scraped", sa.String(length=10), nullable=True),
        sa.Column("new_entries_added", sa.String(length=10), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "agency_members",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("agency_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("password_hash", sa.String(length=200), nullable=True),
        sa.Column("invite_token", sa.String(length=100), nullable=True),
        sa.Column("invite_token_expires", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("invited_at", sa.DateTime(), nullable=False),
        sa.Column("joined_at", sa.DateTime(), nullable=True),
        sa.Column("last_login", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agency_members_agency_id", "agency_members", ["agency_id"], unique=False)
    op.create_index("ix_agency_members_email", "agency_members", ["email"], unique=False)
    op.create_index("ix_agency_members_invite_token", "agency_members", ["invite_token"], unique=False)

    op.create_table(
        "after_visa_progress",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("module_id", sa.String(length=50), nullable=False),
        sa.Column("section_id", sa.String(length=100), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_after_visa_progress_user_id", "after_visa_progress", ["user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"], unique=False)
    op.create_index("ix_chat_messages_user_id", "chat_messages", ["user_id"], unique=False)

    op.create_table(
        "document_progress",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=50), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_document_progress_user_id", "document_progress", ["user_id"], unique=False)

    op.create_table(
        "roadmap_progress",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("step_id", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_roadmap_progress_user_id", "roadmap_progress", ["user_id"], unique=False)

    op.create_table(
        "simulator_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("mode", sa.String(length=20), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("feedback", sa.Text(), nullable=True),
        sa.Column("scores", sa.Text(), nullable=True),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_simulator_sessions_user_id", "simulator_sessions", ["user_id"], unique=False)

    op.create_table(
        "student_profiles",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("university", sa.String(length=200), nullable=False),
        sa.Column("course_year", sa.Integer(), nullable=False),
        sa.Column("interview_date", sa.Date(), nullable=True),
        sa.Column("english_level", sa.String(length=20), nullable=False),
        sa.Column("travel_history", sa.Boolean(), nullable=False),
        sa.Column("financial_source", sa.String(length=20), nullable=False),
        sa.Column("job_offer", sa.String(length=20), nullable=False),
        sa.Column("country", sa.String(length=10), nullable=False),
        sa.Column("via_agency", sa.Boolean(), nullable=False),
        sa.Column("risk_profile", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_student_profiles_user_id", "student_profiles", ["user_id"], unique=True)

    op.create_table(
        "agency_students",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("agency_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("assigned_manager_id", sa.String(length=36), nullable=True),
        sa.Column("added_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(["agency_id"], ["agencies.id"]),
        sa.ForeignKeyConstraint(["assigned_manager_id"], ["agency_members.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agency_students_agency_id", "agency_students", ["agency_id"], unique=False)

    op.create_table(
        "referral_codes",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_referral_codes_code", "referral_codes", ["code"], unique=True)
    op.create_index("ix_referral_codes_user_id", "referral_codes", ["user_id"], unique=True)

    op.create_table(
        "referrals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("referrer_id", sa.String(length=36), nullable=False),
        sa.Column("referred_id", sa.String(length=36), nullable=False),
        sa.Column("referral_code", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["referred_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["referrer_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("referred_id"),
    )
    op.create_index("ix_referrals_referrer_id", "referrals", ["referrer_id"], unique=False)

    op.create_table(
        "referral_rewards",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("reward_type", sa.String(length=50), nullable=False),
        sa.Column("reward_value", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("earned_at", sa.DateTime(), nullable=False),
        sa.Column("claimed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "reward_type", name="uq_user_reward_type"),
    )
    op.create_index("ix_referral_rewards_user_id", "referral_rewards", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("referral_rewards")
    op.drop_table("referrals")
    op.drop_table("referral_codes")
    op.drop_table("agency_students")
    op.drop_table("student_profiles")
    op.drop_table("simulator_sessions")
    op.drop_table("roadmap_progress")
    op.drop_table("document_progress")
    op.drop_table("chat_messages")
    op.drop_table("after_visa_progress")
    op.drop_table("agency_members")
    op.drop_table("scraper_runs")
    op.drop_table("knowledge_base")
    op.drop_table("emergency_sessions")
    op.drop_table("early_access_emails")
    op.drop_table("analytics_events")
    op.drop_table("agencies")
    op.drop_table("users")

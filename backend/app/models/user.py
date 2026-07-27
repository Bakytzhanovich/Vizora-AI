import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, Date, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_id", name="uq_users_oauth_provider_id"),
        CheckConstraint(
            "subscription_status IN ('trial', 'expired', 'active', 'canceled', 'past_due')",
            name="ck_users_subscription_status",
        ),
        CheckConstraint(
            "subscription_plan IS NULL OR subscription_plan IN "
            "('basic', 'standard', 'premium', 'agency_starter', 'agency_business', 'agency_partner')",
            name="ck_users_subscription_plan",
        ),
        CheckConstraint(
            "subscription_billing_period IS NULL OR subscription_billing_period IN ('monthly', 'yearly')",
            name="ck_users_subscription_billing_period",
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, default="student")
    refresh_token_hash = Column(String(255), nullable=True)
    telegram_id = Column(String(20), unique=True, nullable=True, index=True)
    telegram_username = Column(String(255), nullable=True)
    oauth_provider = Column(String(20), nullable=True)  # e.g. "google"; null for email/password users
    oauth_id = Column(String(255), nullable=True)  # provider's unique user ID
    avatar_url = Column(String(500), nullable=True)
    language = Column(String(5), nullable=False, default="ru")  # "ru" | "kz"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # ─── Monetization (trial + Kaspi Pay subscription) ────────────────────────
    trial_started_at = Column(DateTime, nullable=True)
    trial_ends_at = Column(DateTime, nullable=True)
    subscription_status = Column(String(20), nullable=False, default="trial")
    subscription_plan = Column(String(30), nullable=True)
    # Kaspi has no native recurring-subscription object (unlike Stripe) — we track
    # which billing period was purchased so renewal can compute the next amount/date.
    subscription_billing_period = Column(String(10), nullable=True)  # "monthly" | "yearly"
    subscription_period_end = Column(DateTime, nullable=True)
    # Anchor for webhook idempotency; Kaspi payments are per-invoice, not a
    # customer/subscription object, so there's no stripe_customer_id equivalent.
    kaspi_last_payment_id = Column(String(64), nullable=True)
    sessions_used_this_month = Column(Integer, nullable=False, default=0)
    faq_used_today = Column(Integer, nullable=False, default=0)
    faq_reset_date = Column(Date, nullable=True)
    trial_discount_shown = Column(Boolean, nullable=False, default=False)

    profile = relationship("StudentProfile", back_populates="user", uselist=False)

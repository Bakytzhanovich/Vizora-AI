import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class SubscriptionEvent(Base):
    """Audit log of payment/subscription lifecycle events, keyed by Kaspi's
    payment id for idempotency (mirrors Stripe's event-id dedup pattern).

    Shared between student (user_id) and agency (agency_id) checkouts —
    exactly one of the two is set per row.
    """

    __tablename__ = "subscription_events"
    __table_args__ = (
        CheckConstraint(
            "(user_id IS NOT NULL AND agency_id IS NULL) OR (user_id IS NULL AND agency_id IS NOT NULL)",
            name="ck_subscription_events_payer",
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    agency_id = Column(String(36), ForeignKey("agencies.id"), nullable=True, index=True)
    event_type = Column(String(40), nullable=False)
    plan = Column(String(30), nullable=True)
    # Recorded per-checkout (not on the user row) so two concurrent/abandoned
    # checkouts for different periods can't clobber each other's billing period
    # before either completes — see routers/payments.py::_apply_successful_payment.
    billing_period = Column(String(10), nullable=True)  # "monthly" | "yearly"
    amount = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(6), nullable=False, default="kzt")
    kaspi_payment_id = Column(String(64), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    agency = relationship("Agency")

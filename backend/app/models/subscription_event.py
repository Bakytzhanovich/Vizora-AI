import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class SubscriptionEvent(Base):
    """Audit log of payment/subscription lifecycle events, keyed by Kaspi's
    payment id for idempotency (mirrors Stripe's event-id dedup pattern)."""

    __tablename__ = "subscription_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    event_type = Column(String(40), nullable=False)
    plan = Column(String(30), nullable=True)
    amount = Column(Numeric(10, 2), nullable=True)
    currency = Column(String(6), nullable=False, default="kzt")
    kaspi_payment_id = Column(String(64), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")

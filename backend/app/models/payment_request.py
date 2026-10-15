import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class PaymentRequest(Base):
    """A student's request to pay by a Kaspi invoice the owner sends by hand.

    The student leaves the phone their Kaspi account is on, the owner sends a
    remote invoice from Kaspi Pay for business, sees it paid and approves the
    request in the admin panel — approval goes through the same activation as
    an automatic Kaspi payment (see routers/admin.py::approve_payment_request).
    """

    __tablename__ = "payment_requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    plan = Column(String(30), nullable=False)  # "standard" | "premium"
    billing_period = Column(String(10), nullable=False)  # "monthly" | "yearly"
    amount = Column(Numeric(10, 2), nullable=False)
    phone = Column(String(20), nullable=False)  # normalized 7XXXXXXXXXX
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending | approved | cancelled
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    user = relationship("User", foreign_keys=[user_id])

import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import deferred

from app.core.database import Base


class JobOffer(Base):
    """A Work & Travel job offer a student resells to other students.

    Vizora only charges the seller a listing fee (manual Kaspi invoice, like
    payment_requests); the offer price itself is paid student to student and
    never goes through us — see routers/offers.py.
    """

    __tablename__ = "job_offers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    employer = Column(String(120), nullable=False)
    position = Column(String(120), nullable=False)
    state = Column(String(40), nullable=False)
    city = Column(String(80), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    hourly_wage = Column(Numeric(6, 2), nullable=False)
    hours_per_week = Column(Integer, nullable=False)
    housing = Column(String(200), nullable=True)
    sponsor = Column(String(120), nullable=False)
    agency = Column(String(120), nullable=True)
    description = Column(Text, nullable=True)
    price_kzt = Column(Integer, nullable=False)
    contact = Column(String(100), nullable=False)
    # Proof the offer is real (offer letter photo/PDF). Owner-only, never public;
    # deferred so offer lists don't load megabytes of files.
    proof = deferred(Column(LargeBinary, nullable=False))
    proof_type = Column(String(50), nullable=False)
    phone = Column(String(20), nullable=False)  # seller's Kaspi number for the fee invoice
    listing_fee = Column(Integer, nullable=False)
    # pending → published (fee paid and proof checked) | rejected; published → sold;
    # published → hidden after REPORTS_TO_HIDE reports, until the owner looks again.
    status = Column(String(20), nullable=False, default="pending", index=True)
    reject_reason = Column(String(300), nullable=True)
    reports_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    published_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)


class JobOfferReport(Base):
    __tablename__ = "job_offer_reports"
    __table_args__ = (UniqueConstraint("offer_id", "user_id", name="uq_job_offer_reports_offer_user"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    offer_id = Column(String(36), ForeignKey("job_offers.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    reason = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.core.database import Base


class ReferralCode(Base):
    __tablename__ = "referral_codes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    code = Column(String(20), nullable=False, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    referrer_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    referred_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    referral_code = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | completed
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)


class ReferralReward(Base):
    __tablename__ = "referral_rewards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    reward_type = Column(String(50), nullable=False)
    reward_value = Column(Integer, nullable=True)
    description = Column(String(200), nullable=False, default="")
    status = Column(String(20), nullable=False, default="earned")  # earned | claimed | expired
    earned_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    claimed_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "reward_type", name="uq_user_reward_type"),
    )

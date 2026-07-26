import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("oauth_provider", "oauth_id", name="uq_users_oauth_provider_id"),
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

    profile = relationship("StudentProfile", back_populates="user", uselist=False)

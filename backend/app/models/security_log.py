import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text

from app.core.database import Base


class SecurityLog(Base):
    __tablename__ = "security_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event_type = Column(String(50), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True)  # IPv6-safe length
    # No FK — a failed-login/invalid-JWT event often has no resolvable user
    # (wrong email, tampered token), and a real user row could be deleted
    # later without needing to touch historical security log rows.
    user_id = Column(String(36), nullable=True, index=True)
    details = Column(Text, nullable=True)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

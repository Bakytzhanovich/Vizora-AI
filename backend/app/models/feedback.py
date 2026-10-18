import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.core.database import Base


class Feedback(Base):
    """A student's message to the owner, or their rating of one simulator session."""

    __tablename__ = "feedback"
    # One rating per session: rating again replaces the old one. General
    # messages have no session_id, and NULLs never collide in a unique index.
    __table_args__ = (UniqueConstraint("user_id", "session_id", name="uq_feedback_user_session"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(20), nullable=False, index=True)  # idea | bug | question | session
    rating = Column(Integer, nullable=True)  # 1–5, session ratings only
    message = Column(Text, nullable=True)
    page = Column(String(200), nullable=True)
    session_id = Column(String(36), ForeignKey("simulator_sessions.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

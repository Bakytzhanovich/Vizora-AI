import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base


class SimulatorSession(Base):
    __tablename__ = "simulator_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    mode = Column(String(20), nullable=False)
    difficulty = Column(String(20), nullable=False, default="medium")
    transcript = Column(Text, default="[]")
    feedback = Column(Text, nullable=True)
    scores = Column(Text, nullable=True)
    duration_seconds = Column(Integer, default=0)
    question_count = Column(Integer, default=0, nullable=True)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

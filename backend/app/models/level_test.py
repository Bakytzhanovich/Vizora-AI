import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text

from app.core.database import Base


class LevelTest(Base):
    """Spoken English placement test — separate from SimulatorSession so it
    never counts toward simulator session limits, history or score averages."""

    __tablename__ = "level_tests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    # JSON list of turns: {"question", "level", "answer", "scores", "corrections", "words_per_minute"}
    transcript = Column(Text, default="[]", nullable=False)
    current_question = Column(Text, nullable=False)
    current_level = Column(String(4), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    final_level = Column(String(4), nullable=True)
    result = Column(Text, nullable=True)  # JSON — what the results screen shows
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

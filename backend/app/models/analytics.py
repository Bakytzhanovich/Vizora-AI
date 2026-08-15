from datetime import datetime
from sqlalchemy import Column, DateTime, String, Text
from app.core.database import Base


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    event = Column(String, nullable=False, index=True)
    properties = Column(Text, nullable=True)  # JSON string
    url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

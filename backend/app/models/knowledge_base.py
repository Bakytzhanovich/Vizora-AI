import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, Text

from app.core.database import Base


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String(50), nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    trust_level = Column(String(80), nullable=False, default="официальный источник")
    source_url = Column(Text, nullable=True)
    embedding = Column(Text, nullable=True)      # JSON-encoded list[float]
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)


class ScraperRun(Base):
    __tablename__ = "scraper_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    sources_scraped = Column(String(10), default="0")
    new_entries_added = Column(String(10), default="0")
    status = Column(String(20), default="running", nullable=False)
    error_message = Column(Text, nullable=True)

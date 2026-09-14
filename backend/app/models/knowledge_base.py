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
    # Product currently only covers US visas — schema is tagged now so a
    # future Europe/other-country expansion doesn't need a migration+backfill
    # later, just new rows with a different country_code/visa_type. All
    # existing content predates this field and is USA/J1 (can't reliably
    # tell J1 from F1 content programmatically, so it's manually correctable
    # per-row later rather than guessed here).
    country_code = Column(String(10), nullable=False, default="USA")
    visa_type = Column(String(10), nullable=False, default="J1")


class ScraperRun(Base):
    __tablename__ = "scraper_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    sources_scraped = Column(String(10), default="0")
    new_entries_added = Column(String(10), default="0")
    status = Column(String(20), default="running", nullable=False)
    error_message = Column(Text, nullable=True)

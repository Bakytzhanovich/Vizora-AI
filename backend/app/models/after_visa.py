import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String

from app.core.database import Base


class AfterVisaProgress(Base):
    __tablename__ = "after_visa_progress"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), nullable=False, index=True)
    module_id = Column(String(50), nullable=False)
    section_id = Column(String(100), nullable=False)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

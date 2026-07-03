import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID

from app.core.database import Base


class EarlyAccessEmail(Base):
    __tablename__ = "early_access_emails"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    type = Column(String(20), nullable=False, default="student")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

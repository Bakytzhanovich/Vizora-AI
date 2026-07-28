import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    name = Column(String(100), nullable=False)
    university = Column(String(200), nullable=False)
    course_year = Column(Integer, nullable=False)
    profession = Column(String(150), nullable=False)
    interview_date = Column(Date, nullable=True)
    english_level = Column(String(20), nullable=False)
    travel_history = Column(Boolean, nullable=False, default=False)
    financial_source = Column(String(20), nullable=False)
    job_offer = Column(String(20), nullable=False)
    country = Column(String(10), nullable=False)
    via_agency = Column(Boolean, nullable=False, default=False)
    risk_profile = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="profile")

import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint

from app.core.database import Base


class RoadmapProgress(Base):
    __tablename__ = "roadmap_progress"
    __table_args__ = (UniqueConstraint("user_id", "step_id", name="uq_roadmap_progress_user_step"),)

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    step_id = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

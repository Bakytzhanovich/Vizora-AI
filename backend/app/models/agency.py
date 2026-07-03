import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String

from app.core.database import Base


class Agency(Base):
    __tablename__ = "agencies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, unique=True, index=True)
    password_hash = Column(String(200), nullable=False)
    country = Column(String(10), nullable=False)
    contact_phone = Column(String(50), nullable=True)
    subscription_plan = Column(String(50), default="trial", nullable=False)
    white_label_name = Column(String(200), nullable=True)
    white_label_logo_url = Column(String(500), nullable=True)
    white_label_primary_color = Column(String(20), nullable=True)
    white_label_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AgencyMember(Base):
    __tablename__ = "agency_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agency_id = Column(String(36), ForeignKey("agencies.id"), nullable=False, index=True)
    role = Column(String(20), default="manager", nullable=False)  # 'admin' | 'manager'
    name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, index=True)
    password_hash = Column(String(200), nullable=True)  # null until invitation accepted
    invite_token = Column(String(100), nullable=True, index=True)
    invite_token_expires = Column(DateTime, nullable=True)
    status = Column(String(20), default="invited", nullable=False)  # 'active' | 'invited' | 'deactivated'
    invited_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    joined_at = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class AgencyStudent(Base):
    __tablename__ = "agency_students"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agency_id = Column(String(36), ForeignKey("agencies.id"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_manager_id = Column(String(36), ForeignKey("agency_members.id"), nullable=True)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(String(20), default="active", nullable=False)

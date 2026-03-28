from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(Text, nullable=False, index=True) # student, teacher, admin
    department = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    records = relationship("StudentRecord", back_populates="teacher")
    alerts = relationship("Alert", back_populates="teacher")

class StudentRecord(Base):
    __tablename__ = "student_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    email = Column(Text, nullable=False, index=True)
    attendance_pct = Column(Numeric(5, 2), nullable=False)
    assignment_avg = Column(Numeric(5, 2), nullable=False)
    midterm_score = Column(Numeric(5, 2), nullable=False)
    final_score = Column(Numeric(5, 2), nullable=False)
    quiz_avg = Column(Numeric(5, 2), default=70.0)
    semester = Column(Text)
    department = Column(Text)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # ML Prediction results
    risk_level = Column(Text) # Low, Medium, High
    confidence = Column(Numeric(5, 4))
    
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, index=True)

    teacher = relationship("User", back_populates="records")
    alerts = relationship("Alert", back_populates="student")

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("student_records.id", ondelete="CASCADE"))
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    risk_level = Column(Text, nullable=False)
    confidence = Column(Numeric(5, 4))
    email_sent = Column(Boolean, default=False)
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, index=True)

    student = relationship("StudentRecord", back_populates="alerts")
    teacher = relationship("User", back_populates="alerts")

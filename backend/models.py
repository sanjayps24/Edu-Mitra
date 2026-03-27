"""
models.py — Pydantic request/response models for the Edu-Mitra API.
All data validation and serialization is handled here.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from enum import Enum


# ── Enums ────────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class RiskLevel(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"


# ── Auth Models ──────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    """Request model for user registration."""
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.student
    # Optional: teacher/admin specific fields
    department: Optional[str] = None


class UserLogin(BaseModel):
    """Request model for user login."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Response model after successful login."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
    name: str


# ── Student / Academic Record Models ─────────────────────────────────────────

class StudentRecord(BaseModel):
    """Full academic record for a student."""
    student_id: Optional[str] = None
    name: str
    email: EmailStr
    attendance_pct: float = Field(..., ge=0, le=100, description="Attendance percentage")
    assignment_avg: float = Field(..., ge=0, le=100, description="Average assignment score")
    midterm_score: float = Field(..., ge=0, le=100, description="Midterm exam score")
    final_score: float = Field(..., ge=0, le=100, description="Final exam score")
    quiz_avg: float = Field(..., ge=0, le=100, description="Average quiz score")
    semester: Optional[str] = None
    department: Optional[str] = None
    teacher_id: Optional[str] = None


class StudentUpdate(BaseModel):
    """Partial update model for student records."""
    attendance_pct: Optional[float] = Field(None, ge=0, le=100)
    assignment_avg: Optional[float] = Field(None, ge=0, le=100)
    midterm_score: Optional[float] = Field(None, ge=0, le=100)
    final_score: Optional[float] = Field(None, ge=0, le=100)
    quiz_avg: Optional[float] = Field(None, ge=0, le=100)
    semester: Optional[str] = None


# ── Prediction Models ─────────────────────────────────────────────────────────

class PredictRequest(BaseModel):
    """Input features for ML risk prediction."""
    attendance_pct: float = Field(..., ge=0, le=100)
    assignment_avg: float = Field(..., ge=0, le=100)
    midterm_score: float = Field(..., ge=0, le=100)
    final_score: float = Field(..., ge=0, le=100)
    quiz_avg: float = Field(..., ge=0, le=100)


class FeatureImportance(BaseModel):
    """SHAP / feature importance entry."""
    feature: str
    importance: float
    direction: str  # "positive" or "negative"


class PredictResponse(BaseModel):
    """ML model prediction response."""
    risk_level: RiskLevel
    confidence: float
    recommendations: List[str]
    feature_importance: List[FeatureImportance]


# ── Dashboard Models ──────────────────────────────────────────────────────────

class StudentSummary(BaseModel):
    """Summary row used in teacher/admin dashboards."""
    student_id: str
    name: str
    email: str
    attendance_pct: float
    assignment_avg: float
    exam_avg: float
    risk_level: Optional[str] = None
    confidence: Optional[float] = None


class DashboardStats(BaseModel):
    """System-wide statistics for admin dashboard."""
    total_students: int
    total_teachers: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    avg_attendance: float
    avg_exam_score: float


# ── Alert Models ──────────────────────────────────────────────────────────────

class Alert(BaseModel):
    """High-risk student alert record."""
    student_id: str
    name: str
    email: str
    risk_level: str
    confidence: float
    teacher_email: Optional[str] = None
    created_at: Optional[str] = None

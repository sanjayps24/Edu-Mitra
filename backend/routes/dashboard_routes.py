"""
dashboard_routes.py — Teacher and Admin dashboard data endpoints.
Returns aggregated statistics, student lists, and system-wide metrics.
"""

from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import DashboardStats, StudentSummary
from auth import require_role
from database import get_db
from database_models import User, StudentRecord
from ml.predict import predict_risk

router = APIRouter()


@router.get("/teacher", response_model=dict)
async def get_teacher_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """
    Teacher dashboard: all students with risk summary and high-risk list.
    Admins see all students; teachers see only their own.
    """
    teacher_id = current_user.get("sub")
    role = current_user.get("role")

    if role == "admin":
        students = db.query(StudentRecord).all()
    else:
        students = db.query(StudentRecord).filter(StudentRecord.teacher_id == teacher_id).all()
    
    if not students:
        return {
            "teacher_name": current_user.get("name"),
            "stats": {"total": 0, "high_risk": 0, "medium_risk": 0, "low_risk": 0},
            "students": []
        }
    
    summaries = []
    high_count = 0
    medium_count = 0
    low_count = 0

    for s in students:
        if s.risk_level == "High": high_count += 1
        elif s.risk_level == "Medium": medium_count += 1
        else: low_count += 1

        exam_avg = (float(s.midterm_score or 0) + float(s.final_score or 0)) / 2
        summaries.append(StudentSummary(
            student_id=str(s.id),
            name=s.name,
            email=s.email,
            attendance_pct=float(s.attendance_pct),
            assignment_avg=float(s.assignment_avg),
            exam_avg=exam_avg,
            risk_level=s.risk_level,
            confidence=float(s.confidence) if s.confidence else None
        ))

    return {
        "teacher_name": current_user.get("name"),
        "stats": {
            "total": len(students),
            "high_risk": high_count,
            "medium_risk": medium_count,
            "low_risk": low_count
        },
        "students": summaries
    }


@router.get("/admin", response_model=DashboardStats)
async def get_admin_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin"))
):
    """
    Get system-wide stats for the admin dashboard.
    Uses SQLAlchemy aggregations for performance.
    """
    total_students = db.query(func.count(User.id)).filter(User.role == "student").scalar()
    total_teachers = db.query(func.count(User.id)).filter(User.role == "teacher").scalar()
    
    risk_stats = db.query(
        StudentRecord.risk_level, 
        func.count(StudentRecord.id)
    ).group_by(StudentRecord.risk_level).all()
    
    risk_counts = {r: count for r, count in risk_stats}
    
    avg_stats = db.query(
        func.avg(StudentRecord.attendance_pct),
        func.avg((StudentRecord.midterm_score + StudentRecord.final_score) / 2)
    ).first()

    return DashboardStats(
        total_students=total_students or 0,
        total_teachers=total_teachers or 0,
        high_risk_count=risk_counts.get("High", 0),
        medium_risk_count=risk_counts.get("Medium", 0),
        low_risk_count=risk_counts.get("Low", 0),
        avg_attendance=float(avg_stats[0] or 0),
        avg_exam_score=float(avg_stats[1] or 0)
    )

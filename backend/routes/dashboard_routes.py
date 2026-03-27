"""
dashboard_routes.py — Teacher and Admin dashboard data endpoints.
Returns aggregated statistics, student lists, and system-wide metrics.
"""

from fastapi import APIRouter, Depends
from typing import List
from models import StudentSummary, DashboardStats
from auth import get_current_user, require_role
from database import supabase
from ml.predict import predict_risk

router = APIRouter()


@router.get("/teacher", response_model=dict)
async def teacher_dashboard(
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """
    Teacher dashboard: all students with risk summary and high-risk list.
    Admins see all students; teachers see only their own.
    """
    if not supabase:
        return {
            "students": [], "risk_counts": {"Low": 3, "Medium": 3, "High": 2},
            "high_risk_students": [], "total_students": 8,
            "teacher_name": current_user.get("name"),
        }

    teacher_id = current_user.get("sub")
    role       = current_user.get("role")

    if role == "admin":
        result = supabase.table("student_records").select("*").execute()
    else:
        result = supabase.table("student_records").select("*").eq("teacher_id", teacher_id).execute()

    students = result.data or []
    risk_counts = {"Low": 0, "Medium": 0, "High": 0}
    student_summaries = []

    for s in students:
        risk = s.get("risk_level", "Low")
        if risk in risk_counts:
            risk_counts[risk] += 1
        exam_avg = (s.get("midterm_score", 0) + s.get("final_score", 0)) / 2
        student_summaries.append({
            "student_id":    str(s["id"]),
            "name":          s["name"],
            "email":         s["email"],
            "attendance_pct":s["attendance_pct"],
            "assignment_avg":s["assignment_avg"],
            "exam_avg":      exam_avg,
            "risk_level":    risk,
            "confidence":    s.get("confidence"),
        })

    high_risk = [s for s in student_summaries if s["risk_level"] == "High"]
    return {
        "students":           student_summaries,
        "risk_counts":        risk_counts,
        "high_risk_students": high_risk,
        "total_students":     len(students),
        "teacher_name":       current_user.get("name"),
    }


@router.get("/admin", response_model=dict)
async def admin_dashboard(
    current_user: dict = Depends(require_role("admin"))
):
    """
    Admin dashboard: system-wide student stats and risk distribution.
    """
    if not supabase:
        return {
            "stats": {"total_students": 8, "total_teachers": 2, "high_risk_count": 2,
                      "medium_risk_count": 3, "low_risk_count": 3, "avg_attendance": 70.3, "avg_exam_score": 66.5},
            "risk_distribution": {"Low": 3, "Medium": 3, "High": 2},
            "recent_records": [],
        }

    student_result = supabase.table("student_records").select("*").execute()
    students = student_result.data or []

    user_result = supabase.table("users").select("id, role").execute()
    users = user_result.data or []

    total_students = sum(1 for u in users if u["role"] == "student")
    total_teachers = sum(1 for u in users if u["role"] == "teacher")

    risk_counts     = {"Low": 0, "Medium": 0, "High": 0}
    total_attendance = 0
    total_exam       = 0

    for s in students:
        risk = s.get("risk_level", "Low")
        if risk in risk_counts:
            risk_counts[risk] += 1
        total_attendance += s.get("attendance_pct", 0)
        total_exam       += (s.get("midterm_score", 0) + s.get("final_score", 0)) / 2

    n = len(students) or 1
    stats = DashboardStats(
        total_students=   total_students,
        total_teachers=   total_teachers,
        high_risk_count=  risk_counts["High"],
        medium_risk_count=risk_counts["Medium"],
        low_risk_count=   risk_counts["Low"],
        avg_attendance=   round(total_attendance / n, 2),
        avg_exam_score=   round(total_exam / n, 2),
    )
    return {
        "stats":             stats.model_dump(),
        "risk_distribution": risk_counts,
        "recent_records":    students[-10:],
    }

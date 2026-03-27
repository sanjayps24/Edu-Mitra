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
    current_user: dict = Depends(await require_role("teacher", "admin"))
):
    """
    Teacher dashboard data:
    - All students assigned to this teacher (or all students for admin)
    - Risk level summary counts
    - Recent high-risk alerts
    """
    teacher_id = current_user.get("sub")
    role = current_user.get("role")

    # Admins see all students; teachers see their own
    if role == "admin":
        result = supabase.table("student_records").select("*").execute()
    else:
        result = supabase.table("student_records").select("*").eq("teacher_id", teacher_id).execute()

    students = result.data or []

    # Compute risk counts
    risk_counts = {"Low": 0, "Medium": 0, "High": 0}
    student_summaries = []

    for s in students:
        risk = s.get("risk_level", "Unknown")
        if risk in risk_counts:
            risk_counts[risk] += 1

        exam_avg = (s.get("midterm_score", 0) + s.get("final_score", 0)) / 2
        student_summaries.append({
            "student_id": str(s["id"]),
            "name": s["name"],
            "email": s["email"],
            "attendance_pct": s["attendance_pct"],
            "assignment_avg": s["assignment_avg"],
            "exam_avg": exam_avg,
            "risk_level": risk,
            "confidence": s.get("confidence"),
        })

    # High-risk students for alert panel
    high_risk = [s for s in student_summaries if s["risk_level"] == "High"]

    return {
        "students": student_summaries,
        "risk_counts": risk_counts,
        "high_risk_students": high_risk,
        "total_students": len(students),
        "teacher_name": current_user.get("name"),
    }


@router.get("/admin", response_model=dict)
async def admin_dashboard(
    current_user: dict = Depends(await require_role("admin"))
):
    """
    Admin dashboard data:
    - System-wide student statistics
    - Total users (students + teachers)
    - Risk distribution
    - Average attendance and exam scores
    """
    # All student records
    student_result = supabase.table("student_records").select("*").execute()
    students = student_result.data or []

    # All users
    user_result = supabase.table("users").select("id, role").execute()
    users = user_result.data or []

    total_students = sum(1 for u in users if u["role"] == "student")
    total_teachers = sum(1 for u in users if u["role"] == "teacher")

    risk_counts = {"Low": 0, "Medium": 0, "High": 0}
    total_attendance = 0
    total_exam = 0

    for s in students:
        risk = s.get("risk_level", "Low")
        if risk in risk_counts:
            risk_counts[risk] += 1
        total_attendance += s.get("attendance_pct", 0)
        total_exam += (s.get("midterm_score", 0) + s.get("final_score", 0)) / 2

    n = len(students) or 1
    stats = DashboardStats(
        total_students=total_students,
        total_teachers=total_teachers,
        high_risk_count=risk_counts["High"],
        medium_risk_count=risk_counts["Medium"],
        low_risk_count=risk_counts["Low"],
        avg_attendance=round(total_attendance / n, 2),
        avg_exam_score=round(total_exam / n, 2),
    )

    return {
        "stats": stats.model_dump(),
        "risk_distribution": risk_counts,
        "recent_records": students[-10:],  # Latest 10 records
    }

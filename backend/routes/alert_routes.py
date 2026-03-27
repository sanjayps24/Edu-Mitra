"""
alert_routes.py — Alert endpoints for high-risk student notifications.
Returns high-risk student lists and triggers email notifications.
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from typing import List
from models import Alert
from auth import get_current_user, require_role
from database import supabase
from services.email_service import send_high_risk_alert

router = APIRouter()


@router.get("/high-risk", response_model=List[dict])
async def get_high_risk_students(
    current_user: dict = Depends(await require_role("teacher", "admin"))
):
    """
    Return all students currently classified as High risk.
    Accessible by: teacher, admin
    """
    result = supabase.table("student_records") \
        .select("*") \
        .eq("risk_level", "High") \
        .execute()

    high_risk = result.data or []

    return [
        {
            "student_id": str(s["id"]),
            "name": s["name"],
            "email": s["email"],
            "attendance_pct": s["attendance_pct"],
            "assignment_avg": s["assignment_avg"],
            "risk_level": s["risk_level"],
            "confidence": s.get("confidence"),
            "department": s.get("department"),
        }
        for s in high_risk
    ]


@router.post("/notify", response_model=dict)
async def send_alerts_to_teachers(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(await require_role("admin"))
):
    """
    Trigger email notifications to all teachers for their high-risk students.
    Runs in background so the response is immediate.
    Accessible by: admin only
    """
    # Get all high-risk students
    student_result = supabase.table("student_records") \
        .select("*") \
        .eq("risk_level", "High") \
        .execute()
    students = student_result.data or []

    if not students:
        return {"message": "No high-risk students found. No alerts sent."}

    # Get all teachers to email them
    teacher_result = supabase.table("users").select("*").eq("role", "teacher").execute()
    teachers = teacher_result.data or []

    # Group students by teacher_id and send alert emails
    alerts_sent = 0
    for teacher in teachers:
        teacher_students = [s for s in students if s.get("teacher_id") == teacher["id"]]
        if teacher_students:
            background_tasks.add_task(
                send_high_risk_alert,
                teacher_email=teacher["email"],
                teacher_name=teacher["name"],
                students=teacher_students,
            )
            alerts_sent += 1

    return {
        "message": f"Alert emails queued for {alerts_sent} teacher(s).",
        "high_risk_count": len(students),
    }

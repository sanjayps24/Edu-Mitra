"""
alert_routes.py — Alert endpoints for high-risk student notifications.
Returns high-risk student lists and triggers email notifications.
"""

from fastapi import APIRouter, Depends, BackgroundTasks
from typing import List
from sqlalchemy.orm import Session
from datetime import datetime
from models import Alert as AlertModel
from auth import require_role
from database import get_db
from database_models import Alert, StudentRecord, User
from services.email_service import send_risk_alert

router = APIRouter()


@router.get("/high-risk", response_model=List[dict])
async def list_high_risk_alerts(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """Return all students currently classified as High risk."""
    # Get high-risk records from DB
    query = db.query(StudentRecord).filter(StudentRecord.risk_level == "High")
    
    # If teacher, filter for their students
    if current_user.get("role") == "teacher":
        query = query.filter(StudentRecord.teacher_id == current_user.get("sub"))
    
    high_risk_students = query.all()
    
    alerts = []
    for s in high_risk_students:
        alerts.append(AlertModel(
            student_id=str(s.id),
            name=s.name,
            email=s.email,
            risk_level=s.risk_level,
            confidence=float(s.confidence or 0),
            created_at=str(s.created_at)
        ))
    
    return alerts


@router.post("/notify", response_model=dict)
async def send_alerts_to_teachers(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin"))
):
    """
    Trigger email notifications to all teachers for their high-risk students.
    """
    # Fetch high-risk students and their teachers
    high_risk = db.query(StudentRecord, User).join(User, StudentRecord.teacher_id == User.id).filter(StudentRecord.risk_level == "High").all()
    
    sent_count = 0
    for s, t in high_risk:
        # Check if alert already exists for this student/teacher
        existing = db.query(Alert).filter(Alert.student_id == s.id, Alert.teacher_id == t.id).first()
        if existing and existing.email_sent:
            continue

        success = send_risk_alert(
            teacher_email=t.email,
            student_name=s.name,
            risk_level=s.risk_level,
            confidence=float(s.confidence or 0)
        )

        if success:
            if existing:
                existing.email_sent = True
                existing.sent_at = datetime.utcnow()
            else:
                new_alert = Alert(
                    student_id=s.id,
                    teacher_id=t.id,
                    risk_level=s.risk_level,
                    confidence=s.confidence,
                    email_sent=True,
                    sent_at=datetime.utcnow()
                )
                db.add(new_alert)
            sent_count += 1

    db.commit()
    return {"message": f"Successfully sent {sent_count} alerts."}

"""
student_routes.py — CRUD endpoints for student academic records.
Full Create / Read / Update / Delete operations for teachers and admins.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from sqlalchemy.orm import Session
from models import StudentRecord, StudentUpdate, StudentSummary
from auth import get_current_user, require_role
from database import get_db
from database_models import StudentRecord as DBStudentRecord
from ml.predict import predict_risk

router = APIRouter()


@router.post("/add", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_student(
    record: StudentRecord,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """
    Add a new student academic record.
    Accessible by: teacher, admin
    Also runs ML prediction and stores the risk level.
    """
    features = {
        "attendance_pct": record.attendance_pct,
        "assignment_avg": record.assignment_avg,
        "midterm_score":  record.midterm_score,
        "final_score":    record.final_score,
        "quiz_avg":       record.quiz_avg,
    }
    prediction = predict_risk(features)

    new_student = DBStudentRecord(
        name=record.name,
        email=record.email,
        attendance_pct=record.attendance_pct,
        assignment_avg=record.assignment_avg,
        midterm_score=record.midterm_score,
        final_score=record.final_score,
        quiz_avg=record.quiz_avg,
        semester=record.semester,
        department=record.department,
        teacher_id=current_user.get("sub"),
        risk_level=prediction["risk_level"],
        confidence=prediction["confidence"],
    )
    
    db.add(new_student)
    try:
        db.commit()
        db.refresh(new_student)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add student record: {str(e)}")

    return {
        "message":    "Student record added successfully.",
        "student_id": str(new_student.id),
        "risk_level": prediction["risk_level"],
    }


@router.get("/{student_id}/performance", response_model=dict)
async def get_student_performance(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a student's full academic performance record.
    Students can only access their own data; teachers/admins can access all.
    """
    student = db.query(DBStudentRecord).filter(DBStudentRecord.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    prediction = predict_risk({
        "attendance_pct": float(student.attendance_pct),
        "assignment_avg": float(student.assignment_avg),
        "midterm_score":  float(student.midterm_score),
        "final_score":    float(student.final_score),
        "quiz_avg":       float(student.quiz_avg or 70),
    })

    return {
        "id": str(student.id),
        "name": student.name,
        "email": student.email,
        "attendance_pct": float(student.attendance_pct),
        "assignment_avg": float(student.assignment_avg),
        "midterm_score": float(student.midterm_score),
        "final_score": float(student.final_score),
        "quiz_avg": float(student.quiz_avg),
        "semester": student.semester,
        "department": student.department,
        "risk_level":         prediction["risk_level"],
        "confidence":         prediction["confidence"],
        "recommendations":    prediction["recommendations"],
        "feature_importance": prediction["feature_importance"],
    }


@router.get("/", response_model=List[StudentSummary])
async def list_students(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """List all student records with risk levels. Teacher/Admin only."""
    students = db.query(DBStudentRecord).all()

    summaries = []
    for s in students:
        exam_avg = (float(s.midterm_score or 0) + float(s.final_score or 0)) / 2
        summaries.append(StudentSummary(
            student_id=str(s.id),
            name=s.name,
            email=s.email,
            attendance_pct=float(s.attendance_pct),
            assignment_avg=float(s.assignment_avg),
            exam_avg=exam_avg,
            risk_level=s.risk_level,
            confidence=float(s.confidence) if s.confidence else None,
        ))
    return summaries


@router.put("/{student_id}/update", response_model=dict)
async def update_student(
    student_id: str,
    updates: StudentUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """Update a student's academic record. Re-runs ML prediction after update."""
    update_data = updates.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    student = db.query(DBStudentRecord).filter(DBStudentRecord.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    # Update fields
    for key, value in update_data.items():
        setattr(student, key, value)

    # Re-predict
    prediction = predict_risk({
        "attendance_pct": float(student.attendance_pct),
        "assignment_avg": float(student.assignment_avg),
        "midterm_score":  float(student.midterm_score),
        "final_score":    float(student.final_score),
        "quiz_avg":       float(student.quiz_avg or 70),
    })
    
    student.risk_level = prediction["risk_level"]
    student.confidence = prediction["confidence"]

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update student record.")

    return {
        "message":    "Student record updated successfully.",
        "risk_level": prediction["risk_level"],
        "confidence": prediction["confidence"],
    }


@router.delete("/{student_id}", response_model=dict)
async def delete_student(
    student_id: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("teacher", "admin"))
):
    """Delete a student's academic record. Teacher/Admin only."""
    student = db.query(DBStudentRecord).filter(DBStudentRecord.id == student_id).first()
    if student:
        db.delete(student)
        db.commit()
    return {"message": "Student record deleted successfully."}

"""
student_routes.py — CRUD endpoints for student academic records.
Full Create / Read / Update / Delete operations for teachers and admins.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from models import StudentRecord, StudentUpdate, StudentSummary
from auth import get_current_user, require_role
from database import supabase
from ml.predict import predict_risk

router = APIRouter()


@router.post("/add", response_model=dict, status_code=status.HTTP_201_CREATED)
async def add_student(
    record: StudentRecord,
    current_user: dict = Depends(await require_role("teacher", "admin"))
):
    """
    Add a new student academic record.
    Accessible by: teacher, admin
    Also runs ML prediction and stores the risk level.
    """
    # Run ML prediction for immediate risk classification
    prediction = predict_risk({
        "attendance_pct": record.attendance_pct,
        "assignment_avg": record.assignment_avg,
        "midterm_score": record.midterm_score,
        "final_score": record.final_score,
        "quiz_avg": record.quiz_avg,
    })

    student_data = {
        "name": record.name,
        "email": record.email,
        "attendance_pct": record.attendance_pct,
        "assignment_avg": record.assignment_avg,
        "midterm_score": record.midterm_score,
        "final_score": record.final_score,
        "quiz_avg": record.quiz_avg,
        "semester": record.semester,
        "department": record.department,
        "teacher_id": current_user.get("sub"),
        "risk_level": prediction["risk_level"],
        "confidence": prediction["confidence"],
    }

    result = supabase.table("student_records").insert(student_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to add student record.")

    created = result.data[0]
    return {
        "message": "Student record added successfully.",
        "student_id": created["id"],
        "risk_level": prediction["risk_level"],
    }


@router.get("/{student_id}/performance", response_model=dict)
async def get_student_performance(
    student_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get a student's full academic performance record.
    Students can only access their own data; teachers/admins can access all.
    """
    # Students may only view their own data
    if current_user.get("role") == "student":
        # Fetch the student record linked to this user account
        user_result = supabase.table("users").select("*").eq("id", current_user["sub"]).execute()
        if not user_result.data:
            raise HTTPException(status_code=404, detail="User not found.")

    result = supabase.table("student_records").select("*").eq("id", student_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Student record not found.")

    student = result.data[0]

    # Run fresh prediction for latest data
    prediction = predict_risk({
        "attendance_pct": student["attendance_pct"],
        "assignment_avg": student["assignment_avg"],
        "midterm_score": student["midterm_score"],
        "final_score": student["final_score"],
        "quiz_avg": student["quiz_avg"],
    })

    return {
        **student,
        "risk_level": prediction["risk_level"],
        "confidence": prediction["confidence"],
        "recommendations": prediction["recommendations"],
        "feature_importance": prediction["feature_importance"],
    }


@router.get("/", response_model=List[StudentSummary])
async def list_students(
    current_user: dict = Depends(await require_role("teacher", "admin"))
):
    """
    List all student records with risk levels.
    Accessible by: teacher, admin
    """
    result = supabase.table("student_records").select("*").execute()
    students = result.data or []

    summaries = []
    for s in students:
        exam_avg = (s.get("midterm_score", 0) + s.get("final_score", 0)) / 2
        summaries.append(StudentSummary(
            student_id=str(s["id"]),
            name=s["name"],
            email=s["email"],
            attendance_pct=s["attendance_pct"],
            assignment_avg=s["assignment_avg"],
            exam_avg=exam_avg,
            risk_level=s.get("risk_level"),
            confidence=s.get("confidence"),
        ))

    return summaries


@router.put("/{student_id}/update", response_model=dict)
async def update_student(
    student_id: str,
    updates: StudentUpdate,
    current_user: dict = Depends(await require_role("teacher", "admin"))
):
    """
    Update a student's academic record (partial update supported).
    Re-runs ML prediction after update.
    """
    # Build update dict — only include fields that were provided
    update_data = updates.model_dump(exclude_none=True)

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    # Fetch existing record to fill in missing fields for prediction
    existing = supabase.table("student_records").select("*").eq("id", student_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Student record not found.")

    merged = {**existing.data[0], **update_data}

    # Re-run prediction with merged data
    prediction = predict_risk({
        "attendance_pct": merged["attendance_pct"],
        "assignment_avg": merged["assignment_avg"],
        "midterm_score": merged["midterm_score"],
        "final_score": merged["final_score"],
        "quiz_avg": merged["quiz_avg"],
    })

    update_data["risk_level"] = prediction["risk_level"]
    update_data["confidence"] = prediction["confidence"]

    result = supabase.table("student_records").update(update_data).eq("id", student_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update student record.")

    return {
        "message": "Student record updated successfully.",
        "risk_level": prediction["risk_level"],
        "confidence": prediction["confidence"],
    }


@router.delete("/{student_id}", response_model=dict)
async def delete_student(
    student_id: str,
    current_user: dict = Depends(await require_role("teacher", "admin"))
):
    """
    Delete a student's academic record.
    Accessible by: teacher, admin
    """
    result = supabase.table("student_records").delete().eq("id", student_id).execute()
    return {"message": "Student record deleted successfully."}

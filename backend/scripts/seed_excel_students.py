"""
seed_excel_students.py — Data migration script for Edu-Mitra.
Reads 50 students from Excel, predicts their risk via ML, and populates the DB.
"""

import os
import sys
import pandas as pd
import uuid
import numpy as np

# Adjust path to import backend modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal
from database_models import User, StudentRecord
from auth import hash_password
from ml.predict import predict_risk

# Configuration
EXCEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "student_performance_enhanced.xlsx"))
NUM_STUDENTS = 50
TEACHER_ID = "f1e982e1-ca58-4ab9-8ca0-8ad582b09db7" # Pre-existing teacher ID

def seed():
    print(f"[*] Reading students from: {EXCEL_PATH}")
    if not os.path.exists(EXCEL_PATH):
        print(f"[!] Error: Excel file not found at {EXCEL_PATH}")
        return

    # Load first 50 students
    df = pd.read_excel(EXCEL_PATH, nrows=NUM_STUDENTS)

    db = SessionLocal()
    try:
        # 1. Verify Teacher exists or find one
        teacher = db.query(User).filter(User.role == "teacher").first()
        if not teacher:
            print("[!] Error: No teacher found in database. Please create a teacher first.")
            return
        
        assigned_teacher_id = teacher.id
        print(f"[*] Assigning students to Teacher: {teacher.name} ({assigned_teacher_id})")

        count = 0
        for index, row in df.iterrows():
            roll_no = str(row['RollNo'])
            email = f"{roll_no.lower()}@edumitra.com"
            
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == email).first()
            if existing_user:
                print(f"[-] Skipping {roll_no} (Email {email} already exists)")
                continue

            # 2. Map features for ML Prediction
            # Excel columns: Attendance, AssignmentCompletion, ExamScore, Sem1_Marks
            features = {
                "attendance_pct" : float(row.get('Attendance', 75)),
                "assignment_avg" : float(row.get('AssignmentCompletion', 70)),
                "midterm_score"  : float(row.get('Sem1_Marks', 65)),
                "final_score"    : float(row.get('ExamScore', 60)),
                "quiz_avg"       : 75.0 # default if not in excel
            }

            # 3. Get ML Prediction
            prediction = predict_risk(features)
            
            # DEBUG
            print(f"[*] Seeding {roll_no} (Email: {email})")
            print(f"DEBUG: roll_no={roll_no}, type={type(roll_no)}, len={len(roll_no)}")

            # 4. Create User
            new_user = User(
                name=f"Student {roll_no}",
                email=email,
                password_hash=hash_password(roll_no), # RollNo as password
                role="student",
                department="Computer Science" if 'Grade' in row else "General"
            )
            db.add(new_user)
            db.flush() # Get user ID
            
            # 5. Create StudentRecord
            new_record = StudentRecord(
                id=new_user.id, # Map 1:1 with user ID for simplicity
                name=new_user.name,
                email=new_user.email,
                attendance_pct=features["attendance_pct"],
                assignment_avg=features["assignment_avg"],
                midterm_score=features["midterm_score"],
                final_score=features["final_score"],
                quiz_avg=features["quiz_avg"],
                teacher_id=assigned_teacher_id,
                risk_level=prediction["risk_level"],
                confidence=float(prediction["confidence"])
            )
            db.add(new_record)
            
            count += 1
            if count % 10 == 0:
                print(f"[*] Processed {count} students...")

        db.commit()
        print(f"[+] SUCCESS: Seeded {count} new students into the database.")
        print(f"[*] Credentials Example: Email={df.iloc[0]['RollNo'].lower()}@edumitra.com, Password={df.iloc[0]['RollNo']}")

    except Exception as e:
        db.rollback()
        import traceback
        print(f"[!] Critical Error during seeding:\n{traceback.format_exc()}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()

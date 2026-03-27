"""
email_service.py — Email notification service using aiosmtplib.
Sends automated alerts to teachers when students are classified as high-risk.
"""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, APP_NAME


def build_alert_html(teacher_name: str, students: List[Dict]) -> str:
    """Build a styled HTML email body for the high-risk alert."""
    rows = ""
    for s in students:
        rows += f"""
        <tr>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">{s.get('name','N/A')}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">{s.get('email','N/A')}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">{s.get('attendance_pct',0):.1f}%</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">{s.get('assignment_avg',0):.1f}</td>
            <td style="padding:10px;border-bottom:1px solid #e2e8f0;">
                <span style="background:#fee2e2;color:#991b1b;padding:3px 10px;border-radius:12px;font-weight:600;">
                    HIGH RISK
                </span>
            </td>
        </tr>"""

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family:Arial,sans-serif;background:#f8fafc;padding:20px;color:#1e293b;">
        <div style="max-width:680px;margin:auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,.08);">
            <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:30px;text-align:center;">
                <h1 style="color:white;margin:0;font-size:22px;">🎓 {APP_NAME}</h1>
                <p style="color:#bfdbfe;margin:6px 0 0;">High-Risk Student Alert</p>
            </div>
            <div style="padding:30px;">
                <p>Dear <strong>{teacher_name}</strong>,</p>
                <p>The following student(s) in your class have been classified as <strong style="color:#dc2626;">High Risk</strong>
                   by the Edu-Mitra prediction system and require your immediate attention:</p>

                <table style="width:100%;border-collapse:collapse;margin:20px 0;">
                    <thead>
                        <tr style="background:#eff6ff;">
                            <th style="padding:10px;text-align:left;font-size:13px;color:#3b82f6;">Student</th>
                            <th style="padding:10px;text-align:left;font-size:13px;color:#3b82f6;">Email</th>
                            <th style="padding:10px;text-align:left;font-size:13px;color:#3b82f6;">Attendance</th>
                            <th style="padding:10px;text-align:left;font-size:13px;color:#3b82f6;">Assignments</th>
                            <th style="padding:10px;text-align:left;font-size:13px;color:#3b82f6;">Risk</th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>

                <p>Please reach out to these students as soon as possible to offer guidance and support.</p>
                <p style="color:#64748b;font-size:13px;">This is an automated notification from the {APP_NAME} system.</p>
            </div>
            <div style="background:#f1f5f9;padding:16px 30px;text-align:center;color:#94a3b8;font-size:12px;">
                © 2024 {APP_NAME} | Team: Strategic Minds | P-02
            </div>
        </div>
    </body>
    </html>"""


def send_high_risk_alert(teacher_email: str, teacher_name: str, students: List[Dict]):
    """
    Send a high-risk student alert email to a teacher.
    Uses synchronous smtplib (safe to run in FastAPI background tasks).
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[Email] SMTP not configured — skipping alert to {teacher_email}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"⚠️ {APP_NAME} Alert: {len(students)} High-Risk Student(s) Detected"
        msg["From"]    = SMTP_USER
        msg["To"]      = teacher_email

        html_content = build_alert_html(teacher_name, students)
        msg.attach(MIMEText(html_content, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, teacher_email, msg.as_string())

        print(f"[Email] ✅ Alert sent to {teacher_email} for {len(students)} student(s)")

    except Exception as e:
        print(f"[Email] ❌ Failed to send alert to {teacher_email}: {e}")

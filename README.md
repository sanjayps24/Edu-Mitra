# 🎓 EduMitra — Student Performance Prediction & Monitoring System

> **Team: Strategic Minds** | Built with FastAPI · XGBoost · Supabase · Tailwind CSS

A full-stack AI-powered academic monitoring system that predicts student risk levels (Low / Medium / High) using machine learning, delivers personalized recommendations, and notifies educators — before students fall behind.

---

## 🚀 Features

| Feature | Description |
|---|---|
| 🤖 ML Risk Prediction | XGBoost classifier — up to 95% accuracy on 5 academic features |
| 🧠 Explainable AI | SHAP-based feature importance shows *why* a student is at risk |
| 📊 Role Dashboards | Separate UIs for Student, Teacher, and Admin |
| 💬 AI Chatbot | Keyword-driven study advisor bot for students |
| 📧 Email Alerts | Automated SMTP notifications to teachers for high-risk students |
| 🔐 JWT Auth | Secure login with role-based route guards |
| 📈 Charts | Chart.js line, bar, doughnut, radar graphs for trends |
| 🗂️ Full CRUD | Teachers can add / edit / delete student records |

---

## 🖥️ Demo Credentials

| Role | Email | Password |
|---|---|---|
| 🎓 Student | `student@demo.com` | `demo123` |
| 👩‍🏫 Teacher | `teacher@demo.com` | `demo123` |
| 🛡️ Admin | `admin@demo.com` | `demo123` |

> The frontend works fully in **Demo Mode** (no backend needed) — all data is mocked locally.

---

## 📁 Project Structure

```
Edu-Mitra/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── auth.py                  # JWT utilities + bcrypt
│   ├── config.py                # Env variable loading
│   ├── database.py              # Supabase client
│   ├── models.py                # Pydantic request/response models
│   ├── routes/
│   │   ├── auth_routes.py       # POST /auth/login, /auth/register
│   │   ├── student_routes.py    # GET/POST/PUT/DELETE /students
│   │   ├── predict_routes.py    # POST /predict
│   │   ├── dashboard_routes.py  # GET /dashboard/teacher, /admin
│   │   └── alert_routes.py      # GET /alerts/high-risk
│   ├── ml/
│   │   ├── train_model.py       # Training script (XGBoost / RandomForest)
│   │   ├── predict.py           # Inference + SHAP importance
│   │   └── model.pkl            # Trained model (generated after training)
│   ├── services/
│   │   ├── email_service.py     # SMTP alert emails
│   │   └── recommendation.py   # Study tip generator
│   └── requirements.txt
│
├── frontend/
│   ├── index.html               # 🏠 Landing page
│   ├── login.html               # 🔐 Login (3 role tabs)
│   ├── register.html            # 📝 Registration
│   ├── student_dashboard.html   # 🎓 Student view
│   ├── teacher_dashboard.html   # 👩‍🏫 Teacher view
│   └── admin_dashboard.html     # 🛡️ Admin view
│   └── js/
│       ├── auth.js              # JWT + session management
│       ├── student.js           # Student dashboard logic + chatbot
│       ├── teacher.js           # Teacher CRUD + charts
│       ├── admin.js             # Admin stats + bulk alerts
│       └── charts.js            # Chart.js factory helpers
│
├── supabase_schema.sql          # 🗄️ Database schema (run in Supabase SQL Editor)
├── student_performance_enhanced.xlsx  # 📊 Training dataset
└── .env.example                 # Environment variable template
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.10+
- A [Supabase](https://supabase.com) project (free tier works)
- Git

### 1. Clone & Create Virtual Environment

```bash
git clone https://github.com/sanjayps24/Edu-Mitra.git
cd Edu-Mitra

python -m venv venv
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-service-role-key
JWT_SECRET=your-super-secret-key
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
```

### 4. Set Up Supabase Database

1. Go to your Supabase project → **SQL Editor**
2. Paste the contents of `supabase_schema.sql` and run it
3. This creates all tables, indexes, RLS policies, and demo seed data

### 5. Train the ML Model

```bash
python backend/ml/train_model.py
```

Expected output:
```
[Training] Loading dataset...
[Training] 5-Fold CV Accuracy: 0.9432 ± 0.0218
[Training] Test Accuracy: 0.9500
[Training] ✅ Model saved → backend/ml/model.pkl
```

### 6. Start the Backend

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 7. Open the Frontend

Open `frontend/index.html` directly in your browser, or serve it:

```bash
# Simple HTTP server (Python)
python -m http.server 3000 --directory frontend
```

Then visit: **http://localhost:3000**

---

## 🤖 ML Model Details

| Property | Value |
|---|---|
| Algorithm | XGBoost Classifier (fallback: RandomForest) |
| Input Features | Attendance %, Assignment Avg, Midterm, Final Exam, Quiz Avg |
| Output | `Low` / `Medium` / `High` risk + confidence score |
| Explainability | SHAP feature importance per prediction |
| CV Accuracy | ~94–95% (5-fold stratified) |

### Risk Thresholds (Composite Score)

```
Composite = 0.25×Attendance + 0.20×Assignment + 0.25×Midterm + 0.20×Final + 0.10×Quiz

≥ 65  →  Low Risk   🟢
45–64 →  Medium Risk 🟡
< 45  →  High Risk   🔴
```

---

## 🌐 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Create account |
| POST | `/auth/login` | ❌ | Login & get JWT |
| GET | `/students/{id}/performance` | ✅ | Student's full record + prediction |
| GET | `/students/` | ✅ Teacher/Admin | List all students |
| POST | `/students/add` | ✅ Teacher/Admin | Add student record |
| PUT | `/students/{id}/update` | ✅ Teacher/Admin | Update student record |
| DELETE | `/students/{id}` | ✅ Teacher/Admin | Delete student |
| POST | `/predict` | ✅ | Run ML prediction |
| GET | `/dashboard/teacher` | ✅ Teacher | Teacher dashboard data |
| GET | `/dashboard/admin` | ✅ Admin | System-wide stats |
| GET | `/alerts/high-risk` | ✅ Teacher/Admin | High-risk student list |
| POST | `/alerts/notify` | ✅ Admin | Send bulk email alerts |

---

## 🗄️ Database Schema

```
users              → id, name, email, password_hash, role, department
student_records    → id, name, email, academic scores, risk_level, confidence, teacher_id
alerts             → id, student_id, teacher_id, risk_level, email_sent
```

---

## 🚀 Deployment

### Backend (Render)
1. Push to GitHub
2. Create new Render project → Deploy from GitHub repo
3. Set root directory to `backend/`
4. Add all `.env` variables in Render's environment settings
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Frontend
- Host `frontend/` on **Netlify**, **Vercel**, or **GitHub Pages**
- Update `API_BASE` in `frontend/js/auth.js` to your Railway backend URL

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, Tailwind CSS (CDN), Chart.js, Vanilla JS |
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Database | Supabase (PostgreSQL) |
| ML | XGBoost, scikit-learn, SHAP, pandas, joblib |
| Auth | JWT (python-jose), bcrypt (passlib) |
| Email | smtplib (SMTP) |
| Deployment | Render (backend), GitHub Pages / Netlify, Vercel (frontend) |

---

## 📄 License

MIT License — © 2026 Made with ❤️ By Sanjay P S
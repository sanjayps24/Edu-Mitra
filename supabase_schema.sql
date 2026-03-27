-- ============================================================
-- EduMitra — Supabase PostgreSQL Schema
-- Run this in your Supabase SQL Editor to set up all tables.
-- Team: Strategic Minds
-- ============================================================

-- ── 1. Users Table ───────────────────────────────────────────
-- Stores all authenticated users (students, teachers, admins).
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    department    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast login lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ── 2. Student Academic Records Table ────────────────────────
-- Core table for all academic performance data.
CREATE TABLE IF NOT EXISTS student_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    email          TEXT NOT NULL,
    attendance_pct NUMERIC(5,2) NOT NULL CHECK (attendance_pct BETWEEN 0 AND 100),
    assignment_avg NUMERIC(5,2) NOT NULL CHECK (assignment_avg BETWEEN 0 AND 100),
    midterm_score  NUMERIC(5,2) NOT NULL CHECK (midterm_score BETWEEN 0 AND 100),
    final_score    NUMERIC(5,2) NOT NULL CHECK (final_score BETWEEN 0 AND 100),
    quiz_avg       NUMERIC(5,2) DEFAULT 70 CHECK (quiz_avg BETWEEN 0 AND 100),
    semester       TEXT,
    department     TEXT,
    teacher_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    -- ML Prediction results stored alongside record
    risk_level     TEXT CHECK (risk_level IN ('Low', 'Medium', 'High')),
    confidence     NUMERIC(5,4),
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_records_teacher    ON student_records(teacher_id);
CREATE INDEX IF NOT EXISTS idx_records_risk       ON student_records(risk_level);
CREATE INDEX IF NOT EXISTS idx_records_email      ON student_records(email);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON student_records(created_at DESC);

-- ── 3. Alerts Table ───────────────────────────────────────────
-- Tracks which alerts have been sent to which teachers.
CREATE TABLE IF NOT EXISTS alerts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id     UUID REFERENCES student_records(id) ON DELETE CASCADE,
    teacher_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    risk_level     TEXT NOT NULL,
    confidence     NUMERIC(5,4),
    email_sent     BOOLEAN DEFAULT FALSE,
    sent_at        TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_teacher    ON alerts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_alerts_student    ON alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON alerts(created_at DESC);

-- ── 4. Row-Level Security (RLS) ───────────────────────────────
-- Enable RLS so Supabase enforces access policies.

ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts          ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by FastAPI backend)
CREATE POLICY "service_role_all_users"   ON users           FOR ALL USING (true);
CREATE POLICY "service_role_all_records" ON student_records FOR ALL USING (true);
CREATE POLICY "service_role_all_alerts"  ON alerts          FOR ALL USING (true);

-- ── 5. Updated-At Trigger ─────────────────────────────────────
-- Auto-update updated_at timestamp on row changes.

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_records_updated_at
  BEFORE UPDATE ON student_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 6. Seed Demo Data (optional — comment out in production) ──
-- Creates demo accounts for testing all 3 roles.
-- Passwords are bcrypt hashes of "demo123".

INSERT INTO users (name, email, password_hash, role, department) VALUES
  ('Alex Johnson',   'student@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFYdOR5qVrQ/TWa', 'student', 'Computer Science'),
  ('Prof. Sarah Chen','teacher@demo.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFYdOR5qVrQ/TWa', 'teacher', 'Computer Science'),
  ('Admin User',     'admin@demo.com',   '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFYdOR5qVrQ/TWa', 'admin',   'Administration')
ON CONFLICT (email) DO NOTHING;

-- ── 7. Useful Views ───────────────────────────────────────────
-- Summary view for teacher dashboards.
CREATE OR REPLACE VIEW student_summary AS
SELECT
    sr.id,
    sr.name,
    sr.email,
    sr.attendance_pct,
    sr.assignment_avg,
    sr.midterm_score,
    sr.final_score,
    sr.quiz_avg,
    ROUND((sr.midterm_score + sr.final_score) / 2.0, 2) AS exam_avg,
    sr.semester,
    sr.department,
    sr.risk_level,
    sr.confidence,
    sr.teacher_id,
    u.name AS teacher_name,
    sr.created_at,
    sr.updated_at
FROM student_records sr
LEFT JOIN users u ON u.id = sr.teacher_id;

-- System-wide stats view for admin dashboard.
CREATE OR REPLACE VIEW system_stats AS
SELECT
    COUNT(*) FILTER (WHERE role = 'student') AS total_students,
    COUNT(*) FILTER (WHERE role = 'teacher') AS total_teachers,
    COUNT(*) FILTER (WHERE role = 'admin')   AS total_admins
FROM users;

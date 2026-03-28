"""
config.py — Application configuration loaded from environment variables.
Uses python-dotenv to support local .env files.
"""

import os
from dotenv import load_dotenv

# Load .env file using absolute path relative to this script. Use override=True to ensure .env values win.
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path, override=True)

# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", os.getenv("SUPABASE_URL", ""))
# SUPABASE_KEY is kept for potential frontend usage, but not needed for direct Postgres
SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")

# ── JWT ─────────────────────────────────────────────────────────────────────
JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

# ── SMTP / Email ─────────────────────────────────────────────────────────────
SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER: str = os.getenv("SMTP_USER", "")
SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")

# ── App ──────────────────────────────────────────────────────────────────────
APP_NAME: str = os.getenv("APP_NAME", "Edu-Mitra")
DEBUG: bool = os.getenv("DEBUG", "True").lower() == "true"

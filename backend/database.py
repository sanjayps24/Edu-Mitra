"""
database.py — Direct PostgreSQL connection using SQLAlchemy.
Provides engine, SessionLocal, and a FastAPI dependency for DB access.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from config import DATABASE_URL

# Handle potential 'postgres://' vs 'postgresql://' URL mismatch
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLAlchemy initialization
engine = None
SessionLocal = None
Base = declarative_base()

if DATABASE_URL:
    try:
        # Supabase/Postgres often require SSL. Ensure it's handled.
        connect_args = {}
        if "sslmode=require" in DATABASE_URL:
            connect_args["sslmode"] = "require"

        engine = create_engine(
            DATABASE_URL, 
            pool_pre_ping=True,
            pool_recycle=3600,
            connect_args=connect_args
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        # Verify connection and ensure tables exist
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        print("[Database] Connected successfully to PostgreSQL via SQLAlchemy.")
    except Exception as e:
        print(f"[Database] Error: Failed to initialize SQLAlchemy engine: {e}")
else:
    print("[Database] Warning: DATABASE_URL missing. System running in DEMO mode.")

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Mock Supabase object for backward compatibility (placeholder while refactoring)
# In reality, we'll replace all 'supabase' usage with SQLAlchemy session queries.
supabase = None 

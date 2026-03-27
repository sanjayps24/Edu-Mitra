"""
database.py — Supabase client initialization.
Provides a single shared client instance used across all routes.
"""

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY


# Shared client singleton — initialized if keys are present
supabase: Client = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Database] Warning: Failed to connect to Supabase: {e}")
else:
    print("[Database] Warning: SUPABASE_URL/KEY missing. System running in DEMO mode.")

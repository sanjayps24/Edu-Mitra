"""
database.py — Supabase client initialization.
Provides a single shared client instance used across all routes.
"""

from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY


def get_supabase() -> Client:
    """Return an initialized Supabase client."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file."
        )
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# Shared client singleton
supabase: Client = get_supabase() if SUPABASE_URL and SUPABASE_KEY else None

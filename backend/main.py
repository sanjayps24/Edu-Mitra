"""
main.py — FastAPI application entrypoint for Edu-Mitra.
# Last reload triggered at 2026-03-28T05:52:00Z
Registers all routers, configures CORS, and provides a health check endpoint.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from config import APP_NAME, DEBUG
from database import engine, Base
# Import models to ensure they are registered with Base metadata
import database_models

# Import all route modules
from routes.auth_routes import router as auth_router
from routes.student_routes import router as student_router
from routes.predict_routes import router as predict_router
from routes.dashboard_routes import router as dashboard_router
from routes.alert_routes import router as alert_router

# ── App Initialization ────────────────────────────────────────────────────────

app = FastAPI(
    title=f"{APP_NAME} API",
    description="Student Performance Prediction & Monitoring System",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    debug=DEBUG,
)

# ── CORS Configuration ────────────────────────────────────────────────────────
# Allow all origins in development; restrict to your domain in production.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace with specific origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Run database synchronization on startup."""
    try:
        from database import engine, Base
        Base.metadata.create_all(bind=engine)
        print("[Database] Schema synchronized successfully.")
    except Exception as e:
        print(f"[Database] Error during schema sync: {e}")

# ── Register Routers ──────────────────────────────────────────────────────────

app.include_router(auth_router,      prefix="/auth",      tags=["Authentication"])
app.include_router(student_router,   prefix="/students",  tags=["Students"])
app.include_router(predict_router,   prefix="",           tags=["ML Prediction"])
app.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboards"])
app.include_router(alert_router,     prefix="/alerts",    tags=["Alerts"])

# ── Serve Frontend Static Files ───────────────────────────────────────────────
# Serve the frontend folder so the whole app runs from one server.

frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    app.mount("/app", StaticFiles(directory=frontend_path, html=True), name="frontend")


# ── Health Check ──────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    """Health check — confirms the API is running."""
    return {
        "status": "online",
        "app": APP_NAME,
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    """Detailed health check endpoint."""
    return {"status": "healthy", "debug": DEBUG}

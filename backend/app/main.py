"""
PulmoScan AI - FastAPI Backend
AI-assisted pulmonary nodule detection & risk assessment
Research prototype — not a clinical diagnostic system.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.api.routes import cases, health
from app.core.config import settings
from app.core.database import create_tables

app = FastAPI(
    title="PulmoScan AI API",
    description=(
        "AI-assisted pulmonary nodule detection, segmentation, and malignancy risk assessment. "
        "Research prototype — not a clinical diagnostic device."
    ),
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create upload directories on startup
@app.on_event("startup")
async def startup_event():
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.DEMO_DATA_DIR, exist_ok=True)
    create_tables()

# Mount routes
app.include_router(health.router, prefix="/api")
app.include_router(cases.router, prefix="/api")

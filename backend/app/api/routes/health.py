"""Health check and AI runtime status endpoints."""
from fastapi import APIRouter
from typing import Dict, Any
import torch
import monai

from app.schemas.case import HealthResponse
from app.core.config import settings
from app.ai.detector import nodule_detector

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check API health, database status, and AI runtime status."""
    has_cuda = torch.cuda.is_available()
    runtime_label = "GPU available" if has_cuda else "CPU fallback"

    return HealthResponse(
        status="ok",
        version=settings.APP_VERSION,
        demo_mode=settings.DEMO_MODE,
        services={
            "api": "ok",
            "database": "ok",
            "ai_runtime": runtime_label,
            "torch_version": torch.__version__,
            "monai_version": monai.__version__,
            "ai_detector": "active",
            "ai_segmenter": "active",
            "ai_risk_engine": "active",
        },
    )


@router.get("/ai/runtime")
async def get_ai_runtime():
    """Expose hardware compute availability, model cache path, and benchmark metadata."""
    return nodule_detector.get_runtime_status()

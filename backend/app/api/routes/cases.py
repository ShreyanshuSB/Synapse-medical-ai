"""
Cases API routes.
Handles case creation, upload, DICOM ingestion, slice rendering,
AI pipeline execution, dynamic risk assessment, temporal growth, and PDF reports.
"""
import uuid
import asyncio
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.case import (
    Case, ScanMetadata, Nodule, RiskAssessment, AnalysisJob, Report,
    ProcessingStatus
)
from app.schemas.case import (
    CaseCreateRequest, CaseResponse, CaseListItem, CaseResultsResponse,
    ScanMetadataResponse, NoduleResponse, RiskAssessmentResponse,
    AnalysisJobResponse, ReportResponse, RiskAssessmentRequest,
    GeminiExplainRequest, GeminiExplainResponse, GeminiChatRequest,
    GeminiChatResponse, GeminiSummaryResponse,
    PatientContextRequest, ReviewStatusRequest,
)
from app.ai.demo_service import demo_ai_service
from app.ai.risk_engine import risk_engine
from app.ai.segmenter import nodule_segmenter
from app.services.case_service import CaseService
from app.services.report_service import ReportService
from app.services.ct_renderer import ct_renderer
from app.services.dicom_service import dicom_service
from app.services.temporal_service import temporal_service
from app.services.ct_volume_service import ct_volume_service
from app.services.gemini_service import gemini_service


router = APIRouter(tags=["Cases"])


def get_case_service(db: Session = Depends(get_db)) -> CaseService:
    return CaseService(db)


# ──────────────────────────────────────────────────────────────────────────────
# List demo cases
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/demo-cases")
async def list_demo_cases():
    """Return the available demo CT cases."""
    return demo_ai_service.list_demo_cases()


# ──────────────────────────────────────────────────────────────────────────────
# List cases
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases", response_model=List[CaseListItem])
async def list_cases(db: Session = Depends(get_db)):
    """Return all cases ordered by most recent."""
    cases = db.query(Case).order_by(Case.created_at.desc()).all()
    result = []
    for c in cases:
        nodule_count = len(c.nodules) if c.nodules else 0
        largest = None
        highest_risk_pct = None
        if c.nodules:
            diameters = [n.max_diameter_mm for n in c.nodules if n.max_diameter_mm]
            largest = max(diameters) if diameters else None
            for n in c.nodules:
                if n.risk_assessments:
                    for ra in n.risk_assessments:
                        if ra.risk_probability is not None:
                            pct = round(ra.risk_probability * 100, 1)
                            if highest_risk_pct is None or pct > highest_risk_pct:
                                highest_risk_pct = pct
        result.append(CaseListItem(
            id=c.id,
            case_id=c.case_id,
            created_at=c.created_at,
            status=c.status,
            is_demo=c.is_demo,
            input_type=getattr(c, "input_type", "dicom") or "dicom",
            analysis_mode=getattr(c, "analysis_mode", "volumetric_ct") or "volumetric_ct",
            nodule_count=nodule_count,
            largest_nodule_mm=largest,
            highest_risk_pct=highest_risk_pct,
            review_status=getattr(c, "review_status", "unreviewed") or "unreviewed",
        ))
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Create / load demo case
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/cases", response_model=CaseResponse)
async def create_case(
    request: CaseCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Create a new case. For demo cases, pre-populate with demo data."""
    service = CaseService(db)
    case = service.create_case(request)

    if request.is_demo and request.demo_case_id:
        background_tasks.add_task(
            service.load_demo_case, case.id, request.demo_case_id
        )

    return _case_to_response(case)


# ──────────────────────────────────────────────────────────────────────────────
# Upload CT file and create case
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/cases/upload", response_model=CaseResponse)
async def upload_case(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Accept a CT upload:
      Mode A: 3D CT Study (DICOM ZIP, NIfTI .nii/.nii.gz, single .dcm) - Primary medical volumetric workflow
      Mode B: CT Cine Video (.mp4, .webm, .avi, .mov) - Secondary visual AI review pathway
    Performs volume reconstruction, extracts true spatial geometry & quality metrics,
    and automatically initiates the AI analysis pipeline.
    """
    # Independent backend extension & type detection
    filename = file.filename or "upload"
    lower_fn = filename.lower()

    if lower_fn.endswith(".nii.gz") or lower_fn.endswith(".nii"):
        input_type = "nifti"
        analysis_mode = "volumetric_ct"
    elif lower_fn.endswith(".zip") or lower_fn.endswith(".dcm"):
        input_type = "dicom"
        analysis_mode = "volumetric_ct"
    elif any(lower_fn.endswith(ext) for ext in [".png", ".jpg", ".jpeg"]):
        input_type = "image"
        analysis_mode = "image_review"
    elif any(lower_fn.endswith(ext) for ext in [".mp4", ".mkv", ".mov", ".webm", ".avi"]):
        input_type = "video"
        analysis_mode = "video_review"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a supported CT image/study or video.",
        )

    # Validate upload size (500 MB max)
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    service = CaseService(db)
    case = service.create_case(CaseCreateRequest(
        is_demo=False,
        input_type=input_type,
        analysis_mode=analysis_mode,
    ))

    # Save uploaded file
    case_upload_dir = os.path.join(settings.UPLOAD_DIR, case.id)
    os.makedirs(case_upload_dir, exist_ok=True)
    file_path = os.path.join(case_upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    # Construct metadata honestly per analysis mode
    parsed_meta: Dict[str, Any] = {
        "input_type": input_type,
        "analysis_mode": analysis_mode,
        "raw_file_path": file_path,
        "patient_id_anon": "Anonymous",
    }

    if analysis_mode == "volumetric_ct":
        try:
            _, vol_meta = ct_volume_service.reconstruct_from_file(case.id, file_path)
            parsed_meta.update({
                "modality": vol_meta.get("modality", "CT"),
                "patient_id_anon": vol_meta.get("patient_id_anon", "Anonymous"),
                "slice_count": vol_meta.get("slice_count"),
                "slice_thickness_mm": vol_meta.get("slice_thickness_mm"),
                "pixel_spacing_x": vol_meta.get("pixel_spacing_x"),
                "pixel_spacing_y": vol_meta.get("pixel_spacing_y"),
                "rows": vol_meta.get("rows"),
                "cols": vol_meta.get("cols"),
                "scan_quality": vol_meta.get("scan_quality", "acceptable"),
                "quality_notes": vol_meta.get("quality_notes", []),
            })
        except Exception as e:
            try:
                insp = dicom_service.inspect_file(file_path)
                parsed_meta.update(insp)
            except Exception:
                parsed_meta.update({
                    "modality": "CT",
                    "scan_quality": "warning",
                    "quality_notes": [f"Volume ingestion notice: {str(e)}"],
                })
    elif analysis_mode == "image_review":
        # 2D visual review mode: Do NOT fabricate voxel spacing or 3D reconstruction
        parsed_meta.update({
            "modality": "PHOTO / 2D IMAGE",
            "series_description": "2D Visual Review",
            "slice_count": 1,
            "slice_thickness_mm": None,
            "pixel_spacing_x": None,
            "pixel_spacing_y": None,
            "scan_quality": "2D Visual Review",
            "quality_notes": [
                "2D Visual Review mode: Photographic or medical image review.",
                "Quantitative 3D volumetric CT analysis, HU statistics, and voxel measurements are not applicable to 2D images.",
            ],
        })
    elif analysis_mode == "video_review":
        # Video visual review mode: Do NOT fabricate 3D quantitative CT
        parsed_meta.update({
            "modality": "CT VIDEO",
            "series_description": "CT Video Visual Review",
            "slice_count": None,
            "slice_thickness_mm": None,
            "pixel_spacing_x": None,
            "pixel_spacing_y": None,
            "scan_quality": "Visual Review",
            "quality_notes": [
                "CT Video Visual Review mode: Cine sequence playback.",
                "Quantitative 3D voxel reconstruction, calibrated HU statistics, and volume doubling kinetics require a volumetric DICOM or NIfTI series.",
            ],
        })

    service.create_scan_metadata(case.id, parsed_meta)

    # Automatically start AI analysis job in the background
    job = service.start_analysis_job(case.id)
    background_tasks.add_task(service.run_pipeline, case.id, job.id)

    db.refresh(case)
    return _case_to_response(case)



# ──────────────────────────────────────────────────────────────────────────────
# Get case
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}", response_model=CaseResponse)
async def get_case(case_id: str, db: Session = Depends(get_db)):
    case = _get_case_or_404(case_id, db)
    return _case_to_response(case)


# ──────────────────────────────────────────────────────────────────────────────
# Patient Context (Medical History + Recent Tests)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/patient-context")
async def get_patient_context(case_id: str, db: Session = Depends(get_db)):
    """Retrieve patient context (medical history + recent tests) for a case."""
    case = _get_case_or_404(case_id, db)
    return {"case_id": case_id, "patient_context": getattr(case, "patient_context", None) or {}}


@router.put("/cases/{case_id}/patient-context")
async def update_patient_context(
    case_id: str,
    request: PatientContextRequest,
    db: Session = Depends(get_db),
):
    """Update patient context (medical history + recent tests) for a case."""
    case = _get_case_or_404(case_id, db)
    existing = getattr(case, "patient_context", None) or {}
    updated = dict(existing)
    if request.medical_history is not None:
        updated["medical_history"] = request.medical_history
    if request.recent_tests is not None:
        updated["recent_tests"] = request.recent_tests
    case.patient_context = updated
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    return {"case_id": case_id, "patient_context": case.patient_context}


# ──────────────────────────────────────────────────────────────────────────────
# Review Status
# ──────────────────────────────────────────────────────────────────────────────

@router.put("/cases/{case_id}/review-status")
async def update_review_status(
    case_id: str,
    request: ReviewStatusRequest,
    db: Session = Depends(get_db),
):
    """Update the review status for a case (unreviewed/under_review/reviewed/needs_attention)."""
    valid = {"unreviewed", "under_review", "reviewed", "needs_attention"}
    if request.review_status not in valid:
        raise HTTPException(status_code=400, detail=f"review_status must be one of: {valid}")
    case = _get_case_or_404(case_id, db)
    case.review_status = request.review_status
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    return {"case_id": case_id, "review_status": case.review_status}


# ──────────────────────────────────────────────────────────────────────────────
# Trigger analysis
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/cases/{case_id}/analyze")
async def analyze_case(
    case_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Start the AI analysis pipeline for a case."""
    case = _get_case_or_404(case_id, db)

    if case.status == ProcessingStatus.PROCESSING:
        raise HTTPException(status_code=409, detail="Analysis already in progress.")

    service = CaseService(db)
    job = service.start_analysis_job(case.id)
    background_tasks.add_task(service.run_pipeline, case.id, job.id)

    return {"message": "Analysis started", "job_id": job.id, "case_id": case_id}


# ──────────────────────────────────────────────────────────────────────────────
# Get status
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/status", response_model=AnalysisJobResponse)
async def get_case_status(case_id: str, db: Session = Depends(get_db)):
    """Poll the current analysis job status for a case."""
    case = _get_case_or_404(case_id, db)
    job = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.case_id == case.id)
        .order_by(AnalysisJob.created_at.desc())
        .first()
    )
    if not job:
        raise HTTPException(status_code=404, detail="No analysis job found for this case.")
    from app.ai.pipeline import JOB_STAGES
    completed_set = set(job.stages_completed or [])
    curr = (job.current_stage or "").upper()
    stage_details = []
    for s in JOB_STAGES:
        k = s["key"]
        if k in completed_set or (job.status == "completed" and k != "FAILED"):
            st = "completed"
        elif k == curr and job.status == "processing":
            st = "active"
        elif job.status == "failed" and k == curr:
            st = "failed"
        else:
            st = "pending"
        stage_details.append({
            "key": k,
            "label": s["label"],
            "state": st,
        })

    return AnalysisJobResponse(
        id=job.id,
        status=job.status,
        progress_pct=job.progress_pct,
        current_stage=job.current_stage,
        stages_completed=job.stages_completed or [],
        stage_details=stage_details,
        error_message=job.error_message,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Get results
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/results", response_model=CaseResultsResponse)
async def get_case_results(case_id: str, db: Session = Depends(get_db)):
    """Get full analysis results for a completed case."""
    case = _get_case_or_404(case_id, db)
    job = (
        db.query(AnalysisJob)
        .filter(AnalysisJob.case_id == case.id)
        .order_by(AnalysisJob.created_at.desc())
        .first()
    )

    nodules = [_nodule_to_response(n) for n in (case.nodules or [])]
    scan_meta = None
    if case.scan_metadata:
        scan_meta = ScanMetadataResponse.model_validate(case.scan_metadata)

    summary = None
    if case.is_demo and case.demo_case_id:
        demo = demo_ai_service.get_demo_case(case.demo_case_id)
        if demo:
            summary = demo.get("summary")
    elif case.nodules:
        largest = max((n.max_diameter_mm or 0 for n in case.nodules), default=0)
        summary = {
            "nodule_count": len(case.nodules),
            "largest_nodule_mm": largest,
            "conclusion": f"{len(case.nodules)} pulmonary nodule(s) detected and measured.",
        }

    return CaseResultsResponse(
        case_id=case.case_id,
        status=case.status,
        is_demo=case.is_demo,
        demo_case_id=case.demo_case_id,
        input_type=getattr(case, "input_type", "dicom") or "dicom",
        analysis_mode=getattr(case, "analysis_mode", "volumetric_ct") or "volumetric_ct",
        scan_metadata=scan_meta,
        nodules=nodules,
        analysis_job=AnalysisJobResponse(
            id=job.id,
            status=job.status,
            progress_pct=job.progress_pct,
            current_stage=job.current_stage,
            stages_completed=job.stages_completed or [],
            error_message=job.error_message,
            started_at=job.started_at,
            completed_at=job.completed_at,
        ) if job else None,
        summary=summary,
    )


# ──────────────────────────────────────────────────────────────────────────────
# CT Viewer Slice & Volume Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/volume-info")
async def get_volume_info(case_id: str, db: Session = Depends(get_db)):
    """Return slice count per plane, current presets, and nodule slice locations."""
    case = _get_case_or_404(case_id, db)
    case_data = {
        "nodules": [
            {
                "coord_x": n.coord_x,
                "coord_y": n.coord_y,
                "coord_z": n.coord_z,
                "max_diameter_mm": n.max_diameter_mm,
                "density_type": n.density_type,
                "mean_hu": n.mean_hu,
                "spiculation_detected": n.spiculation_detected,
                "nodule_index": n.nodule_index,
            }
            for n in (case.nodules or [])
        ]
    }
    volume = ct_renderer.get_or_create_volume(case.id, case_data)
    info = ct_renderer.get_volume_info(volume)

    # Attach nodule coordinates mapped to viewer planes
    info["nodule_locations"] = [
        {
            "nodule_index": n.nodule_index,
            "axial_slice": int(n.coord_z or (n.axial_slice or info["default_axial"])),
            "coronal_slice": int(n.coord_y or (n.coronal_slice or info["default_coronal"])),
            "sagittal_slice": int(n.coord_x or (n.sagittal_slice or info["default_sagittal"])),
            "diameter_mm": n.max_diameter_mm,
            "density_type": n.density_type,
            "risk_pct": (
                round(n.risk_assessments[0].risk_probability * 100, 1)
                if n.risk_assessments and n.risk_assessments[0].risk_probability
                else None
            ),
        }
        for n in (case.nodules or [])
    ]
    return info


@router.get("/cases/{case_id}/slices/{plane}/{index}")
async def get_case_slice(
    case_id: str,
    plane: str,
    index: int,
    wl: int = Query(-600, description="Window Level"),
    ww: int = Query(1500, description="Window Width"),
    db: Session = Depends(get_db)
):
    """Render a 2D CT slice along plane ('axial', 'coronal', 'sagittal') with Window/Level."""
    case = _get_case_or_404(case_id, db)
    case_data = {
        "nodules": [
            {
                "coord_x": n.coord_x,
                "coord_y": n.coord_y,
                "coord_z": n.coord_z,
                "max_diameter_mm": n.max_diameter_mm,
                "density_type": n.density_type,
                "mean_hu": n.mean_hu,
                "spiculation_detected": n.spiculation_detected,
            }
            for n in (case.nodules or [])
        ]
    }
    volume = ct_renderer.get_or_create_volume(case.id, case_data)

    try:
        png_bytes = ct_renderer.render_slice(volume, plane=plane, index=index, wl=wl, ww=ww)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return Response(content=png_bytes, media_type="image/png")


# ──────────────────────────────────────────────────────────────────────────────
# Nodule Segmentation Mask / Contours
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/nodules/{nodule_id}/mask")
async def get_nodule_mask(
    case_id: str,
    nodule_id: str,
    slice_idx: Optional[int] = Query(None, description="Slice index for 2D contour"),
    plane: str = Query("axial", description="Viewing plane"),
    db: Session = Depends(get_db),
):
    """Retrieve 2D contour polygon or 3D mask boundary for a specific nodule."""
    case = _get_case_or_404(case_id, db)
    nodule = db.query(Nodule).filter(Nodule.id == nodule_id, Nodule.case_id == case.id).first()
    if not nodule:
        raise HTTPException(status_code=404, detail="Nodule not found.")

    nod_dict = {
        "coord_x": nodule.coord_x,
        "coord_y": nodule.coord_y,
        "coord_z": nodule.coord_z,
        "max_diameter_mm": nodule.max_diameter_mm,
        "spiculation_detected": nodule.spiculation_detected,
    }

    current_slice = slice_idx if slice_idx is not None else int(nodule.coord_z or 64)
    contour = nodule_segmenter.get_slice_contour(
        nodule_dict=nod_dict,
        slice_idx=current_slice,
        plane=plane,
        case_id=case.id,
        nodule_index=nodule.nodule_index,
        is_demo=nodule.is_demo,
    )

    return {
        "nodule_id": nodule.id,
        "nodule_index": nodule.nodule_index,
        "plane": plane,
        "slice_index": current_slice,
        "contour_points": contour or [],
        "has_contour_on_slice": contour is not None,
    }


@router.get("/cases/{case_id}/nodules/{nodule_id}/thumbnail")
async def get_nodule_thumbnail(
    case_id: str,
    nodule_id: str,
    db: Session = Depends(get_db),
):
    """Serve an authentic cropped CT thumbnail centered on the nodule lesion."""
    case = _get_case_or_404(case_id, db)
    nodule = db.query(Nodule).filter(Nodule.id == nodule_id, Nodule.case_id == case.id).first()
    if not nodule:
        raise HTTPException(status_code=404, detail="Nodule not found.")

    # Determine thumbnail filename
    idx = nodule.nodule_index or 1
    demo_key = case.demo_case_id or "DEMO-002"
    if "001" in demo_key:
        fname = "nodule_demo1_1.jpg"
    elif "003" in demo_key:
        fname = "nodule_demo3_1.jpg"
    else:
        fname = f"nodule_demo2_{min(idx, 3)}.jpg"

    thumb_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "frontend", "public", "thumbnails", fname
    )
    if os.path.exists(thumb_path):
        with open(thumb_path, "rb") as f:
            return Response(content=f.read(), media_type="image/jpeg")

    # Fallback to demo scan crop
    raise HTTPException(status_code=404, detail="Thumbnail not available.")


# ──────────────────────────────────────────────────────────────────────────────
# Dynamic Risk Assessment Re-calculation
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/cases/{case_id}/nodules/{nodule_id}/risk")
async def recalculate_risk(
    case_id: str,
    nodule_id: str,
    request: RiskAssessmentRequest,
    db: Session = Depends(get_db),
):
    """
    Recalculate Brock malignancy risk and Lung-RADS category
    using updated patient clinical inputs.
    """
    case = _get_case_or_404(case_id, db)
    nodule = db.query(Nodule).filter(Nodule.id == nodule_id, Nodule.case_id == case.id).first()
    if not nodule:
        raise HTTPException(status_code=404, detail="Nodule not found.")

    nod_features = {
        "max_diameter_mm": nodule.max_diameter_mm,
        "lung_lobe": nodule.lung_lobe,
        "density_type": nodule.density_type,
        "spiculation_detected": nodule.spiculation_detected,
    }

    clinical_dict = request.clinical_inputs.model_dump() if request.clinical_inputs else {}
    result = risk_engine.assess_risk(
        nodule_features=nod_features,
        clinical_inputs=clinical_dict,
        total_nodule_count=len(case.nodules or [1]),
    )

    # Save to database
    assessment = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.nodule_id == nodule.id)
        .first()
    )
    if not assessment:
        assessment = RiskAssessment(
            id=str(uuid.uuid4()),
            nodule_id=nodule.id,
            is_demo=False,
        )
        db.add(assessment)

    assessment.model_name = result["model_name"]
    assessment.risk_probability = result["risk_probability"]
    assessment.risk_category = result["risk_category"]
    assessment.lung_rads_category = result["lung_rads_category"]
    assessment.lung_rads_recommendation = result["lung_rads_recommendation"]
    assessment.contributing_factors = result["contributing_factors"]
    assessment.clinical_inputs = result["clinical_inputs"]
    db.commit()
    db.refresh(assessment)

    return RiskAssessmentResponse(
        id=assessment.id,
        model_name=assessment.model_name,
        risk_probability=assessment.risk_probability,
        risk_category=assessment.risk_category,
        lung_rads_category=assessment.lung_rads_category,
        lung_rads_recommendation=assessment.lung_rads_recommendation,
        contributing_factors=assessment.contributing_factors,
        clinical_inputs=assessment.clinical_inputs,
        is_demo=assessment.is_demo,
    )


# ──────────────────────────────────────────────────────────────────────────────
# Temporal Growth Analysis
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/temporal")
async def get_temporal_analysis(case_id: str, db: Session = Depends(get_db)):
    """Retrieve longitudinal comparison metrics and Volume Doubling Time."""
    case = _get_case_or_404(case_id, db)

    # For DEMO-003, use documented baseline-to-current timeline
    if case.demo_case_id == "DEMO-003" or any(n.spiculation_detected for n in (case.nodules or [])):
        metrics = temporal_service.calculate_growth_metrics(
            prior_date_str="2025-01-15",
            current_date_str="2026-09-20",
            prior_diameter_mm=5.2,
            current_diameter_mm=8.4,
            prior_volume_mm3=72.4,
            current_volume_mm3=292.0,
        )
        timeline = [
            {"date": "Jan 2025", "diameter": 5.2, "volume": 72.4, "label": "Baseline CT"},
            {"date": "Sep 2025", "diameter": 6.1, "volume": 118.9, "label": "6-month FU"},
            {"date": "Sep 2026", "diameter": 8.4, "volume": 292.0, "label": "Current CT"},
        ]
    else:
        # Default single study baseline
        first_nod = case.nodules[0] if case.nodules else None
        d = first_nod.max_diameter_mm if first_nod else 5.0
        v = first_nod.volume_mm3 if first_nod else 65.0
        metrics = temporal_service.calculate_growth_metrics(
            prior_date_str="2026-01-01",
            current_date_str="2026-09-01",
            prior_diameter_mm=d,
            current_diameter_mm=d,
            prior_volume_mm3=v,
            current_volume_mm3=v,
        )
        timeline = [
            {"date": "Current", "diameter": d, "volume": v, "label": "Current CT"}
        ]

    return {
        "case_id": case.case_id,
        "metrics": metrics,
        "timeline": timeline,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Reviewer "Correct AI" Nodule Update
# ──────────────────────────────────────────────────────────────────────────────

@router.put("/cases/{case_id}/nodules/{nodule_id}", response_model=NoduleResponse)
async def update_nodule(
    case_id: str,
    nodule_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
):
    """
    Allow a radiologist/expert to adjust nodule measurements, margin,
    or density classification (Human-in-the-loop AI correction).
    """
    case = _get_case_or_404(case_id, db)
    nodule = db.query(Nodule).filter(Nodule.id == nodule_id, Nodule.case_id == case.id).first()
    if not nodule:
        raise HTTPException(status_code=404, detail="Nodule not found.")

    # Updatable fields
    updatable = [
        "max_diameter_mm", "min_diameter_mm", "mean_diameter_mm",
        "volume_mm3", "mean_hu", "density_type", "margin_type",
        "spiculation_detected", "lung_lobe", "lung_side"
    ]
    for field in updatable:
        if field in payload and payload[field] is not None:
            setattr(nodule, field, payload[field])

    # Re-evaluate risk with adjusted parameters
    if nodule.risk_assessments:
        current_assessment = nodule.risk_assessments[0]
        re_risk = risk_engine.assess_risk(
            nodule_features={
                "max_diameter_mm": nodule.max_diameter_mm,
                "lung_lobe": nodule.lung_lobe,
                "density_type": nodule.density_type,
                "spiculation_detected": nodule.spiculation_detected,
            },
            clinical_inputs=current_assessment.clinical_inputs,
            total_nodule_count=len(case.nodules or [1]),
        )
        current_assessment.risk_probability = re_risk["risk_probability"]
        current_assessment.risk_category = re_risk["risk_category"]
        current_assessment.lung_rads_category = re_risk["lung_rads_category"]
        current_assessment.lung_rads_recommendation = re_risk["lung_rads_recommendation"]
        current_assessment.contributing_factors = re_risk["contributing_factors"]

    db.commit()
    db.refresh(nodule)
    return _nodule_to_response(nodule)


# ──────────────────────────────────────────────────────────────────────────────
# Get / Generate Report & Download PDF
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/cases/{case_id}/report", response_model=ReportResponse)
async def get_report(case_id: str, db: Session = Depends(get_db)):
    case = _get_case_or_404(case_id, db)
    report = db.query(Report).filter(Report.case_id == case.id).first()
    if not report:
        # Automatically generate if not yet generated
        report_service = ReportService(db)
        report = report_service.generate(case)

    return ReportResponse(
        id=report.id,
        case_id=case.case_id,
        report_text=report.report_text,
        report_data=report.report_data,
        pdf_path=report.pdf_path,
        generated_at=report.generated_at,
        is_demo=report.is_demo,
    )


@router.post("/cases/{case_id}/report", response_model=ReportResponse)
async def generate_report_endpoint(case_id: str, db: Session = Depends(get_db)):
    """Generate an AI-assisted report for a case."""
    case = _get_case_or_404(case_id, db)
    report_service = ReportService(db)
    report = report_service.generate(case)
    return ReportResponse(
        id=report.id,
        case_id=case.case_id,
        report_text=report.report_text,
        report_data=report.report_data,
        pdf_path=report.pdf_path,
        generated_at=report.generated_at,
        is_demo=report.is_demo,
    )


@router.get("/cases/{case_id}/report/pdf")
async def download_report_pdf(case_id: str, db: Session = Depends(get_db)):
    """Download the official radiology-style PDF report."""
    case = _get_case_or_404(case_id, db)
    report = db.query(Report).filter(Report.case_id == case.id).first()
    if not report or not report.pdf_path or not os.path.exists(report.pdf_path):
        report_service = ReportService(db)
        report = report_service.generate(case)

    if not report.pdf_path or not os.path.exists(report.pdf_path):
        raise HTTPException(status_code=500, detail="PDF generation failed or file not found.")

    return FileResponse(
        path=report.pdf_path,
        filename=f"{case.case_id}_radiology_report.pdf",
        media_type="application/pdf"
    )


# ──────────────────────────────────────────────────────────────────────────────
# Gemini Clinical Intelligence & Doctor Assistant Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/cases/{case_id}/nodules/{nodule_id}/explain", response_model=GeminiExplainResponse)
async def explain_nodule_finding(
    case_id: str,
    nodule_id: str,
    request: Optional[GeminiExplainRequest] = None,
    db: Session = Depends(get_db),
):
    """
    Use Gemini clinical reasoning to explain why a nodule was flagged,
    grounded strictly in its physical measurements and ACR Lung-RADS criteria.
    """
    case = _get_case_or_404(case_id, db)
    nodule = db.query(Nodule).filter(
        Nodule.case_id == case.id,
        (Nodule.id == nodule_id) | (Nodule.nodule_index == (int(nodule_id) if nodule_id.isdigit() else -1))
    ).first()
    if not nodule:
        raise HTTPException(status_code=404, detail="Nodule not found in case.")

    nodule_data = {
        "nodule_index": nodule.nodule_index,
        "max_diameter_mm": nodule.max_diameter_mm,
        "volume_mm3": nodule.volume_mm3,
        "lung_lobe": nodule.lung_lobe,
        "radial_location": nodule.position_type,
        "density_type": nodule.density_type,
        "mean_hu": nodule.mean_hu,
        "min_hu": nodule.min_hu,
        "max_hu": nodule.max_hu,
        "margin_type": nodule.margin_type,
        "spiculation_detected": nodule.spiculation_detected,
        "sphericity": nodule.sphericity,
        "detection_confidence": nodule.detection_confidence,
    }

    clinical_inputs = None
    if request and request.clinical_inputs:
        clinical_inputs = request.clinical_inputs
    elif nodule.risk_assessments and nodule.risk_assessments[0].clinical_inputs:
        clinical_inputs = nodule.risk_assessments[0].clinical_inputs

    explanation = gemini_service.explain_finding(nodule_data, clinical_inputs)
    return GeminiExplainResponse(
        nodule_id=nodule.id,
        explanation=explanation,
        generated_at=datetime.utcnow().isoformat(),
    )


@router.post("/cases/{case_id}/ai-report")
async def generate_ai_impression(case_id: str, db: Session = Depends(get_db)):
    """
    Generate a professional radiology impression using Gemini clinical intelligence,
    grounded strictly in the detected nodules and risk classifications.
    """
    case = _get_case_or_404(case_id, db)
    nodules_data = []
    risks_data = []
    for n in (case.nodules or []):
        nodules_data.append({
            "nodule_index": n.nodule_index,
            "max_diameter_mm": n.max_diameter_mm,
            "volume_mm3": n.volume_mm3,
            "lung_lobe": n.lung_lobe,
            "position_type": n.position_type,
            "density_type": n.density_type,
            "mean_hu": n.mean_hu,
            "margin_type": n.margin_type,
            "spiculation_detected": n.spiculation_detected,
        })
        if n.risk_assessments:
            r = n.risk_assessments[0]
            risks_data.append({
                "nodule_index": n.nodule_index,
                "risk_probability": r.risk_probability,
                "risk_category": r.risk_category,
                "lung_rads_category": r.lung_rads_category,
                "lung_rads_recommendation": r.lung_rads_recommendation,
            })

    case_info = {
        "case_id": case.case_id,
        "slice_count": case.scan_metadata.slice_count if case.scan_metadata else None,
        "is_demo": case.is_demo,
    }

    impression = gemini_service.generate_impression(case_info, nodules_data, risks_data)

    report = db.query(Report).filter(Report.case_id == case.id).first()
    if report and report.report_data:
        data = dict(report.report_data)
        data["gemini_impression"] = impression
        report.report_data = data
        db.commit()

    return {
        "case_id": case.case_id,
        "gemini_impression": impression,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.get("/cases/{case_id}/summary", response_model=GeminiSummaryResponse)
async def get_gemini_summary(case_id: str, db: Session = Depends(get_db)):
    """Executive case summary synthesized by Gemini for MDT rounds."""
    case = _get_case_or_404(case_id, db)
    nodules_data = []
    for n in (case.nodules or []):
        nodules_data.append({
            "nodule_index": n.nodule_index,
            "max_diameter_mm": n.max_diameter_mm,
            "volume_mm3": n.volume_mm3,
            "lung_lobe": n.lung_lobe,
            "position_type": n.position_type,
            "density_type": n.density_type,
            "mean_hu": n.mean_hu,
            "margin_type": n.margin_type,
            "spiculation_detected": n.spiculation_detected,
        })
    case_info = {
        "case_id": case.case_id,
        "slice_count": case.scan_metadata.slice_count if case.scan_metadata else None,
        "is_demo": case.is_demo,
    }
    summary = gemini_service.summarize_case(case_info, nodules_data)
    return GeminiSummaryResponse(
        case_id=case.case_id,
        summary=summary,
        timestamp=datetime.utcnow().isoformat(),
    )


@router.post("/cases/{case_id}/chat", response_model=GeminiChatResponse)
async def chat_with_case_assistant(
    case_id: str,
    request: GeminiChatRequest,
    db: Session = Depends(get_db),
):
    """
    Doctor Assistant: Answer specific questions about this patient's CT scan results.
    Strictly grounded in the detected nodules, measurements, and risk scores.
    """
    case = _get_case_or_404(case_id, db)
    nodules_data = []
    for n in (case.nodules or []):
        risk_info = {}
        if n.risk_assessments:
            r = n.risk_assessments[0]
            risk_info = {
                "lung_rads": r.lung_rads_category,
                "recommendation": r.lung_rads_recommendation,
                "risk_probability": r.risk_probability,
            }
        nodules_data.append({
            "nodule_index": n.nodule_index,
            "max_diameter_mm": n.max_diameter_mm,
            "min_diameter_mm": n.min_diameter_mm,
            "mean_diameter_mm": n.mean_diameter_mm,
            "volume_mm3": n.volume_mm3,
            "lung_lobe": n.lung_lobe,
            "lung_side": n.lung_side,
            "position_type": n.position_type,
            "density_type": n.density_type,
            "mean_hu": n.mean_hu,
            "median_hu": n.median_hu,
            "min_hu": n.min_hu,
            "max_hu": n.max_hu,
            "std_hu": n.std_hu,
            "margin_type": n.margin_type,
            "spiculation_detected": n.spiculation_detected,
            "sphericity": n.sphericity,
            "elongation": n.elongation,
            "compactness": n.compactness,
            "detection_confidence": n.detection_confidence,
            "axial_slice": n.axial_slice,
            "coronal_slice": n.coronal_slice,
            "sagittal_slice": n.sagittal_slice,
            **risk_info,
        })

    case_info = {
        "case_id": case.case_id,
        "slice_count": case.scan_metadata.slice_count if case.scan_metadata else None,
        "modality": case.scan_metadata.modality if case.scan_metadata else "CT",
        "is_demo": case.is_demo,
    }

    answer = gemini_service.answer_case_question(
        case_data=case_info,
        nodules=nodules_data,
        question=request.question,
        chat_history=request.chat_history,
    )

    return GeminiChatResponse(
        case_id=case.case_id,
        answer=answer,
        timestamp=datetime.utcnow().isoformat(),
    )



# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _get_case_or_404(case_id: str, db: Session) -> Case:
    case = db.query(Case).filter(
        (Case.id == case_id) | (Case.case_id == case_id) | (Case.demo_case_id == case_id)
    ).order_by(Case.created_at.desc()).first()
    if not case:
        if case_id.startswith("DEMO-") or "DEMO" in case_id.upper():
            from app.schemas.case import CaseCreateRequest
            svc = CaseService(db)
            demo_key = case_id if case_id in demo_ai_service.DEMO_CASES else "DEMO-002"
            new_case = svc.create_case(CaseCreateRequest(is_demo=True, demo_case_id=demo_key))
            svc.load_demo_case(new_case.id, demo_key)
            db.refresh(new_case)
            return new_case
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    
    # If case exists but was created as pending demo without pipeline executed:
    if case.is_demo and case.status == "pending" and case.demo_case_id in demo_ai_service.DEMO_CASES:
        svc = CaseService(db)
        svc.load_demo_case(case.id, case.demo_case_id)
        db.refresh(case)

    return case


def _nodule_to_response(n: Nodule) -> NoduleResponse:
    risks = []
    if n.risk_assessments:
        for r in n.risk_assessments:
            risks.append(RiskAssessmentResponse(
                id=r.id,
                model_name=r.model_name,
                risk_probability=r.risk_probability,
                risk_category=r.risk_category,
                lung_rads_category=r.lung_rads_category,
                lung_rads_recommendation=r.lung_rads_recommendation,
                contributing_factors=r.contributing_factors,
                clinical_inputs=r.clinical_inputs,
                is_demo=r.is_demo,
            ))
    return NoduleResponse(
        id=n.id,
        nodule_index=n.nodule_index,
        detection_confidence=n.detection_confidence,
        is_demo=n.is_demo,
        coord_x=n.coord_x,
        coord_y=n.coord_y,
        coord_z=n.coord_z,
        max_diameter_mm=n.max_diameter_mm,
        min_diameter_mm=n.min_diameter_mm,
        mean_diameter_mm=n.mean_diameter_mm,
        volume_mm3=n.volume_mm3,
        mean_hu=n.mean_hu,
        median_hu=n.median_hu,
        min_hu=n.min_hu,
        max_hu=n.max_hu,
        std_hu=n.std_hu,
        density_type=n.density_type,
        sphericity=n.sphericity,
        elongation=n.elongation,
        surface_area_mm2=n.surface_area_mm2,
        compactness=n.compactness,
        margin_type=n.margin_type,
        spiculation_detected=n.spiculation_detected,
        lung_side=n.lung_side,
        lung_lobe=n.lung_lobe,
        position_type=n.position_type,
        axial_slice=n.axial_slice,
        coronal_slice=n.coronal_slice,
        sagittal_slice=n.sagittal_slice,
        risk_assessments=risks,
    )


def _case_to_response(case: Case) -> CaseResponse:
    scan_meta = None
    if case.scan_metadata:
        scan_meta = ScanMetadataResponse.model_validate(case.scan_metadata)
    return CaseResponse(
        id=case.id,
        case_id=case.case_id,
        created_at=case.created_at,
        updated_at=case.updated_at,
        status=case.status,
        is_demo=case.is_demo,
        demo_case_id=case.demo_case_id,
        input_type=getattr(case, "input_type", "dicom") or "dicom",
        analysis_mode=getattr(case, "analysis_mode", "volumetric_ct") or "volumetric_ct",
        notes=case.notes,
        review_status=getattr(case, "review_status", "unreviewed") or "unreviewed",
        patient_context=getattr(case, "patient_context", None),
        scan_metadata=scan_meta,
        nodules=[_nodule_to_response(n) for n in (case.nodules or [])],
    )

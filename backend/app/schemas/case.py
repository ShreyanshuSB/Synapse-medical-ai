"""Pydantic schemas for API request/response validation."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class ProcessingStatusEnum(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"


class DensityTypeEnum(str, Enum):
    SOLID = "solid"
    PART_SOLID = "part_solid"
    GROUND_GLASS = "ground_glass"
    CALCIFIED = "calcified"
    UNKNOWN = "unknown"


class LungSideEnum(str, Enum):
    LEFT = "left"
    RIGHT = "right"
    UNKNOWN = "unknown"


class LungLobeEnum(str, Enum):
    RUL = "RUL"
    RML = "RML"
    RLL = "RLL"
    LUL = "LUL"
    LLL = "LLL"
    UNKNOWN = "unknown"


# ──────────────────────────────────────────────────────────────────────────────
# Scan Metadata
# ──────────────────────────────────────────────────────────────────────────────

class ScanMetadataResponse(BaseModel):
    input_type: Optional[str] = "dicom"
    analysis_mode: Optional[str] = "volumetric_ct"
    modality: str = "CT"
    patient_id_anon: str = "Anonymous"
    study_date: Optional[str] = None
    series_description: Optional[str] = None
    slice_count: Optional[int] = None
    slice_thickness_mm: Optional[float] = None
    pixel_spacing_x: Optional[float] = None
    pixel_spacing_y: Optional[float] = None
    rows: Optional[int] = None
    cols: Optional[int] = None
    scan_quality: str = "unknown"
    quality_notes: Optional[List[str]] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────────────────
# Nodule
# ──────────────────────────────────────────────────────────────────────────────

class RiskFactorItem(BaseModel):
    name: str
    display_name: str
    score: float  # 0–1 contribution
    level: str    # low, moderate, high
    description: str


class RiskAssessmentResponse(BaseModel):
    id: str
    model_name: str
    risk_probability: Optional[float] = None
    risk_category: Optional[str] = None
    lung_rads_category: Optional[str] = None
    lung_rads_recommendation: Optional[str] = None
    contributing_factors: Optional[List[RiskFactorItem]] = None
    clinical_inputs: Optional[Dict[str, Any]] = None
    is_demo: bool = True

    class Config:
        from_attributes = True


class NoduleResponse(BaseModel):
    id: str
    nodule_index: int
    detection_confidence: Optional[float] = None
    is_demo: bool = False

    # Coordinates
    coord_x: Optional[float] = None
    coord_y: Optional[float] = None
    coord_z: Optional[float] = None

    # Measurements
    max_diameter_mm: Optional[float] = None
    min_diameter_mm: Optional[float] = None
    mean_diameter_mm: Optional[float] = None
    volume_mm3: Optional[float] = None

    # Density
    mean_hu: Optional[float] = None
    median_hu: Optional[float] = None
    min_hu: Optional[float] = None
    max_hu: Optional[float] = None
    std_hu: Optional[float] = None
    density_type: Optional[str] = None

    # Morphology
    sphericity: Optional[float] = None
    elongation: Optional[float] = None
    surface_area_mm2: Optional[float] = None
    compactness: Optional[float] = None
    margin_type: Optional[str] = None
    spiculation_detected: Optional[bool] = None

    # Location
    lung_side: Optional[str] = None
    lung_lobe: Optional[str] = None
    position_type: Optional[str] = None
    axial_slice: Optional[int] = None
    coronal_slice: Optional[int] = None
    sagittal_slice: Optional[int] = None

    risk_assessments: Optional[List[RiskAssessmentResponse]] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────────────────
# Analysis Job
# ──────────────────────────────────────────────────────────────────────────────

class AnalysisJobResponse(BaseModel):
    id: str
    status: str
    progress_pct: int
    current_stage: Optional[str] = None
    stages_completed: Optional[List[str]] = None
    stage_details: Optional[List[Dict[str, Any]]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────────────────
# Report
# ──────────────────────────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    id: str
    case_id: str
    report_text: Optional[str] = None
    report_data: Optional[Dict[str, Any]] = None
    pdf_path: Optional[str] = None
    generated_at: datetime
    is_demo: bool = True

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────────────────────────────────────
# Case
# ──────────────────────────────────────────────────────────────────────────────

class CaseCreateRequest(BaseModel):
    is_demo: bool = False
    demo_case_id: Optional[str] = None
    input_type: Optional[str] = "demo"
    analysis_mode: Optional[str] = "demo"
    notes: Optional[str] = None


class PatientContextRequest(BaseModel):
    medical_history: Optional[Dict[str, Any]] = None
    recent_tests: Optional[List[Dict[str, Any]]] = None


class ReviewStatusRequest(BaseModel):
    review_status: str  # unreviewed, under_review, reviewed, needs_attention


class CaseResponse(BaseModel):
    id: str
    case_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    status: str
    is_demo: bool
    demo_case_id: Optional[str] = None
    input_type: Optional[str] = "dicom"
    analysis_mode: Optional[str] = "volumetric_ct"
    notes: Optional[str] = None
    review_status: Optional[str] = "unreviewed"
    patient_context: Optional[Dict[str, Any]] = None
    scan_metadata: Optional[ScanMetadataResponse] = None
    nodules: Optional[List[NoduleResponse]] = []

    class Config:
        from_attributes = True


class CaseListItem(BaseModel):
    id: str
    case_id: str
    created_at: datetime
    status: str
    is_demo: bool
    input_type: Optional[str] = "dicom"
    analysis_mode: Optional[str] = "volumetric_ct"
    nodule_count: int = 0
    largest_nodule_mm: Optional[float] = None
    highest_risk_pct: Optional[float] = None  # highest risk across all nodules
    review_status: Optional[str] = "unreviewed"

    class Config:
        from_attributes = True


class CaseResultsResponse(BaseModel):
    case_id: str
    status: str
    is_demo: bool
    demo_case_id: Optional[str] = None
    input_type: Optional[str] = "dicom"
    analysis_mode: Optional[str] = "volumetric_ct"
    scan_metadata: Optional[ScanMetadataResponse] = None
    nodules: List[NoduleResponse] = []
    analysis_job: Optional[AnalysisJobResponse] = None
    summary: Optional[Dict[str, Any]] = None


# ──────────────────────────────────────────────────────────────────────────────
# Clinical Inputs (for risk assessment)
# ──────────────────────────────────────────────────────────────────────────────

class ClinicalInputs(BaseModel):
    age: Optional[int] = Field(None, ge=18, le=120)
    sex: Optional[str] = None  # "male", "female", "other"
    smoking_history: Optional[bool] = None
    family_history_lung_cancer: Optional[bool] = None
    emphysema: Optional[bool] = None
    pack_years: Optional[float] = None


class RiskAssessmentRequest(BaseModel):
    nodule_id: str
    clinical_inputs: Optional[ClinicalInputs] = None


# ──────────────────────────────────────────────────────────────────────────────
# Health
# ──────────────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    demo_mode: bool
    services: Dict[str, str]


# ──────────────────────────────────────────────────────────────────────────────
# Gemini AI Clinical Reasoning Schemas
# ──────────────────────────────────────────────────────────────────────────────

class GeminiExplainRequest(BaseModel):
    clinical_inputs: Optional[Dict[str, Any]] = None


class GeminiExplainResponse(BaseModel):
    nodule_id: str
    explanation: str
    generated_at: str


class GeminiChatRequest(BaseModel):
    question: str
    chat_history: Optional[List[Dict[str, str]]] = None


class GeminiChatResponse(BaseModel):
    answer: str
    case_id: str
    timestamp: str


class GeminiSummaryResponse(BaseModel):
    case_id: str
    summary: str
    timestamp: str


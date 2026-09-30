"""SQLAlchemy ORM models for PulmoScan AI."""
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime,
    JSON, Text, ForeignKey, Enum
)
from sqlalchemy.orm import relationship
from app.core.database import Base
import enum


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"


class DensityType(str, enum.Enum):
    SOLID = "solid"
    PART_SOLID = "part_solid"
    GROUND_GLASS = "ground_glass"
    CALCIFIED = "calcified"
    UNKNOWN = "unknown"


class LungSide(str, enum.Enum):
    LEFT = "left"
    RIGHT = "right"
    UNKNOWN = "unknown"


class LungLobe(str, enum.Enum):
    RUL = "RUL"
    RML = "RML"
    RLL = "RLL"
    LUL = "LUL"
    LLL = "LLL"
    UNKNOWN = "unknown"


def generate_uuid():
    return str(uuid.uuid4())


class Case(Base):
    """A patient case containing one or more CT studies."""
    __tablename__ = "cases"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, unique=True, index=True)  # Human-readable like CASE-001
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default=ProcessingStatus.PENDING)
    is_demo = Column(Boolean, default=False)
    demo_case_id = Column(String, nullable=True)  # e.g. "DEMO-001"
    input_type = Column(String, default="dicom")   # dicom, nifti, image, video, demo
    analysis_mode = Column(String, default="volumetric_ct")  # volumetric_ct, image_review, video_review, demo
    notes = Column(Text, nullable=True)
    review_status = Column(String, default="unreviewed")  # unreviewed, under_review, reviewed, needs_attention
    patient_context = Column(JSON, nullable=True)  # {medical_history: {...}, recent_tests: [...]}

    # Relationships
    scan_metadata = relationship("ScanMetadata", back_populates="case", uselist=False)
    nodules = relationship("Nodule", back_populates="case")
    analysis_jobs = relationship("AnalysisJob", back_populates="case")
    reports = relationship("Report", back_populates="case")


class ScanMetadata(Base):
    """Metadata extracted from the DICOM/NIfTI file."""
    __tablename__ = "scan_metadata"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"))
    input_type = Column(String, default="dicom")
    analysis_mode = Column(String, default="volumetric_ct")
    modality = Column(String, default="CT")
    patient_id_anon = Column(String, default="Anonymous")
    study_date = Column(String, nullable=True)
    series_description = Column(String, nullable=True)
    slice_count = Column(Integer, nullable=True)
    slice_thickness_mm = Column(Float, nullable=True)
    pixel_spacing_x = Column(Float, nullable=True)
    pixel_spacing_y = Column(Float, nullable=True)
    rows = Column(Integer, nullable=True)
    cols = Column(Integer, nullable=True)
    manufacturer = Column(String, nullable=True)
    institution = Column(String, nullable=True)
    scan_quality = Column(String, default="unknown")
    quality_notes = Column(JSON, nullable=True)
    raw_file_path = Column(String, nullable=True)
    volume_file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="scan_metadata")


class Nodule(Base):
    """A detected pulmonary nodule."""
    __tablename__ = "nodules"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"))
    nodule_index = Column(Integer)  # 1, 2, 3...

    # Detection
    detection_confidence = Column(Float, nullable=True)
    is_demo = Column(Boolean, default=False)

    # 3D coordinates (voxel space)
    coord_x = Column(Float, nullable=True)
    coord_y = Column(Float, nullable=True)
    coord_z = Column(Float, nullable=True)

    # Bounding box
    bbox_x1 = Column(Float, nullable=True)
    bbox_y1 = Column(Float, nullable=True)
    bbox_z1 = Column(Float, nullable=True)
    bbox_x2 = Column(Float, nullable=True)
    bbox_y2 = Column(Float, nullable=True)
    bbox_z2 = Column(Float, nullable=True)

    # Segmentation
    segmentation_path = Column(String, nullable=True)
    segmentation_confidence = Column(Float, nullable=True)

    # Measurements
    max_diameter_mm = Column(Float, nullable=True)
    min_diameter_mm = Column(Float, nullable=True)
    mean_diameter_mm = Column(Float, nullable=True)
    volume_mm3 = Column(Float, nullable=True)

    # Density (HU)
    mean_hu = Column(Float, nullable=True)
    median_hu = Column(Float, nullable=True)
    min_hu = Column(Float, nullable=True)
    max_hu = Column(Float, nullable=True)
    std_hu = Column(Float, nullable=True)
    density_type = Column(String, default=DensityType.UNKNOWN)

    # Morphology
    sphericity = Column(Float, nullable=True)
    elongation = Column(Float, nullable=True)
    surface_area_mm2 = Column(Float, nullable=True)
    compactness = Column(Float, nullable=True)
    margin_type = Column(String, nullable=True)   # smooth, lobulated, irregular, spiculated
    spiculation_detected = Column(Boolean, nullable=True)

    # Location
    lung_side = Column(String, default=LungSide.UNKNOWN)
    lung_lobe = Column(String, default=LungLobe.UNKNOWN)
    position_type = Column(String, nullable=True)  # central, peripheral, pleural_adjacent
    axial_slice = Column(Integer, nullable=True)
    coronal_slice = Column(Integer, nullable=True)
    sagittal_slice = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="nodules")
    risk_assessments = relationship("RiskAssessment", back_populates="nodule")
    measurements = relationship("NoduleMeasurement", back_populates="nodule")


class NoduleMeasurement(Base):
    """Historical measurements for a nodule (for temporal tracking)."""
    __tablename__ = "nodule_measurements"

    id = Column(String, primary_key=True, default=generate_uuid)
    nodule_id = Column(String, ForeignKey("nodules.id"))
    measured_at = Column(DateTime, default=datetime.utcnow)
    max_diameter_mm = Column(Float, nullable=True)
    volume_mm3 = Column(Float, nullable=True)
    scan_date = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    nodule = relationship("Nodule", back_populates="measurements")


class RiskAssessment(Base):
    """Risk assessment for a nodule."""
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=generate_uuid)
    nodule_id = Column(String, ForeignKey("nodules.id"))
    model_name = Column(String, default="brock_pancan_demo")
    risk_probability = Column(Float, nullable=True)
    risk_category = Column(String, nullable=True)  # low, moderate, high, very_high
    lung_rads_category = Column(String, nullable=True)  # 1, 2, 3, 4A, 4B, 4X
    lung_rads_recommendation = Column(Text, nullable=True)
    contributing_factors = Column(JSON, nullable=True)
    clinical_inputs = Column(JSON, nullable=True)
    is_demo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    nodule = relationship("Nodule", back_populates="risk_assessments")


class AnalysisJob(Base):
    """Background job tracking for AI analysis pipeline."""
    __tablename__ = "analysis_jobs"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"))
    status = Column(String, default="pending")
    progress_pct = Column(Integer, default=0)
    current_stage = Column(String, nullable=True)
    stages_completed = Column(JSON, default=list)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="analysis_jobs")


class Report(Base):
    """Generated radiology-style report."""
    __tablename__ = "reports"

    id = Column(String, primary_key=True, default=generate_uuid)
    case_id = Column(String, ForeignKey("cases.id"))
    report_text = Column(Text, nullable=True)
    report_data = Column(JSON, nullable=True)
    pdf_path = Column(String, nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    is_demo = Column(Boolean, default=True)

    case = relationship("Case", back_populates="reports")

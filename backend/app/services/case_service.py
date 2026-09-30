import os
import uuid
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.case import Case, ScanMetadata, Nodule, RiskAssessment, AnalysisJob, Report
from app.schemas.case import CaseCreateRequest
from app.ai.demo_service import demo_ai_service
from app.ai.pipeline import AIPipelineOrchestrator
from app.services.ct_volume_service import ct_volume_service
from app.services.report_service import ReportService


def _generate_case_id() -> str:
    suffix = str(uuid.uuid4())[:8].upper()
    return f"CASE-{suffix}"


class CaseService:
    def __init__(self, db: Session):
        self.db = db

    def create_case(self, request: CaseCreateRequest) -> Case:
        input_type = getattr(request, "input_type", None) or ("demo" if request.is_demo else "dicom")
        analysis_mode = getattr(request, "analysis_mode", None) or ("demo" if request.is_demo else "volumetric_ct")
        case = Case(
            id=str(uuid.uuid4()),
            case_id=_generate_case_id(),
            is_demo=request.is_demo,
            demo_case_id=request.demo_case_id,
            input_type=input_type,
            analysis_mode=analysis_mode,
            notes=request.notes,
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        return case

    def create_scan_metadata(self, case_id: str, meta: Dict[str, Any]) -> ScanMetadata:
        sm = ScanMetadata(
            id=str(uuid.uuid4()),
            case_id=case_id,
            input_type=meta.get("input_type", "dicom"),
            analysis_mode=meta.get("analysis_mode", "volumetric_ct"),
            modality=meta.get("modality", "CT"),
            patient_id_anon=meta.get("patient_id_anon", "Anonymous"),
            study_date=meta.get("study_date"),
            series_description=meta.get("series_description", "Thoracic CT"),
            slice_count=meta.get("slice_count", 320),
            slice_thickness_mm=meta.get("slice_thickness_mm"),
            pixel_spacing_x=meta.get("pixel_spacing_x"),
            pixel_spacing_y=meta.get("pixel_spacing_y"),
            rows=meta.get("rows", 512),
            cols=meta.get("cols", 512),
            scan_quality=meta.get("scan_quality", "good"),
            quality_notes=meta.get("quality_notes"),
            raw_file_path=meta.get("raw_file_path"),
            volume_file_path=meta.get("volume_file_path"),
        )
        self.db.add(sm)
        self.db.commit()
        self.db.refresh(sm)
        return sm

    def load_demo_case(self, case_id: str, demo_case_id: str):
        """Load pre-computed demo data into the database with explicit DEMO labelling."""
        demo = demo_ai_service.get_demo_case(demo_case_id)
        if not demo:
            return

        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return

        case.status = "completed"
        case.updated_at = datetime.utcnow()
        case.is_demo = True
        case.input_type = "demo"
        case.analysis_mode = "demo"
        case.patient_context = demo.get("patient_context", {})

        # Update or create scan metadata
        sm_data = demo["scan_metadata"]
        existing_sm = self.db.query(ScanMetadata).filter(ScanMetadata.case_id == case_id).first()
        if existing_sm:
            for k, v in sm_data.items():
                if hasattr(existing_sm, k):
                    setattr(existing_sm, k, v)
            existing_sm.input_type = "demo"
            existing_sm.analysis_mode = "demo"
        else:
            sm = ScanMetadata(
                id=str(uuid.uuid4()),
                case_id=case_id,
                input_type="demo",
                analysis_mode="demo",
                **{k: v for k, v in sm_data.items() if k != "quality_notes"},
                quality_notes=sm_data.get("quality_notes"),
            )
            self.db.add(sm)

        # Clear any existing nodules
        self.db.query(Nodule).filter(Nodule.case_id == case_id).delete()
        self.db.commit()

        # Create nodules
        for ndata in demo.get("nodules", []):
            risk_data = ndata.pop("risk", None)
            _timeline = ndata.pop("timeline", None)
            _thumb = ndata.pop("thumbnail_url", None)

            nodule = Nodule(
                id=str(uuid.uuid4()),
                case_id=case_id,
                is_demo=True,
                **{k: v for k, v in ndata.items() if k != "is_demo"},
            )
            self.db.add(nodule)
            self.db.flush()

            if risk_data:
                factors = risk_data.get("contributing_factors", [])
                risk = RiskAssessment(
                    id=str(uuid.uuid4()),
                    nodule_id=nodule.id,
                    model_name=risk_data.get("model_name", "brock_pancan_demo"),
                    risk_probability=risk_data.get("risk_probability"),
                    risk_category=risk_data.get("risk_category"),
                    lung_rads_category=risk_data.get("lung_rads_category"),
                    lung_rads_recommendation=risk_data.get("lung_rads_recommendation"),
                    contributing_factors=factors,
                    clinical_inputs=risk_data.get("clinical_inputs"),
                    is_demo=True,
                )
                self.db.add(risk)

            # Restore popped data
            ndata["risk"] = risk_data
            ndata["timeline"] = _timeline
            ndata["thumbnail_url"] = _thumb

        # Create analysis job (completed)
        stages = demo_ai_service.simulate_pipeline_stages()
        job = AnalysisJob(
            id=str(uuid.uuid4()),
            case_id=case_id,
            status="completed",
            progress_pct=100,
            current_stage="COMPLETE",
            stages_completed=[s["key"] for s in stages],
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        self.db.add(job)
        self.db.commit()

    def start_analysis_job(self, case_id: str) -> AnalysisJob:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if case:
            case.status = "processing"
            case.updated_at = datetime.utcnow()

        job = AnalysisJob(
            id=str(uuid.uuid4()),
            case_id=case_id,
            status="processing",
            progress_pct=0,
            current_stage="VALIDATING",
            stages_completed=[],
            started_at=datetime.utcnow(),
        )
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    async def run_pipeline(
        self,
        case_id: str,
        job_id: str,
        clinical_inputs: Optional[Dict[str, Any]] = None,
    ):
        """
        Executes the analysis pipeline:
        - Demo cases: loads simulated demo data with high fidelity
        - 3D Volumetric CT: runs actual AIPipelineOrchestrator
        - 2D / Video review: generates visual review report
        """
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            return

        # 1. Demo Mode
        if case.is_demo:
            demo_id = case.demo_case_id or "DEMO-001"
            self.load_demo_case(case_id, demo_id)
            return

        # 2. 2D Photo or Video Review Modes (Non-volumetric)
        if case.analysis_mode in ("image_review", "video_review"):
            job = self.db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if job:
                job.current_stage = "GENERATING_EXPLANATION"
                job.progress_pct = 70
                job.stages_completed = ["VALIDATING", "PREPROCESSING", "GENERATING_EXPLANATION"]
                self.db.commit()

            report_service = ReportService(self.db)
            report_service.generate(case)

            case.status = "completed"
            case.updated_at = datetime.utcnow()
            if job:
                job.status = "completed"
                job.progress_pct = 100
                job.current_stage = "COMPLETE"
                job.completed_at = datetime.utcnow()
            self.db.commit()
            return

        # 3. Real 3D Volumetric CT Pipeline
        orchestrator = AIPipelineOrchestrator(self.db)
        await orchestrator.execute_case_pipeline(
            case_id=case_id,
            job_id=job_id,
            clinical_inputs=clinical_inputs,
        )

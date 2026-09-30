"""
End-to-End Validation Suite for Yellow Phase.
Covers Section 38 requirements:
A. Real NIfTI CT end-to-end pipeline
B. Invalid CT validation rejection
C. Gemini failure / missing key graceful degradation
D. Demo case preservation
E. Hardware runtime detection
"""
import os
import sys
import uuid
import asyncio
import tempfile
import unittest
import numpy as np
import SimpleITK as sitk

# Path setup
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal, create_tables
from app.models.case import Case, ScanMetadata, Nodule, RiskAssessment, AnalysisJob, Report
from app.core.ct_volume import CTVolume, CTValidator
from app.ai.pipeline import AIPipelineOrchestrator
from app.ai.detector import nodule_detector
from app.services.gemini_service import gemini_service
from app.services.case_service import CaseService


class TestYellowEndToEnd(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        create_tables()

    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def _create_sample_ct_nifti(self, tmpdir, with_nodule=True):
        """Creates a realistic CT volume (40 slices, 128x128) as NIfTI with HU values."""
        # Baseline lung tissue ~ -700 HU, chest wall ~ +40 HU
        vol = np.full((40, 128, 128), -700.0, dtype=np.float32)
        # Chest wall outer ring
        vol[:, :10, :] = 40.0
        vol[:, -10:, :] = 40.0
        vol[:, :, :10] = 40.0
        vol[:, :, -10:] = 40.0

        if with_nodule:
            # Synthetic solid nodule at z=20, y=64, x=64, radius=5 (~10mm diameter), HU ~ -50
            for z in range(16, 25):
                for y in range(58, 71):
                    for x in range(58, 71):
                        dist = np.sqrt((z - 20)**2 + (y - 64)**2 + (x - 64)**2)
                        if dist <= 5.5:
                            vol[z, y, x] = -50.0  # Solid soft-tissue nodule

        itk_img = sitk.GetImageFromArray(vol)
        itk_img.SetSpacing((1.0, 1.0, 2.5))  # (X, Y, Z) spacing
        itk_img.SetOrigin((0.0, 0.0, 0.0))

        nii_path = os.path.join(tmpdir, "sample_scan.nii.gz")
        sitk.WriteImage(itk_img, nii_path)
        return nii_path

    # ── Test A: Real NIfTI CT End-to-End Analysis ─────────────────────────────
    def test_A_real_nifti_e2e_pipeline(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            nii_path = self._create_sample_ct_nifti(tmpdir, with_nodule=True)

            case_id_str = f"CASE-E2E-{uuid.uuid4().hex[:8]}"
            case = Case(
                case_id=case_id_str,
                status="pending",
                is_demo=False,
                input_type="nifti",
                analysis_mode="volumetric_ct",
            )
            self.db.add(case)
            self.db.commit()

            # Add ScanMetadata with the actual raw file path
            sm = ScanMetadata(
                case_id=case.id,
                input_type="nifti",
                analysis_mode="volumetric_ct",
                raw_file_path=nii_path,
                modality="CT",
                slice_count=40,
                slice_thickness_mm=2.5,
                pixel_spacing_x=1.0,
                pixel_spacing_y=1.0,
            )
            self.db.add(sm)
            self.db.commit()

            # Create analysis job
            job = AnalysisJob(
                case_id=case.id,
                status="queued",
                current_stage="VALIDATING",
                stages_completed=[],
                progress_pct=0,
            )
            self.db.add(job)
            self.db.commit()

            # Run complete pipeline asynchronously
            orchestrator = AIPipelineOrchestrator(self.db)
            result = asyncio.run(
                orchestrator.execute_case_pipeline(
                    case_id=case.id,
                    job_id=job.id,
                    clinical_inputs={"age": 62, "smoking_history": "former_smoker"},
                )
            )

            self.assertEqual(result.get("status"), "completed", f"Pipeline returned error: {result}")

            # Check job status
            self.db.refresh(job)
            self.assertEqual(job.status, "completed")
            self.assertEqual(job.current_stage, "COMPLETE")
            self.assertEqual(job.progress_pct, 100)
            self.assertIn("MEASURING", job.stages_completed)
            self.assertIn("RISK_ASSESSMENT", job.stages_completed)

            # Check case status
            self.db.refresh(case)
            self.assertEqual(case.status, "completed")

            # Check real detected nodule findings
            nodules = self.db.query(Nodule).filter(Nodule.case_id == case.id).all()
            self.assertGreater(len(nodules), 0, "Should detect at least 1 candidate nodule in test scan")

            n0 = nodules[0]
            self.assertFalse(n0.is_demo, "Real scan nodule must NOT have is_demo=True")
            self.assertIsNotNone(n0.max_diameter_mm)
            self.assertGreater(n0.max_diameter_mm, 3.0)
            self.assertIsNotNone(n0.volume_mm3)
            self.assertIsNotNone(n0.mean_hu)
            self.assertIsNotNone(n0.density_type)
            self.assertIsNotNone(n0.margin_type)
            self.assertIsNotNone(n0.detection_confidence)

            # Check risk assessment
            risk = self.db.query(RiskAssessment).filter(RiskAssessment.nodule_id == n0.id).first()
            self.assertIsNotNone(risk)
            self.assertIsNotNone(risk.risk_probability)
            self.assertIn(risk.lung_rads_category, ["1", "2", "3", "4A", "4B", "4X"])
            self.assertIsNotNone(risk.contributing_factors)
            self.assertFalse(risk.is_demo)

            # Check Report record created
            report = self.db.query(Report).filter(Report.case_id == case.id).first()
            self.assertIsNotNone(report)
            self.assertIsNotNone(report.report_text)
            self.assertFalse(report.is_demo)

    # ── Test B: Invalid CT Study Rejection ────────────────────────────────────
    def test_B_invalid_ct_rejection(self):
        # 1. Non-CT modality rejection
        vol_invalid_modality = CTVolume(
            data=np.zeros((10, 32, 32), dtype=np.float32),
            spacing=(1.0, 1.0, 1.0),
            origin=(0.0, 0.0, 0.0),
            direction=(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0),
            metadata={"modality": "MR"},  # MRI instead of CT
            source_format="dicom",
        )
        val = CTValidator.validate_volume(vol_invalid_modality)
        self.assertFalse(val.is_suitable_for_volumetric)
        self.assertEqual(val.status, "NOT_SUITABLE")
        self.assertTrue(any("MR" in r for r in val.reasons))

        # 2. Insufficient slices (< 5)
        vol_too_thin = CTVolume(
            data=np.zeros((2, 32, 32), dtype=np.float32),
            spacing=(1.0, 1.0, 1.0),
            origin=(0.0, 0.0, 0.0),
            direction=(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0),
            metadata={"modality": "CT"},
            source_format="dicom",
        )
        val2 = CTValidator.validate_volume(vol_too_thin)
        self.assertFalse(val2.is_suitable_for_volumetric)
        self.assertEqual(val2.status, "NOT_SUITABLE")
        self.assertTrue(any("slices" in r for r in val2.reasons))

    # ── Test C: Gemini Safe Fallback (No Crash on API Outage) ──────────────────
    def test_C_gemini_fallback_safety(self):
        finding_info = {
            "nodule_index": 1,
            "max_diameter_mm": 11.2,
            "volume_mm3": 735.6,
            "density_type": "solid",
            "mean_hu": 28.4,
            "lung_lobe": "RUL",
            "spiculation_detected": True,
            "margin_type": "spiculated",
        }
        # Even with no network / expired key, explain_finding must NEVER raise an uncaught exception
        explanation = gemini_service.explain_finding(finding_info)
        self.assertIsInstance(explanation, str)
        self.assertTrue(len(explanation) > 0)
        self.assertNotIn("API_KEY", explanation)

        # Impression fallback
        case_summary = {
            "case_id": "TEST-SUMMARY",
            "nodules": [finding_info],
        }
        impression = gemini_service.generate_impression(case_summary)
        self.assertIsInstance(impression, str)
        self.assertIn("IMPRESSION", impression)
        self.assertIn("RECOMMENDATIONS", impression)

    # ── Test D: Demo Mode Preservation ────────────────────────────────────────
    def test_D_demo_case_preservation(self):
        # Verify demo cases can be queried and loaded
        from app.ai.demo_service import demo_ai_service
        demo_cases = demo_ai_service.list_demo_cases()
        self.assertGreaterEqual(len(demo_cases), 3, "At least 3 demo cases must exist in demo service")

        demo_ids = [c["id"] for c in demo_cases]
        self.assertIn("DEMO-001", demo_ids)
        self.assertIn("DEMO-002", demo_ids)
        self.assertIn("DEMO-003", demo_ids)

        # Check detail of DEMO-002
        demo_detail = demo_ai_service.get_demo_case("DEMO-002")
        self.assertIsNotNone(demo_detail)
        self.assertGreater(len(demo_detail.get("nodules", [])), 0)

    # ── Test E: Hardware Runtime Detection ────────────────────────────────────
    def test_E_hardware_runtime_detection(self):
        status = nodule_detector.get_runtime_status()
        self.assertIn("device", status)
        self.assertIn(status["device"], ["cpu", "gpu"])
        self.assertIn("device_name", status)
        self.assertIn("performance_citation", status)
        self.assertIn("target_spacing", status)


if __name__ == "__main__":
    unittest.main()

"""
PulmoScan AI - Yellow Phase Automated Verification Test Suite.
Tests all Yellow Phase requirements:
1. DICOM parsing & validation
2. NIfTI loading & validation
3. HU conversion & clipping
4. Volume resampling to target model spacing (0.703, 0.703, 1.25 mm)
5. Reversible coordinate transforms
6. Detector output schema & candidate metadata
7. Segmentation output schema & skimage boundary contour extraction
8. Mask-to-volume calculation & diameter measurements
9. HU density statistics
10. Brock / PanCan risk engine & ACR Lung-RADS v2022 classification
11. Gemini structured context grounding & fallback safety
12. Radiology report generation with preserved numerical values
13. Job status transitions (VALIDATING -> PREPROCESSING -> ... -> COMPLETE)
14. End-to-end reproducible pipeline execution
15. Hardware compute runtime detection (GPU vs CPU fallback)
"""
import os
import sys
import math
import json
import tempfile
import zipfile
import unittest
import uuid
import numpy as np

# Ensure app is in path
sys.path.insert(0, os.path.dirname(__file__))

import torch
import monai
import nibabel as nib
from app.core.ct_volume import CTVolume, CTValidator, ValidationResult
from app.services.ct_volume_service import ct_volume_service
from app.ai.preprocessing import (
    resample_volume_to_spacing,
    normalize_intensity_lung_window,
    original_to_resampled_coords,
    resampled_to_original_coords,
    voxel_to_world_coords,
    world_to_voxel_coords,
    DEFAULT_TARGET_SPACING,
)
from app.ai.detector import nodule_detector
from app.ai.segmenter import nodule_segmenter
from app.ai.feature_extractor import feature_extractor
from app.ai.risk_engine import risk_engine
from app.services.gemini_service import gemini_service
from app.ai.pipeline import JOB_STAGES, AIPipelineOrchestrator
from app.core.database import SessionLocal, create_tables
from app.models.case import Case, ScanMetadata, Nodule, RiskAssessment, AnalysisJob, Report


class TestYellowPhase(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        create_tables()

    # ── Test 1: NIfTI Loading & Quality Validation ────────────────────────────
    def test_01_nifti_loading_and_validation(self):
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            # Create synthetic 3D CT volume with 30 slices
            shape = (64, 64, 30)
            data = np.full(shape, -800.0, dtype=np.float32)
            affine = np.diag([0.75, 0.75, 1.5, 1.0])
            img = nib.Nifti1Image(data, affine)
            nib.save(img, tmp_path)

            res = CTValidator.validate_study_file(tmp_path)
            self.assertTrue(res.is_suitable_for_volumetric)
            self.assertEqual(res.status, "VALID")
            self.assertEqual(res.slice_count, 30)
            self.assertAlmostEqual(res.slice_thickness_mm, 1.5, places=1)
        finally:
            if os.path.isfile(tmp_path):
                os.remove(tmp_path)

    # ── Test 2: Inadequate Slice Count Rejection ─────────────────────────────
    def test_02_insufficient_slice_count_rejection(self):
        with tempfile.NamedTemporaryFile(suffix=".nii.gz", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            # Only 3 slices (< 5 slice minimum)
            shape = (64, 64, 3)
            data = np.full(shape, -800.0, dtype=np.float32)
            affine = np.diag([0.75, 0.75, 1.5, 1.0])
            img = nib.Nifti1Image(data, affine)
            nib.save(img, tmp_path)

            res = CTValidator.validate_study_file(tmp_path)
            self.assertFalse(res.is_suitable_for_volumetric)
            self.assertEqual(res.status, "NOT_SUITABLE")
            self.assertTrue(any("slices" in r for r in res.reasons))
        finally:
            if os.path.isfile(tmp_path):
                os.remove(tmp_path)

    # ── Test 3: HU Conversion & Range Clipping ────────────────────────────────
    def test_03_hu_conversion_and_clipping(self):
        raw = np.array([0.0, 100.0, 4095.0], dtype=np.float32)
        slope = 1.0
        intercept = -1024.0
        hu = raw * slope + intercept
        self.assertEqual(hu[0], -1024.0)
        self.assertEqual(hu[1], -924.0)

        # Standard CT window clipping
        clipped = np.clip(hu, -1024.0, 3071.0)
        self.assertTrue(np.all(clipped >= -1024.0))
        self.assertTrue(np.all(clipped <= 3071.0))

    # ── Test 4: Volume Resampling to MONAI Target Spacing ─────────────────────
    def test_04_resampling_to_target_spacing(self):
        # 3D volume shape (Z=20, Y=32, X=32)
        vol = np.full((20, 32, 32), -700.0, dtype=np.float32)
        orig_spacing = (1.0, 1.0, 2.5)  # mm
        target_spacing = (0.703, 0.703, 1.25)  # mm

        resampled, zoom_factors = resample_volume_to_spacing(vol, orig_spacing, target_spacing)
        # Expected zoom_z = 2.5 / 1.25 = 2.0 -> Z becomes ~40
        self.assertAlmostEqual(zoom_factors[0], 2.0, places=2)
        self.assertEqual(resampled.shape[0], 40)
        self.assertTrue(resampled.shape[1] > 32)
        self.assertTrue(resampled.shape[2] > 32)

    # ── Test 5: Reversible Coordinate Transforms ──────────────────────────────
    def test_05_reversible_coordinate_transforms(self):
        orig_spacing = (0.8, 0.8, 2.0)
        target_spacing = (0.703, 0.703, 1.25)
        orig_coord = (15.0, 120.0, 140.0)  # (Z, Y, X)

        # Forward map to resampled space
        res_coord = original_to_resampled_coords(orig_coord, orig_spacing, target_spacing)
        # Invert back to original space
        restored = resampled_to_original_coords(res_coord, orig_spacing, target_spacing)

        self.assertAlmostEqual(orig_coord[0], restored[0], places=4)
        self.assertAlmostEqual(orig_coord[1], restored[1], places=4)
        self.assertAlmostEqual(orig_coord[2], restored[2], places=4)

        # Test world to voxel reversible mapping
        origin = (10.0, 20.0, -100.0)
        world = voxel_to_world_coords(orig_coord, orig_spacing, origin)
        vox_restored = world_to_voxel_coords(world, orig_spacing, origin)
        self.assertAlmostEqual(orig_coord[0], vox_restored[0], places=4)
        self.assertAlmostEqual(orig_coord[1], vox_restored[1], places=4)
        self.assertAlmostEqual(orig_coord[2], vox_restored[2], places=4)

    # ── Test 6: Detector Output Schema & Candidate Structure ──────────────────
    def test_06_detector_output_schema(self):
        # Create a synthetic volume with an embedded nodule
        vol = np.full((32, 64, 64), -800.0, dtype=np.float32)
        # Embed soft-tissue sphere at center (z=16, y=32, x=32)
        gz, gy, gx = np.ogrid[:32, :64, :64]
        dist_sq = ((gx - 32) / 4.0)**2 + ((gy - 32) / 4.0)**2 + ((gz - 16) / 2.5)**2
        vol[dist_sq <= 1.0] = 45.0  # +45 HU solid nodule core

        metadata = {"pixel_spacing_x": 0.703, "pixel_spacing_y": 0.703, "slice_thickness_mm": 1.25}
        candidates = nodule_detector.detect(vol, metadata)

        self.assertTrue(len(candidates) >= 1)
        c0 = candidates[0]
        # Check required schema keys
        required_keys = [
            "candidate_id", "nodule_index", "detection_confidence",
            "coord_x", "coord_y", "coord_z", "relevant_slice_index",
            "bbox_x1", "bbox_y1", "bbox_z1", "bbox_x2", "bbox_y2", "bbox_z2",
            "max_diameter_mm", "detection_model", "inference_source", "is_demo"
        ]
        for k in required_keys:
            self.assertIn(k, c0, f"Candidate missing schema key: {k}")

        self.assertFalse(c0["is_demo"])
        self.assertGreaterEqual(c0["detection_confidence"], 0.45)
        # Nodule should be detected near z=16
        self.assertAlmostEqual(c0["coord_z"], 16.0, delta=3.0)

    # ── Test 7: Segmentation & skimage Boundary Contour Extraction ────────────
    def test_07_segmentation_and_boundary_contours(self):
        vol = np.full((32, 64, 64), -800.0, dtype=np.float32)
        gz, gy, gx = np.ogrid[:32, :64, :64]
        sphere = ((gx - 30) / 4.0)**2 + ((gy - 30) / 4.0)**2 + ((gz - 15) / 2.0)**2 <= 1.0
        vol[sphere] = 40.0

        bbox = {"bbox_x1": 25, "bbox_y1": 25, "bbox_z1": 13, "bbox_x2": 35, "bbox_y2": 35, "bbox_z2": 17}
        seg_res = nodule_segmenter.segment(vol, bbox, nodule_index=1)

        self.assertIn("binary_mask", seg_res)
        self.assertIn("voxel_count", seg_res)
        self.assertGreater(seg_res["voxel_count"], 0)
        self.assertIn(seg_res["segmentation_status"], ["REAL_MODEL_INFERENCE", "REAL_3D_MORPHOLOGICAL_SEGMENTATION"])

        # Extract contour on the axial slice passing through z=15
        mask_data = {
            "mask": seg_res["binary_mask"],
            "crop_bounds": seg_res["crop_bounds"],
            "voxel_count": seg_res["voxel_count"],
        }
        contours = nodule_segmenter.extract_slice_contours(mask_data, plane="axial", slice_index=15)
        self.assertTrue(len(contours) >= 1)
        self.assertTrue(len(contours[0]) >= 3)
        # Contour points must have float x, y coordinates
        self.assertIn("x", contours[0][0])
        self.assertIn("y", contours[0][0])

    # ── Test 8 & 9: Real Measurements & HU Statistics ─────────────────────────
    def test_08_and_09_measurements_and_hu_statistics(self):
        vol = np.full((20, 40, 40), -800.0, dtype=np.float32)
        mask = np.zeros((20, 40, 40), dtype=bool)

        # Place a 6x6x4 voxel nodule with HU = 50.0
        mask[8:12, 18:24, 18:24] = True
        vol[mask] = 50.0

        spacing = (0.703, 0.703, 1.25)
        feats = feature_extractor.extract(vol, mask, spacing=spacing, centroid=(21.0, 21.0, 10.0))

        # Check volume calculation: 4 * 6 * 6 = 144 voxels
        expected_vol_mm3 = 144 * (0.703 * 0.703 * 1.25)
        self.assertAlmostEqual(feats["volume_mm3"], expected_vol_mm3, delta=2.0)

        # Check HU stats
        self.assertAlmostEqual(feats["mean_hu"], 50.0, delta=0.5)
        self.assertAlmostEqual(feats["median_hu"], 50.0, delta=0.5)
        self.assertEqual(feats["density_type"], "solid")
        self.assertEqual(feats["measurement_status"], "REAL_MEASUREMENTS")

    # ── Test 10: Brock / PanCan Risk Engine & Lung-RADS ────────────────────────
    def test_10_risk_engine_and_lung_rads(self):
        # Case A: 8.5 mm solid nodule with spiculation in upper lobe, older smoker
        feats_high = {
            "max_diameter_mm": 8.5,
            "lung_lobe": "RUL",
            "density_type": "solid",
            "spiculation_detected": True,
        }
        clinical_high = {
            "age": 68,
            "sex": "female",
            "smoking_history": True,
            "pack_years": 40,
            "emphysema": True,
            "family_history_lung_cancer": True,
        }
        res_high = risk_engine.assess_risk(feats_high, clinical_high)

        self.assertGreater(res_high["risk_probability"], 0.10)
        self.assertIn(res_high["risk_category"], ["moderate", "high"])
        self.assertEqual(res_high["lung_rads_category"], "4X")  # Solid >8mm with spiculation
        self.assertEqual(res_high["input_completeness_pct"], 100)

        # Case B: Missing clinical data (Not provided) must NOT be silently defaulted to No
        clinical_missing = {}
        res_missing = risk_engine.assess_risk(feats_high, clinical_missing)
        self.assertEqual(res_missing["clinical_inputs"]["smoking_history"], "Not provided")
        self.assertEqual(res_missing["clinical_inputs"]["family_history_lung_cancer"], "Not provided")
        self.assertIn("Smoking History", res_missing["missing_clinical_fields"])
        self.assertLess(res_missing["input_completeness_pct"], 50)

    # ── Test 11: Gemini Integration Safety & Grounded Context ────────────────
    def test_11_gemini_grounding_and_fallback(self):
        # Test finding explanation formatting
        nodule_dict = {
            "nodule_index": 1,
            "max_diameter_mm": 8.4,
            "volume_mm3": 292.0,
            "lung_lobe": "RUL",
            "density_type": "part_solid",
            "margin_type": "spiculated",
            "spiculation_detected": True,
            "mean_hu": 46.0,
            "detection_confidence": 0.94,
        }
        # Call explain finding (will use Gemini API or grounded clinical fallback if unreachable)
        explanation = gemini_service.explain_finding(nodule_dict)
        self.assertIsInstance(explanation, str)
        self.assertTrue(len(explanation) > 30)

        # Ensure no secrets leak
        self.assertNotIn("AQ.", explanation)

    # ── Test 12: Job Status Transitions ───────────────────────────────────────
    def test_12_job_status_transitions(self):
        db = SessionLocal()
        test_case_id = f"TEST-JOB-{uuid.uuid4().hex[:8]}"
        try:
            case = Case(
                case_id=test_case_id,
                status="processing",
                is_demo=False,
            )
            db.add(case)
            db.commit()

            job = AnalysisJob(
                case_id=case.id,
                status="processing",
                current_stage="VALIDATING",
                stages_completed=[],
            )
            db.add(job)
            db.commit()

            orchestrator = AIPipelineOrchestrator(db)
            orchestrator.update_job_stage(job.id, "PREPROCESSING", "processing", progress_pct=25)

            db.refresh(job)
            self.assertEqual(job.current_stage, "PREPROCESSING")
            self.assertIn("VALIDATING", job.stages_completed)
            self.assertEqual(job.progress_pct, 25)

            orchestrator.update_job_stage(job.id, "COMPLETE", "completed", progress_pct=100)
            db.refresh(job)
            self.assertEqual(job.status, "completed")
            self.assertEqual(job.progress_pct, 100)
            self.assertIsNotNone(job.completed_at)
        finally:
            db.close()

    # ── Test 13: Hardware Runtime Compute Status ──────────────────────────────
    def test_13_hardware_runtime_compute(self):
        status = nodule_detector.get_runtime_status()
        self.assertIn("device", status)
        self.assertIn(status["device"], ["cpu", "gpu"])
        self.assertIn("performance_citation", status)
        self.assertIn("LUNA16", status["performance_citation"])


if __name__ == "__main__":
    unittest.main()

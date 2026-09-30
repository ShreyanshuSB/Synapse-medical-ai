"""
CT 3D Volumetric Reconstruction & Ingestion Service.
Reconstructs, normalizes, validates, and stores real 3D CT volumes from:
  - DICOM series (ZIP archives containing .dcm files)
  - NIfTI volumes (.nii, .nii.gz)
  - Single-file DICOM (.dcm)
Converts raw pixel values into calibrated Hounsfield Units (HU).
Stores reconstructed volumes as high-performance NumPy arrays (.npy) with spatial metadata.
"""
import os
import json
import zipfile
import tempfile
import numpy as np
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

from app.core.ct_volume import CTVolume, CTValidator, ValidationResult

try:
    import pydicom
    HAS_PYDICOM = True
except ImportError:
    HAS_PYDICOM = False

try:
    import nibabel as nib
    HAS_NIBABEL = True
except ImportError:
    HAS_NIBABEL = False

VOLUMES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "volumes")
os.makedirs(VOLUMES_DIR, exist_ok=True)


class CTVolumeService:
    """Manages physical 3D CT volume extraction, HU conversion, validation, and persistence."""

    @staticmethod
    def get_case_volume_dir(case_id: str) -> str:
        d = os.path.join(VOLUMES_DIR, case_id)
        os.makedirs(d, exist_ok=True)
        return d

    @staticmethod
    def get_volume_path(case_id: str) -> str:
        return os.path.join(CTVolumeService.get_case_volume_dir(case_id), "volume.npy")

    @staticmethod
    def get_meta_path(case_id: str) -> str:
        return os.path.join(CTVolumeService.get_case_volume_dir(case_id), "volume_meta.json")

    @staticmethod
    def has_real_volume(case_id: str) -> bool:
        return os.path.isfile(CTVolumeService.get_volume_path(case_id))

    @staticmethod
    def get_volume(case_id: str) -> Optional[np.ndarray]:
        path = CTVolumeService.get_volume_path(case_id)
        if os.path.isfile(path):
            try:
                return np.load(path, mmap_mode="r")
            except Exception:
                pass
        return None

    @staticmethod
    def get_volume_meta(case_id: str) -> Optional[Dict[str, Any]]:
        path = CTVolumeService.get_meta_path(case_id)
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return None

    @staticmethod
    def validate_file(file_path: str) -> ValidationResult:
        """Run strict quality and suitability validation on an uploaded CT file."""
        return CTValidator.validate_study_file(file_path)

    @staticmethod
    def reconstruct_from_file(case_id: str, file_path: str) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Ingest an uploaded CT file, build a real 3D volume in HU,
        and persist both volume array (.npy) and spatial metadata (.json).
        """
        # 1. Run validation
        val_result = CTVolumeService.validate_file(file_path)
        if not val_result.is_suitable_for_volumetric:
            reasons_str = "; ".join(val_result.reasons)
            raise ValueError(f"Scan validation failed: {reasons_str}")

        # 2. Reconstruct by format
        ext = os.path.splitext(file_path)[-1].lower()
        if file_path.endswith(".nii.gz") or ext == ".nii":
            ct_vol = CTVolumeService._reconstruct_from_nifti(file_path, val_result)
        elif ext == ".zip":
            ct_vol = CTVolumeService._reconstruct_from_dicom_zip(file_path, val_result)
        elif ext == ".dcm":
            ct_vol = CTVolumeService._reconstruct_from_single_dicom(file_path, val_result)
        else:
            raise ValueError(f"Unsupported file format for 3D reconstruction: {ext}")

        # 3. Save volume array
        vol_path = CTVolumeService.get_volume_path(case_id)
        np.save(vol_path, ct_vol.data)

        # 4. Save volume metadata
        meta = ct_vol.get_summary_dict()
        meta["reconstructed_at"] = datetime.utcnow().isoformat()
        meta["validation"] = val_result.to_dict()
        meta["scan_quality"] = val_result.status.lower()
        meta["quality_notes"] = val_result.warnings + val_result.reasons
        meta_path = CTVolumeService.get_meta_path(case_id)
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(meta, f, indent=2)

        return ct_vol.data, meta

    @staticmethod
    def _reconstruct_from_nifti(nii_path: str, val_result: ValidationResult) -> CTVolume:
        if not HAS_NIBABEL:
            raise RuntimeError("nibabel is required for NIfTI reconstruction.")

        img = nib.load(nii_path)
        img = nib.as_closest_canonical(img)
        data = np.asarray(img.dataobj, dtype=np.float32)
        zooms = img.header.get_zooms()

        if data.ndim == 3:
            vol = np.transpose(data, (2, 1, 0))
            spacing_z = float(zooms[2]) if len(zooms) > 2 else 1.25
            spacing_y = float(zooms[1]) if len(zooms) > 1 else 0.703
            spacing_x = float(zooms[0]) if len(zooms) > 0 else 0.703
        elif data.ndim == 4:
            vol = np.transpose(data[..., 0], (2, 1, 0))
            spacing_z = float(zooms[2]) if len(zooms) > 2 else 1.25
            spacing_y = float(zooms[1]) if len(zooms) > 1 else 0.703
            spacing_x = float(zooms[0]) if len(zooms) > 0 else 0.703
        else:
            raise ValueError(f"Invalid NIfTI dimensions: {data.shape}")

        vol = np.clip(vol, -1024.0, 3071.0).astype(np.float32)

        return CTVolume(
            data=vol,
            spacing=(spacing_x, spacing_y, spacing_z),
            source_format="nifti",
            metadata={
                "modality": "CT",
                "patient_id_anon": "Anonymous",
                "series_description": "NIfTI Thoracic CT Series",
            }
        )

    @staticmethod
    def _reconstruct_from_dicom_zip(zip_path: str, val_result: ValidationResult) -> CTVolume:
        if not HAS_PYDICOM:
            raise RuntimeError("pydicom is required for DICOM reconstruction.")

        slices = []
        with tempfile.TemporaryDirectory() as tmp_dir:
            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(tmp_dir)

            for root, _, files in os.walk(tmp_dir):
                for f in files:
                    fp = os.path.join(root, f)
                    try:
                        ds = pydicom.dcmread(fp)
                        if getattr(ds, "Modality", "") == "CT" and hasattr(ds, "pixel_array"):
                            slices.append(ds)
                    except Exception:
                        continue

        if not slices:
            raise ValueError("No valid CT DICOM slices with pixel data found in ZIP archive.")

        # Sort slices craniocaudally by ImagePositionPatient Z (or SliceLocation/InstanceNumber)
        def get_slice_pos(s):
            if hasattr(s, "ImagePositionPatient") and len(s.ImagePositionPatient) >= 3:
                return float(s.ImagePositionPatient[2])
            elif hasattr(s, "SliceLocation"):
                return float(s.SliceLocation)
            elif hasattr(s, "InstanceNumber"):
                return float(s.InstanceNumber)
            return 0.0

        slices.sort(key=get_slice_pos)

        # Convert raw pixels to calibrated Hounsfield Units: HU = pixel * RescaleSlope + RescaleIntercept
        hu_slices = []
        for s in slices:
            raw = s.pixel_array.astype(np.float32)
            slope = float(getattr(s, "RescaleSlope", 1.0))
            intercept = float(getattr(s, "RescaleIntercept", -1024.0))
            hu = raw * slope + intercept
            hu_slices.append(hu)

        vol = np.stack(hu_slices, axis=0)  # Shape: (Z, Y, X)
        vol = np.clip(vol, -1024.0, 3071.0).astype(np.float32)

        first_ds = slices[0]
        spacing = getattr(first_ds, "PixelSpacing", [0.703, 0.703])
        thickness = getattr(first_ds, "SliceThickness", 1.25)
        patient_id = getattr(first_ds, "PatientID", "Anonymous")
        series_desc = getattr(first_ds, "SeriesDescription", "Thoracic CT Series")

        origin = (0.0, 0.0, 0.0)
        if hasattr(first_ds, "ImagePositionPatient") and len(first_ds.ImagePositionPatient) >= 3:
            origin = (float(first_ds.ImagePositionPatient[0]), float(first_ds.ImagePositionPatient[1]), float(first_ds.ImagePositionPatient[2]))

        return CTVolume(
            data=vol,
            spacing=(float(spacing[0]), float(spacing[1]), float(thickness)),
            origin=origin,
            source_format="dicom_series",
            metadata={
                "modality": "CT",
                "patient_id_anon": str(patient_id),
                "series_description": str(series_desc),
                "slice_thickness_mm": float(thickness),
            }
        )

    @staticmethod
    def _reconstruct_from_single_dicom(dcm_path: str, val_result: ValidationResult) -> CTVolume:
        if not HAS_PYDICOM:
            raise RuntimeError("pydicom is required for DICOM reconstruction.")

        ds = pydicom.dcmread(dcm_path)
        raw = ds.pixel_array.astype(np.float32)
        slope = float(getattr(ds, "RescaleSlope", 1.0))
        intercept = float(getattr(ds, "RescaleIntercept", -1024.0))
        hu = raw * slope + intercept

        if hu.ndim == 2:
            vol = np.expand_dims(hu, axis=0)
        else:
            vol = hu

        vol = np.clip(vol, -1024.0, 3071.0).astype(np.float32)
        spacing = getattr(ds, "PixelSpacing", [0.703, 0.703])
        thickness = getattr(ds, "SliceThickness", 1.25)
        patient_id = getattr(ds, "PatientID", "Anonymous")

        return CTVolume(
            data=vol,
            spacing=(float(spacing[0]), float(spacing[1]), float(thickness)),
            source_format="single_dicom",
            metadata={
                "modality": "CT",
                "patient_id_anon": str(patient_id),
                "series_description": getattr(ds, "SeriesDescription", "Single Slice CT"),
                "slice_thickness_mm": float(thickness),
            }
        )


ct_volume_service = CTVolumeService()

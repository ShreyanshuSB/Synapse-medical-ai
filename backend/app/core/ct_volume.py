"""
CT 3D Volume Internal Representation & Strict Medical Validation.
Provides standard internal CTVolume data structure with physical geometry,
Hounsfield Unit (HU) calibrated array, and DICOM/NIfTI quality validation.
Research prototype — not a clinical diagnostic device.
"""
import os
import json
import tempfile
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List
import numpy as np

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


@dataclass
class ValidationResult:
    """Medical validation result for volumetric CT studies."""
    status: str  # "VALID", "WARNING", "NOT_SUITABLE"
    is_suitable_for_volumetric: bool
    modality: str
    slice_count: int
    slice_thickness_mm: Optional[float]
    pixel_spacing: Optional[Tuple[float, float]]
    matrix_size: Tuple[int, int]
    warnings: List[str] = field(default_factory=list)
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "is_suitable_for_volumetric": self.is_suitable_for_volumetric,
            "modality": self.modality,
            "slice_count": self.slice_count,
            "slice_thickness_mm": self.slice_thickness_mm,
            "pixel_spacing": list(self.pixel_spacing) if self.pixel_spacing else None,
            "matrix_size": list(self.matrix_size),
            "warnings": self.warnings,
            "reasons": self.reasons,
        }


@dataclass
class CTVolume:
    """
    Standardized internal 3D CT Volume representation.
    Ensures downstream AI algorithms interact with uniform geometry and calibrated HUs.
    """
    data: np.ndarray  # Shape: (Z, Y, X), float32, calibrated HUs [-1024, 3071]
    spacing: Tuple[float, float, float]  # (spacing_x, spacing_y, spacing_z) in mm
    origin: Tuple[float, float, float] = (0.0, 0.0, 0.0)  # (x, y, z) in mm
    direction: Tuple[float, ...] = (1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0)
    affine: Optional[np.ndarray] = None
    source_format: str = "dicom_series"  # "dicom_series", "single_dicom", "nifti", "synthetic"
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def shape(self) -> Tuple[int, int, int]:
        """(depth_z, height_y, width_x)"""
        return self.data.shape

    @property
    def hu_min(self) -> float:
        return float(np.min(self.data))

    @property
    def hu_max(self) -> float:
        return float(np.max(self.data))

    @property
    def hu_mean(self) -> float:
        return float(np.mean(self.data))

    def get_summary_dict(self) -> Dict[str, Any]:
        return {
            "source_format": self.source_format,
            "slice_count": self.shape[0],
            "rows": self.shape[1],
            "cols": self.shape[2],
            "pixel_spacing_x": round(self.spacing[0], 3),
            "pixel_spacing_y": round(self.spacing[1], 3),
            "slice_thickness_mm": round(self.spacing[2], 3),
            "hu_min": round(self.hu_min, 1),
            "hu_max": round(self.hu_max, 1),
            "hu_mean": round(self.hu_mean, 1),
            "origin": list(self.origin),
            "metadata": self.metadata,
        }


class CTValidator:
    """Validates CT imaging studies before admission to the 3D AI pipeline."""

    @staticmethod
    def validate_volume(vol: "CTVolume") -> ValidationResult:
        """Validate an in-memory CTVolume object."""
        reasons = []
        warnings = []
        modality = vol.metadata.get("modality", "UNKNOWN") if vol.metadata else "UNKNOWN"
        if modality != "CT":
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality=modality,
                slice_count=vol.data.shape[0] if vol.data.ndim == 3 else 0,
                slice_thickness_mm=vol.spacing[2] if len(vol.spacing) > 2 else None,
                pixel_spacing=(vol.spacing[0], vol.spacing[1]) if len(vol.spacing) >= 2 else None,
                matrix_size=(vol.data.shape[1], vol.data.shape[2]) if vol.data.ndim == 3 else (0, 0),
                reasons=[f"Modality '{modality}' is not CT (expected thoracic CT)."],
            )

        slice_count = vol.data.shape[0] if vol.data.ndim == 3 else 0
        if slice_count < 5:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="CT",
                slice_count=slice_count,
                slice_thickness_mm=vol.spacing[2] if len(vol.spacing) > 2 else None,
                pixel_spacing=(vol.spacing[0], vol.spacing[1]) if len(vol.spacing) >= 2 else None,
                matrix_size=(vol.data.shape[1], vol.data.shape[2]) if vol.data.ndim == 3 else (0, 0),
                reasons=[f"Insufficient slices: {slice_count} slices detected (minimum 5 required for 3D volumetric analysis)."],
            )

        if len(vol.spacing) > 2 and vol.spacing[2] > 2.5:
            warnings.append(f"Slice thickness is {vol.spacing[2]:.2f} mm (> 2.5 mm).")

        return ValidationResult(
            status="WARNING" if warnings else "VALID",
            is_suitable_for_volumetric=True,
            modality="CT",
            slice_count=slice_count,
            slice_thickness_mm=vol.spacing[2] if len(vol.spacing) > 2 else None,
            pixel_spacing=(vol.spacing[0], vol.spacing[1]) if len(vol.spacing) >= 2 else None,
            matrix_size=(vol.data.shape[1], vol.data.shape[2]) if vol.data.ndim == 3 else (0, 0),
            warnings=warnings,
            reasons=reasons,
        )

    @staticmethod
    def validate_study_file(file_path: str) -> ValidationResult:
        """Inspect and validate an uploaded file (.dcm, .zip, .nii, .nii.gz)."""
        ext = os.path.splitext(file_path)[-1].lower()
        if file_path.endswith(".nii.gz") or ext == ".nii":
            return CTValidator._validate_nifti(file_path)
        elif ext == ".zip":
            return CTValidator._validate_dicom_zip(file_path)
        elif ext == ".dcm":
            return CTValidator._validate_single_dicom(file_path)
        else:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="UNKNOWN",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=[f"File extension '{ext}' is not a recognized volumetric CT format (.dcm, .zip, .nii, .nii.gz)."]
            )

    @staticmethod
    def _validate_nifti(nii_path: str) -> ValidationResult:
        if not HAS_NIBABEL:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="NIFTI",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=["nibabel library is unavailable for NIfTI processing."]
            )

        try:
            img = nib.load(nii_path)
            shape = img.shape
            zooms = img.header.get_zooms()

            if len(shape) < 3:
                return ValidationResult(
                    status="NOT_SUITABLE",
                    is_suitable_for_volumetric=False,
                    modality="NIFTI",
                    slice_count=1 if len(shape) > 0 else 0,
                    slice_thickness_mm=None,
                    pixel_spacing=None,
                    matrix_size=(shape[0] if len(shape) > 0 else 0, shape[1] if len(shape) > 1 else 0),
                    reasons=["NIfTI dataset has fewer than 3 spatial dimensions; 3D volumetric analysis cannot be performed."]
                )

            # Standard NIfTI: shape = (X, Y, Z)
            slice_count = int(shape[2])
            rows = int(shape[1])
            cols = int(shape[0])
            spacing_x = float(zooms[0]) if len(zooms) > 0 else 0.703
            spacing_y = float(zooms[1]) if len(zooms) > 1 else 0.703
            thickness = float(zooms[2]) if len(zooms) > 2 else 1.25

            warnings: List[str] = []
            reasons: List[str] = []

            if slice_count < 5:
                reasons.append(f"Volume contains only {slice_count} slices (minimum 5 required for volumetric nodule detection).")
                return ValidationResult(
                    status="NOT_SUITABLE",
                    is_suitable_for_volumetric=False,
                    modality="CT",
                    slice_count=slice_count,
                    slice_thickness_mm=thickness,
                    pixel_spacing=(spacing_x, spacing_y),
                    matrix_size=(rows, cols),
                    reasons=reasons,
                )

            if thickness > 2.5:
                warnings.append(
                    f"Slice thickness is {thickness:.2f} mm (> 2.5 mm threshold). "
                    "Thin-slice CT (<= 1.5 mm) is clinically recommended for small nodule detection."
                )

            if slice_count < 20:
                warnings.append(f"Limited volumetric coverage ({slice_count} slices). Upper/lower lung lobes may be cut off.")

            status = "WARNING" if warnings else "VALID"
            return ValidationResult(
                status=status,
                is_suitable_for_volumetric=True,
                modality="CT",
                slice_count=slice_count,
                slice_thickness_mm=thickness,
                pixel_spacing=(spacing_x, spacing_y),
                matrix_size=(rows, cols),
                warnings=warnings,
                reasons=reasons,
            )
        except Exception as e:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="NIFTI",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=[f"NIfTI parsing error: {str(e)}"]
            )

    @staticmethod
    def _validate_dicom_zip(zip_path: str) -> ValidationResult:
        if not HAS_PYDICOM:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="DICOM",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=["pydicom library is unavailable for DICOM processing."]
            )

        slices: List[Any] = []
        warnings: List[str] = []
        reasons: List[str] = []

        try:
            with tempfile.TemporaryDirectory() as tmp_dir:
                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(tmp_dir)

                for root, _, files in os.walk(tmp_dir):
                    for f in files:
                        fp = os.path.join(root, f)
                        try:
                            ds = pydicom.dcmread(fp, stop_before_pixels=True)
                            if hasattr(ds, "Modality"):
                                slices.append(ds)
                        except Exception:
                            continue

            if not slices:
                return ValidationResult(
                    status="NOT_SUITABLE",
                    is_suitable_for_volumetric=False,
                    modality="UNKNOWN",
                    slice_count=0,
                    slice_thickness_mm=None,
                    pixel_spacing=None,
                    matrix_size=(0, 0),
                    reasons=["No valid DICOM files were found in the uploaded ZIP archive."]
                )

            # Check modality
            modalities = set(getattr(s, "Modality", "UNKNOWN") for s in slices)
            if "CT" not in modalities:
                return ValidationResult(
                    status="NOT_SUITABLE",
                    is_suitable_for_volumetric=False,
                    modality=", ".join(modalities),
                    slice_count=len(slices),
                    slice_thickness_mm=None,
                    pixel_spacing=None,
                    matrix_size=(0, 0),
                    reasons=[f"Modality is '{', '.join(modalities)}' (expected 'CT'). PulmoScan AI requires thoracic CT scans."]
                )

            # Filter to CT slices only
            ct_slices = [s for s in slices if getattr(s, "Modality", "") == "CT"]
            slice_count = len(ct_slices)

            if slice_count < 5:
                return ValidationResult(
                    status="NOT_SUITABLE",
                    is_suitable_for_volumetric=False,
                    modality="CT",
                    slice_count=slice_count,
                    slice_thickness_mm=None,
                    pixel_spacing=None,
                    matrix_size=(0, 0),
                    reasons=[f"Only {slice_count} CT slices detected (minimum 5 required for 3D volumetric analysis)."]
                )

            first_ds = ct_slices[0]
            spacing = getattr(first_ds, "PixelSpacing", None)
            thickness = getattr(first_ds, "SliceThickness", None)
            rows = int(getattr(first_ds, "Rows", 512))
            cols = int(getattr(first_ds, "Columns", 512))

            pixel_spacing_tuple: Optional[Tuple[float, float]] = None
            if spacing and len(spacing) >= 2:
                try:
                    pixel_spacing_tuple = (float(spacing[0]), float(spacing[1]))
                except (ValueError, TypeError):
                    warnings.append("Pixel spacing could not be parsed numerically; defaulting to standard 0.703 mm.")
            else:
                warnings.append("PixelSpacing header missing in DICOM; physical dimensions are estimated.")

            thickness_val: Optional[float] = None
            if thickness is not None:
                try:
                    thickness_val = float(thickness)
                    if thickness_val > 2.5:
                        warnings.append(f"Slice thickness is {thickness_val:.2f} mm (> 2.5 mm). Thin-slice CT provides higher nodule sensitivity.")
                except (ValueError, TypeError):
                    warnings.append("SliceThickness could not be parsed numerically.")
            else:
                warnings.append("SliceThickness tag missing in DICOM metadata.")

            # Check series coherence
            series_uids = set(getattr(s, "SeriesInstanceUID", "UNKNOWN") for s in ct_slices)
            if len(series_uids) > 1:
                warnings.append(f"Multiple series detected in ZIP archive ({len(series_uids)} series). Analysis will focus on primary series.")

            status = "WARNING" if warnings else "VALID"
            return ValidationResult(
                status=status,
                is_suitable_for_volumetric=True,
                modality="CT",
                slice_count=slice_count,
                slice_thickness_mm=thickness_val,
                pixel_spacing=pixel_spacing_tuple,
                matrix_size=(rows, cols),
                warnings=warnings,
                reasons=reasons,
            )
        except Exception as e:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="DICOM",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=[f"DICOM archive validation error: {str(e)}"]
            )

    @staticmethod
    def _validate_single_dicom(dcm_path: str) -> ValidationResult:
        if not HAS_PYDICOM:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="DICOM",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=["pydicom library is unavailable for DICOM processing."]
            )

        try:
            ds = pydicom.dcmread(dcm_path, stop_before_pixels=True)
            modality = getattr(ds, "Modality", "UNKNOWN")
            if modality != "CT":
                return ValidationResult(
                    status="NOT_SUITABLE",
                    is_suitable_for_volumetric=False,
                    modality=modality,
                    slice_count=1,
                    slice_thickness_mm=None,
                    pixel_spacing=None,
                    matrix_size=(0, 0),
                    reasons=[f"Modality is '{modality}' (expected 'CT'). Single slice is not a thoracic CT."]
                )

            spacing = getattr(ds, "PixelSpacing", None)
            thickness = getattr(ds, "SliceThickness", None)
            rows = int(getattr(ds, "Rows", 512))
            cols = int(getattr(ds, "Columns", 512))

            pixel_spacing_tuple: Optional[Tuple[float, float]] = None
            if spacing and len(spacing) >= 2:
                pixel_spacing_tuple = (float(spacing[0]), float(spacing[1]))

            thickness_val = float(thickness) if thickness is not None else None

            warnings = [
                "Single-slice DICOM uploaded. True 3D volumetric detection and longitudinal growth require a multi-slice series.",
            ]

            return ValidationResult(
                status="WARNING",
                is_suitable_for_volumetric=True,
                modality="CT",
                slice_count=1,
                slice_thickness_mm=thickness_val,
                pixel_spacing=pixel_spacing_tuple,
                matrix_size=(rows, cols),
                warnings=warnings,
                reasons=[],
            )
        except Exception as e:
            return ValidationResult(
                status="NOT_SUITABLE",
                is_suitable_for_volumetric=False,
                modality="DICOM",
                slice_count=0,
                slice_thickness_mm=None,
                pixel_spacing=None,
                matrix_size=(0, 0),
                reasons=[f"DICOM parsing error: {str(e)}"]
            )

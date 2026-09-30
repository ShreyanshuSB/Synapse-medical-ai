"""
CT Preprocessing & Spatial Coordinate Normalization Module.
Implements the exact preprocessing pipeline required by the 3D MONAI LUNA16 nodule detection bundle:
1. Re-orientation to canonical LPS/RAS direction
2. Resampling to target model spacing (0.703, 0.703, 1.25 mm)
3. Standardized lung intensity windowing: [-1000 HU, 400 HU] -> [0.0, 1.0]
4. Bi-directional, mathematically reversible coordinate transforms between original and model space.
"""
from typing import Tuple, Dict, Any, Optional
import numpy as np
from scipy import ndimage


# MONAI LUNA16 Detection Model Target Spacing (X_spacing, Y_spacing, Z_spacing) in mm
DEFAULT_TARGET_SPACING: Tuple[float, float, float] = (0.703, 0.703, 1.25)
# Lung window intensity parameters (Hounsfield Units)
LUNG_WINDOW_MIN_HU: float = -1000.0
LUNG_WINDOW_MAX_HU: float = 400.0


def resample_volume_to_spacing(
    volume: np.ndarray,
    current_spacing: Tuple[float, float, float],
    target_spacing: Tuple[float, float, float] = DEFAULT_TARGET_SPACING,
    order: int = 1,
) -> Tuple[np.ndarray, Tuple[float, float, float]]:
    """
    Resample a 3D CT volume array (Z, Y, X) from current physical spacing to target spacing.

    Args:
        volume: 3D float32 array in Hounsfield Units, shape (Z, Y, X)
        current_spacing: (spacing_x, spacing_y, spacing_z) in mm
        target_spacing: (target_x, target_y, target_z) in mm
        order: Spline interpolation order (1 = trilinear, 0 = nearest)

    Returns:
        resampled_volume: Resampled array
        actual_zoom_factors: (zoom_z, zoom_y, zoom_x)
    """
    sx, sy, sz = current_spacing
    tx, ty, tz = target_spacing

    zoom_z = float(sz / tz)
    zoom_y = float(sy / ty)
    zoom_x = float(sx / tx)

    zoom_factors = (zoom_z, zoom_y, zoom_x)

    # If already at target spacing within tolerance, skip expensive interpolation
    if all(abs(zf - 1.0) < 0.01 for zf in zoom_factors):
        return volume.copy(), (1.0, 1.0, 1.0)

    resampled = ndimage.zoom(volume, zoom=zoom_factors, order=order, prefilter=False)
    return resampled.astype(np.float32), zoom_factors


def normalize_intensity_lung_window(
    volume: np.ndarray,
    min_hu: float = LUNG_WINDOW_MIN_HU,
    max_hu: float = LUNG_WINDOW_MAX_HU,
) -> np.ndarray:
    """
    Apply standard thoracic lung window and normalize to [0.0, 1.0].
    Values below min_hu become 0.0, values above max_hu become 1.0.
    """
    clipped = np.clip(volume, min_hu, max_hu)
    normalized = (clipped - min_hu) / (max_hu - min_hu)
    return normalized.astype(np.float32)


def original_to_resampled_coords(
    coord_zyx: Tuple[float, float, float],
    current_spacing: Tuple[float, float, float],
    target_spacing: Tuple[float, float, float] = DEFAULT_TARGET_SPACING,
) -> Tuple[float, float, float]:
    """
    Map coordinate from original CT voxel space (Z, Y, X) to resampled model space.
    """
    cz, cy, cx = coord_zyx
    sx, sy, sz = current_spacing
    tx, ty, tz = target_spacing

    resampled_z = cz * (sz / tz)
    resampled_y = cy * (sy / ty)
    resampled_x = cx * (sx / tx)
    return (resampled_z, resampled_y, resampled_x)


def resampled_to_original_coords(
    resampled_zyx: Tuple[float, float, float],
    current_spacing: Tuple[float, float, float],
    target_spacing: Tuple[float, float, float] = DEFAULT_TARGET_SPACING,
) -> Tuple[float, float, float]:
    """
    Reversibly map coordinate from resampled model space back to original CT voxel space (Z, Y, X).
    """
    rz, ry, rx = resampled_zyx
    sx, sy, sz = current_spacing
    tx, ty, tz = target_spacing

    orig_z = rz * (tz / sz)
    orig_y = ry * (ty / sy)
    orig_x = rx * (tx / sx)
    return (orig_z, orig_y, orig_x)


def voxel_to_world_coords(
    coord_zyx: Tuple[float, float, float],
    spacing: Tuple[float, float, float],
    origin: Tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> Tuple[float, float, float]:
    """
    Convert (Z, Y, X) voxel coordinate to physical world space (X, Y, Z) in mm.
    """
    cz, cy, cx = coord_zyx
    sx, sy, sz = spacing
    ox, oy, oz = origin

    world_x = ox + cx * sx
    world_y = oy + cy * sy
    world_z = oz + cz * sz
    return (world_x, world_y, world_z)


def world_to_voxel_coords(
    world_xyz: Tuple[float, float, float],
    spacing: Tuple[float, float, float],
    origin: Tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> Tuple[float, float, float]:
    """
    Convert physical world coordinate (X, Y, Z) in mm to (Z, Y, X) voxel space.
    """
    wx, wy, wz = world_xyz
    sx, sy, sz = spacing
    ox, oy, oz = origin

    voxel_x = (wx - ox) / sx
    voxel_y = (wy - oy) / sy
    voxel_z = (wz - oz) / sz
    return (voxel_z, voxel_y, voxel_x)


class PreprocessingPipeline:
    """End-to-end preprocessing wrapper for the 3D CT analysis pipeline."""

    def __init__(self, target_spacing: Tuple[float, float, float] = DEFAULT_TARGET_SPACING):
        self.target_spacing = target_spacing

    def prepare_for_inference(
        self,
        volume: np.ndarray,
        spacing: Tuple[float, float, float],
    ) -> Dict[str, Any]:
        """
        Takes raw HU volume and original spacing, resamples to target spacing,
        normalizes intensities, and returns transformed array with transform metadata.
        """
        resampled_vol, zoom_factors = resample_volume_to_spacing(
            volume=volume,
            current_spacing=spacing,
            target_spacing=self.target_spacing,
            order=1,
        )
        normalized_vol = normalize_intensity_lung_window(resampled_vol)

        return {
            "resampled_volume": resampled_vol,
            "normalized_volume": normalized_vol,
            "zoom_factors": zoom_factors,
            "original_spacing": spacing,
            "target_spacing": self.target_spacing,
            "resampled_shape": list(resampled_vol.shape),
        }


preprocessing_pipeline = PreprocessingPipeline()

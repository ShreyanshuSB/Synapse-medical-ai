/**
 * File validation and input classification utility for PulmoScan AI.
 * Centralizes all extension checking, size constraints, and input_type/analysis_mode detection.
 */

import type { InputType, AnalysisMode } from "@/types/api";

export const MAX_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

export const IMAGE_CT_EXTENSIONS = [
  ".dcm",
  ".zip",
  ".nii",
  ".nii.gz",
  ".png",
  ".jpg",
  ".jpeg",
] as const;

export const VIDEO_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".mov",
  ".webm",
  ".avi",
] as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  category?: "image_ct" | "video";
  inputType?: InputType;
  analysisMode?: AnalysisMode;
  modeLabel?: string;
  isVolumetric?: boolean;
}

/**
 * Detect input_type and analysis_mode from a filename or File object.
 */
export function detectFileClassification(filename: string): {
  inputType: InputType;
  analysisMode: AnalysisMode;
  category: "image_ct" | "video";
  modeLabel: string;
  isVolumetric: boolean;
} | null {
  const lower = filename.toLowerCase();

  // 3D Volumetric CT: NIfTI
  if (lower.endsWith(".nii.gz") || lower.endsWith(".nii")) {
    return {
      inputType: "nifti",
      analysisMode: "volumetric_ct",
      category: "image_ct",
      modeLabel: "3D Volumetric CT Analysis (NIfTI)",
      isVolumetric: true,
    };
  }

  // 3D Volumetric CT: DICOM (.zip or .dcm)
  if (lower.endsWith(".zip") || lower.endsWith(".dcm")) {
    return {
      inputType: "dicom",
      analysisMode: "volumetric_ct",
      category: "image_ct",
      modeLabel: "3D Volumetric CT Analysis (DICOM)",
      isVolumetric: true,
    };
  }

  // 2D Image Review: PNG, JPG, JPEG
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  ) {
    return {
      inputType: "image",
      analysisMode: "image_review",
      category: "image_ct",
      modeLabel: "2D Visual Review (Medical Photo / Image)",
      isVolumetric: false,
    };
  }

  // CT Video Review: MP4, MKV, MOV, WEBM, AVI
  if (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mkv") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".webm") ||
    lower.endsWith(".avi")
  ) {
    return {
      inputType: "video",
      analysisMode: "video_review",
      category: "video",
      modeLabel: "Visual Review (CT Video Cine)",
      isVolumetric: false,
    };
  }

  return null;
}

/**
 * Validate a file against upload rules.
 * @param file File object from input or drop event
 * @param expectedCategory Optional filter: "image_ct" or "video"
 */
export function validateUploadFile(
  file: File,
  expectedCategory?: "image_ct" | "video"
): FileValidationResult {
  if (!file) {
    return { valid: false, error: "No file was selected." };
  }

  // Size limit check
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 500 MB.`,
    };
  }

  const classification = detectFileClassification(file.name);
  if (!classification) {
    return {
      valid: false,
      error:
        "Unsupported file type. Please upload a supported CT study (.dcm, .zip, .nii, .nii.gz), medical image (.png, .jpg, .jpeg), or CT video (.mp4, .mkv, .mov, .webm, .avi).",
    };
  }

  // If a specific card/category was targeted, enforce it with friendly guidance
  if (expectedCategory && classification.category !== expectedCategory) {
    if (expectedCategory === "image_ct") {
      return {
        valid: false,
        error:
          "This upload card is for CT Images / Photos (.dcm, .zip, .nii, .png, .jpg). Please use the CT Video card for video uploads.",
      };
    } else if (expectedCategory === "video") {
      return {
        valid: false,
        error:
          "This upload card is for CT Videos (.mp4, .mkv, .mov, .webm, .avi). Please use the CT Image / Photo card for images or volumetric studies.",
      };
    }
  }

  return {
    valid: true,
    category: classification.category,
    inputType: classification.inputType,
    analysisMode: classification.analysisMode,
    modeLabel: classification.modeLabel,
    isVolumetric: classification.isVolumetric,
  };
}

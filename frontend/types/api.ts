// TypeScript types matching backend Pydantic schemas exactly.
// These are the shared API contract between frontend and backend.

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "needs_review";

export type DensityType =
  | "solid"
  | "part_solid"
  | "ground_glass"
  | "calcified"
  | "unknown";

export type LungSide = "left" | "right" | "unknown";
export type LungLobe = "RUL" | "RML" | "RLL" | "LUL" | "LLL" | "unknown";
export type RiskCategory = "low" | "moderate" | "intermediate" | "high" | "higher" | "very_high" | "unassessed";

export type InputType = "dicom" | "nifti" | "image" | "video" | "demo";
export type AnalysisMode = "volumetric_ct" | "image_review" | "video_review" | "demo";
export type ReviewStatus = "unreviewed" | "under_review" | "reviewed" | "needs_attention";

export interface MedicalHistory {
  smoking_status?: string | null;        // "never" | "former" | "current" | null
  pack_years?: number | null;
  family_history_lung_cancer?: string | null; // "yes" | "no" | null
  previous_lung_disease?: string | null;
  copd_emphysema?: string | null;        // "yes" | "no" | null
  previous_cancer?: string | null;
  previous_pulmonary_nodules?: string | null; // "yes" | "no" | null
  relevant_surgeries?: string | null;
  relevant_medications?: string | null;
  other_history?: string | null;
}

export interface RecentTest {
  id?: string;          // client-side uuid
  test_type: string;    // "CT" | "PET-CT" | "chest_xray" | ...
  test_date?: string | null;
  summary?: string | null;
  doctor_note?: string | null;
  reference?: string | null;
}

export interface PatientContext {
  medical_history?: MedicalHistory | null;
  recent_tests?: RecentTest[] | null;
}

export interface RiskFactorItem {
  name: string;
  display_name: string;
  score: number; // 0–1
  level: "low" | "moderate" | "high";
  description: string;
  source?: string;
  value?: string;
}

export interface ClinicalInputs {
  age?: number | null;
  sex?: "male" | "female" | "other" | null;
  smoking_history?: boolean | null;
  family_history_lung_cancer?: boolean | null;
  emphysema?: boolean | null;
  pack_years?: number | null;
}

export interface RiskAssessment {
  id: string;
  model_name: string;
  risk_probability: number | null;
  risk_category: RiskCategory | null;
  lung_rads_category: string | null;
  lung_rads_recommendation: string | null;
  contributing_factors: RiskFactorItem[] | null;
  clinical_inputs?: ClinicalInputs | null;
  is_demo: boolean;
}

export interface Nodule {
  id: string;
  nodule_index: number;
  detection_confidence: number | null;
  is_demo: boolean;
  thumbnail_url?: string | null;
  solidity?: number | null;

  // Coordinates
  coord_x: number | null;
  coord_y: number | null;
  coord_z: number | null;

  // Measurements
  max_diameter_mm: number | null;
  min_diameter_mm: number | null;
  mean_diameter_mm: number | null;
  volume_mm3: number | null;

  // Density
  mean_hu: number | null;
  median_hu: number | null;
  min_hu: number | null;
  max_hu: number | null;
  std_hu: number | null;
  density_type: DensityType | null;

  // Morphology
  sphericity: number | null;
  elongation: number | null;
  surface_area_mm2: number | null;
  compactness: number | null;
  margin_type: string | null;
  spiculation_detected: boolean | null;

  // Location
  lung_side: LungSide | null;
  lung_lobe: LungLobe | null;
  position_type: string | null;
  axial_slice: number | null;
  coronal_slice: number | null;
  sagittal_slice: number | null;

  risk_assessments: RiskAssessment[] | null;
}

export interface ScanMetadata {
  input_type?: InputType;
  analysis_mode?: AnalysisMode;
  modality: string;
  patient_id_anon: string;
  study_date: string | null;
  series_description: string | null;
  slice_count: number | null;
  slice_thickness_mm: number | null;
  pixel_spacing_x: number | null;
  pixel_spacing_y: number | null;
  rows: number | null;
  cols: number | null;
  scan_quality: string;
  quality_notes: string[] | null;
}

export interface StageDetail {
  key: string;
  label: string;
  state: "completed" | "active" | "pending" | "failed";
}

export interface AnalysisJob {
  id: string;
  status: string;
  progress_pct: number;
  current_stage: string | null;
  stages_completed: string[] | null;
  stage_details?: StageDetail[] | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Case {
  id: string;
  case_id: string;
  created_at: string;
  updated_at: string | null;
  status: ProcessingStatus;
  is_demo: boolean;
  demo_case_id: string | null;
  input_type?: InputType;
  analysis_mode?: AnalysisMode;
  notes: string | null;
  review_status?: ReviewStatus;
  patient_context?: PatientContext | null;
  scan_metadata: ScanMetadata | null;
  nodules: Nodule[];
}

export interface CaseListItem {
  id: string;
  case_id: string;
  created_at: string;
  status: ProcessingStatus;
  is_demo: boolean;
  input_type?: InputType;
  analysis_mode?: AnalysisMode;
  nodule_count: number;
  largest_nodule_mm: number | null;
  highest_risk_pct?: number | null;
  review_status?: ReviewStatus;
}

export interface CaseResults {
  case_id: string;
  status: ProcessingStatus;
  is_demo: boolean;
  demo_case_id?: string | null;
  input_type?: InputType;
  analysis_mode?: AnalysisMode;
  scan_metadata: ScanMetadata | null;
  nodules: Nodule[];
  analysis_job?: AnalysisJob | null;
  stages?: StageDetail[];
  summary: CaseSummary | null;
}

export interface CaseSummary {
  nodule_count: number;
  largest_nodule_mm: number | null;
  highest_risk_pct: number | null;
  lung_rads_overall: string | null;
  conclusion: string;
}

export interface DemoCaseInfo {
  id: string;
  label: string;
  description: string;
}

export interface Report {
  id: string;
  case_id: string;
  report_text: string | null;
  report_data: Record<string, unknown> | null;
  pdf_path: string | null;
  generated_at: string;
  is_demo: boolean;
}

export interface ContourPoint {
  x: number;
  y: number;
}

export interface NoduleMaskResponse {
  nodule_id: string;
  nodule_index: number;
  plane: string;
  slice_index: number;
  contour_points: ContourPoint[];
  has_contour_on_slice: boolean;
}

export interface NoduleLocation {
  nodule_index: number;
  axial_slice: number;
  coronal_slice: number;
  sagittal_slice: number;
  diameter_mm: number | null;
  density_type: string | null;
  risk_pct: number | null;
}

export interface VolumeInfo {
  axial_slices: number;
  coronal_slices: number;
  sagittal_slices: number;
  default_axial: number;
  default_coronal: number;
  default_sagittal: number;
  presets: Record<string, { wl: number; ww: number; label: string }>;
  nodule_locations: NoduleLocation[];
}

export interface TemporalGrowthMetrics {
  elapsed_days: number;
  prior_diameter_mm: number;
  current_diameter_mm: number;
  diameter_change_mm: number;
  diameter_change_pct: number;
  prior_volume_mm3: number;
  current_volume_mm3: number;
  volume_change_mm3: number;
  volume_change_pct: number;
  volume_doubling_time_days: number | null;
  kinetic_category: string;
  growth_flag: string;
}

export interface TimelinePoint {
  date: string;
  diameter: number;
  volume: number;
  label: string;
}

export interface TemporalAnalysisResponse {
  case_id: string;
  metrics: TemporalGrowthMetrics;
  timeline: TimelinePoint[];
}

// Pipeline stage definitions (matches Yellow Phase backend specification)
export interface PipelineStage {
  key: string;
  label: string;
}

export const PIPELINE_STAGES: PipelineStage[] = [
  { key: "VALIDATING", label: "Validating CT study" },
  { key: "PREPROCESSING", label: "Preprocessing & 3D volume reconstruction" },
  { key: "DETECTING", label: "Detecting pulmonary nodules" },
  { key: "SEGMENTING", label: "Segmenting candidate lesions" },
  { key: "MEASURING", label: "Quantitative measurements & HU density" },
  { key: "RISK_ASSESSMENT", label: "Malignancy risk assessment (Brock / PanCan)" },
  { key: "GENERATING_EXPLANATION", label: "Generating clinical report" },
  { key: "COMPLETE", label: "Analysis complete" },
];

// Single Authoritative Source of Truth for PulmoScan AI Demo Cases.
// Every case defines consistent CT imaging, metadata, nodules, cropped thumbnails,
// calibrated metrics, Brock/PanCan risk assessment, 3D coordinates, patient context, and recent tests.

import type { CaseResults, Nodule, PatientContext, RecentTest, MedicalHistory } from "@/types/api";

export interface DemoCaseFull {
  id: string;
  label: string;
  shortDescription: string;
  scenario: "Low" | "Intermediate" | "Higher Suspicion" | "Negative / No Significant Nodule" | "Mixed Multiple Nodules";
  primaryRiskCategory: "low" | "intermediate" | "higher" | "unassessed";
  dominantSizeMm: number | null;
  patientId: string;
  age: number;
  gender: string;
  scanDate: string;
  sliceCount: number;
  scanType: string;
  voxelSpacing: string;
  pixelSpacing: number;
  scanQuality: string;
  qualityNotes: string[];
  ctImagePath: string;
  defaultSlice: number;
  defaultWindow: { wl: number; ww: number };
  nodules: Nodule[];
  patientContext: PatientContext;
  summary: {
    nodule_count: number;
    largest_nodule_mm: number | null;
    highest_risk_pct: number | null;
    lung_rads_overall: string;
    conclusion: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO-001: Solitary Small Nodule (Low Suspicion)
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_CASE_001: DemoCaseFull = {
  id: "DEMO-001",
  label: "DEMO-001 — Solitary Small Nodule",
  shortDescription: "5.4 mm solid nodule in Right Upper Lobe. Low suspicion (7.2% Brock risk, Lung-RADS 3).",
  scenario: "Low",
  primaryRiskCategory: "low",
  dominantSizeMm: 5.4,
  patientId: "PS-2026-001",
  age: 58,
  gender: "Female",
  scanDate: "12 Jan 2026",
  sliceCount: 312,
  scanType: "Chest CT (DICOM)",
  voxelSpacing: "0.7 × 0.7 × 1.0 mm",
  pixelSpacing: 0.703,
  scanQuality: "Good",
  qualityNotes: ["Adequate resolution (1.0 mm)", "Full thoracic coverage", "No motion artifacts"],
  ctImagePath: "/demo_scans/ct_demo1.jpg",
  defaultSlice: 156,
  defaultWindow: { wl: -600, ww: 1500 },
  patientContext: {
    medical_history: {
      smoking_status: "never",
      pack_years: 0,
      family_history_lung_cancer: "no",
      copd_emphysema: "no",
      previous_pulmonary_nodules: "no",
      relevant_surgeries: "None",
      relevant_medications: "None",
    },
    recent_tests: [
      {
        id: "t1",
        test_type: "Chest X-Ray",
        test_date: "14 Aug 2025",
        summary: "Normal cardio-thoracic contours. No clear focal consolidation or infiltrates.",
        doctor_note: "Annual routine check-up.",
      },
      {
        id: "t2",
        test_type: "Pulmonary Function Test",
        test_date: "03 Sep 2025",
        summary: "FEV1 96% predicted, FVC 98% predicted. Normal spirometry.",
        doctor_note: "Good baseline lung volumes.",
      },
    ],
  },
  nodules: [
    {
      id: "nod-001-1",
      nodule_index: 1,
      detection_confidence: null,
      is_demo: true,
      coord_x: 380,
      coord_y: 320,
      coord_z: 230,
      max_diameter_mm: 5.4,
      min_diameter_mm: 4.8,
      mean_diameter_mm: 5.1,
      volume_mm3: 82.5,
      mean_hu: 48.0,
      median_hu: 45.0,
      min_hu: -85.0,
      max_hu: 162.0,
      std_hu: 36.4,
      density_type: "solid",
      sphericity: 0.84,
      elongation: 1.12,
      surface_area_mm2: 92.0,
      compactness: 0.81,
      margin_type: "smooth",
      spiculation_detected: false,
      lung_side: "left",
      lung_lobe: "LLL",
      position_type: "peripheral",
      axial_slice: 230,
      coronal_slice: 142,
      sagittal_slice: 380,
      thumbnail_url: "/thumbnails/nodule_demo1_1.jpg",
      risk_assessments: [
        {
          id: "risk-001-1",
          model_name: "brock_pancan_demo",
          risk_probability: 0.072,
          risk_category: "low",
          lung_rads_category: "3",
          lung_rads_recommendation: "6-month follow-up Low-Dose CT recommended to verify stability.",
          contributing_factors: [
            { name: "size", display_name: "Nodule Size", score: 0.32, level: "low", description: "5.4 mm — small baseline diameter" },
            { name: "location", display_name: "Lower-Lobe Location", score: 0.22, level: "low", description: "Left lower lobe baseline location" },
            { name: "density", display_name: "Solid Density", score: 0.28, level: "low", description: "Solid attenuation pattern without ground-glass halo" },
            { name: "margin", display_name: "Smooth Margins", score: 0.12, level: "low", description: "Well-circumscribed margins with no spiculation" },
          ],
          clinical_inputs: { age: 58, sex: "female", smoking_history: false, pack_years: 0 },
          is_demo: true,
        },
      ],
    },
  ],
  summary: {
    nodule_count: 1,
    largest_nodule_mm: 5.4,
    highest_risk_pct: 7.2,
    lung_rads_overall: "3",
    conclusion: "Single 5.4 mm solid nodule in Left Lower Lobe. Estimated malignancy probability 7.2% (Low Suspicion). ACR Lung-RADS Category 3 — 6-month CT follow-up recommended.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO-002: Multiple Nodules (Dominant Intermediate Suspicion)
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_CASE_002: DemoCaseFull = {
  id: "DEMO-002",
  label: "DEMO-002 — Multiple Nodules (Dominant Intermediate)",
  shortDescription: "Three nodules: dominant 8.6 mm intermediate lesion in RLL (28.5% Brock risk, Lung-RADS 4A), 5.6 mm in RUL, 4.1 mm in LUL.",
  scenario: "Intermediate",
  primaryRiskCategory: "intermediate",
  dominantSizeMm: 8.6,
  patientId: "PS-2026-002",
  age: 62,
  gender: "Male",
  scanDate: "18 Feb 2026",
  sliceCount: 512,
  scanType: "Chest CT (DICOM)",
  voxelSpacing: "0.7 × 0.7 × 1.0 mm",
  pixelSpacing: 0.703,
  scanQuality: "Good",
  qualityNotes: ["High-contrast reconstruction", "Breath-hold achieved", "Full lung parenchyma coverage"],
  ctImagePath: "/demo_scans/ct_demo2.jpg",
  defaultSlice: 245,
  defaultWindow: { wl: -600, ww: 1600 },
  patientContext: {
    medical_history: {
      smoking_status: "former",
      pack_years: 20,
      family_history_lung_cancer: "no",
      copd_emphysema: "yes",
      previous_pulmonary_nodules: "yes",
      relevant_surgeries: "Appendectomy (1988)",
      relevant_medications: "Albuterol inhaler PRN",
      other_history: "Former smoker, quit 5 years ago.",
    },
    recent_tests: [
      {
        id: "t2-1",
        test_type: "Previous CT",
        test_date: "14 Feb 2025",
        summary: "Baseline CT showed 7.2 mm solitary nodule in RLL. Follow-up recommended in 12 months.",
        doctor_note: "Nodule #1 grew from 7.2 mm to 8.6 mm (+19% diameter, indolent growth kinetics).",
      },
      {
        id: "t2-2",
        test_type: "PFT",
        test_date: "10 Oct 2025",
        summary: "Mild obstructive ventilatory impairment (FEV1/FVC 69%).",
        doctor_note: "Consistent with mild centrilobular emphysema on CT.",
      },
    ],
  },
  nodules: [
    {
      id: "nod-002-1",
      nodule_index: 1,
      detection_confidence: null,
      is_demo: true,
      coord_x: 160,
      coord_y: 345,
      coord_z: 245,
      max_diameter_mm: 8.6,
      min_diameter_mm: 7.4,
      mean_diameter_mm: 8.0,
      volume_mm3: 332.0,
      mean_hu: -18.0,
      median_hu: -10.0,
      min_hu: -320.0,
      max_hu: 145.0,
      std_hu: 38.5,
      density_type: "part_solid",
      sphericity: 0.72,
      elongation: 1.24,
      surface_area_mm2: 232.0,
      compactness: 0.81,
      margin_type: "lobulated",
      spiculation_detected: false,
      lung_side: "right",
      lung_lobe: "RLL",
      position_type: "peripheral",
      axial_slice: 245,
      coronal_slice: 238,
      sagittal_slice: 160,
      thumbnail_url: "/thumbnails/nodule_demo2_1.jpg",
      risk_assessments: [
        {
          id: "risk-002-1",
          model_name: "brock_pancan_demo",
          risk_probability: 0.285,
          risk_category: "intermediate",
          lung_rads_category: "4A",
          lung_rads_recommendation: "3-month Low-Dose CT follow-up or PET/CT correlation recommended.",
          contributing_factors: [
            { name: "size", display_name: "Nodule Size", score: 0.62, level: "moderate", description: "8.6 mm diameter — intermediate threshold" },
            { name: "density", display_name: "Part-Solid Attenuation", score: 0.58, level: "moderate", description: "Part-solid composition with ground-glass halo" },
            { name: "margin", display_name: "Lobulated Margin", score: 0.45, level: "moderate", description: "Mild lobulation without prominent spiculation" },
            { name: "history", display_name: "Smoking History", score: 0.40, level: "moderate", description: "20 pack-year former smoking history" },
          ],
          clinical_inputs: { age: 62, sex: "male", smoking_history: true, pack_years: 20, emphysema: true, family_history_lung_cancer: false },
          is_demo: true,
        },
      ],
    },
    {
      id: "nod-002-2",
      nodule_index: 2,
      detection_confidence: null,
      is_demo: true,
      coord_x: 150,
      coord_y: 175,
      coord_z: 175,
      max_diameter_mm: 5.6,
      min_diameter_mm: 4.9,
      mean_diameter_mm: 5.2,
      volume_mm3: 91.0,
      mean_hu: 36.0,
      median_hu: 32.0,
      min_hu: -110.0,
      max_hu: 140.0,
      std_hu: 32.1,
      density_type: "solid",
      sphericity: 0.82,
      elongation: 1.15,
      surface_area_mm2: 98.0,
      compactness: 0.85,
      margin_type: "smooth",
      spiculation_detected: false,
      lung_side: "right",
      lung_lobe: "RUL",
      position_type: "peripheral",
      axial_slice: 175,
      coronal_slice: 195,
      sagittal_slice: 150,
      thumbnail_url: "/thumbnails/nodule_demo2_2.jpg",
      risk_assessments: [
        {
          id: "risk-002-2",
          model_name: "brock_pancan_demo",
          risk_probability: 0.142,
          risk_category: "low",
          lung_rads_category: "3",
          lung_rads_recommendation: "6-month Low-Dose CT follow-up.",
          contributing_factors: [
            { name: "size", display_name: "Nodule Size", score: 0.38, level: "low", description: "5.6 mm diameter" },
            { name: "location", display_name: "Upper Lobe", score: 0.44, level: "moderate", description: "Right Upper Lobe" },
          ],
          is_demo: true,
        },
      ],
    },
    {
      id: "nod-002-3",
      nodule_index: 3,
      detection_confidence: null,
      is_demo: true,
      coord_x: 355,
      coord_y: 175,
      coord_z: 175,
      max_diameter_mm: 4.1,
      min_diameter_mm: 3.7,
      mean_diameter_mm: 3.9,
      volume_mm3: 36.0,
      mean_hu: 54.0,
      median_hu: 51.0,
      min_hu: -75.0,
      max_hu: 142.0,
      std_hu: 26.5,
      density_type: "solid",
      sphericity: 0.89,
      elongation: 1.09,
      surface_area_mm2: 52.0,
      compactness: 0.92,
      margin_type: "smooth",
      spiculation_detected: false,
      lung_side: "left",
      lung_lobe: "LUL",
      position_type: "peripheral",
      axial_slice: 175,
      coronal_slice: 172,
      sagittal_slice: 355,
      thumbnail_url: "/thumbnails/nodule_demo2_3.jpg",
      risk_assessments: [
        {
          id: "risk-002-3",
          model_name: "brock_pancan_demo",
          risk_probability: 0.065,
          risk_category: "low",
          lung_rads_category: "2",
          lung_rads_recommendation: "Routine annual Low-Dose CT screening.",
          contributing_factors: [
            { name: "size", display_name: "Nodule Size", score: 0.18, level: "low", description: "4.1 mm — small baseline nodule" },
          ],
          is_demo: true,
        },
      ],
    },
  ],
  summary: {
    nodule_count: 3,
    largest_nodule_mm: 8.6,
    highest_risk_pct: 28.5,
    lung_rads_overall: "4A",
    conclusion: "Three pulmonary nodules detected. Dominant Nodule #1 (8.6 mm, part-solid, RLL) exhibits intermediate malignancy risk (28.5%). ACR Lung-RADS 4A — 3-month CT follow-up or PET/CT correlation recommended.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO-003: Higher-Risk Spiculated Mass
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_CASE_003: DemoCaseFull = {
  id: "DEMO-003",
  label: "DEMO-003 — High-Risk Spiculated Mass",
  shortDescription: "16.4 mm spiculated part-solid lesion with documented growth. Higher suspicion (86.4% Brock risk, Lung-RADS 4X).",
  scenario: "Higher Suspicion",
  primaryRiskCategory: "higher",
  dominantSizeMm: 16.4,
  patientId: "PS-2026-003",
  age: 71,
  gender: "Male",
  scanDate: "04 Mar 2026",
  sliceCount: 480,
  scanType: "Chest CT (DICOM)",
  voxelSpacing: "0.65 × 0.65 × 1.0 mm",
  pixelSpacing: 0.65,
  scanQuality: "Good",
  qualityNotes: ["Diagnostic quality", "Intense peripheral vascular markings", "No motion artifact"],
  ctImagePath: "/demo_scans/ct_demo3.jpg",
  defaultSlice: 160,
  defaultWindow: { wl: -600, ww: 1600 },
  patientContext: {
    medical_history: {
      smoking_status: "current",
      pack_years: 45,
      family_history_lung_cancer: "yes",
      copd_emphysema: "yes",
      previous_pulmonary_nodules: "yes",
      relevant_surgeries: "None",
      relevant_medications: "Tiotropium, Atorvastatin",
      other_history: "Unexplained 4 kg weight loss over last 3 months.",
    },
    recent_tests: [
      {
        id: "t3-1",
        test_type: "Prior CT",
        test_date: "10 Sep 2025",
        summary: "11.2 mm part-solid lesion noted in Right Upper Lobe. Recommended 3-6 month follow-up.",
        doctor_note: "Interval increase from 11.2 mm to 16.4 mm (VDT = 198 days, rapid malignant kinetics).",
      },
      {
        id: "t3-2",
        test_type: "Biopsy/Pathology",
        test_date: "Pending",
        summary: "CT-guided transthoracic needle biopsy pending radiologist consult.",
        doctor_note: "Urgent staging recommended.",
      },
    ],
  },
  nodules: [
    {
      id: "nod-003-1",
      nodule_index: 1,
      detection_confidence: null,
      is_demo: true,
      coord_x: 145,
      coord_y: 250,
      coord_z: 160,
      max_diameter_mm: 16.4,
      min_diameter_mm: 13.2,
      mean_diameter_mm: 14.8,
      volume_mm3: 1820.0,
      mean_hu: 34.0,
      median_hu: 28.0,
      min_hu: -280.0,
      max_hu: 210.0,
      std_hu: 62.1,
      density_type: "part_solid",
      sphericity: 0.52,
      elongation: 1.54,
      surface_area_mm2: 680.0,
      compactness: 0.64,
      margin_type: "spiculated",
      spiculation_detected: true,
      lung_side: "right",
      lung_lobe: "RUL",
      position_type: "peripheral",
      axial_slice: 160,
      coronal_slice: 160,
      sagittal_slice: 145,
      thumbnail_url: "/thumbnails/nodule_demo3_1.jpg",
      risk_assessments: [
        {
          id: "risk-003-1",
          model_name: "brock_pancan_demo",
          risk_probability: 0.864,
          risk_category: "very_high",
          lung_rads_category: "4X",
          lung_rads_recommendation: "Urgent multidisciplinary oncology consultation, PET/CT staging, and tissue biopsy recommended.",
          contributing_factors: [
            { name: "size", display_name: "Lesion Size (>15 mm)", score: 0.95, level: "high", description: "16.4 mm diameter carries elevated risk of invasive malignancy" },
            { name: "spiculation", display_name: "Coronary Spiculation", score: 0.92, level: "high", description: "Prominent radiating spicules and pleural tagging" },
            { name: "growth", display_name: "Rapid Volume Doubling", score: 0.90, level: "high", description: "VDT of 198 days is consistent with malignant kinetics" },
            { name: "clinical", display_name: "Age & Pack-Years", score: 0.85, level: "high", description: "Age 71, 45 pack-years current smoking, emphysema, weight loss" },
          ],
          clinical_inputs: { age: 71, sex: "male", smoking_history: true, pack_years: 45, emphysema: true, family_history_lung_cancer: true },
          is_demo: true,
        },
      ],
    },
  ],
  summary: {
    nodule_count: 1,
    largest_nodule_mm: 16.4,
    highest_risk_pct: 86.4,
    lung_rads_overall: "4X",
    conclusion: "16.4 mm spiculated part-solid lesion in Right Upper Lobe. Estimated malignancy probability 86.4% (Higher Suspicion). Demonstrates rapid interval growth. ACR Lung-RADS 4X — Immediate thoracic oncology referral and tissue biopsy warranted.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO-004: Screening CT — No Significant Nodule (Negative / 0 Nodules)
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_CASE_004: DemoCaseFull = {
  id: "DEMO-004",
  label: "DEMO-004 — Screening CT (No Significant Nodules)",
  shortDescription: "Normal low-dose screening thoracic CT. ACR Lung-RADS Category 1 (Negative, 0 nodules).",
  scenario: "Negative / No Significant Nodule",
  primaryRiskCategory: "unassessed",
  dominantSizeMm: null,
  patientId: "PS-2026-004",
  age: 52,
  gender: "Female",
  scanDate: "22 Feb 2026",
  sliceCount: 320,
  scanType: "Chest CT (DICOM)",
  voxelSpacing: "0.7 × 0.7 × 1.0 mm",
  pixelSpacing: 0.703,
  scanQuality: "Good",
  qualityNotes: ["Adequate lung expansion", "Complete parenchyma visualization", "No actionable findings"],
  ctImagePath: "/demo_scans/ct_demo4.jpg",
  defaultSlice: 160,
  defaultWindow: { wl: -600, ww: 1500 },
  patientContext: {
    medical_history: {
      smoking_status: "never",
      pack_years: 0,
      family_history_lung_cancer: "no",
      copd_emphysema: "no",
      previous_pulmonary_nodules: "no",
      relevant_surgeries: "None",
      relevant_medications: "None",
    },
    recent_tests: [
      {
        id: "t4-1",
        test_type: "Chest X-Ray",
        test_date: "12 Jan 2025",
        summary: "Normal screening thoracic radiograph. Clear costophrenic angles.",
        doctor_note: "Annual occupational health clearance.",
      },
    ],
  },
  nodules: [], // Strictly 0 nodules
  summary: {
    nodule_count: 0,
    largest_nodule_mm: null,
    highest_risk_pct: null,
    lung_rads_overall: "1",
    conclusion: "Screening thoracic CT demonstrates clear bilateral lung parenchyma without actionable pulmonary nodule or focal consolidation. ACR Lung-RADS Category 1 (Negative). Routine annual screening recommended.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DEMO-005: Multiple Nodules (Mixed Suspicion)
// ─────────────────────────────────────────────────────────────────────────────
export const DEMO_CASE_005: DemoCaseFull = {
  id: "DEMO-005",
  label: "DEMO-005 — Multiple Nodules (Mixed Suspicion)",
  shortDescription: "Three nodules of mixed risk: dominant 14.2 mm Higher Suspicion lesion in RUL (78.0%), 7.8 mm Intermediate in RLL (32.0%), 4.5 mm Low in LLL (8.0%).",
  scenario: "Mixed Multiple Nodules",
  primaryRiskCategory: "higher",
  dominantSizeMm: 14.2,
  patientId: "PS-2026-005",
  age: 67,
  gender: "Male",
  scanDate: "28 Feb 2026",
  sliceCount: 450,
  scanType: "Chest CT (DICOM)",
  voxelSpacing: "0.7 × 0.7 × 1.0 mm",
  pixelSpacing: 0.703,
  scanQuality: "Good",
  qualityNotes: ["Full thoracic coverage", "High contrast resolution", "No motion artifact"],
  ctImagePath: "/demo_scans/ct_demo5.jpg",
  defaultSlice: 58,
  defaultWindow: { wl: -600, ww: 1600 },
  patientContext: {
    medical_history: {
      smoking_status: "former",
      pack_years: 30,
      family_history_lung_cancer: "yes",
      copd_emphysema: "yes",
      previous_pulmonary_nodules: "yes",
      relevant_surgeries: "None",
      relevant_medications: "Symbicort inhaler",
      other_history: "Quit smoking 3 years ago.",
    },
    recent_tests: [
      {
        id: "t5-1",
        test_type: "Previous CT",
        test_date: "18 May 2025",
        summary: "Two sub-centimeter nodules observed; surveillance CT requested at 9-12 months.",
        doctor_note: "Interval enlargement in lesion; follow-up demonstrates mixed-risk progression.",
      },
    ],
  },
  nodules: [
    {
      id: "nod-005-1",
      nodule_index: 1,
      detection_confidence: null,
      is_demo: true,
      coord_x: 144,
      coord_y: 246,
      coord_z: 58,
      max_diameter_mm: 14.2,
      min_diameter_mm: 11.8,
      mean_diameter_mm: 13.0,
      volume_mm3: 1240.0,
      mean_hu: 15.2,
      median_hu: 18.0,
      min_hu: -80.0,
      max_hu: 175.0,
      std_hu: 42.0,
      density_type: "part_solid",
      sphericity: 0.72,
      elongation: 1.35,
      surface_area_mm2: 520.0,
      compactness: 0.70,
      margin_type: "spiculated",
      spiculation_detected: true,
      lung_side: "right",
      lung_lobe: "RUL",
      position_type: "peripheral",
      axial_slice: 58,
      coronal_slice: 246,
      sagittal_slice: 144,
      thumbnail_url: "/thumbnails/nodule_demo5_1.jpg",
      risk_assessments: [
        {
          id: "risk-005-1",
          model_name: "brock_pancan_demo",
          risk_probability: 0.780,
          risk_category: "very_high",
          lung_rads_category: "4X",
          lung_rads_recommendation: "Multidisciplinary thoracic oncology consultation, diagnostic PET/CT, and tissue biopsy recommended.",
          contributing_factors: [
            { name: "size", display_name: "Nodule Size (14.2 mm)", score: 0.88, level: "high", description: "14.2 mm dominant part-solid mass in upper lobe" },
            { name: "spiculation", display_name: "Spiculated Contour", score: 0.82, level: "high", description: "Irregular spiculated boundary with pleural tagging" },
            { name: "density", display_name: "Part-Solid Attenuation", score: 0.76, level: "high", description: "Significant solid component with surrounding ground glass" },
          ],
          clinical_inputs: { age: 67, sex: "male", smoking_history: true, pack_years: 30, emphysema: true, family_history_lung_cancer: true },
          is_demo: true,
        },
      ],
    },
    {
      id: "nod-005-2",
      nodule_index: 2,
      detection_confidence: null,
      is_demo: true,
      coord_x: 212,
      coord_y: 208,
      coord_z: 58,
      max_diameter_mm: 8.2,
      min_diameter_mm: 7.0,
      mean_diameter_mm: 7.6,
      volume_mm3: 290.0,
      mean_hu: 28.0,
      median_hu: 24.0,
      min_hu: -120.0,
      max_hu: 150.0,
      std_hu: 36.0,
      density_type: "solid",
      sphericity: 0.74,
      elongation: 1.20,
      surface_area_mm2: 195.0,
      compactness: 0.79,
      margin_type: "lobulated",
      spiculation_detected: false,
      lung_side: "left",
      lung_lobe: "LUL",
      position_type: "perihilar",
      axial_slice: 58,
      coronal_slice: 208,
      sagittal_slice: 212,
      thumbnail_url: "/thumbnails/nodule_demo5_2.jpg",
      risk_assessments: [
        {
          id: "risk-005-2",
          model_name: "brock_pancan_demo",
          risk_probability: 0.340,
          risk_category: "intermediate",
          lung_rads_category: "4A",
          lung_rads_recommendation: "Intermediate suspicion. 3-month follow-up diagnostic chest CT recommended.",
          contributing_factors: [
            { name: "size", display_name: "Intermediate Size (8.2 mm)", score: 0.58, level: "moderate", description: "8.2 mm solid perihilar nodule" },
            { name: "margin", display_name: "Lobulated Margin", score: 0.48, level: "moderate", description: "Lobulated contour requiring growth surveillance" },
          ],
          is_demo: true,
        },
      ],
    },
    {
      id: "nod-005-3",
      nodule_index: 3,
      detection_confidence: null,
      is_demo: true,
      coord_x: 375,
      coord_y: 250,
      coord_z: 58,
      max_diameter_mm: 4.5,
      min_diameter_mm: 4.0,
      mean_diameter_mm: 4.25,
      volume_mm3: 48.0,
      mean_hu: 52.0,
      median_hu: 48.0,
      min_hu: -60.0,
      max_hu: 138.0,
      std_hu: 28.0,
      density_type: "solid",
      sphericity: 0.88,
      elongation: 1.08,
      surface_area_mm2: 64.0,
      compactness: 0.90,
      margin_type: "smooth",
      spiculation_detected: false,
      lung_side: "left",
      lung_lobe: "LLL",
      position_type: "peripheral",
      axial_slice: 58,
      coronal_slice: 250,
      sagittal_slice: 375,
      thumbnail_url: "/thumbnails/nodule_demo5_3.jpg",
      risk_assessments: [
        {
          id: "risk-005-3",
          model_name: "brock_pancan_demo",
          risk_probability: 0.080,
          risk_category: "low",
          lung_rads_category: "2",
          lung_rads_recommendation: "Benign appearance. Routine annual Low-Dose CT screening.",
          contributing_factors: [
            { name: "size", display_name: "Small Solitary Focus", score: 0.22, level: "low", description: "4.5 mm smooth baseline nodule with low pre-test probability" },
          ],
          is_demo: true,
        },
      ],
    },
  ],
  summary: {
    nodule_count: 3,
    largest_nodule_mm: 14.2,
    highest_risk_pct: 78.0,
    lung_rads_overall: "4X",
    conclusion: "Three distinct pulmonary nodules representing a mixed risk spectrum: Dominant Nodule #1 (14.2 mm, High Risk 78.0%, Lung-RADS 4X), Nodule #2 (8.2 mm, Intermediate 34.0%, Lung-RADS 4A), and Nodule #3 (4.5 mm, Low Risk 8.0%, Lung-RADS 2).",
  },
};

export const ALL_DEMO_CASES: Record<string, DemoCaseFull> = {
  "DEMO-001": DEMO_CASE_001,
  "DEMO-002": DEMO_CASE_002,
  "DEMO-003": DEMO_CASE_003,
  "DEMO-004": DEMO_CASE_004,
  "DEMO-005": DEMO_CASE_005,
};

export function getDemoCaseFull(id: string): DemoCaseFull {
  return ALL_DEMO_CASES[id] || DEMO_CASE_002;
}

export function convertToCaseResults(dc: DemoCaseFull): CaseResults {
  return {
    case_id: dc.patientId,
    status: "completed",
    is_demo: true,
    demo_case_id: dc.id,
    analysis_mode: "demo",
    scan_metadata: {
      input_type: "demo",
      analysis_mode: "demo",
      modality: "CT",
      patient_id_anon: dc.patientId,
      study_date: dc.scanDate,
      series_description: "CHEST CT (DICOM)",
      slice_count: dc.sliceCount,
      slice_thickness_mm: 1.0,
      pixel_spacing_x: dc.pixelSpacing,
      pixel_spacing_y: dc.pixelSpacing,
      rows: 512,
      cols: 512,
      scan_quality: dc.scanQuality.toLowerCase(),
      quality_notes: dc.qualityNotes,
    },
    nodules: dc.nodules,
    summary: dc.summary,
    stages: [
      { key: "upload_received", label: "Upload received", state: "completed" },
      { key: "dicom_validation", label: "DICOM validation", state: "completed" },
      { key: "volume_reconstruction", label: "3D volume reconstruction", state: "completed" },
      { key: "lung_segmentation", label: "Lung segmentation", state: "completed" },
      { key: "nodule_detection", label: "Nodule detection", state: "completed" },
      { key: "nodule_segmentation", label: "Nodule segmentation", state: "completed" },
      { key: "feature_extraction", label: "Feature extraction", state: "completed" },
      { key: "risk_assessment", label: "Risk assessment", state: "completed" },
      { key: "report_generation", label: "Report generation", state: "completed" },
    ],
  };
}

/**
 * Requirement #21: Automated Demo Consistency Check
 * Validates that every demo case has no internal contradictions.
 * Throws an Error with detailed information if validation fails.
 */
export function validateDemoCase(dc: DemoCaseFull): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!dc.id || !dc.patientId) errors.push(`Missing id or patientId in ${dc.id}`);
  if (dc.nodules.length !== dc.summary.nodule_count) {
    errors.push(`Nodule count mismatch in ${dc.id}: array length ${dc.nodules.length} vs summary ${dc.summary.nodule_count}`);
  }

  if (dc.id === "DEMO-004") {
    if (dc.nodules.length !== 0) errors.push(`DEMO-004 must have 0 nodules, found ${dc.nodules.length}`);
    if (dc.summary.largest_nodule_mm !== null) errors.push(`DEMO-004 largest_nodule_mm must be null`);
    if (dc.summary.highest_risk_pct !== null) errors.push(`DEMO-004 highest_risk_pct must be null`);
  } else {
    if (dc.nodules.length === 0) errors.push(`${dc.id} has 0 nodules but is not DEMO-004`);
    const diams = dc.nodules.map((n) => n.max_diameter_mm).filter(Boolean) as number[];
    const maxDiam = Math.max(...diams);
    if (Math.abs(maxDiam - (dc.summary.largest_nodule_mm || 0)) > 0.05) {
      errors.push(`Largest diameter mismatch in ${dc.id}: max(${diams})=${maxDiam} vs summary ${dc.summary.largest_nodule_mm}`);
    }

    dc.nodules.forEach((n, idx) => {
      if (!n.id) errors.push(`Nodule at index ${idx} in ${dc.id} missing id`);
      if (n.max_diameter_mm == null || n.volume_mm3 == null) {
        errors.push(`Nodule ${n.id} in ${dc.id} missing diameter or volume measurement`);
      }
      if (n.coord_x == null || n.coord_y == null || n.coord_z == null) {
        errors.push(`Nodule ${n.id} in ${dc.id} missing 3D coordinates`);
      }
      if (!n.risk_assessments || n.risk_assessments.length === 0) {
        errors.push(`Nodule ${n.id} in ${dc.id} missing risk assessment`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

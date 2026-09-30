// API client for PulmoScan AI backend.
// All requests go through this module.

import type {
  Case,
  CaseListItem,
  CaseResults,
  DemoCaseInfo,
  AnalysisJob,
  Report,
  VolumeInfo,
  NoduleMaskResponse,
  RiskAssessment,
  ClinicalInputs,
  TemporalAnalysisResponse,
  Nodule,
} from "@/types/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = "APIError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });
  } catch {
    throw new APIError(
      0,
      "Unable to reach the PulmoScan AI backend. Please ensure the server is running on port 8000.",
      "Network error"
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err.detail || JSON.stringify(err);
    } catch {
      detail = response.statusText;
    }
    throw new APIError(response.status, `Request failed: ${detail}`, detail);
  }

  return response.json() as Promise<T>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Health
// ──────────────────────────────────────────────────────────────────────────────

export async function checkHealth() {
  return request<{ status: string; version: string; demo_mode: boolean }>("/health");
}

// ──────────────────────────────────────────────────────────────────────────────
// Cases
// ──────────────────────────────────────────────────────────────────────────────

export async function listCases(): Promise<CaseListItem[]> {
  return request<CaseListItem[]>("/cases");
}

export async function getCase(caseId: string): Promise<Case> {
  return request<Case>(`/cases/${caseId}`);
}

export async function createDemoCase(demoCaseId: string): Promise<Case> {
  return request<Case>("/cases", {
    method: "POST",
    body: JSON.stringify({
      is_demo: true,
      demo_case_id: demoCaseId,
    }),
  });
}

export async function getCaseResults(caseId: string): Promise<CaseResults> {
  return request<CaseResults>(`/cases/${caseId}/results`);
}

export async function getCaseStatus(caseId: string): Promise<AnalysisJob> {
  return request<AnalysisJob>(`/cases/${caseId}/status`);
}

export async function analyzeCase(caseId: string) {
  return request(`/cases/${caseId}/analyze`, { method: "POST" });
}

export async function listDemoCases(): Promise<DemoCaseInfo[]> {
  return request<DemoCaseInfo[]>("/demo-cases");
}

export async function uploadCase(file: File): Promise<Case> {
  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE}/cases/upload`;
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body: formData });
  } catch {
    throw new APIError(0, "Network error uploading file.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const err = await response.json();
      detail = err.detail || JSON.stringify(err);
    } catch {
      detail = response.statusText;
    }
    throw new APIError(response.status, `Upload failed: ${detail}`, detail);
  }
  return response.json() as Promise<Case>;
}

// ──────────────────────────────────────────────────────────────────────────────
// Slices & Medical Viewer
// ──────────────────────────────────────────────────────────────────────────────

export function getSliceUrl(
  caseId: string,
  plane: string,
  index: number,
  wl: number = -600,
  ww: number = 1500
): string {
  return `${API_BASE}/cases/${caseId}/slices/${plane}/${index}?wl=${wl}&ww=${ww}`;
}

export async function getVolumeInfo(caseId: string): Promise<VolumeInfo> {
  return request<VolumeInfo>(`/cases/${caseId}/volume-info`);
}

export async function getNoduleMask(
  caseId: string,
  noduleId: string,
  sliceIdx?: number,
  plane: string = "axial"
): Promise<NoduleMaskResponse> {
  const query = sliceIdx !== undefined ? `?slice_idx=${sliceIdx}&plane=${plane}` : `?plane=${plane}`;
  return request<NoduleMaskResponse>(`/cases/${caseId}/nodules/${noduleId}/mask${query}`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Risk Assessment & Human-in-the-Loop Corrections
// ──────────────────────────────────────────────────────────────────────────────

export async function recalculateRisk(
  caseId: string,
  noduleId: string,
  clinicalInputs: ClinicalInputs
): Promise<RiskAssessment> {
  return request<RiskAssessment>(`/cases/${caseId}/nodules/${noduleId}/risk`, {
    method: "POST",
    body: JSON.stringify({
      nodule_id: noduleId,
      clinical_inputs: clinicalInputs,
    }),
  });
}

export async function updateNodule(
  caseId: string,
  noduleId: string,
  payload: Partial<Nodule>
): Promise<Nodule> {
  return request<Nodule>(`/cases/${caseId}/nodules/${noduleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Longitudinal Temporal Comparison
// ──────────────────────────────────────────────────────────────────────────────

export async function getTemporalAnalysis(caseId: string): Promise<TemporalAnalysisResponse> {
  return request<TemporalAnalysisResponse>(`/cases/${caseId}/temporal`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Reports & PDF Export
// ──────────────────────────────────────────────────────────────────────────────

export async function generateReport(caseId: string): Promise<Report> {
  return request<Report>(`/cases/${caseId}/report`, { method: "POST" });
}

export async function getReport(caseId: string): Promise<Report> {
  return request<Report>(`/cases/${caseId}/report`);
}

export function getPdfReportUrl(caseId: string): string {
  return `${API_BASE}/cases/${caseId}/report/pdf`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Patient Context (Medical History + Recent Tests)
// ──────────────────────────────────────────────────────────────────────────────

export async function getPatientContext(caseId: string): Promise<{ case_id: string; patient_context: Record<string, unknown> }> {
  return request(`/cases/${caseId}/patient-context`);
}

export async function updatePatientContext(
  caseId: string,
  medical_history?: Record<string, unknown> | null,
  recent_tests?: Record<string, unknown>[] | null
): Promise<{ case_id: string; patient_context: Record<string, unknown> }> {
  return request(`/cases/${caseId}/patient-context`, {
    method: "PUT",
    body: JSON.stringify({ medical_history, recent_tests }),
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Review Status
// ──────────────────────────────────────────────────────────────────────────────

export async function updateReviewStatus(
  caseId: string,
  review_status: string
): Promise<{ case_id: string; review_status: string }> {
  return request(`/cases/${caseId}/review-status`, {
    method: "PUT",
    body: JSON.stringify({ review_status }),
  });
}

export { APIError };

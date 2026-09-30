"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  FileText,
  Download,
  Printer,
  CheckCircle,
} from "lucide-react";
import { getCaseResults, generateReport, getReport, getPdfReportUrl, getPatientContext, APIError } from "@/lib/api";
import type { CaseResults, Report, PatientContext } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";

function fmt(v: number | null | undefined, d = 1) {
  if (v == null) return "—";
  return v.toFixed(d);
}

function densityLabel(d: string | null | undefined) {
  const map: Record<string, string> = {
    solid: "Solid",
    part_solid: "Part-solid",
    ground_glass: "Ground-glass",
    calcified: "Calcified",
    unknown: "Unknown",
  };
  return map[d || "unknown"] || "Unknown";
}

function lobeFull(lobe: string | null | undefined) {
  const map: Record<string, string> = {
    RUL: "Right Upper Lobe",
    RML: "Right Middle Lobe",
    RLL: "Right Lower Lobe",
    LUL: "Left Upper Lobe",
    LLL: "Left Lower Lobe",
    unknown: "Unknown",
  };
  return map[lobe || "unknown"] || "Unknown";
}

export default function ReportPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const [results, setResults] = useState<CaseResults | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientCtx, setPatientCtx] = useState<PatientContext | null>(null);

  useEffect(() => {
    if (caseId.startsWith("DEMO-")) {
      import("@/lib/demoCases").then(({ getDemoCaseFull, convertToCaseResults }) => {
        const dc = getDemoCaseFull(caseId);
        setResults(convertToCaseResults(dc));
        setPatientCtx(dc.patientContext);
        setLoading(false);
      });
      return;
    }

    Promise.all([
      getCaseResults(caseId),
      getReport(caseId).catch(() => null),
      getPatientContext(caseId).catch(() => null),
    ]).then(([r, rpt, pctx]) => {
      setResults(r);
      setReport(rpt);
      setPatientCtx((pctx as { patient_context: PatientContext } | null)?.patient_context || null);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof APIError ? err.message : String(err));
      setLoading(false);
    });
  }, [caseId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const rpt = await generateReport(caseId);
      setReport(rpt);
    } catch (err) {
      setError(err instanceof APIError ? (err as APIError).message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => window.print();

  if (loading) return (
    <div style={{ height: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader2 size={28} color="var(--accent-primary)" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error || !results) return (
    <div style={{ height: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>
      <AlertTriangle size={24} color="var(--color-danger)" style={{ marginRight: 12 }} /> {error || "Failed to load"}
    </div>
  );

  const sm = results.scan_metadata;
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ height: 48, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }} className="no-print">
        <BrandLogo size={28} showBadge={false} />
        <span style={{ color: "var(--border-default)" }}>|</span>
        <Link href={`/workspace/${caseId}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", textDecoration: "none", fontSize: 12 }}>
          <ChevronLeft size={13} />
          Workspace
        </Link>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Report</span>
        {results.is_demo ? (
          <span className="demo-badge">DEMO DATA</span>
        ) : results.analysis_mode === "image_review" ? (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(8,145,178,0.12)", color: "#0891b2", border: "1px solid rgba(8,145,178,0.3)" }}>
            2D VISUAL REVIEW
          </span>
        ) : results.analysis_mode === "video_review" ? (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(8,145,178,0.12)", color: "#0891b2", border: "1px solid rgba(8,145,178,0.3)" }}>
            VISUAL REVIEW (CT VIDEO)
          </span>
        ) : (
          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 4, background: "rgba(0,184,156,0.12)", color: "var(--accent-secondary)", border: "1px solid var(--border-default)" }}>
            PROTOTYPE / DEMO ANALYSIS
          </span>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!report && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: "var(--accent-primary)",
                color: "#0a0d12",
                border: "none",
                borderRadius: 3,
                fontSize: 12,
                fontWeight: 700,
                cursor: generating ? "not-allowed" : "pointer",
              }}
            >
              {generating ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <FileText size={12} />}
              Generate Report
            </button>
          )}
          <button
            onClick={handlePrint}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-default)",
              borderRadius: 3,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Printer size={12} />
            Print
          </button>
          <a
            href={getPdfReportUrl(caseId)}
            download={`${results.case_id}_radiology_report.pdf`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              background: "var(--accent-primary)",
              color: "#0a0d12",
              borderRadius: 3,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            <Download size={12} />
            Download PDF
          </a>
        </div>
      </div>

      {/* Report content */}
      <div
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "40px 24px",
          fontFamily: "'Inter', sans-serif",
        }}
        id="report-content"
      >
        {/* Report header */}
        <div
          style={{
            borderBottom: "3px solid var(--accent-primary)",
            paddingBottom: 20,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ marginBottom: 6 }}>
                <BrandLogo size={36} showBadge={false} />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                AI-Assisted Pulmonary Nodule Analysis Report
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: "3px 8px",
                  borderRadius: 4,
                  display: "inline-block",
                  marginBottom: 4,
                  background: results.is_demo ? "rgba(245,158,11,0.12)" : "rgba(0,184,156,0.12)",
                  color: results.is_demo ? "var(--color-warning)" : "var(--accent-secondary)",
                  border: `1px solid ${results.is_demo ? "rgba(245,158,11,0.3)" : "var(--border-default)"}`,
                }}
              >
                {results.is_demo
                  ? "⚠ DEMO DATA"
                  : results.analysis_mode === "image_review"
                  ? "2D VISUAL REVIEW"
                  : results.analysis_mode === "video_review"
                  ? "CT VIDEO REVIEW"
                  : "PROTOTYPE ANALYSIS"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Research Prototype v0.1</div>
            </div>
          </div>
        </div>

        {/* Disclaimer banner */}
        <div
          style={{
            padding: "10px 16px",
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: 4,
            marginBottom: 24,
            fontSize: 12,
            color: "var(--color-warning)",
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
          <strong>RESEARCH PROTOTYPE:</strong> This report is generated by an AI prototype for research and demonstration purposes only.
          It is not a clinical diagnosis and must not be used for medical decision-making.
          Always consult a qualified radiologist for clinical interpretation.
        </div>

        {/* Study info */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 14 }}>
            Study Information
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px" }}>
            {[
              { label: "Case ID", value: results.case_id },
              { label: "Report Date", value: now },
              { label: "Modality", value: sm?.modality || "CT" },
              { label: "Patient ID", value: sm?.patient_id_anon || "Anonymous" },
              { label: "Study Date", value: sm?.study_date || "—" },
              { label: "Series", value: sm?.series_description || "—" },
              { label: "Slices", value: sm?.slice_count?.toString() || "—" },
              { label: "Slice Thickness", value: sm?.slice_thickness_mm != null ? `${sm.slice_thickness_mm} mm` : "—" },
              { label: "Pixel Spacing", value: sm?.pixel_spacing_x != null ? `${sm.pixel_spacing_x.toFixed(3)} mm` : "—" },
              { label: "Scan Quality", value: sm?.scan_quality?.toUpperCase() || "—" },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: "5px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}:</span>
                {" "}
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Findings */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 14 }}>
            AI Findings
          </h2>

          {results.analysis_mode === "image_review" ? (
            <div style={{ padding: "16px 18px", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                2D Visual Review (Medical Photo / Image)
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                This study was submitted as a 2D photograph or medical image for visual review. Quantitative 3D volumetric CT reconstruction, Hounsfield Unit statistics, and voxel measurements are not applicable to 2D images. For 3D pulmonary nodule segmentation and Lung-RADS risk estimation, please upload a calibrated volumetric DICOM or NIfTI series.
              </p>
            </div>
          ) : results.analysis_mode === "video_review" ? (
            <div style={{ padding: "16px 18px", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4 }}>
                CT Video Visual Review (Cine Playback)
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, margin: 0 }}>
                This study was submitted as a CT cine / video recording for visual inspection. Quantitative 3D voxel reconstruction, calibrated Hounsfield Unit statistics, and volume doubling kinetics require a calibrated volumetric DICOM or NIfTI series.
              </p>
            </div>
          ) : results.nodules.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px", background: "rgba(0,200,122,0.06)", border: "1px solid rgba(0,200,122,0.15)", borderRadius: 4 }}>
              <CheckCircle size={14} color="var(--color-success)" />
              <span style={{ fontSize: 13 }}>No pulmonary nodules detected by the AI system (ACR Lung-RADS 1).</span>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
                {results.nodules.length} pulmonary nodule{results.nodules.length !== 1 ? "s" : ""} detected.
              </p>
              {results.nodules.map((n) => {
                const risk = n.risk_assessments?.[0];
                return (
                  <div key={n.id} style={{ marginBottom: 20, padding: "16px 18px", background: "var(--bg-panel)", border: "1px solid var(--border-subtle)", borderRadius: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>Nodule #{n.nodule_index}</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                      <span style={{ fontSize: 13, color: "var(--accent-primary)", fontFamily: "monospace" }}>
                        {fmt(n.max_diameter_mm)} mm
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{lobeFull(n.lung_lobe)}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px 16px" }}>
                      {[
                        { label: "Detection confidence", value: n.detection_confidence != null ? `${fmt(n.detection_confidence * 100, 0)}%` : "Not formally estimated" },
                        { label: "Max diameter", value: `${fmt(n.max_diameter_mm)} mm` },
                        { label: "Volume", value: `${fmt(n.volume_mm3, 0)} mm³` },
                        { label: "Density type", value: densityLabel(n.density_type) },
                        { label: "Mean HU", value: fmt(n.mean_hu, 0) },
                        { label: "Lung lobe", value: n.lung_lobe || "—" },
                        { label: "Margin", value: (n.margin_type || "—").charAt(0).toUpperCase() + (n.margin_type || "").slice(1) },
                        { label: "Spiculation", value: n.spiculation_detected == null ? "—" : n.spiculation_detected ? "Detected" : "Not detected" },
                        { label: "Sphericity", value: fmt(n.sphericity, 2) },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ borderBottom: "1px solid var(--border-subtle)", padding: "4px 0" }}>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{label}: </span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-primary)" }}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {risk && (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: "var(--bg-elevated)", borderRadius: 3 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          Est. malignancy risk:{" "}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            fontFamily: "monospace",
                            color:
                              risk.risk_category === "low"
                                ? "var(--risk-low)"
                                : risk.risk_category === "moderate"
                                ? "var(--risk-moderate)"
                                : "var(--risk-high)",
                          }}
                        >
                          {fmt((risk.risk_probability || 0) * 100, 1)}% ({(risk.risk_category || "").toUpperCase()})
                        </span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>
                          · Lung-RADS {risk.lung_rads_category}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </section>

        {/* Summary */}
        {results.summary && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 14 }}>
              Assessment Summary
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              {results.summary.conclusion}
            </p>
          </section>
        )}

        {/* Patient Context */}
        {patientCtx && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 14 }}>
              Patient Context
            </h2>
            <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10 }}>
              Clinician-entered. Not fabricated by AI.
            </div>

            {patientCtx.medical_history && Object.values(patientCtx.medical_history).some(v => v != null) ? (
              <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>Medical History</h3>
                {[
                  { label: "Smoking Status", value: patientCtx.medical_history.smoking_status },
                  { label: "Pack-Years", value: patientCtx.medical_history.pack_years != null ? String(patientCtx.medical_history.pack_years) : null },
                  { label: "Family History of Lung Cancer", value: patientCtx.medical_history.family_history_lung_cancer },
                  { label: "COPD / Emphysema", value: patientCtx.medical_history.copd_emphysema },
                  { label: "Previous Cancer", value: patientCtx.medical_history.previous_cancer },
                  { label: "Previous Pulmonary Nodules", value: patientCtx.medical_history.previous_pulmonary_nodules },
                  { label: "Previous Lung Disease", value: patientCtx.medical_history.previous_lung_disease },
                  { label: "Relevant Surgeries", value: patientCtx.medical_history.relevant_surgeries },
                  { label: "Relevant Medications", value: patientCtx.medical_history.relevant_medications },
                  { label: "Other History", value: patientCtx.medical_history.other_history },
                ].filter(f => f.value != null && f.value !== "").map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", padding: "4px 0" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{String(value)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 10 }}>No medical history provided.</div>
            )}

            {patientCtx.recent_tests && patientCtx.recent_tests.length > 0 ? (
              <div>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8 }}>Recent Investigations</h3>
                {patientCtx.recent_tests.map((t, i) => (
                  <div key={i} style={{ padding: "8px 12px", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", borderRadius: 4, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text-primary)", marginBottom: 2 }}>{t.test_type}</div>
                    {t.test_date && <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 3 }}>{t.test_date}</div>}
                    {t.summary && <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>{t.summary}</div>}
                    {t.doctor_note && <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", marginTop: 2 }}>Note: {t.doctor_note}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No recent investigations provided.</div>
            )}
          </section>
        )}

        {/* AI Limitations */}
        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 14 }}>
            AI System Limitations
          </h2>

          {[
            "This system is a research prototype and has not been clinically validated for diagnostic use.",
            "Risk estimates use a demo implementation of published evidence-based models (Brock/PanCan) and do not reflect actual validated model inference.",
            "All results in this report are labeled DEMO DATA and were not generated by a real AI model performing inference on this scan.",
            "Do not use these results for clinical decisions. Always consult a qualified radiologist for clinical interpretation.",
            "The CT viewer shows a simulated visualization — it does not render actual pixel data from the uploaded scan.",
          ].map((limitation, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
              <span style={{ color: "var(--color-warning)", fontSize: 12, marginTop: 1, flexShrink: 0 }}>•</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>{limitation}</span>
            </div>
          ))}
        </section>

        {/* Report text (if generated from backend) */}
        {report?.report_text && (
          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-primary)", borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6, marginBottom: 14 }}>
              Generated Report Text
            </h2>
            <pre
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "var(--text-secondary)",
                background: "var(--bg-panel)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 4,
                padding: 16,
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: 1.6,
              }}
            >
              {report.report_text}
            </pre>
          </section>
        )}

        {/* Footer */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 16,
            fontSize: 11,
            color: "var(--text-muted)",
            textAlign: "center",
          }}
        >
          PulmoScan AI — Research Prototype v0.1 · NOT FOR CLINICAL USE ·
          This report is computer-generated and has not been reviewed by a radiologist.
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          .no-print { display: none !important; }
          body { background: white; color: black; }
        }
      `}</style>
    </div>
  );
}

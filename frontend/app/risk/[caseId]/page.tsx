"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  TrendingUp,
  Info,
  Sliders,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { getCaseResults, recalculateRisk, APIError } from "@/lib/api";
import type { CaseResults, Nodule, RiskAssessment, RiskFactorItem, ClinicalInputs } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";

function fmt(v: number | null | undefined, d = 1) {
  if (v == null) return "—";
  return v.toFixed(d);
}

function riskColor(cat: string | null | undefined) {
  if (cat === "low") return "var(--risk-low)";
  if (cat === "moderate") return "var(--risk-moderate)";
  if (cat === "high" || cat === "very_high") return "var(--risk-high)";
  return "var(--text-muted)";
}

function RiskGauge({ value }: { value: number }) {
  const pct = Math.min(value * 100, 100);
  const color =
    pct < 5
      ? "var(--risk-low)"
      : pct < 15
      ? "var(--risk-moderate)"
      : "var(--risk-high)";

  return (
    <div style={{ position: "relative", width: 140, height: 70, margin: "0 auto" }}>
      <svg viewBox="0 0 120 60" style={{ width: 140, height: 70 }}>
        <path
          d="M 10 55 A 50 50 0 0 1 110 55"
          fill="none"
          stroke="var(--border-default)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 10 55 A 50 50 0 0 1 110 55"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 157.08} 157.08`}
        />
        <text
          x="60"
          y="52"
          textAnchor="middle"
          fill="white"
          fontSize="16"
          fontWeight="700"
          fontFamily="monospace"
        >
          {pct.toFixed(1)}%
        </text>
      </svg>
    </div>
  );
}

function FactorBar({ factor }: { factor: RiskFactorItem }) {
  const color =
    factor.level === "high"
      ? "var(--risk-high)"
      : factor.level === "moderate"
      ? "var(--risk-moderate)"
      : "var(--risk-low)";

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, alignItems: "center" }}>
        <div>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{factor.display_name}</span>
          {factor.source && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 6, opacity: 0.8 }}>({factor.source})</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {factor.value && (
            <span style={{ fontSize: 11, fontFamily: "monospace", color: factor.value === "Not provided" ? "var(--text-muted)" : "var(--text-primary)" }}>
              {factor.value}
            </span>
          )}
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 2,
              background: `${color}15`,
              color,
              letterSpacing: "0.06em",
            }}
          >
            {factor.level.toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{ height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${factor.score * 100}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            borderRadius: 3,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
        {factor.description}
      </div>
    </div>
  );
}

export default function RiskPage() {
  const params = useParams();
  const caseId = params.caseId as string;
  const [results, setResults] = useState<CaseResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showMethodology, setShowMethodology] = useState(false);

  // Interactive Clinical Inputs
  const [age, setAge] = useState<number>(62);
  const [sex, setSex] = useState<"male" | "female">("male");
  const [smoking, setSmoking] = useState<boolean>(true);
  const [packYears, setPackYears] = useState<number>(30);
  const [familyHist, setFamilyHist] = useState<boolean>(false);
  const [emphysema, setEmphysema] = useState<boolean>(false);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  useEffect(() => {
    getCaseResults(caseId)
      .then((r) => {
        setResults(r);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof APIError ? err.message : String(err));
        setLoading(false);
      });
  }, [caseId]);

  const selectedNodule = results?.nodules[selectedIdx] || null;
  const risk = selectedNodule?.risk_assessments?.[0] || null;

  const handleRecalculate = async () => {
    if (!selectedNodule) return;
    setRecalculating(true);
    try {
      const inputs: ClinicalInputs = {
        age,
        sex,
        smoking_history: smoking,
        pack_years: smoking ? packYears : 0,
        family_history_lung_cancer: familyHist,
        emphysema,
      };
      const updatedRisk = await recalculateRisk(caseId, selectedNodule.id, inputs);
      if (results) {
        const updatedNodules = [...results.nodules];
        updatedNodules[selectedIdx] = {
          ...selectedNodule,
          risk_assessments: [updatedRisk],
        };
        setResults({ ...results, nodules: updatedNodules });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={28} color="var(--accent-primary)" style={{ animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (error || !results) {
    return (
      <div style={{ height: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-primary)" }}>
        <AlertTriangle size={24} color="var(--color-danger)" style={{ marginRight: 12 }} />
        {error || "Failed to load"}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ height: 48, background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <BrandLogo size={28} showBadge={false} />
        <span style={{ color: "var(--border-default)" }}>|</span>
        <Link href={`/workspace/${caseId}`} style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-muted)", textDecoration: "none", fontSize: 12 }}>
          <ChevronLeft size={13} />
          Workspace
        </Link>
        <span style={{ color: "var(--border-default)" }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Risk Assessment</span>
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
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Malignancy Risk & Explainability Engine
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
          Evidence-based Brock (PanCan) multivariable model and ACR Lung-RADS v2022 standardized assessment.
        </p>

        {/* Nodule Selector Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {results.nodules.map((n, i) => (
            <button
              key={n.id}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: "8px 16px",
                borderRadius: 4,
                border: `1px solid ${i === selectedIdx ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                background: i === selectedIdx ? "rgba(0,196,232,0.12)" : "var(--bg-secondary)",
                color: i === selectedIdx ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>Nodule #{n.nodule_index}</span>
              <span style={{ fontSize: 10, fontFamily: "monospace", opacity: 0.8 }}>({n.max_diameter_mm} mm)</span>
            </button>
          ))}
        </div>

        {selectedNodule && risk ? (
          <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24 }}>
            {/* Left Column: Risk Gauge, Lung-RADS, and Interactive Clinical Factor Inputs */}
            <div>
              {/* Primary Gauge */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 20, textAlign: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 8, textTransform: "uppercase" }}>
                  BROCK MALIGNANCY ESTIMATE
                </div>
                <RiskGauge value={risk.risk_probability || 0} />
                <div style={{ marginTop: 12 }}>
                  <span className={`risk-badge risk-badge-${risk.risk_category || "low"}`}>
                    {(risk.risk_category || "low").toUpperCase()} PROBABILITY
                  </span>
                </div>
              </div>

              {/* ACR Lung-RADS Card */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    ACR LUNG-RADS v2022
                  </span>
                  <span style={{ fontWeight: 800, color: "var(--accent-primary)", fontSize: 13, fontFamily: "monospace" }}>
                    Category {risk.lung_rads_category}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {risk.lung_rads_recommendation}
                </div>
              </div>

              {/* Interactive Clinical Risk Adjuster */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                  <Sliders size={14} color="var(--accent-primary)" />
                  ADJUST CLINICAL FACTORS
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>AGE</label>
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(Number(e.target.value))}
                      style={{ width: "100%", padding: "5px 8px", background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "white", borderRadius: 3, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginBottom: 2 }}>SEX</label>
                    <select
                      value={sex}
                      onChange={(e) => setSex(e.target.value as "male" | "female")}
                      style={{ width: "100%", padding: "5px 8px", background: "var(--bg-primary)", border: "1px solid var(--border-default)", color: "white", borderRadius: 3, fontSize: 12 }}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={smoking}
                      onChange={(e) => setSmoking(e.target.checked)}
                    />
                    History of cigarette smoking
                  </label>
                  {smoking && (
                    <div style={{ marginTop: 6, paddingLeft: 22 }}>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Pack-years: {packYears}</span>
                      <input
                        type="range"
                        min={1}
                        max={80}
                        value={packYears}
                        onChange={(e) => setPackYears(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "var(--accent-primary)" }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={familyHist}
                      onChange={(e) => setFamilyHist(e.target.checked)}
                    />
                    Family history of lung cancer
                  </label>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={emphysema}
                      onChange={(e) => setEmphysema(e.target.checked)}
                    />
                    Radiologic or clinical emphysema
                  </label>
                </div>

                <button
                  onClick={handleRecalculate}
                  disabled={recalculating}
                  style={{
                    width: "100%",
                    padding: "8px",
                    background: "var(--accent-primary)",
                    color: "#0a0d12",
                    border: "none",
                    borderRadius: 3,
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  {recalculating ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={13} />}
                  Recalculate Risk (Brock Model)
                </button>
              </div>
            </div>

            {/* Right Column: Explainable AI Contributing Factors & Guidance */}
            <div>
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 20, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 16, textTransform: "uppercase" }}>
                  WHY THIS NODULE WAS FLAGGED (FACTOR ATTRIBUTIONS)
                </div>

                {risk.contributing_factors && risk.contributing_factors.map((f) => (
                  <FactorBar key={f.name} factor={f} />
                ))}
              </div>

              {/* Methodology Accordion */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
                <button
                  onClick={() => setShowMethodology(!showMethodology)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    background: "transparent",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <Info size={14} color="var(--accent-primary)" />
                  How this evidence-based estimate was derived
                  <span style={{ marginLeft: "auto", fontSize: 14 }}>{showMethodology ? "−" : "+"}</span>
                </button>
                {showMethodology && (
                  <div style={{ padding: "0 16px 16px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    <p style={{ marginBottom: 8 }}>
                      Model: <strong>Pan-Canadian Early Detection of Lung Cancer (Brock/PanCan) multivariable logistic model</strong> (McWilliams et al., NEJM 2013).
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                      <div>✓ Nodule size & volume</div>
                      <div>✓ Spiculated margins</div>
                      <div>✓ Upper-lobe location</div>
                      <div>✓ Density pattern</div>
                      <div>✓ Patient age & sex</div>
                      <div>✓ Smoking pack-years</div>
                      <div>✓ Family history</div>
                      <div>✓ Emphysema presence</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Research Disclaimer */}
              <div style={{ padding: "10px 14px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: 4, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                <AlertTriangle size={12} color="var(--color-warning)" style={{ display: "inline", marginRight: 6 }} />
                Research decision-support prototype. Estimates are statistical approximations and must be evaluated in clinical context by a board-certified thoracic radiologist.
              </div>
            </div>
          </div>
        ) : results.nodules.length === 0 ? (
          <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "48px 32px", textAlign: "center", maxWidth: 600, margin: "20px auto" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <CheckCircle size={28} color="var(--color-success)" />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
              ACR Lung-RADS Category 1 — Negative Study
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 24 }}>
              No pulmonary nodules or suspicious lesions were detected in this CT examination. Malignancy risk calculation via the Brock (PanCan) model is not indicated for negative studies. Routine screening recommended per clinical guidelines.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <Link
                href={`/workspace/${caseId}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-primary)",
                  textDecoration: "none",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={14} />
                Back to Workspace
              </Link>
              <Link
                href={`/report/${caseId}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  background: "var(--accent-primary)",
                  color: "#0a0d12",
                  textDecoration: "none",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                View Structured Report
              </Link>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "var(--bg-panel)",
              borderRadius: 10,
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              maxWidth: 600,
              margin: "0 auto",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 8 }}>
              {results.analysis_mode === "image_review" || results.analysis_mode === "video_review"
                ? "Visual Review Study"
                : "No Nodules Identified"}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-secondary)", marginBottom: 20 }}>
              {results.analysis_mode === "image_review"
                ? "This study was submitted as a 2D photograph / image for visual review. Quantitative 3D volumetric CT analysis, HU statistics, and Brock model risk estimation require a volumetric DICOM or NIfTI series."
                : results.analysis_mode === "video_review"
                ? "This study was submitted as a CT cine / video recording for visual inspection. Quantitative 3D voxel reconstruction and Lung-RADS risk calculations require a calibrated volumetric DICOM or NIfTI series."
                : "No pulmonary nodules were detected in this thoracic CT scan. The overall assessment is ACR Lung-RADS Category 1 (Negative)."}
            </p>
            <Link
              href={`/report/${caseId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                background: "var(--accent-primary)",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              View Radiology Report
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

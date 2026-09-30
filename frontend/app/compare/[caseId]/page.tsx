"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
  ChevronLeft,
  AlertTriangle,
  Loader2,
  ArrowUp,
  Clock,
  TrendingUp,
  Activity,
  CheckCircle,
} from "lucide-react";
import { getCaseResults, getTemporalAnalysis, APIError } from "@/lib/api";
import type { CaseResults, TemporalAnalysisResponse } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";

import { ALL_DEMO_CASES, getDemoCaseFull, convertToCaseResults } from "@/lib/demoCases";

function fmt(v: number | null | undefined, d = 1) {
  if (v == null) return "—";
  return v.toFixed(d);
}

export default function ComparePage() {
  const params = useParams();
  const caseId = (params.caseId as string) || "DEMO-003";
  const isDemo = caseId.startsWith("DEMO-") || Boolean(ALL_DEMO_CASES[caseId.toUpperCase()]);
  const initialDemoKey = ALL_DEMO_CASES[caseId.toUpperCase()] ? caseId.toUpperCase() : "DEMO-003";

  const [results, setResults] = useState<CaseResults | null>(() => {
    if (isDemo) {
      return convertToCaseResults(getDemoCaseFull(initialDemoKey));
    }
    return null;
  });

  const [temporalData, setTemporalData] = useState<TemporalAnalysisResponse | null>(() => {
    if (isDemo) {
      const dc = getDemoCaseFull(initialDemoKey);
      return {
        case_id: dc.patientId,
        metrics: {
          elapsed_days: 175,
          prior_diameter_mm: 11.2,
          current_diameter_mm: dc.nodules[0]?.max_diameter_mm || 16.4,
          diameter_change_mm: (dc.nodules[0]?.max_diameter_mm || 16.4) - 11.2,
          diameter_change_pct: 46.4,
          prior_volume_mm3: 735.0,
          current_volume_mm3: dc.nodules[0]?.volume_mm3 || 1820.0,
          volume_change_mm3: (dc.nodules[0]?.volume_mm3 || 1820.0) - 735.0,
          volume_change_pct: 147.6,
          volume_doubling_time_days: 198,
          kinetic_category: "rapid",
          growth_flag: "significant_growth",
        },
        timeline: [
          { date: "10 Sep 2025", diameter: 11.2, volume: 735.0, label: "Prior CT Baseline" },
          { date: dc.scanDate, diameter: dc.nodules[0]?.max_diameter_mm || 16.4, volume: dc.nodules[0]?.volume_mm3 || 1820.0, label: "Current CT (Follow-up)" },
        ],
      };
    }
    return null;
  });

  const [loading, setLoading] = useState(!isDemo);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (isDemo) return;

    Promise.all([
      getCaseResults(caseId),
      getTemporalAnalysis(caseId).catch(() => null),
    ])
      .then(([res, temp]) => {
        setResults(res);
        setTemporalData(temp);
        setLoading(false);
      })
      .catch((err) => {
        const dc = getDemoCaseFull("DEMO-003");
        setResults(convertToCaseResults(dc));
        setLoading(false);
      });
  }, [caseId, isDemo]);

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
        {error || "Failed to load comparison data"}
      </div>
    );
  }

  const selectedNodule = results.nodules[selectedIdx] || null;
  const metrics = temporalData?.metrics;
  const timeline = temporalData?.timeline || [];

  const prev = timeline.length >= 2 ? timeline[0] : null;
  const curr = timeline.length >= 2 ? timeline[timeline.length - 1] : null;

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
        <span style={{ fontSize: 12, fontWeight: 600 }}>Temporal Comparison</span>
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

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>
          Longitudinal Growth Kinetics & Comparison
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
          Compare nodule volume, diameter changes, and Volume Doubling Time (VDT) across serial chest CT studies.
        </p>

        {/* Nodule Selector */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {results.nodules.map((n, i) => (
            <button
              key={n.id}
              onClick={() => setSelectedIdx(i)}
              style={{
                padding: "6px 14px",
                borderRadius: 3,
                border: `1px solid ${i === selectedIdx ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                background: i === selectedIdx ? "rgba(0,196,232,0.1)" : "var(--bg-secondary)",
                color: i === selectedIdx ? "var(--accent-primary)" : "var(--text-secondary)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Nodule #{n.nodule_index} ({fmt(n.max_diameter_mm)} mm)
            </button>
          ))}
        </div>

        {selectedNodule && prev && curr ? (
          <>
            {/* Growth Alert Banner */}
            {metrics?.kinetic_category === "rapid_growth" && (
              <div
                style={{
                  padding: "12px 16px",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.25)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 24,
                }}
              >
                <AlertTriangle size={20} color="#ef4444" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444" }}>
                    RAPID INTERVAL GROWTH DETECTED
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {metrics.growth_flag} Volume Doubling Time (VDT): <strong>{metrics.volume_doubling_time_days} days</strong>.
                  </div>
                </div>
              </div>
            )}

            {/* Side-by-side comparative cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 16, marginBottom: 24, alignItems: "center" }}>
              {/* Previous Scan */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 4 }}>
                  PRIOR CT STUDY
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 16 }}>{prev.date} ({prev.label})</div>

                {/* Simulated circle lesion */}
                <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: "50%", background: "rgba(0,196,232,0.15)", border: "2px solid rgba(0,196,232,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--accent-primary)" }}>PREV</span>
                </div>

                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: "var(--text-primary)" }}>
                  {fmt(prev.diameter)} mm
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Volume: {fmt(prev.volume, 0)} mm³
                </div>
              </div>

              {/* Interval Growth Arrow Indicator */}
              <div style={{ textAlign: "center", padding: "0 8px" }}>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 18px",
                    background: metrics?.volume_change_pct && metrics.volume_change_pct > 20 ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                    border: `1px solid ${metrics?.volume_change_pct && metrics.volume_change_pct > 20 ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
                    borderRadius: 6,
                  }}
                >
                  <ArrowUp size={20} color={metrics?.volume_change_pct && metrics.volume_change_pct > 20 ? "#ef4444" : "#10b981"} />
                  <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: metrics?.volume_change_pct && metrics.volume_change_pct > 20 ? "#ef4444" : "#10b981" }}>
                    +{fmt(metrics?.diameter_change_mm)} mm
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)" }}>
                    +{fmt(metrics?.volume_change_pct, 1)}% vol
                  </div>
                </div>
              </div>

              {/* Current Scan */}
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--accent-primary)", borderRadius: 6, padding: "20px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--accent-primary)", marginBottom: 4 }}>
                  CURRENT CT STUDY
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 16 }}>{curr.date} ({curr.label})</div>

                {/* Simulated circle lesion */}
                <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: "50%", background: "rgba(0,196,232,0.3)", border: "2px solid var(--accent-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 10, fontFamily: "monospace", color: "white" }}>CURR</span>
                </div>

                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: "var(--accent-primary)" }}>
                  {fmt(curr.diameter)} mm
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Volume: {fmt(curr.volume, 0)} mm³
                </div>
              </div>
            </div>

            {/* Kinetic Metrics Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 24 }}>
              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  INTERVAL DURATION
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>
                  {metrics?.elapsed_days} days
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  ~{(metrics?.elapsed_days || 365) / 30 | 0} months elapsed
                </div>
              </div>

              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  VOLUME DOUBLING TIME (VDT)
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: metrics?.volume_doubling_time_days && metrics.volume_doubling_time_days < 400 ? "#ef4444" : "var(--text-primary)" }}>
                  {metrics?.volume_doubling_time_days ? `${metrics.volume_doubling_time_days} days` : "Indeterminate"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  Schwartz doubling model
                </div>
              </div>

              <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 16 }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  KINETIC PATTERN
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: metrics?.kinetic_category === "rapid_growth" ? "#ef4444" : "var(--color-success)", marginTop: 4 }}>
                  {(metrics?.kinetic_category || "stable").replace("_", " ").toUpperCase()}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                  {metrics?.kinetic_category === "rapid_growth" ? "Immediate clinical review" : "Routine surveillance"}
                </div>
              </div>
            </div>

            {/* Longitudinal Timeline Progression */}
            <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: 20 }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 16, textTransform: "uppercase" }}>
                LONGITUDINAL SCAN TIMELINE
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
                <div style={{ position: "absolute", top: 16, left: 30, right: 30, height: 2, background: "var(--border-default)", zIndex: 0 }} />

                {timeline.map((tp, idx) => (
                  <div key={idx} style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-primary)", border: `2px solid ${idx === timeline.length - 1 ? "var(--accent-primary)" : "var(--border-default)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                      <Clock size={14} color={idx === timeline.length - 1 ? "var(--accent-primary)" : "var(--text-muted)"} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{tp.date}</div>
                    <div style={{ fontSize: 11, fontFamily: "monospace", color: "var(--accent-primary)" }}>{tp.diameter} mm</div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{tp.volume} mm³</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", background: "var(--bg-secondary)", borderRadius: 6, border: "1px solid var(--border-subtle)", maxWidth: 500, margin: "20px auto" }}>
            <Clock size={32} color="var(--text-muted)" style={{ margin: "0 auto 12px", opacity: 0.5 }} />
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 6 }}>Single Study Case</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 20 }}>No prior longitudinal CT scans available for comparison or volume doubling calculation.</p>
            <Link
              href={`/workspace/${caseId}`}
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
              <ChevronLeft size={14} />
              Return to Workspace
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

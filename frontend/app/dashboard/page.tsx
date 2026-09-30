"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UploadCloud, Search, Bell, User, AlertTriangle, Loader2, TrendingUp,
  FileText, CheckCircle, Clock, Eye, RefreshCw, Scan, Layers, Activity,
  Circle, Info, X, ChevronDown, ChevronUp, ClipboardList,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { listCases, listDemoCases, createDemoCase, updateReviewStatus, APIError } from "@/lib/api";
import type { CaseListItem, DemoCaseInfo } from "@/types/api";
import { ALL_DEMO_CASES } from "@/lib/demoCases";

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return d; }
}
function riskColor(pct?: number | null): string {
  if (pct == null) return "#94a3b8";
  if (pct >= 65) return "#dc2626";
  if (pct >= 15) return "#d97706";
  return "#059669";
}
function riskLabel(pct?: number | null): string {
  if (pct == null) return "Unassessed";
  if (pct >= 65) return "Higher Suspicion";
  if (pct >= 15) return "Intermediate";
  return "Low";
}
function reviewBadgeStyle(status: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    unreviewed: { label: "Unreviewed", color: "#64748b", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)" },
    under_review: { label: "Under Review", color: "#0891b2", bg: "rgba(8,145,178,0.1)", border: "rgba(8,145,178,0.25)" },
    reviewed: { label: "Reviewed", color: "#059669", bg: "rgba(5,150,105,0.1)", border: "rgba(5,150,105,0.25)" },
    needs_attention: { label: "Needs Attention", color: "#dc2626", bg: "rgba(220,38,38,0.1)", border: "rgba(220,38,38,0.25)" },
  };
  return map[status] || map.unreviewed;
}
function analysisBadgeStyle(mode: string, isDemo: boolean) {
  if (isDemo) return { label: "Demo Data", color: "#d97706", bg: "rgba(217,119,6,0.1)", border: "rgba(217,119,6,0.25)" };
  if (mode === "image_review") return { label: "2D Visual Review", color: "#0891b2", bg: "rgba(8,145,178,0.1)", border: "rgba(8,145,178,0.25)" };
  if (mode === "video_review") return { label: "CT Video Review", color: "#0891b2", bg: "rgba(8,145,178,0.1)", border: "rgba(8,145,178,0.25)" };
  return { label: "3D CT Analysis", color: "#00b89c", bg: "rgba(0,184,156,0.1)", border: "rgba(0,184,156,0.25)" };
}

type RiskFilter = "all" | "higher" | "intermediate" | "low" | "unassessed" | "needs_review" | "reviewed";
type SortKey = "risk" | "date" | "largest_nodule" | "review_status";

function RiskPriorityQueue({ cases, loading, onRefresh }: {
  cases: CaseListItem[]; loading: boolean; onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<RiskFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("risk");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const handleStatusUpdate = async (caseId: string, newStatus: string) => {
    setUpdatingStatus(caseId);
    try { await updateReviewStatus(caseId, newStatus); onRefresh(); }
    catch (e) { console.error("Status update failed", e); }
    finally { setUpdatingStatus(null); }
  };

  const filtered = cases.filter((c) => {
    const pct = c.highest_risk_pct;
    if (filter === "higher") return pct != null && pct >= 65;
    if (filter === "intermediate") return pct != null && pct >= 15 && pct < 65;
    if (filter === "low") return pct != null && pct < 15;
    if (filter === "unassessed") return pct == null;
    if (filter === "needs_review") return c.review_status === "needs_attention" || c.review_status === "unreviewed";
    if (filter === "reviewed") return c.review_status === "reviewed";
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "risk") return ((b.highest_risk_pct ?? -1) - (a.highest_risk_pct ?? -1));
    if (sortKey === "date") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortKey === "largest_nodule") return (b.largest_nodule_mm ?? 0) - (a.largest_nodule_mm ?? 0);
    if (sortKey === "review_status") return (a.review_status ?? "").localeCompare(b.review_status ?? "");
    return 0;
  });

  const filterBtns: { key: RiskFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "higher", label: "Higher Suspicion" },
    { key: "intermediate", label: "Intermediate" },
    { key: "low", label: "Low" },
    { key: "unassessed", label: "Unassessed" },
    { key: "needs_review", label: "Needs Review" },
    { key: "reviewed", label: "Reviewed" },
  ];

  return (
    <div style={{ background: "#fff", border: "1px solid #b8e8e0", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,184,156,0.06)" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e6f7f4", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={18} color="#00b89c" />
          <span style={{ fontWeight: 800, fontSize: 15, color: "#0d2926" }}>Estimated Risk Priority</span>
          <span style={{ fontSize: 11, color: "#5a9b90", background: "#e6f7f4", border: "1px solid #b8e8e0", padding: "2px 8px", borderRadius: 6, fontWeight: 600 }}>
            {sorted.length} case{sorted.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#5a9b90", fontWeight: 600 }}>Sort:</span>
          {(["risk", "date", "largest_nodule", "review_status"] as SortKey[]).map((sk) => (
            <button key={sk} onClick={() => setSortKey(sk)} style={{
              padding: "4px 10px", borderRadius: 6, border: `1px solid ${sortKey === sk ? "#00b89c" : "#b8e8e0"}`,
              background: sortKey === sk ? "rgba(0,184,156,0.1)" : "transparent",
              color: sortKey === sk ? "#007a68" : "#5a9b90",
              fontSize: 11, fontWeight: sortKey === sk ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" as const,
            }}>
              {sk === "risk" ? "Risk" : sk === "date" ? "Date" : sk === "largest_nodule" ? "Largest Nodule" : "Review Status"}
            </button>
          ))}
          <button onClick={onRefresh} style={{ padding: "5px 7px", borderRadius: 6, border: "1px solid #b8e8e0", background: "transparent", cursor: "pointer", color: "#5a9b90", display: "flex" }}>
            <RefreshCw size={12} />
          </button>
        </div>
      </div>
      <div style={{ padding: "8px 20px", borderBottom: "1px solid #e6f7f4", display: "flex", gap: 6, flexWrap: "wrap" as const }}>
        {filterBtns.map((fb) => (
          <button key={fb.key} onClick={() => setFilter(fb.key)} style={{
            padding: "4px 12px", borderRadius: 20,
            border: `1px solid ${filter === fb.key ? "#00b89c" : "#b8e8e0"}`,
            background: filter === fb.key ? "rgba(0,184,156,0.12)" : "transparent",
            color: filter === fb.key ? "#007a68" : "#5a9b90",
            fontSize: 11, fontWeight: filter === fb.key ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" as const,
          }}>{fb.label}</button>
        ))}
      </div>
      <div style={{ padding: "8px 20px", background: "#fffbeb", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "flex-start", gap: 6 }}>
        <Info size={12} color="#d97706" style={{ marginTop: 1, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#92400e", lineHeight: 1.4 }}>
          Risk priority is based on the highest available estimated malignancy risk from the current analysis and is intended for workflow prioritization, not diagnosis.
        </span>
      </div>
      {loading ? (
        <div style={{ padding: "32px", textAlign: "center", color: "#5a9b90" }}>
          <Loader2 size={20} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px", display: "block" }} color="#00b89c" />
          <span style={{ fontSize: 13 }}>Loading cases…</span>
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#5a9b90" }}>
          <Circle size={36} color="#b8e8e0" style={{ margin: "0 auto 12px", display: "block" }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0d2926", marginBottom: 6 }}>No cases match this filter</div>
          <p style={{ fontSize: 12 }}>Try a different filter or upload a new CT study.</p>
        </div>
      ) : (
        <div>
          {sorted.map((c, idx) => {
            const pct = c.highest_risk_pct;
            const rc = riskColor(pct);
            const rl = riskLabel(pct);
            const rb = reviewBadgeStyle(c.review_status ?? "unreviewed");
            const ab = analysisBadgeStyle(c.analysis_mode ?? "volumetric_ct", c.is_demo ?? false);
            const isExpanded = expandedId === c.id;
            const isUpdating = updatingStatus === c.id;
            return (
              <div key={c.id} style={{ borderBottom: idx < sorted.length - 1 ? "1px solid #e6f7f4" : "none" }}>
                <div style={{ padding: "12px 20px", display: "grid", gridTemplateColumns: "28px 1fr auto auto auto", gap: 12, alignItems: "center" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#f0faf8")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#b8e8e0", textAlign: "center", fontFamily: "monospace" }}>#{idx + 1}</div>
                  <div style={{ cursor: "pointer" }} onClick={() => { window.location.href = `/workspace/${c.id}`; }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" as const }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: "#0d2926", fontFamily: "monospace" }}>{c.case_id}</span>
                      <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: ab.bg, color: ab.color, border: `1px solid ${ab.border}`, fontWeight: 700, letterSpacing: "0.04em" }}>{ab.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#5a9b90", display: "flex", gap: 10, flexWrap: "wrap" as const }}>
                      <span>{formatDate(c.created_at)}</span>
                      {c.nodule_count > 0 && <span>{c.nodule_count} nodule{c.nodule_count !== 1 ? "s" : ""}</span>}
                      {c.largest_nodule_mm != null && <span>Largest: {c.largest_nodule_mm.toFixed(1)} mm</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 90 }}>
                    {pct != null ? (
                      <>
                        <div style={{ fontSize: 17, fontWeight: 900, color: rc, fontFamily: "monospace", lineHeight: 1 }}>{Math.round(pct)}%</div>
                        <div style={{ fontSize: 9, color: rc, fontWeight: 700, marginTop: 1, textTransform: "uppercase" as const }}>{rl}</div>
                        <div style={{ width: 56, height: 3, background: "#e6f7f4", borderRadius: 2, marginTop: 3, marginLeft: "auto" }}>
                          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: rc, borderRadius: 2 }} />
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Not assessed</div>
                    )}
                  </div>
                  <div>
                    <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 4, background: rb.bg, color: rb.color, border: `1px solid ${rb.border}`, fontWeight: 700, whiteSpace: "nowrap" as const }}>
                      {rb.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Link href={`/workspace/${c.id}`} style={{
                      display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 6,
                      background: "rgba(0,184,156,0.1)", border: "1px solid rgba(0,184,156,0.25)",
                      color: "#007a68", textDecoration: "none", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" as const,
                    }}>
                      <Eye size={11} /> Review
                    </Link>
                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{
                      padding: "5px 6px", borderRadius: 6, border: "1px solid #b8e8e0",
                      background: "transparent", cursor: "pointer", color: "#5a9b90", display: "flex"
                    }}>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: "0 20px 12px", paddingLeft: 60, background: "#f8fffe", borderTop: "1px solid #e6f7f4" }}>
                    <div style={{ fontSize: 11, color: "#5a9b90", marginBottom: 6, fontWeight: 600, marginTop: 10 }}>Update Review Status:</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      {["unreviewed", "under_review", "reviewed", "needs_attention"].map((s) => {
                        const bd = reviewBadgeStyle(s);
                        return (
                          <button key={s} disabled={isUpdating} onClick={() => handleStatusUpdate(c.id, s)} style={{
                            padding: "4px 10px", borderRadius: 6,
                            border: `1px solid ${c.review_status === s ? bd.color : "#b8e8e0"}`,
                            background: c.review_status === s ? bd.bg : "transparent",
                            color: c.review_status === s ? bd.color : "#5a9b90",
                            fontSize: 11, fontWeight: c.review_status === s ? 700 : 500,
                            cursor: isUpdating ? "not-allowed" : "pointer", opacity: isUpdating ? 0.6 : 1,
                          }}>
                            {bd.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickStats({ cases }: { cases: CaseListItem[] }) {
  const total = cases.length;
  const withHighRisk = cases.filter((c) => (c.highest_risk_pct ?? 0) >= 65).length;
  const needsReview = cases.filter((c) => c.review_status === "unreviewed" || c.review_status === "needs_attention").length;
  const completed = cases.filter((c) => c.status === "completed").length;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
      {[
        { label: "Total Cases", value: total, Icon: Scan, color: "#0891b2", bg: "rgba(8,145,178,0.1)" },
        { label: "Higher Suspicion", value: withHighRisk, Icon: AlertTriangle, color: "#dc2626", bg: "rgba(220,38,38,0.08)" },
        { label: "Needs Review", value: needsReview, Icon: Clock, color: "#d97706", bg: "rgba(217,119,6,0.08)" },
        { label: "Analysis Complete", value: completed, Icon: CheckCircle, color: "#059669", bg: "rgba(5,150,105,0.08)" },
      ].map(({ label, value, Icon, color, bg }) => (
        <div key={label} style={{ background: "#fff", border: "1px solid #b8e8e0", borderRadius: 12, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 2px 8px rgba(0,184,156,0.05)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={18} color={color} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0d2926", fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, color: "#5a9b90", fontWeight: 500, marginTop: 2 }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_DEMO_CASES: DemoCaseInfo[] = Object.values(ALL_DEMO_CASES).map((d) => ({
  id: d.id,
  label: d.label,
  description: d.shortDescription,
}));

function DemoCasesPanel({ onCaseCreated }: { onCaseCreated: () => void }) {
  const router = useRouter();
  const [demoCases, setDemoCases] = useState<DemoCaseInfo[]>(DEFAULT_DEMO_CASES);
  const [creating, setCreating] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listDemoCases()
      .then((data) => {
        if (data && data.length > 0) setDemoCases(data);
      })
      .catch(() => {});
  }, []);

  const handleLoad = async (demoCaseId: string) => {
    setCreating(demoCaseId);
    setLoadError(null);
    try {
      const c = await createDemoCase(demoCaseId);
      onCaseCreated();
      router.push(`/workspace/${c.id}`);
    } catch {
      router.push(`/workspace/${demoCaseId}`);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #b8e8e0", borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,184,156,0.06)" }}>
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #e6f7f4", display: "flex", alignItems: "center", gap: 8 }}>
        <Layers size={16} color="#00b89c" />
        <span style={{ fontWeight: 800, fontSize: 14, color: "#0d2926" }}>Curated Research Demo Studies</span>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3, background: "rgba(217,119,6,0.1)", color: "#d97706", border: "1px solid rgba(217,119,6,0.25)", fontWeight: 800, letterSpacing: "0.06em" }}>DEMO DATA</span>
      </div>
      {loadError && <div style={{ padding: "8px 20px", background: "#fef2f2", color: "#b91c1c", fontSize: 12, borderBottom: "1px solid #fecaca" }}>{loadError}</div>}
      <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {demoCases.map((dc) => (
          <div key={dc.id} style={{ border: "1px solid #e6f7f4", borderRadius: 10, padding: "14px 16px", background: "#f8fffe", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#0d2926" }}>{dc.label}</div>
            <div style={{ fontSize: 11, color: "#5a9b90", lineHeight: 1.4 }}>{dc.description}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#e0f2fe", color: "#0284c7" }}>Chest CT (DICOM)</span>
              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#e6f7f4", color: "#007a68" }}>Volumetric Analysis</span>
            </div>
            <button disabled={creating === dc.id} onClick={() => handleLoad(dc.id)} style={{
              padding: "7px 14px", borderRadius: 8,
              background: creating === dc.id ? "#e6f7f4" : "linear-gradient(135deg, #00b89c 0%, #0284c7 100%)",
              color: creating === dc.id ? "#5a9b90" : "#fff",
              border: "none", cursor: creating === dc.id ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
              {creating === dc.id ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} color="#5a9b90" /> Loading…</> : "Launch Workstation"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const INITIAL_DEMO_CASES: CaseListItem[] = Object.values(ALL_DEMO_CASES).map((dc) => ({
  id: dc.id,
  case_id: dc.patientId,
  status: "completed",
  created_at: new Date().toISOString(),
  is_demo: true,
  analysis_mode: "volumetric_ct",
  highest_risk_pct: dc.summary.highest_risk_pct,
  nodule_count: dc.summary.nodule_count,
  largest_nodule_mm: dc.summary.largest_nodule_mm,
  review_status: "unreviewed",
}));

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseListItem[]>(INITIAL_DEMO_CASES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [backendDown, setBackendDown] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCases();
      setCases(data);
      setBackendDown(false);
    } catch (e) {
      if (e instanceof APIError && e.status === 0) {
        setBackendDown(true);
        setError("Cannot reach PulmoScan AI backend. Ensure the server is running on port 8000.");
      } else {
        setError(e instanceof APIError ? e.message : String(e));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await listCases();
        if (active) {
          setCases(data);
          setBackendDown(false);
        }
      } catch (e) {
        if (active) {
          // Provide demo case list fallback so workstation review is immediately accessible
          const fallbackCases: CaseListItem[] = Object.values(ALL_DEMO_CASES).map((dc) => ({
            id: dc.id,
            case_id: dc.patientId,
            status: "completed",
            created_at: new Date().toISOString(),
            is_demo: true,
            analysis_mode: "volumetric_ct",
            highest_risk_pct: dc.summary.highest_risk_pct,
            nodule_count: dc.summary.nodule_count,
            largest_nodule_mm: dc.summary.largest_nodule_mm,
            review_status: "unreviewed",
          }));
          setCases(fallbackCases);
          setBackendDown(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const displayCases = searchQuery.trim()
    ? cases.filter((c) =>
        c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cases;

  return (
    <div style={{ minHeight: "100vh", background: "#f0faf8", fontFamily: "'Inter', -apple-system, sans-serif", color: "#0d2926" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <header style={{
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)", borderBottom: "1px solid #b8e8e0",
        padding: "0 28px", height: 60, display: "flex", alignItems: "center", gap: 16,
        position: "sticky", top: 0, zIndex: 50, boxShadow: "0 2px 12px rgba(0,184,156,0.05)",
      }}>
        <BrandLogo size={32} showBadge={false} />
        <span style={{ color: "#b8e8e0" }}>|</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#2d6b62" }}>Dashboard</span>
        <div style={{ flex: 1, maxWidth: 420, position: "relative" }}>
          <Search size={14} color="#5a9b90" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            type="text" placeholder="Search patient ID, case ID, or study…"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "8px 32px", borderRadius: 8, border: "1px solid #b8e8e0", background: "#f8fffe", fontSize: 13, color: "#0d2926", outline: "none", fontFamily: "inherit" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#5a9b90" }}>
              <X size={13} />
            </button>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
          <Link href="/analyze" style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8,
            background: "linear-gradient(135deg, #00b89c 0%, #0284c7 100%)", color: "#fff",
            textDecoration: "none", fontSize: 13, fontWeight: 700, boxShadow: "0 2px 10px rgba(0,184,156,0.3)",
          }}>
            <UploadCloud size={14} /> Upload CT Scan
          </Link>
          <Link href="/cases" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #b8e8e0", color: "#2d6b62", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            <ClipboardList size={14} /> All Cases
          </Link>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #00b89c 0%, #0284c7 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={15} color="#fff" />
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px 64px" }}>
        {backendDown && (
          <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertTriangle size={18} color="#b91c1c" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#b91c1c" }}>Backend Unavailable</div>
              <div style={{ fontSize: 12, color: "#991b1b", marginTop: 2 }}>{error}</div>
            </div>
            <button onClick={loadCases} style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 6, border: "1px solid #fecaca", background: "#fff", cursor: "pointer", fontSize: 12, color: "#b91c1c" }}>
              Retry
            </button>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0d2926", marginBottom: 4, letterSpacing: "-0.02em" }}>Clinical Workstation</h1>
          <p style={{ fontSize: 13, color: "#5a9b90" }}>Review AI-analyzed CT studies, prioritize cases by risk, and generate structured reports.</p>
        </div>

        {!loading && !backendDown && <QuickStats cases={displayCases} />}
        {searchQuery && (
          <div style={{ marginBottom: 16, fontSize: 13, color: "#5a9b90" }}>
            {displayCases.length} result{displayCases.length !== 1 ? "s" : ""} for &quot;<strong style={{ color: "#0d2926" }}>{searchQuery}</strong>&quot;
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <RiskPriorityQueue cases={displayCases} loading={loading} onRefresh={loadCases} />
        </div>

        {!backendDown && (
          <div style={{ marginBottom: 24 }}>
            <DemoCasesPanel onCaseCreated={loadCases} />
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { Icon: UploadCloud, label: "New CT Analysis", desc: "Upload and analyze a CT study", href: "/analyze", color: "#00b89c", primary: true },
            { Icon: ClipboardList, label: "View All Cases", desc: "Browse case directory", href: "/cases", color: "#0891b2", primary: false },
            { Icon: Activity, label: "Risk Assessment", desc: "Detailed risk scoring", href: "/risk", color: "#d97706", primary: false },
            { Icon: FileText, label: "Reports", desc: "Generate structured reports", href: "/report", color: "#059669", primary: false },
          ].map(({ Icon, label, desc, href, color, primary }) => (
            <Link key={label} href={href} style={{
              background: primary ? `linear-gradient(135deg, ${color} 0%, #0284c7 100%)` : "#fff",
              border: `1px solid ${primary ? "transparent" : "#b8e8e0"}`,
              borderRadius: 12, padding: "16px 18px", textDecoration: "none",
              display: "flex", alignItems: "center", gap: 12,
              boxShadow: primary ? "0 4px 16px rgba(0,184,156,0.25)" : "0 2px 8px rgba(0,184,156,0.04)",
            }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0, background: primary ? "rgba(255,255,255,0.2)" : `${color}14`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={18} color={primary ? "#fff" : color} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: primary ? "#fff" : "#0d2926", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, color: primary ? "rgba(255,255,255,0.75)" : "#5a9b90" }}>{desc}</div>
              </div>
            </Link>
          ))}
        </div>

        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertTriangle size={14} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11.5, color: "#78350f", lineHeight: 1.55, margin: 0 }}>
            <strong>Research Prototype: </strong>
            PulmoScan AI is a research and demonstration prototype. AI-generated findings, risk estimates, and reports require review by a qualified healthcare professional before any clinical decision is made.
          </p>
        </div>
      </main>
    </div>
  );
}


"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus, ChevronRight, AlertTriangle, Loader2, CheckCircle,
  Circle, Clock, ChevronLeft, Layers, Search, Filter, X,
  TrendingUp, Eye,
} from "lucide-react";
import { listCases, APIError } from "@/lib/api";
import type { CaseListItem } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return dateStr; }
}

function riskColor(pct?: number | null): string {
  if (pct == null) return "var(--text-muted)";
  if (pct >= 65) return "#dc2626";
  if (pct >= 15) return "#d97706";
  return "#059669";
}

function riskLabel(pct?: number | null): string {
  if (pct == null) return "Not assessed";
  if (pct >= 65) return "Higher Suspicion";
  if (pct >= 15) return "Intermediate";
  return "Low";
}

function statusBadge(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    completed: { color: "var(--color-success)", label: "Completed" },
    processing: { color: "var(--accent-primary)", label: "Processing" },
    pending: { color: "var(--text-muted)", label: "Pending" },
    failed: { color: "var(--color-danger)", label: "Failed" },
    needs_review: { color: "var(--color-warning)", label: "Needs Review" },
  };
  return map[status] || { color: "var(--text-muted)", label: status };
}

function reviewBadge(status?: string) {
  if (!status) return null;
  const map: Record<string, { label: string; color: string; bg: string }> = {
    unreviewed: { label: "Unreviewed", color: "#64748b", bg: "rgba(100,116,139,0.1)" },
    under_review: { label: "Under Review", color: "#0891b2", bg: "rgba(8,145,178,0.1)" },
    reviewed: { label: "Reviewed", color: "#059669", bg: "rgba(5,150,105,0.1)" },
    needs_attention: { label: "Needs Attention", color: "#dc2626", bg: "rgba(220,38,38,0.1)" },
  };
  return map[status] || map.unreviewed;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle size={13} color="var(--color-success)" />;
  if (status === "processing") return <Loader2 size={13} color="var(--accent-primary)" style={{ animation: "spin 1s linear infinite" }} />;
  if (status === "failed") return <AlertTriangle size={13} color="var(--color-danger)" />;
  return <Clock size={13} color="var(--text-muted)" />;
}

type ReviewFilter = "all" | "unreviewed" | "under_review" | "reviewed" | "needs_attention";
type SortBy = "date" | "risk" | "largest" | "review";

export default function CasesPage() {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const c = await listCases();
        if (active) setCases(c);
      } catch (err) {
        if (active) setError(err instanceof APIError ? err.message : String(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const filtered = cases.filter((c) => {
    const matchSearch = !search.trim() || c.case_id.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
    const matchReview = reviewFilter === "all" || c.review_status === reviewFilter;
    return matchSearch && matchReview;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "risk") return ((b.highest_risk_pct ?? -1) - (a.highest_risk_pct ?? -1));
    if (sortBy === "largest") return ((b.largest_nodule_mm ?? 0) - (a.largest_nodule_mm ?? 0));
    if (sortBy === "review") return (a.review_status ?? "").localeCompare(b.review_status ?? "");
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const reviewFilters: { key: ReviewFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unreviewed", label: "Unreviewed" },
    { key: "under_review", label: "Under Review" },
    { key: "reviewed", label: "Reviewed" },
    { key: "needs_attention", label: "Needs Attention" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border-subtle)", background: "rgba(240, 250, 248, 0.97)",
        backdropFilter: "blur(12px)", padding: "0 28px", height: 60,
        display: "flex", alignItems: "center", gap: 16, position: "sticky", top: 0, zIndex: 40,
      }}>
        <BrandLogo size={32} showBadge={false} />
        <span style={{ color: "var(--border-default)" }}>|</span>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
          <ChevronLeft size={16} />Home
        </Link>
        <span style={{ color: "var(--border-subtle)" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-secondary)" }}>Case Directory</span>
        <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", textDecoration: "none", fontSize: 13, fontWeight: 500, marginLeft: 8 }}>
          Dashboard
        </Link>
        <Link href="/analyze" style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 18px", background: "var(--accent-primary)", color: "#ffffff",
          textDecoration: "none", borderRadius: 8, fontSize: 13, fontWeight: 700,
          boxShadow: "0 2px 10px rgba(0, 184, 156, 0.3)",
        }}>
          <Plus size={15} />New Analysis
        </Link>
      </nav>

      {/* Main */}
      <main style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "28px 24px 64px" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 4 }}>CT Case Directory</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            Thoracic CT studies and visual review cases. Select any case to inspect findings.
          </p>
        </div>

        {/* Search & Filters */}
        <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 400 }}>
            <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              type="text" placeholder="Search case ID or patient ID…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", padding: "8px 32px", borderRadius: 8, border: "1px solid var(--border-subtle)", background: "var(--bg-panel)", fontSize: 13, color: "var(--text-primary)", outline: "none", fontFamily: "inherit" }}
            />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={13} /></button>}
          </div>

          {/* Review filter */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {reviewFilters.map((f) => (
              <button key={f.key} onClick={() => setReviewFilter(f.key)} style={{
                padding: "5px 12px", borderRadius: 20,
                border: `1px solid ${reviewFilter === f.key ? "#00b89c" : "var(--border-subtle)"}`,
                background: reviewFilter === f.key ? "rgba(0,184,156,0.12)" : "transparent",
                color: reviewFilter === f.key ? "#007a68" : "var(--text-muted)",
                fontSize: 11, fontWeight: reviewFilter === f.key ? 700 : 500, cursor: "pointer", whiteSpace: "nowrap" as const,
              }}>{f.label}</button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Sort:</span>
            {(["date", "risk", "largest", "review"] as SortBy[]).map((s) => (
              <button key={s} onClick={() => setSortBy(s)} style={{
                padding: "4px 10px", borderRadius: 6,
                border: `1px solid ${sortBy === s ? "#00b89c" : "var(--border-subtle)"}`,
                background: sortBy === s ? "rgba(0,184,156,0.1)" : "transparent",
                color: sortBy === s ? "#007a68" : "var(--text-muted)",
                fontSize: 11, fontWeight: sortBy === s ? 700 : 500, cursor: "pointer",
              }}>
                {s === "date" ? "Date" : s === "risk" ? "Risk" : s === "largest" ? "Largest Nodule" : "Review Status"}
              </button>
            ))}
          </div>
        </div>

        {search && (
          <div style={{ marginBottom: 12, fontSize: 13, color: "var(--text-muted)" }}>
            {sorted.length} result{sorted.length !== 1 ? "s" : ""} for &quot;<strong style={{ color: "var(--text-primary)" }}>{search}</strong>&quot;
          </div>
        )}

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--text-secondary)", fontSize: 13, padding: "48px 24px", justifyContent: "center", background: "var(--bg-panel)", borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
            <Loader2 size={20} color="var(--accent-primary)" style={{ animation: "spin 1s linear infinite" }} />
            Loading patient cases…
          </div>
        )}

        {error && (
          <div style={{ padding: "16px 20px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, fontSize: 13, color: "#b91c1c", display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20 }}>
            <AlertTriangle size={18} style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <strong>Cannot connect to PulmoScan backend</strong>
              <div style={{ marginTop: 2 }}>{error}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Verify backend is running at <code>http://127.0.0.1:8000</code></div>
            </div>
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 24px", background: "var(--bg-panel)", borderRadius: 12, border: "1px solid var(--border-subtle)" }}>
            <Circle size={44} color="var(--border-default)" style={{ margin: "0 auto 16px", opacity: 0.6 }} />
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>No studies found</h2>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              {search ? "No cases match your search." : "Start by uploading a CT study or try a demonstration case."}
            </p>
            <Link href="/analyze" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", background: "var(--accent-primary)", color: "#ffffff", textDecoration: "none", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
              Start New Analysis
            </Link>
          </div>
        )}

        {!loading && sorted.length > 0 && (
          <div style={{ background: "var(--bg-panel)", border: "1px solid var(--border-default)", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 12px rgba(0, 70, 60, 0.04)" }}>
            {/* Table Header */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 1fr 40px", padding: "11px 20px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-subtle)", gap: 12, alignItems: "center" }}>
              {["Case & Type", "Date Registered", "Status", "Highest Risk", "Nodules", "Review", ""].map((h) => (
                <div key={h} style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: "var(--text-muted)", textTransform: "uppercase" as const }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {sorted.map((c, i) => {
              const badge = statusBadge(c.status);
              const rb = reviewBadge(c.review_status);
              const pct = c.highest_risk_pct;
              const caseUrl = c.status === "processing" ? `/processing/${c.id}` : `/workspace/${c.id}`;
              const isDemo = c.is_demo;
              const isImage = c.analysis_mode === "image_review";
              const isVideo = c.analysis_mode === "video_review";

              return (
                <Link key={c.id} href={caseUrl} style={{
                  display: "grid", gridTemplateColumns: "1.6fr 1.2fr 1fr 1fr 1fr 1fr 40px",
                  padding: "13px 20px", borderBottom: i < sorted.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  textDecoration: "none", color: "var(--text-primary)", gap: 12, alignItems: "center",
                  transition: "background 0.12s ease",
                }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", marginBottom: 3 }}>{c.case_id}</div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                      {isDemo && <span style={{ fontSize: 9, background: "rgba(217,119,6,0.12)", color: "#d97706", border: "1px solid rgba(217,119,6,0.25)", padding: "1px 6px", borderRadius: 3, fontWeight: 800, letterSpacing: "0.06em" }}>Demo</span>}
                      {isImage && <span style={{ fontSize: 9, background: "rgba(8,145,178,0.1)", color: "#0891b2", border: "1px solid rgba(8,145,178,0.25)", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>2D Review</span>}
                      {isVideo && <span style={{ fontSize: 9, background: "rgba(8,145,178,0.1)", color: "#0891b2", border: "1px solid rgba(8,145,178,0.25)", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>Video</span>}
                      {!isDemo && !isImage && !isVideo && <span style={{ fontSize: 9, background: "rgba(0,184,156,0.1)", color: "var(--accent-secondary)", border: "1px solid var(--border-subtle)", padding: "1px 6px", borderRadius: 3, fontWeight: 700 }}>3D CT</span>}
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatDate(c.created_at)}</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <StatusIcon status={c.status} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>{badge.label}</span>
                  </div>

                  <div>
                    {pct != null ? (
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 800, fontFamily: "monospace", color: riskColor(pct) }}>{Math.round(pct)}%</span>
                        <div style={{ fontSize: 9, color: riskColor(pct), fontWeight: 600, marginTop: 1 }}>{riskLabel(pct)}</div>
                        <div style={{ width: 50, height: 3, background: "#e6f7f4", borderRadius: 2, marginTop: 2 }}>
                          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: riskColor(pct), borderRadius: 2 }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Not assessed</span>
                    )}
                  </div>

                  <div style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "monospace" }}>
                    {isImage || isVideo ? <span style={{ color: "var(--text-muted)" }}>Visual</span> : c.nodule_count > 0 ? (
                      <div>
                        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{c.nodule_count}</span>
                        {c.largest_nodule_mm != null && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{c.largest_nodule_mm.toFixed(1)} mm</div>}
                      </div>
                    ) : "0"}
                  </div>

                  <div>
                    {rb ? (
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: rb.bg, color: rb.color, fontWeight: 700, whiteSpace: "nowrap" as const }}>
                        {rb.label}
                      </span>
                    ) : "—"}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  ScanLine,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { getCaseStatus, getCase, APIError } from "@/lib/api";
import type { AnalysisJob } from "@/types/api";
import { PIPELINE_STAGES } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";

export default function ProcessingPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [caseStatus, setCaseStatus] = useState<string>("pending");
  const [error, setError] = useState<string | null>(null);
  const [caseNotFound, setCaseNotFound] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const poll = async () => {
    try {
      const [jobData, caseData] = await Promise.all([
        getCaseStatus(caseId).catch(() => null),
        getCase(caseId),
      ]);
      setCaseStatus(caseData.status);

      if (jobData) {
        setJob(jobData);
        if (jobData.status === "completed" || caseData.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => router.push(`/workspace/${caseId}`), 1200);
          return;
        }
        if (jobData.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(jobData.error_message || "Analysis failed. Please try again.");
          return;
        }
      } else if (caseData.status === "completed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setTimeout(() => router.push(`/workspace/${caseId}`), 800);
      }
    } catch (err) {
      if (err instanceof APIError && err.status === 404) {
        setCaseNotFound(true);
        if (pollRef.current) clearInterval(pollRef.current);
      } else {
        setError("Lost connection to backend. Retrying...");
      }
    }
  };

  useEffect(() => {
    // Trigger analysis on demo cases (backend is ready)
    const timeout = setTimeout(() => {
      poll();
    }, 0);
    pollRef.current = setInterval(poll, 2000);
    return () => {
      clearTimeout(timeout);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const stagesCompleted = new Set(job?.stages_completed || []);
  const currentStage = job?.current_stage;
  const progress = job?.progress_pct || 0;

  if (caseNotFound) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg-primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-primary)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <AlertTriangle size={40} color="var(--color-danger)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Case Not Found</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
            Case ID <code>{caseId}</code> does not exist.
          </p>
          <Link
            href="/analyze"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--accent-primary)",
              color: "#0a0d12",
              textDecoration: "none",
              padding: "10px 20px",
              borderRadius: 4,
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Start New Analysis
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 40 }}>
        <BrandLogo size={42} showBadge={true} />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-default)",
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                marginBottom: 2,
              }}
            >
              AI Analysis
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Case {caseId.substring(0, 8).toUpperCase()}
            </div>
          </div>

          {caseStatus === "completed" ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "var(--color-success)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <CheckCircle size={14} />
              Complete
            </div>
          ) : error ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "var(--color-danger)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={14} />
              Failed
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: "var(--accent-primary)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              Processing
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ padding: "16px 20px 8px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {currentStage
                ? PIPELINE_STAGES.find((s) => s.key === currentStage)?.label || currentStage
                : "Initializing..."}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent-primary)",
                fontFamily: "monospace",
              }}
            >
              {progress}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stage list */}
        <div style={{ padding: "8px 20px 20px" }}>
          {(job?.stage_details && job.stage_details.length > 0
            ? job.stage_details
            : PIPELINE_STAGES.map((s) => ({
                key: s.key,
                label: s.label,
                state: (stagesCompleted.has(s.key)
                  ? "completed"
                  : currentStage === s.key
                  ? "active"
                  : "pending") as "completed" | "active" | "pending" | "failed",
              }))
          ).map((stage) => {
            const isDone = stage.state === "completed";
            const isActive = stage.state === "active";
            const isFailed = stage.state === "failed";

            return (
              <div key={stage.key} className="stage-item" style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
                {isDone ? (
                  <div className="stage-icon-done" style={{ color: "var(--color-success)", display: "flex", alignItems: "center" }}>
                    <CheckCircle size={16} />
                  </div>
                ) : isActive ? (
                  <div style={{ color: "var(--accent-primary)", display: "flex", alignItems: "center" }}>
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                ) : isFailed ? (
                  <div style={{ color: "var(--color-danger)", display: "flex", alignItems: "center" }}>
                    <AlertTriangle size={16} />
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", display: "flex", alignItems: "center", opacity: 0.5 }}>
                    <Circle size={14} />
                  </div>
                )}
                <span
                  style={{
                    fontSize: 13,
                    color: isDone
                      ? "var(--text-secondary)"
                      : isActive
                      ? "var(--text-primary)"
                      : "var(--text-muted)",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error state */}
        {error && (
          <div
            style={{
              margin: "0 20px 20px",
              padding: "12px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 4,
              fontSize: 12,
              color: "#ef4444",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <AlertTriangle size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            {error}
          </div>
        )}

        {/* Complete — redirect notice */}
        {caseStatus === "completed" && (
          <div
            style={{
              margin: "0 20px 20px",
              padding: "12px",
              background: "rgba(0,200,122,0.06)",
              border: "1px solid rgba(0,200,122,0.2)",
              borderRadius: 4,
              fontSize: 13,
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <CheckCircle size={14} />
            Analysis complete. Redirecting to workspace…
          </div>
        )}

        {/* Footer links */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "12px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/analyze"
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              textDecoration: "none",
            }}
          >
            ← New analysis
          </Link>
          {caseStatus === "completed" && (
            <Link
              href={`/workspace/${caseId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "var(--accent-primary)",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Open workspace
              <ChevronRight size={12} />
            </Link>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

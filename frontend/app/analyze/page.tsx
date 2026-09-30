"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileImage,
  Video,
  ChevronLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  Eye,
  Info,
  ArrowRight,
  X,
} from "lucide-react";
import {
  createDemoCase,
  uploadCase,
  APIError,
} from "@/lib/api";
import type { DemoCaseInfo } from "@/types/api";
import { BrandLogo } from "@/components/BrandLogo";
import {
  validateUploadFile,
  detectFileClassification,
  FileValidationResult,
} from "@/lib/validation";

import { ALL_DEMO_CASES, type DemoCaseFull } from "@/lib/demoCases";

const DEMO_CASES_LIST: DemoCaseFull[] = Object.values(ALL_DEMO_CASES);

function radsColor(cat: string): string {
  if (cat === "4X" || cat === "4B") return "#ef4444";
  if (cat === "4A") return "#f59e0b";
  if (cat === "3") return "#0ea5e9";
  return "#10b981";
}

export default function AnalyzePage() {
  const router = useRouter();

  // Active selection state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileAnalysis, setFileAnalysis] = useState<FileValidationResult | null>(null);
  const [activeCard, setActiveCard] = useState<"image_ct" | "video" | null>(null);
  const [dragOverCard, setDragOverCard] = useState<"image_ct" | "video" | null>(null);

  // Demo selection
  const [selectedDemoId, setSelectedDemoId] = useState<string>("DEMO-003");

  // Loading & error states
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File, category: "image_ct" | "video") => {
    setError(null);
    const result = validateUploadFile(file, category);
    if (!result.valid) {
      setError(result.error || "Selected file is invalid.");
      setSelectedFile(null);
      setFileAnalysis(null);
      setActiveCard(null);
      return;
    }
    setSelectedFile(file);
    setFileAnalysis(result);
    setActiveCard(category);
  }, []);

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, "image_ct");
    }
    // Reset input value so same file can be selected again
    e.target.value = "";
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file, "video");
    }
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, category: "image_ct" | "video") => {
    e.preventDefault();
    setDragOverCard(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file, category);
    }
  };

  const handleClearSelection = () => {
    setSelectedFile(null);
    setFileAnalysis(null);
    setActiveCard(null);
    setError(null);
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile) return;
    setError(null);
    setLoading(true);
    setLoadingAction("Uploading and registering study...");
    try {
      const created = await uploadCase(selectedFile);
      router.push(`/processing/${created.id}`);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred during upload. Please verify backend is running.");
      }
      setLoading(false);
      setLoadingAction("");
    }
  };

  const handleStartDemo = async (demoId: string) => {
    setError(null);
    setLoading(true);
    setLoadingAction(`Initializing ${demoId} cohort study...`);
    try {
      const created = await createDemoCase(demoId);
      router.push(`/processing/${created.id}`);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred loading demo case.");
      }
      setLoading(false);
      setLoadingAction("");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top Bar ── */}
      <nav
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(240, 250, 248, 0.95)",
          backdropFilter: "blur(12px)",
          height: 60,
          padding: "0 28px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <BrandLogo size={32} showBadge={false} />
        <span style={{ color: "var(--border-default)" }}>|</span>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ChevronLeft size={16} />
          Home
        </Link>
        <span style={{ color: "var(--border-subtle)" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent-secondary)" }}>
          New Analysis
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Link
            href="/cases"
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              textDecoration: "none",
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-panel)",
            }}
          >
            Past Cases
          </Link>
        </div>
      </nav>

      {/* ── Main Container ── */}
      <main
        style={{
          flex: 1,
          maxWidth: 1040,
          width: "100%",
          margin: "0 auto",
          padding: "44px 24px 64px",
        }}
      >
        {/* Page Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(0, 184, 156, 0.12)",
              border: "1px solid var(--border-default)",
              borderRadius: 20,
              padding: "4px 14px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-secondary)",
              marginBottom: 12,
            }}
          >
            <Layers size={13} />
            Input Acquisition
          </div>
          <h1
            style={{
              fontSize: "clamp(1.75rem, 3.5vw, 2.35rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.2,
              marginBottom: 10,
              color: "var(--text-primary)",
            }}
          >
            Start a New Analysis
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-secondary)",
              maxWidth: 560,
              margin: "0 auto",
              lineHeight: 1.6,
            }}
          >
            Choose how you want to provide the scan. Select volumetric CT or medical image, or submit a CT video sequence for visual review.
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "14px 18px",
              marginBottom: 28,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              color: "#b91c1c",
              fontSize: 13,
              boxShadow: "0 2px 8px rgba(220, 38, 38, 0.08)",
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Upload Notice</div>
              <div>{error}</div>
            </div>
            <button
              onClick={() => setError(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#b91c1c",
                cursor: "pointer",
                padding: 4,
              }}
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── TWO PRIMARY UPLOAD CARDS (Side by side on desktop, stacked on mobile) ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
            marginBottom: 28,
          }}
        >
          {/* ────────────────────────────────────────────────────────── */}
          {/* CARD 1: CT IMAGE / PHOTO                                  */}
          {/* ────────────────────────────────────────────────────────── */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCard("image_ct");
            }}
            onDragLeave={() => setDragOverCard(null)}
            onDrop={(e) => handleDrop(e, "image_ct")}
            style={{
              background: "var(--bg-panel)",
              border: `2px ${dragOverCard === "image_ct" || activeCard === "image_ct" ? "solid var(--accent-primary)" : "dashed var(--border-default)"}`,
              borderRadius: 12,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              boxShadow:
                activeCard === "image_ct"
                  ? "0 8px 24px rgba(0, 184, 156, 0.15)"
                  : "0 2px 10px rgba(0, 80, 70, 0.04)",
              transition: "all 0.2s ease",
              position: "relative",
            }}
          >
            {/* Hidden file input */}
            <input
              ref={imageInputRef}
              type="file"
              accept=".dcm,.zip,.nii,.gz,.png,.jpg,.jpeg"
              style={{ display: "none" }}
              onChange={handleImageFileSelect}
            />

            {/* Header / Icon */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "rgba(0, 184, 156, 0.12)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent-primary)",
                  flexShrink: 0,
                }}
              >
                <FileImage size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    CT Image / Photo
                  </h2>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "rgba(0, 184, 156, 0.15)",
                      color: "var(--accent-secondary)",
                    }}
                  >
                    Primary Study
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Upload a CT study or medical image for AI-assisted review.
                </p>
              </div>
            </div>

            {/* Selected File Feedback or Drop Prompt */}
            {activeCard === "image_ct" && selectedFile && fileAnalysis ? (
              <div
                style={{
                  background: "rgba(0, 184, 156, 0.08)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  padding: "14px 16px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={18} color="var(--color-success)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-all" }}>
                      {selectedFile.name}
                    </span>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 2,
                    }}
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span>•</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: fileAnalysis.isVolumetric ? "var(--accent-secondary)" : "#0891b2",
                      background: "var(--bg-panel)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {fileAnalysis.modeLabel}
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => imageInputRef.current?.click()}
                style={{
                  flex: 1,
                  background: dragOverCard === "image_ct" ? "rgba(0, 184, 156, 0.08)" : "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "24px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 20,
                  transition: "background 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Upload size={28} color="var(--accent-primary)" style={{ marginBottom: 10, opacity: 0.85 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Drop CT study or photo here
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  or click to browse from device
                </div>
              </div>
            )}

            {/* Choose Button */}
            <button
              onClick={() => imageInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "11px 18px",
                background: "var(--accent-primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 2px 10px rgba(0, 184, 156, 0.25)",
                transition: "opacity 0.15s ease",
                marginBottom: 18,
              }}
            >
              <Upload size={16} />
              Choose Image / CT File
            </button>

            {/* Supported Formats Specification */}
            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: 14,
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 6 }}>
                Supported Formats & Mode Breakdown:
              </div>
              <div style={{ marginBottom: 5 }}>
                <strong style={{ color: "var(--accent-secondary)" }}>3D CT Analysis:</strong>{" "}
                <code style={{ background: "rgba(0,184,156,0.1)", padding: "1px 5px", borderRadius: 3 }}>.dcm</code>{" "}
                <code style={{ background: "rgba(0,184,156,0.1)", padding: "1px 5px", borderRadius: 3 }}>.zip</code>{" "}
                <code style={{ background: "rgba(0,184,156,0.1)", padding: "1px 5px", borderRadius: 3 }}>.nii</code>{" "}
                <code style={{ background: "rgba(0,184,156,0.1)", padding: "1px 5px", borderRadius: 3 }}>.nii.gz</code>
              </div>
              <div>
                <strong style={{ color: "#0891b2" }}>2D Visual Review:</strong>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.png</code>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.jpg</code>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.jpeg</code>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                * 2D photos are reviewed visually; 3D volumetric analysis requires multi-slice DICOM or NIfTI.
              </div>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────── */}
          {/* CARD 2: CT VIDEO                                          */}
          {/* ────────────────────────────────────────────────────────── */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCard("video");
            }}
            onDragLeave={() => setDragOverCard(null)}
            onDrop={(e) => handleDrop(e, "video")}
            style={{
              background: "var(--bg-panel)",
              border: `2px ${dragOverCard === "video" || activeCard === "video" ? "solid var(--accent-primary)" : "dashed var(--border-default)"}`,
              borderRadius: 12,
              padding: "28px 24px",
              display: "flex",
              flexDirection: "column",
              boxShadow:
                activeCard === "video"
                  ? "0 8px 24px rgba(0, 184, 156, 0.15)"
                  : "0 2px 10px rgba(0, 80, 70, 0.04)",
              transition: "all 0.2s ease",
              position: "relative",
            }}
          >
            {/* Hidden file input */}
            <input
              ref={videoInputRef}
              type="file"
              accept=".mp4,.mkv,.mov,.webm,.avi"
              style={{ display: "none" }}
              onChange={handleVideoFileSelect}
            />

            {/* Header / Icon */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: "rgba(8, 145, 178, 0.12)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#0891b2",
                  flexShrink: 0,
                }}
              >
                <Video size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
                    CT Video
                  </h2>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: "rgba(8, 145, 178, 0.15)",
                      color: "#0891b2",
                    }}
                  >
                    Visual Review
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  Upload a CT video or slice sequence for AI-assisted visual review.
                </p>
              </div>
            </div>

            {/* Selected File Feedback or Drop Prompt */}
            {activeCard === "video" && selectedFile && fileAnalysis ? (
              <div
                style={{
                  background: "rgba(8, 145, 178, 0.08)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  padding: "14px 16px",
                  marginBottom: 20,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={18} color="var(--color-success)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-all" }}>
                      {selectedFile.name}
                    </span>
                  </div>
                  <button
                    onClick={handleClearSelection}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 2,
                    }}
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                  <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  <span>•</span>
                  <span
                    style={{
                      fontWeight: 700,
                      color: "#0891b2",
                      background: "var(--bg-panel)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    Visual Review (CT Video Cine)
                  </span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => videoInputRef.current?.click()}
                style={{
                  flex: 1,
                  background: dragOverCard === "video" ? "rgba(8, 145, 178, 0.08)" : "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "24px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  marginBottom: 20,
                  transition: "background 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Video size={28} color="#0891b2" style={{ marginBottom: 10, opacity: 0.85 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Drop CT cine recording here
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  or click to browse from device
                </div>
              </div>
            )}

            {/* Choose Video Button */}
            <button
              onClick={() => videoInputRef.current?.click()}
              style={{
                width: "100%",
                padding: "11px 18px",
                background: "var(--accent-secondary)",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: "0 2px 10px rgba(0, 143, 122, 0.25)",
                transition: "opacity 0.15s ease",
                marginBottom: 18,
              }}
            >
              <Video size={16} />
              Choose Video
            </button>

            {/* Supported Formats Specification */}
            <div
              style={{
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: 14,
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)", marginBottom: 6 }}>
                Supported Formats & Mode Breakdown:
              </div>
              <div style={{ marginBottom: 5 }}>
                <strong style={{ color: "#0891b2" }}>Supported Video Containers:</strong>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.mp4</code>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.mkv</code>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.mov</code>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.webm</code>{" "}
                <code style={{ background: "rgba(8,145,178,0.1)", padding: "1px 5px", borderRadius: 3 }}>.avi</code>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>
                * Video sequences are reviewed visually in cine playback mode. They are not processed as 3D quantitative CT studies.
              </div>
            </div>
          </div>
        </div>

        {/* ── ACTION BAR (Shows when a file is selected) ── */}
        {selectedFile && fileAnalysis && (
          <div
            style={{
              background: "var(--bg-panel)",
              border: "2px solid var(--accent-primary)",
              borderRadius: 12,
              padding: "18px 24px",
              marginBottom: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              boxShadow: "0 6px 20px rgba(0, 184, 156, 0.18)",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Ready to Process
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Mode: <strong>{fileAnalysis.modeLabel}</strong> ({ (selectedFile.size / 1024 / 1024).toFixed(2) } MB)
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={handleClearSelection}
                disabled={loading}
                style={{
                  padding: "9px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default)",
                  background: "var(--bg-elevated)",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStartAnalysis}
                disabled={loading}
                style={{
                  padding: "10px 24px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--accent-primary)",
                  color: "#ffffff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: "0 3px 12px rgba(0, 184, 156, 0.35)",
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                    {loadingAction || "Processing..."}
                  </>
                ) : (
                  <>
                    Begin Analysis
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── SECTION 4: DEMO CASE (Placed below upload cards, visually distinct) ── */}
        <section
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #f6fcfb 100%)",
            border: "1px solid var(--border-default)",
            borderRadius: 14,
            padding: "28px 24px",
            boxShadow: "0 4px 16px rgba(0, 70, 60, 0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span
                  style={{
                    background: "rgba(217, 119, 6, 0.12)",
                    border: "1px solid rgba(217, 119, 6, 0.25)",
                    color: "var(--color-warning)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Demonstration Cohort
                </span>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>
                  Try Demo Case
                </h3>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
                Explore pre-computed screening CT studies without uploading any files. Clearly distinguished as demo evaluation data.
              </p>
            </div>

            <button
              onClick={() => handleStartDemo(selectedDemoId)}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 20px",
                background: "var(--accent-primary)",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(0, 184, 156, 0.25)",
              }}
            >
              {loading && loadingAction.includes("DEMO") ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  Loading Demo...
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  Load Selected Demo
                </>
              )}
            </button>
          </div>

          {/* Demo Cases Selector Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {DEMO_CASES_LIST.map((d) => {
              const isSelected = selectedDemoId === d.id;
              const rc = radsColor(d.summary.lung_rads_overall);
              const riskBadgeColor =
                d.primaryRiskCategory === "higher"
                  ? "#ef4444"
                  : d.primaryRiskCategory === "intermediate"
                  ? "#f59e0b"
                  : d.primaryRiskCategory === "low"
                  ? "#10b981"
                  : "#64748b";

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDemoId(d.id)}
                  style={{
                    background: isSelected ? "rgba(0, 184, 156, 0.08)" : "var(--bg-panel)",
                    border: `1.5px solid ${isSelected ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                    borderRadius: 10,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: isSelected
                      ? "0 4px 16px rgba(0, 184, 156, 0.18)"
                      : "0 1px 4px rgba(0,0,0,0.06)",
                  }}
                >
                  {/* CT Scan Thumbnail */}
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      height: 120,
                      background: "#000",
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src={d.ctImagePath}
                      alt={`CT scan preview for ${d.id}`}
                      fill
                      style={{ objectFit: "cover", opacity: isSelected ? 1 : 0.82, transition: "opacity 0.15s ease" }}
                      sizes="(max-width: 768px) 100vw, 340px"
                    />
                    {/* Lung-RADS badge overlay */}
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        background: "rgba(0,0,0,0.78)",
                        backdropFilter: "blur(4px)",
                        border: `1px solid ${rc}80`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: rc,
                      }}
                    >
                      Lung-RADS {d.summary.lung_rads_overall}
                    </div>

                    {/* Selected ring */}
                    {isSelected && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          border: "2px solid var(--accent-primary)",
                          pointerEvents: "none",
                        }}
                      />
                    )}

                    {/* Selection indicator dot */}
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "var(--accent-primary)" : "rgba(255,255,255,0.5)"}`,
                        background: isSelected ? "var(--accent-primary)" : "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#fff",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Card Body with Dynamic Case Data (Requirement #10) */}
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: isSelected ? "var(--accent-secondary)" : "var(--text-primary)" }}>
                        {d.label.split(" — ")[0]}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          padding: "1px 6px",
                          borderRadius: 3,
                          background: `${riskBadgeColor}15`,
                          color: riskBadgeColor,
                          border: `1px solid ${riskBadgeColor}35`,
                        }}
                      >
                        {d.primaryRiskCategory === "higher"
                          ? "Higher Suspicion"
                          : d.primaryRiskCategory === "intermediate"
                          ? "Intermediate"
                          : d.primaryRiskCategory === "low"
                          ? "Low Suspicion"
                          : "Negative"}
                      </span>
                    </div>

                    {/* Quantitative Key Metrics Pills */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, fontFamily: "monospace" }}>
                      <span style={{ background: "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: 4, color: "var(--text-primary)" }}>
                        {d.summary.nodule_count} {d.summary.nodule_count === 1 ? "nodule" : "nodules"}
                      </span>
                      {d.dominantSizeMm != null && (
                        <span style={{ background: "rgba(0,184,156,0.1)", padding: "2px 6px", borderRadius: 4, color: "var(--accent-secondary)", fontWeight: 700 }}>
                          Dominant: {d.dominantSizeMm.toFixed(1)} mm
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.4, marginTop: 2 }}>
                      {d.shortDescription}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

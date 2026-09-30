"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  UploadCloud, LayoutDashboard, Scan, Layers, Ruler, BarChart3,
  FileText, Brain, AlertTriangle, CheckCircle2, Eye, Clock, Shield, Zap, ArrowRight,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const WORKFLOW_STAGES = [
  { key: "upload", label: "Upload", icon: UploadCloud, color: "#0284c7", bg: "#e0f2fe", description: "Load a CT study or supported visual input. Supports DICOM, NIfTI, DICOM ZIP, PNG, JPG, and video." },
  { key: "detect", label: "Detect", icon: Scan, color: "#0891b2", bg: "#cffafe", description: "AI identifies pulmonary nodule candidates using deep learning-based 3D detection." },
  { key: "segment", label: "Segment", icon: Layers, color: "#059669", bg: "#d1fae5", description: "The suspected nodule is isolated at voxel level, generating a precise 3D boundary contour." },
  { key: "measure", label: "Measure", icon: Ruler, color: "#7c3aed", bg: "#ede9fe", description: "Size, volume, density and morphology are calculated from the segmented voxel mask." },
  { key: "assess", label: "Assess", icon: BarChart3, color: "#d97706", bg: "#fef3c7", description: "An evidence-based risk model evaluates available imaging and clinical factors (Brock / PanCan)." },
  { key: "report", label: "Report", icon: FileText, color: "#dc2626", bg: "#fee2e2", description: "Structured findings are converted into an AI-assisted clinical report for physician review." },
];

const CAPABILITIES = [
  { icon: Brain, title: "3D CT Analysis", desc: "Multi-planar reconstruction across axial, coronal and sagittal planes from volumetric CT data.", color: "#0284c7" },
  { icon: Scan, title: "Nodule Detection", desc: "Automated candidate detection across the full CT volume using AI-based pattern recognition.", color: "#0891b2" },
  { icon: Layers, title: "Nodule Segmentation", desc: "Voxel-precise nodule boundary delineation with 3D reconstruction for morphology analysis.", color: "#059669" },
  { icon: Ruler, title: "Quantitative Analysis", desc: "Calibrated measurements: diameter, volume, HU statistics, sphericity, elongation and more.", color: "#7c3aed" },
  { icon: BarChart3, title: "Risk Assessment", desc: "Evidence-based malignancy probability using Brock/PanCan model with contributing factor breakdown.", color: "#d97706" },
  { icon: Clock, title: "Temporal Comparison", desc: "Longitudinal growth tracking: volume doubling time, diameter change, kinetic classification.", color: "#db2777" },
  { icon: FileText, title: "AI-Assisted Reporting", desc: "Structured clinical findings converted into physician-readable reports via AI summarization.", color: "#dc2626" },
  { icon: Eye, title: "Explainable AI", desc: "Every risk estimate shows the contributing factors: size, density, morphology, clinical inputs.", color: "#475569" },
];

export default function WelcomePage() {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveStage((s) => (s + 1) % WORKFLOW_STAGES.length), 2800);
    return () => clearInterval(timer);
  }, []);

  const stage = WORKFLOW_STAGES[activeStage];
  const StageIcon = stage.icon;

  return (
    <div style={{ minHeight: "100vh", background: "#f0faf8", fontFamily: "'Inter', -apple-system, sans-serif", color: "#0d2926" }}>

      {/* NAV */}
      <nav style={{ background: "rgba(255,255,255,0.96)", backdropFilter: "blur(12px)", borderBottom: "1px solid #b8e8e0", padding: "0 40px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 2px 12px rgba(0,184,156,0.06)" }}>
        <BrandLogo size={34} showBadge={false} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, color: "#2d6b62", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            <LayoutDashboard size={14} />
            Dashboard
          </Link>
          <Link href="/cases" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 16px", borderRadius: 8, color: "#2d6b62", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Cases
          </Link>
          <Link href="/analyze" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 9, background: "linear-gradient(135deg, #00b89c 0%, #0284c7 100%)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", boxShadow: "0 2px 10px rgba(0,184,156,0.3)" }}>
            <UploadCloud size={14} />
            Analyze CT Scan
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "80px 40px 64px", maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", color: "#92400e", padding: "5px 14px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.04em", marginBottom: 28 }}>
          <AlertTriangle size={12} />
          RESEARCH &amp; DEMONSTRATION PROTOTYPE
        </div>
        <h1 style={{ fontSize: "clamp(36px, 5vw, 58px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.08, marginBottom: 20, color: "#0d2926" }}>
          AI-Assisted Pulmonary<br />
          <span style={{ background: "linear-gradient(135deg, #007a68 0%, #00b89c 50%, #0284c7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Nodule Analysis
          </span>
        </h1>
        <p style={{ fontSize: 17, color: "#2d6b62", maxWidth: 640, margin: "0 auto 44px", lineHeight: 1.6 }}>
          AI-assisted analysis of chest CT studies for pulmonary nodule detection, segmentation,
          quantitative characterization, and evidence-based risk assessment.
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 56 }}>
          <Link href="/analyze" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 32px", borderRadius: 12, background: "linear-gradient(135deg, #00b89c 0%, #0284c7 100%)", color: "#fff", fontSize: 15, fontWeight: 800, textDecoration: "none", boxShadow: "0 4px 20px rgba(0,184,156,0.35)" }}>
            <UploadCloud size={18} />
            Analyze CT Scan
          </Link>
          <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 32px", borderRadius: 12, background: "#ffffff", color: "#0d2926", fontSize: 15, fontWeight: 700, textDecoration: "none", border: "1.5px solid #b8e8e0", boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <LayoutDashboard size={18} />
            Dashboard
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {[{ label: "Detection Pipeline", value: "MONAI-based" }, { label: "Risk Framework", value: "Brock / PanCan" }, { label: "Classification", value: "ACR Lung-RADS" }].map((stat) => (
            <div key={stat.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#007a68" }}>{stat.value}</span>
              <span style={{ fontSize: 11, color: "#5a9b90", fontWeight: 500 }}>{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* WORKFLOW PIPELINE */}
      <section style={{ padding: "0 40px 72px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0d2926", marginBottom: 8, letterSpacing: "-0.02em" }}>Complete AI Workflow</h2>
          <p style={{ fontSize: 14, color: "#5a9b90" }}>Every study follows the same evidence-based pipeline from ingestion to structured report.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, overflowX: "auto", marginBottom: 28, padding: "4px 0" }}>
          {WORKFLOW_STAGES.map((s, idx) => {
            const Icon = s.icon;
            const isActive = activeStage === idx;
            return (
              <React.Fragment key={s.key}>
                <button onClick={() => setActiveStage(idx)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "12px 20px", borderRadius: 10, border: isActive ? `2px solid ${s.color}` : "2px solid transparent", background: isActive ? s.bg : "#fff", cursor: "pointer", transition: "all 0.2s ease", minWidth: 92, boxShadow: isActive ? `0 4px 16px ${s.color}28` : "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: isActive ? s.color : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
                    <Icon size={18} color={isActive ? "#fff" : s.color} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: isActive ? s.color : "#5a9b90" }}>{s.label}</span>
                </button>
                {idx < WORKFLOW_STAGES.length - 1 && <ArrowRight size={15} color="#b8e8e0" style={{ flexShrink: 0, margin: "0 2px" }} />}
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ background: "#ffffff", borderLeft: `4px solid ${stage.color}`, border: `1px solid ${stage.color}30`, borderRadius: 12, padding: "20px 28px", maxWidth: 720, margin: "0 auto", boxShadow: `0 4px 20px ${stage.color}12` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <StageIcon size={20} color={stage.color} />
            <span style={{ fontSize: 15, fontWeight: 800, color: stage.color }}>{stage.label}</span>
          </div>
          <p style={{ fontSize: 14, color: "#2d6b62", lineHeight: 1.6, margin: 0 }}>{stage.description}</p>
        </div>
      </section>

      {/* CAPABILITIES GRID */}
      <section style={{ padding: "0 40px 72px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0d2926", marginBottom: 8, letterSpacing: "-0.02em" }}>What PulmoScan AI Does</h2>
          <p style={{ fontSize: 14, color: "#5a9b90" }}>A comprehensive suite of AI-assisted tools for thoracic CT analysis.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div key={cap.title} style={{ background: "#ffffff", border: "1px solid #e6f7f4", borderRadius: 12, padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cap.color}14`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Icon size={20} color={cap.color} />
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0d2926", marginBottom: 6 }}>{cap.title}</h3>
                <p style={{ fontSize: 12.5, color: "#5a9b90", lineHeight: 1.5, margin: 0 }}>{cap.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* EXPLAINABILITY */}
      <section style={{ padding: "0 40px 72px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ background: "#ffffff", border: "1px solid #b8e8e0", borderRadius: 16, padding: "44px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", boxShadow: "0 4px 24px rgba(0,184,156,0.08)" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#e6f7f4", border: "1px solid #b8e8e0", color: "#007a68", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 16 }}>
              <Zap size={11} />
              EXPLAINABLE AI
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#0d2926", marginBottom: 14, lineHeight: 1.25 }}>
              PulmoScan does not just show a result. It shows the reasoning.
            </h2>
            <p style={{ fontSize: 14, color: "#2d6b62", lineHeight: 1.65, marginBottom: 24 }}>
              Every risk estimate shows the contributing factors that drive it, giving physicians
              the full picture needed for informed clinical decision-making.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {["Nodule location and lobe", "Size, volume and density (HU)", "Morphology: sphericity, spiculation, elongation", "Clinical factors: age, smoking history, family history", "Model confidence where formally estimated"].map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                  <CheckCircle2 size={15} color="#00b89c" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#2d6b62", lineHeight: 1.4 }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#f0faf8", border: "1px solid #b8e8e0", borderRadius: 14, padding: "24px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5a9b90", marginBottom: 4 }}>CONTRIBUTING FACTORS - EXAMPLE</div>
            {[
              { label: "Upper lobe location", level: "High", color: "#dc2626", pct: 78 },
              { label: "Nodule size 11.8 mm", level: "High", color: "#dc2626", pct: 72 },
              { label: "Spiculated margin", level: "High", color: "#dc2626", pct: 66 },
              { label: "Smoking history", level: "Moderate", color: "#d97706", pct: 45 },
              { label: "Solid density", level: "Moderate", color: "#d97706", pct: 40 },
            ].map((factor) => (
              <div key={factor.label}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#0d2926", fontWeight: 600 }}>{factor.label}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: factor.color, background: `${factor.color}14`, padding: "1px 8px", borderRadius: 8 }}>{factor.level}</span>
                </div>
                <div style={{ height: 5, background: "#e6f7f4", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${factor.pct}%`, background: factor.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
            <div style={{ paddingTop: 12, borderTop: "1px solid #b8e8e0", fontSize: 11, color: "#5a9b90", fontStyle: "italic" }}>Demo illustration only. Actual values from real analysis engine.</div>
          </div>
        </div>
      </section>

      {/* DOCTOR WORKFLOW */}
      <section style={{ padding: "0 40px 72px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: "#0d2926", marginBottom: 8, letterSpacing: "-0.02em" }}>Doctor-Focused Workflow</h2>
          <p style={{ fontSize: 14, color: "#5a9b90" }}>From case selection to report, everything in one integrated workspace.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { step: "01", title: "Upload or Select Case", desc: "Upload a new DICOM or NIfTI CT study, or open an existing case from the dashboard.", icon: UploadCloud, color: "#0284c7" },
            { step: "02", title: "Review CT and Nodules", desc: "Navigate axial, coronal and sagittal planes. Click any detected nodule to focus the viewer.", icon: Scan, color: "#059669" },
            { step: "03", title: "Assess Risk and Report", desc: "Review the evidence-based risk estimate, contributing factors, metrics and generate a report.", icon: FileText, color: "#d97706" },
          ].map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.step} style={{ background: "#ffffff", border: "1px solid #e6f7f4", borderRadius: 14, padding: "28px 24px", position: "relative", overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.03)" }}>
                <div style={{ position: "absolute", top: 20, right: 20, fontSize: 36, fontWeight: 900, color: `${step.color}12`, lineHeight: 1 }}>{step.step}</div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${step.color}14`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                  <Icon size={22} color={step.color} />
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: "#0d2926", marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: "#5a9b90", lineHeight: 1.55, margin: 0 }}>{step.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ padding: "0 40px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ background: "linear-gradient(135deg, #007a68 0%, #0284c7 100%)", borderRadius: 20, padding: "52px 48px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32, flexWrap: "wrap", boxShadow: "0 8px 32px rgba(0,122,104,0.25)" }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em", marginBottom: 10 }}>Ready to analyze a CT study?</h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.5, maxWidth: 480 }}>Upload a DICOM, NIfTI or ZIP archive, or try a pre-loaded demo study to explore the complete AI pipeline immediately.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/analyze" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 10, background: "#ffffff", color: "#007a68", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>
              <UploadCloud size={16} />
              Analyze CT Scan
            </Link>
            <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 10, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.35)", color: "#ffffff", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              <LayoutDashboard size={16} />
              Open Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #b8e8e0", padding: "32px 40px", background: "#e6f7f4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "#fff8e1", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 18px" }}>
            <Shield size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12.5, color: "#78350f", lineHeight: 1.55, margin: 0 }}>
              <strong>Research Prototype Disclaimer: </strong>
              PulmoScan AI is a research and demonstration prototype. It is not a clinically validated medical device and must not be used as a standalone diagnostic system. AI-generated findings, risk estimates and reports require review by a qualified healthcare professional before any clinical decision is made.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <BrandLogo size={28} showBadge={false} />
            <span style={{ fontSize: 11.5, color: "#5a9b90", fontWeight: 500 }}>PulmoScan AI - Research Prototype - Not for clinical use</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
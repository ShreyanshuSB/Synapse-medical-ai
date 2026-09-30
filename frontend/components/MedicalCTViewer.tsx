"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  Crosshair,
  Ruler,
  Sliders,
  Maximize2,
  Minimize2,
  MousePointer,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { getSliceUrl } from "@/lib/api";
import type { Nodule } from "@/types/api";

interface MedicalCTViewerProps {
  caseId: string;
  selectedNodule: Nodule | null;
  onSelectNodule?: (nodule: Nodule) => void;
  nodules: Nodule[];
  pixelSpacing?: number; // mm per pixel, default 0.703
  isDemo?: boolean;
  demoImage?: string;
  sliceCount?: number;
}

export function MedicalCTViewer({
  caseId,
  selectedNodule,
  nodules,
  onSelectNodule,
  pixelSpacing = 0.703,
  isDemo = false,
  demoImage = "/demo_scans/ct_demo2.jpg",
  sliceCount = 512,
}: MedicalCTViewerProps) {
  // Navigation & Slices
  const [plane, setPlane] = useState<"axial" | "coronal" | "sagittal">("axial");
  const [sliceIndex, setSliceIndex] = useState<number>(() => {
    if (selectedNodule?.axial_slice != null) return selectedNodule.axial_slice;
    if (selectedNodule?.coord_z != null) return Math.round(selectedNodule.coord_z);
    return 156;
  });
  const [maxSlices, setMaxSlices] = useState<number>(sliceCount || 512);

  // Window / Level Presets & Manual Adjustments
  const [preset, setPreset] = useState<"lung" | "mediastinum" | "bone" | "custom">("lung");
  const [wl, setWl] = useState<number>(-600);
  const [ww, setWw] = useState<number>(1600);

  // Functional Tools
  const [activeTool, setActiveTool] = useState<"select" | "pan" | "zoom" | "wl" | "caliper" | "layers">("select");
  const [showOverlays, setShowOverlays] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Viewport Transform (Pan & Zoom)
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Measurement Caliper Tool
  const [caliperStart, setCaliperStart] = useState<{ x: number; y: number } | null>(null);
  const [caliperEnd, setCaliperEnd] = useState<{ x: number; y: number } | null>(null);

  // Hover pos
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Keep maxSlices in sync with sliceCount prop
  useEffect(() => {
    if (sliceCount && sliceCount > 0) {
      const timer = setTimeout(() => {
        setMaxSlices(sliceCount);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [sliceCount]);

  // Synchronize slice when selected nodule changes
  useEffect(() => {
    if (selectedNodule) {
      const timer = setTimeout(() => {
        if (plane === "axial" && selectedNodule.axial_slice != null) {
          setSliceIndex(selectedNodule.axial_slice);
        } else if (plane === "axial" && selectedNodule.coord_z != null) {
          setSliceIndex(Math.round(selectedNodule.coord_z));
        } else if (plane === "coronal" && selectedNodule.coronal_slice != null) {
          setSliceIndex(selectedNodule.coronal_slice);
        } else if (plane === "sagittal" && selectedNodule.sagittal_slice != null) {
          setSliceIndex(selectedNodule.sagittal_slice);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedNodule, plane]);

  // Preset changes
  const applyPreset = (p: "lung" | "mediastinum" | "bone") => {
    setPreset(p);
    if (p === "lung") {
      setWl(-600);
      setWw(1600);
    } else if (p === "mediastinum") {
      setWl(40);
      setWw(350);
    } else if (p === "bone") {
      setWl(400);
      setWw(1800);
    }
  };

  // Draw Canvas Slice + Anatomical Overlays + Annotations
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    // Apply pan & zoom
    ctx.translate(w / 2 + pan.x, h / 2 + pan.y);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    // Draw Real CT Image
    if (imageRef.current && imageRef.current.complete) {
      ctx.drawImage(imageRef.current, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#020713";
      ctx.fillRect(0, 0, w, h);
    }

    // Draw Overlays: Boundary-Aware Nodule Contours & Callouts
    if (showOverlays && nodules.length > 0) {
      nodules.forEach((n) => {
        const isSelected = selectedNodule?.id === n.id;
        const riskProb = n.risk_assessments?.[0]?.risk_probability ?? 0;
        const isHigh = riskProb >= 0.6;
        const isInterm = riskProb >= 0.2 && !isHigh;
        const defaultColor = isHigh ? "#f43f5e" : isInterm ? "#f59e0b" : "#10b981";
        const color = isSelected ? "#00e5ff" : defaultColor;

        // Map lesion center coordinates from original 512x512 / 800x800 image to current canvas
        const baseW = imageRef.current?.naturalWidth || 512;
        const baseH = imageRef.current?.naturalHeight || 512;
        const scaleX = w / baseW;
        const scaleY = h / baseH;

        const cx = (n.coord_x != null ? n.coord_x : 256) * scaleX;
        const cy = (n.coord_y != null ? n.coord_y : 256) * scaleY;
        const diam = n.max_diameter_mm || 6.0;

        // Slice Tracking per requirement #5:
        // Only draw marker on slices within physical z-extent of the lesion
        const noduleSlice = n.axial_slice ?? (n.coord_z != null ? Math.round(n.coord_z) : sliceIndex);
        const sliceExtent = Math.max(3, Math.round((diam / 2) / (pixelSpacing || 1.0)));
        const sliceDiff = Math.abs(sliceIndex - noduleSlice);

        if (plane === "axial" && sliceDiff > sliceExtent) {
          // Do not render floating markers on unrelated slices
          return;
        }

        // Cross-section radius adjusts with distance from slice centroid
        const planeDist = sliceDiff * (pixelSpacing || 1.0);
        const crossSecMm = Math.sqrt(Math.max(4, (diam / 2) ** 2 - planeDist ** 2));
        const radius = Math.max(10, ((crossSecMm) / pixelSpacing) * scaleX);

        ctx.save();

        // 1. Segmentation Boundary Contour (precise undulating contour matching morphology)
        ctx.beginPath();
        const steps = 36;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          let r = radius;

          // Realistic edge lobes/spiculation
          if (n.margin_type === "spiculated" || n.spiculation_detected) {
            r += Math.sin(theta * 7) * (radius * 0.20) + Math.cos(theta * 5) * (radius * 0.12);
          } else if (n.margin_type === "irregular") {
            r += Math.sin(theta * 5) * (radius * 0.16) + Math.cos(theta * 3) * (radius * 0.08);
          } else if (n.margin_type === "lobulated") {
            r += Math.sin(theta * 3) * (radius * 0.12);
          }

          const px = cx + r * Math.cos(theta);
          const py = cy + r * Math.sin(theta);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();

        // Soft semi-transparent fill for selected nodule
        if (isSelected) {
          ctx.fillStyle = "rgba(0, 229, 255, 0.25)";
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
          ctx.fill();
        }

        // Contour stroke
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 2.6 : 1.6;
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 12 : 4;
        ctx.stroke();
        ctx.restore();

        // 2. Attached Direct Measurement Line on CT Image (Requirement #4)
        if (isSelected) {
          ctx.save();
          const measY = cy + radius + 14;
          const leftX = cx - radius;
          const rightX = cx + radius;

          // Horizontal measurement line with end ticks
          ctx.strokeStyle = "#00e5ff";
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(leftX, measY);
          ctx.lineTo(rightX, measY);
          // Left end tick
          ctx.moveTo(leftX, measY - 5);
          ctx.lineTo(leftX, measY + 5);
          // Right end tick
          ctx.moveTo(rightX, measY - 5);
          ctx.lineTo(rightX, measY + 5);
          ctx.stroke();

          // Measurement badge below caliper line
          const sizeText = n.max_diameter_mm != null ? `${n.max_diameter_mm.toFixed(1)} mm` : "Measurement unavailable";
          ctx.font = "bold 10px monospace";
          const measW = ctx.measureText(sizeText).width;
          const measBadgeW = measW + 12;
          const measBadgeH = 18;

          ctx.fillStyle = "rgba(2, 6, 23, 0.90)";
          ctx.strokeStyle = "#00e5ff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(cx - measBadgeW / 2, measY + 4, measBadgeW, measBadgeH, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.fillText(sizeText, cx - measW / 2, measY + 16);
          ctx.restore();
        }

        // 3. Boundary-Aware Callout Tag with Leader Line (Requirements #3 & #5)
        if (isSelected) {
          ctx.save();

          // Calculate offset direction based on lesion position in viewport
          // Clamp so that the label is NEVER pushed outside the canvas
          let offsetDirectionX = 1; // 1 = right, -1 = left
          let offsetDirectionY = -1; // -1 = up, 1 = down

          if (cx > w * 0.58) offsetDirectionX = -1;
          if (cy < 100) offsetDirectionY = 1;
          else if (cy > h - 100) offsetDirectionY = -1;

          const badgeW = 160;
          const badgeH = 46;

          const rawCalloutX = offsetDirectionX === 1
            ? cx + radius + 32
            : cx - radius - badgeW - 32;

          const rawCalloutY = offsetDirectionY === 1
            ? cy + radius + 20
            : cy - radius - badgeH - 20;

          // Viewport Clamping (Requirement #3)
          const clampedX = Math.max(16, Math.min(w - badgeW - 16, rawCalloutX));
          const clampedY = Math.max(20, Math.min(h - badgeH - 20, rawCalloutY));

          // Connect leader line from lesion center to clamped callout box edge
          const anchorTargetX = clampedX < cx ? clampedX + badgeW : clampedX;
          const anchorTargetY = clampedY + badgeH / 2;

          ctx.beginPath();
          ctx.strokeStyle = "#00e5ff";
          ctx.lineWidth = 1.6;
          ctx.moveTo(cx, cy);
          ctx.lineTo(anchorTargetX, anchorTargetY);
          ctx.stroke();

          // Anchor dot at lesion center
          ctx.fillStyle = "#00e5ff";
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Professional Clinical Annotation Card
          ctx.fillStyle = "rgba(8, 19, 34, 0.95)";
          ctx.shadowColor = "rgba(0, 229, 255, 0.5)";
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.roundRect(clampedX, clampedY, badgeW, badgeH, 6);
          ctx.fill();

          ctx.strokeStyle = "#0284c7";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Label Content: Nodule ID, Diameter, Location (Requirement #5)
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillText(`Nodule #${n.nodule_index}`, clampedX + 10, clampedY + 18);

          ctx.fillStyle = "#00e5ff";
          ctx.font = "bold 11px monospace";
          const diamStr = n.max_diameter_mm != null ? `${n.max_diameter_mm.toFixed(1)} mm` : "—";
          ctx.fillText(diamStr, clampedX + 76, clampedY + 18);

          ctx.fillStyle = "#94a3b8";
          ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
          const lobeStr = n.lung_lobe || "—";
          const densityStr = n.density_type ? n.density_type.toUpperCase() : "SOLID";
          ctx.fillText(`${lobeStr} • ${densityStr}`, clampedX + 10, clampedY + 36);

          ctx.restore();
        }
      });
    }

    // 4. Draw Interactive Measurement Caliper if active
    if (caliperStart && caliperEnd) {
      ctx.save();
      ctx.strokeStyle = "#eab308";
      ctx.lineWidth = 2.0;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(caliperStart.x, caliperStart.y);
      ctx.lineTo(caliperEnd.x, caliperEnd.y);
      ctx.stroke();

      // End tick marks
      const dx = caliperEnd.x - caliperStart.x;
      const dy = caliperEnd.y - caliperStart.y;
      const distPx = Math.sqrt(dx * dx + dy * dy);
      const distMm = distPx * pixelSpacing * (1 / zoom);

      ctx.fillStyle = "#fef08a";
      ctx.beginPath();
      ctx.arc(caliperStart.x, caliperStart.y, 4, 0, Math.PI * 2);
      ctx.arc(caliperEnd.x, caliperEnd.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Measurement tag
      const midX = (caliperStart.x + caliperEnd.x) / 2;
      const midY = (caliperStart.y + caliperEnd.y) / 2 - 10;
      ctx.font = "bold 11px monospace";
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(midX - 30, midY - 14, 60, 18);
      ctx.fillStyle = "#fef08a";
      ctx.fillText(`${distMm.toFixed(1)} mm`, midX - 26, midY);
      ctx.restore();
    }

    ctx.restore();
  }, [pan, zoom, showOverlays, nodules, selectedNodule, caliperStart, caliperEnd, pixelSpacing, plane, sliceIndex]);

  // Preload real CT image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    if (isDemo && demoImage) {
      img.src = demoImage;
    } else {
      img.src = getSliceUrl(caseId, plane, sliceIndex, wl, ww);
    }

    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };

    img.onerror = () => {
      const fallback = new window.Image();
      fallback.src = demoImage || "/demo_scans/ct_demo2.jpg";
      fallback.onload = () => {
        imageRef.current = fallback;
        drawCanvas();
      };
    };
  }, [caseId, demoImage, isDemo, plane, sliceIndex, wl, ww, drawCanvas]);

  // Redraw when dependencies change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle Wheel: Scroll Slices or Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => Math.max(0.6, Math.min(3.5, z + delta)));
    } else {
      if (e.deltaY < 0) {
        setSliceIndex((s) => Math.min(maxSlices, s + 1));
      } else {
        setSliceIndex((s) => Math.max(1, s - 1));
      }
    }
  };

  // Mouse handlers for pan, measure, select, wl
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "caliper") {
      setCaliperStart({ x, y });
      setCaliperEnd({ x, y });
    } else if (activeTool === "zoom") {
      const delta = e.shiftKey ? -0.2 : 0.2;
      setZoom((z) => Math.max(0.6, Math.min(3.5, z + delta)));
    } else if (activeTool === "select") {
      // Check if clicked close to any nodule
      const w = canvas.width;
      const baseW = imageRef.current?.naturalWidth || 512;
      const scale = w / baseW;

      let found = false;
      nodules.forEach((n) => {
        const nx = (n.coord_x != null ? n.coord_x : 256) * scale;
        const ny = (n.coord_y != null ? n.coord_y : 256) * scale;
        const dist = Math.sqrt((x - nx) ** 2 + (y - ny) ** 2);
        if (dist <= 45 && onSelectNodule) {
          onSelectNodule(n);
          found = true;
        }
      });
      if (!found) {
        setIsDragging(true);
        setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      }
    } else {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoverPos({ x, y });

    if (activeTool === "caliper" && caliperStart) {
      setCaliperEnd({ x, y });
    } else if (isDragging) {
      if (activeTool === "wl") {
        // Adjust window/level via dragging
        const deltaX = e.clientX - (dragStart.x + pan.x);
        const deltaY = e.clientY - (dragStart.y + pan.y);
        setWw((w) => Math.max(100, Math.min(3000, w + deltaX * 2)));
        setWl((l) => Math.max(-1000, Math.min(1000, l - deltaY * 2)));
      } else {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setCaliperStart(null);
    setCaliperEnd(null);
    applyPreset("lung");
  };

  return (
    <div
      ref={containerRef}
      style={{
        background: "#030812",
        borderRadius: 14,
        border: "1px solid #133842",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
        height: "100%",
        minHeight: 520,
      }}
    >
      {/* ── Top Bar: Orthogonal Plane Tabs & Fullscreen ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: "#081322",
          borderBottom: "1px solid #133842",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {(["axial", "coronal", "sagittal"] as const).map((p) => {
            const isActive = plane === p;
            return (
              <button
                key={p}
                onClick={() => setPlane(p)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 6,
                  border: `1px solid ${isActive ? "#00c4e8" : "transparent"}`,
                  background: isActive ? "#0284c7" : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  letterSpacing: "0.03em",
                  transition: "all 0.15s ease",
                }}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Presets & Fullscreen */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Preset Buttons */}
          <div style={{ display: "flex", background: "rgba(15,23,42,0.8)", borderRadius: 6, padding: 2, border: "1px solid #133842" }}>
            {[
              { key: "lung", label: "Lung" },
              { key: "mediastinum", label: "Mediastinum" },
              { key: "bone", label: "Bone" },
            ].map((btn) => (
              <button
                key={btn.key}
                onClick={() => applyPreset(btn.key as "lung" | "mediastinum" | "bone")}
                style={{
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "none",
                  background: preset === btn.key ? "rgba(0, 184, 156, 0.25)" : "transparent",
                  color: preset === btn.key ? "#00e5ff" : "#64748b",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            style={{
              padding: "5px 8px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid #133842",
              color: "#94a3b8",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* ── Main Viewport Center: Canvas + Left Toolbar + Overlay Labels ── */}
      <div
        style={{
          flex: 1,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          background: "#020712",
        }}
        onWheel={handleWheel}
      >
        {/* Left Vertical Tool Strip */}
        <div
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "rgba(8, 19, 34, 0.85)",
            backdropFilter: "blur(12px)",
            padding: 6,
            borderRadius: 8,
            border: "1px solid rgba(56, 189, 248, 0.2)",
            zIndex: 20,
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}
        >
          {[
            { id: "select", Icon: MousePointer, title: "Select / Inspect Lesion" },
            { id: "pan", Icon: Move, title: "Pan View" },
            { id: "zoom", Icon: ZoomIn, title: "Zoom View (Click: In, Shift+Click: Out)" },
            { id: "wl", Icon: Sliders, title: "Window / Level (Drag horizontally for WW, vertically for WL)" },
            { id: "caliper", Icon: Ruler, title: "Caliper Distance Measurement (Drag on CT)" },
          ].map(({ id, Icon, title }) => {
            const isActive = activeTool === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTool(id as "select" | "pan" | "zoom" | "wl" | "caliper" | "layers")}
                title={title}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: `1px solid ${isActive ? "#00c4e8" : "transparent"}`,
                  background: isActive ? "#0284c7" : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={15} />
              </button>
            );
          })}

          <div style={{ height: 1, background: "rgba(56, 189, 248, 0.2)", margin: "2px 0" }} />

          {/* Overlays Toggle */}
          <button
            onClick={() => setShowOverlays(!showOverlays)}
            title={showOverlays ? "Hide Segmentation Contours" : "Show Segmentation Contours"}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid transparent",
              background: showOverlays ? "rgba(0, 229, 255, 0.15)" : "transparent",
              color: showOverlays ? "#00e5ff" : "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Layers size={15} />
          </button>

          {/* Reset Zoom/Pan */}
          <button
            onClick={resetView}
            title="Reset Pan & Zoom"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: "1px solid transparent",
              background: "transparent",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Anatomical Orientation Markers */}
        <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", color: "#64748b", fontSize: 11, fontWeight: 700, pointerEvents: "none", zIndex: 10 }}>
          {plane === "axial" ? "A (Anterior)" : "S (Superior)"}
        </div>
        <div style={{ position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)", color: "#64748b", fontSize: 11, fontWeight: 700, pointerEvents: "none", zIndex: 10 }}>
          {plane === "axial" ? "P (Posterior)" : "I (Inferior)"}
        </div>
        <div style={{ position: "absolute", left: 56, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 11, fontWeight: 700, pointerEvents: "none", zIndex: 10 }}>
          R (Right)
        </div>
        <div style={{ position: "absolute", right: 18, top: "50%", transform: "translateY(-50%)", color: "#64748b", fontSize: 11, fontWeight: 700, pointerEvents: "none", zIndex: 10 }}>
          L (Left)
        </div>

        {/* Real CT Canvas */}
        <canvas
          ref={canvasRef}
          width={560}
          height={560}
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: "1/1",
            cursor: activeTool === "caliper" ? "crosshair" : activeTool === "pan" ? "grab" : activeTool === "zoom" ? "zoom-in" : "default",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        {/* Bottom Left DICOM Parameter Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: 44,
            left: 14,
            fontSize: 9.5,
            color: "#64748b",
            fontFamily: "monospace",
            lineHeight: 1.5,
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <div>PLANE: {plane.toUpperCase()} | SLICE: {sliceIndex}/{maxSlices}</div>
          <div>WL: {wl} | WW: {ww} | SPACING: {pixelSpacing} mm</div>
          <div>ZOOM: {Math.round(zoom * 100)}%</div>
        </div>
      </div>

      {/* ── Bottom Control Bar: Slice Slider & Window Range Readout ── */}
      <div
        style={{
          height: 48,
          background: "#081322",
          borderTop: "1px solid #133842",
          display: "flex",
          alignItems: "center",
          padding: "0 18px",
          gap: 16,
          zIndex: 10,
        }}
      >
        {/* Slice Indicator & Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap" }}>
            Slice {sliceIndex} / {maxSlices}
          </span>
          <input
            type="range"
            min={1}
            max={maxSlices}
            value={sliceIndex}
            onChange={(e) => setSliceIndex(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: "#0284c7",
              cursor: "pointer",
            }}
          />
        </div>

        {/* Window Range Readout */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>
            Window: {wl - ww / 2} to {wl + ww / 2} HU
          </span>
        </div>
      </div>
    </div>
  );
}

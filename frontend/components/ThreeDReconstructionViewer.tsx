"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, RefreshCw, Layers } from "lucide-react";
import type { Nodule } from "@/types/api";

interface ThreeDReconstructionViewerProps {
  nodules: Nodule[];
  selectedNodule: Nodule | null;
  onSelectNodule: (nodule: Nodule) => void;
  caseId?: string;
  isDemo?: boolean;
}

export function ThreeDReconstructionViewer({
  nodules,
  selectedNodule,
  onSelectNodule,
}: ThreeDReconstructionViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"lungs" | "nodule_only" | "both">("both");
  const [isRotating, setIsRotating] = useState(false);

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const lungsGroupRef = useRef<THREE.Group | null>(null);
  const nodulesGroupRef = useRef<THREE.Group | null>(null);
  const noduleMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const reqAnimRef = useRef<number | null>(null);

  // Mouse interaction for rotation
  const isDraggingRef = useRef(false);
  const prevMousePosRef = useRef({ x: 0, y: 0 });
  const rotationAngleRef = useRef({ x: 0, y: 0 });

  // 1. Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 320;
    const height = container.clientHeight || 260;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#050c18");
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0x00c4e8, 0.6);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x38bdf8, 1.2);
    dirLight1.position.set(5, 8, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x0ea5e9, 0.8);
    dirLight2.position.set(-5, -4, -4);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0x00e5ff, 2.5, 8);
    pointLight.position.set(0, 0, 3);
    scene.add(pointLight);

    // Grid / Measurement reference at bottom
    const grid = new THREE.GridHelper(6, 12, 0x00b89c, 0x133842);
    grid.position.y = -2.2;
    scene.add(grid);

    // ── Build Bilateral Lung Anatomy Surfaces ──────────────────────────────
    const lungsGroup = new THREE.Group();
    lungsGroupRef.current = lungsGroup;
    scene.add(lungsGroup);

    // Translucent glass/holographic lung material
    const lungMat = new THREE.MeshPhysicalMaterial({
      color: 0x007a8f,
      emissive: 0x003344,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.1,
      transmission: 0.72,
      opacity: 0.55,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    // Wireframe contour material for clinical scanner appearance
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x38e1ff,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    });

    // Right Lung (viewer's left side: negative X)
    const rightLungGeom = new THREE.SphereGeometry(1.3, 32, 32);
    rightLungGeom.scale(0.85, 1.45, 0.95);
    const rightLung = new THREE.Mesh(rightLungGeom, lungMat);
    rightLung.position.set(-1.15, 0.1, 0);
    const rightLungWire = new THREE.Mesh(rightLungGeom, wireMat);
    rightLungWire.position.copy(rightLung.position);
    lungsGroup.add(rightLung);
    lungsGroup.add(rightLungWire);

    // Left Lung (viewer's right side: positive X, slightly smaller due to cardiac notch)
    const leftLungGeom = new THREE.SphereGeometry(1.25, 32, 32);
    leftLungGeom.scale(0.78, 1.42, 0.90);
    const leftLung = new THREE.Mesh(leftLungGeom, lungMat);
    leftLung.position.set(1.15, 0.12, 0);
    const leftLungWire = new THREE.Mesh(leftLungGeom, wireMat);
    leftLungWire.position.copy(leftLung.position);
    lungsGroup.add(leftLung);
    lungsGroup.add(leftLungWire);

    // Central Trachea & Main Bronchi
    const tracheaGeom = new THREE.CylinderGeometry(0.14, 0.14, 1.4, 24);
    const airwayMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.8,
    });
    const trachea = new THREE.Mesh(tracheaGeom, airwayMat);
    trachea.position.set(0, 1.3, 0);
    lungsGroup.add(trachea);

    // Bronchus branches
    const rightBronchusGeom = new THREE.CylinderGeometry(0.09, 0.08, 0.9, 16);
    const rightBronchus = new THREE.Mesh(rightBronchusGeom, airwayMat);
    rightBronchus.position.set(-0.35, 0.45, 0);
    rightBronchus.rotation.z = Math.PI / 4;
    lungsGroup.add(rightBronchus);

    const leftBronchusGeom = new THREE.CylinderGeometry(0.09, 0.08, 0.9, 16);
    const leftBronchus = new THREE.Mesh(leftBronchusGeom, airwayMat);
    leftBronchus.position.set(0.35, 0.45, 0);
    leftBronchus.rotation.z = -Math.PI / 4;
    lungsGroup.add(leftBronchus);

    // ── Group for 3D Nodules ───────────────────────────────────────────────
    const nodulesGroup = new THREE.Group();
    nodulesGroupRef.current = nodulesGroup;
    scene.add(nodulesGroup);

    // ── Animation Loop ─────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    const animate = () => {
      reqAnimRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Gentle breathing pulse animation for the lungs
      if (lungsGroupRef.current && viewMode !== "nodule_only") {
        const breath = 1.0 + Math.sin(time * 1.5) * 0.012;
        lungsGroupRef.current.scale.set(breath, breath, breath);
      }

      // Selected nodule beacon pulse
      noduleMeshesRef.current.forEach((mesh, id) => {
        const isSel = selectedNodule?.id === id;
        if (isSel) {
          const s = 1.0 + Math.sin(time * 4) * 0.15;
          mesh.scale.set(s, s, s);
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(time * 5) * 0.3;
        } else {
          mesh.scale.set(1, 1, 1);
          (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const nw = container.clientWidth || 320;
      const nh = container.clientHeight || 260;
      cameraRef.current.aspect = nw / nh;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(nw, nh);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
      renderer.dispose();
      container.innerHTML = "";
    };
  }, []);

  // 2. Re-create 3D Nodules when nodules array changes
  useEffect(() => {
    const group = nodulesGroupRef.current;
    if (!group) return;

    // Clear old meshes
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    noduleMeshesRef.current.clear();

    if (nodules.length === 0) return;

    nodules.forEach((n) => {
      const diam = n.max_diameter_mm || 6;
      // Map diameter (e.g. 5-16.4mm) to physically calibrated 3D world units (0.14 - 0.35)
      const radius = Math.max(0.13, (diam / 16.4) * 0.32);

      const geom = new THREE.SphereGeometry(radius, 32, 32);

      // Morphological surface modeling:
      // Spiculated / Part-Solid lesions have irregular radiating spicules
      // Lobulated lesions have multi-bosselated lobes
      const posAttr = geom.attributes.position;
      const isSpiculated = n.spiculation_detected || n.margin_type === "spiculated";
      const isLobulated = n.margin_type === "lobulated";

      if (isSpiculated) {
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          const vz = posAttr.getZ(i);
          const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
          if (len > 0.0001) {
            const nx = vx / len;
            const ny = vy / len;
            const nz = vz / len;
            // Radiating spicule wave
            const spicule = Math.sin(nx * 12) * Math.cos(ny * 12) * Math.sin(nz * 12);
            const factor = spicule > 0.2 ? 1.0 + (spicule - 0.2) * 0.45 : 1.0;
            posAttr.setXYZ(i, vx * factor, vy * factor, vz * factor);
          }
        }
        geom.computeVertexNormals();
      } else if (isLobulated) {
        for (let i = 0; i < posAttr.count; i++) {
          const vx = posAttr.getX(i);
          const vy = posAttr.getY(i);
          const vz = posAttr.getZ(i);
          const len = Math.sqrt(vx * vx + vy * vy + vz * vz);
          if (len > 0.0001) {
            const nx = vx / len;
            const ny = vy / len;
            const lobe = (Math.sin(nx * 4) * Math.cos(ny * 4)) * 0.12;
            posAttr.setXYZ(i, vx * (1.0 + lobe), vy * (1.0 + lobe), vz * (1.0 + lobe));
          }
        }
        geom.computeVertexNormals();
      }

      const riskProb = n.risk_assessments?.[0]?.risk_probability ?? 0;
      const isHighRisk = riskProb >= 0.6;
      const isIntermediate = riskProb >= 0.2 && !isHighRisk;
      const isSelected = selectedNodule?.id === n.id;

      let noduleColor = 0x10b981; // Low: green
      let noduleEmissive = 0x059669;
      if (isHighRisk) {
        noduleColor = 0xff2a5f; // High: red
        noduleEmissive = 0xd90429;
      } else if (isIntermediate) {
        noduleColor = 0xf59e0b; // Intermediate: amber
        noduleEmissive = 0xd97706;
      }

      const mat = new THREE.MeshStandardMaterial({
        color: noduleColor,
        emissive: noduleEmissive,
        emissiveIntensity: isSelected ? 1.4 : 0.6,
        roughness: 0.25,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(geom, mat);

      // ── Physical CT Voxel to 3D Thoracic Scene Transformation ──────────────────
      // Standard chest CT coordinates:
      // X: 0 is Patient Right (Left of CT image), 512 is Patient Left (Right of CT image)
      // Y: 0 is Anterior (Sternum, Top of CT), 512 is Posterior (Spine, Bottom of CT)
      // Z: Slices (0 is Superior/Apex, MaxSlices is Inferior/Base)
      //
      // Three.js Anatomical Coordinates:
      // X: Right Lung center = -1.15, Left Lung center = +1.15
      // Y: Superior (Apex) = +Y, Inferior (Base) = -Y (Center = +0.10)
      // Z: Anterior = +Z, Posterior = -Z (Center = 0.0)

      let posX = -1.15;
      let posY = 0.1;
      let posZ = 0.0;

      const isLeft = n.lung_side === "left" || (n.coord_x != null && n.coord_x > 256);

      if (n.coord_x != null) {
        if (isLeft) {
          // Left Lung: lateral excursion from center ~370
          const normX = (n.coord_x - 370) / 120;
          posX = 1.15 + THREE.MathUtils.clamp(normX, -0.7, 0.7) * 0.45;
        } else {
          // Right Lung: lateral excursion from center ~150
          const normX = (n.coord_x - 150) / 120;
          posX = -1.15 + THREE.MathUtils.clamp(normX, -0.7, 0.7) * 0.45;
        }
      } else {
        posX = isLeft ? 1.15 : -1.15;
      }

      // Vertical Craniocaudal (Superior to Inferior):
      if (n.axial_slice != null || n.coord_z != null) {
        const sliceVal = n.axial_slice ?? n.coord_z ?? 220;
        // Normalize slice index around mid-lung (220)
        const normZ = (sliceVal - 220) / 200; // -1 at apex, +1 at base
        posY = 0.10 - THREE.MathUtils.clamp(normZ, -0.85, 0.85) * 0.70;
      } else if (n.lung_lobe) {
        if (n.lung_lobe.endsWith("UL")) posY = 0.45;
        else if (n.lung_lobe.endsWith("ML")) posY = 0.05;
        else if (n.lung_lobe.endsWith("LL")) posY = -0.40;
      }

      // Anterior-Posterior:
      if (n.coord_y != null) {
        // In CT: 0 is Anterior, 512 is Posterior.
        // In Three.js: +Z is Anterior, -Z is Posterior.
        const normAP = (256 - n.coord_y) / 256; // +1 = Anterior, -1 = Posterior
        posZ = THREE.MathUtils.clamp(normAP, -0.8, 0.8) * 0.50;
      }

      mesh.position.set(posX, posY, posZ);
      mesh.userData = { noduleData: n };

      // Glow beacon ring around nodule
      const ringGeom = new THREE.RingGeometry(radius + 0.04, radius + 0.07, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isHighRisk ? 0xff3366 : 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.6,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      mesh.add(ring);

      group.add(mesh);
      noduleMeshesRef.current.set(n.id, mesh);
    });
  }, [nodules, selectedNodule]);

  // 3. Handle View Mode changes (Lungs / Nodule Only / Both)
  useEffect(() => {
    if (lungsGroupRef.current) {
      lungsGroupRef.current.visible = viewMode === "lungs" || viewMode === "both";
    }
    if (nodulesGroupRef.current) {
      nodulesGroupRef.current.visible = viewMode === "nodule_only" || viewMode === "both";
    }
  }, [viewMode]);

  // 4. Manual Rotation Controls
  const rotateLeft = () => {
    if (!lungsGroupRef.current || !nodulesGroupRef.current) return;
    lungsGroupRef.current.rotation.y += Math.PI / 6;
    nodulesGroupRef.current.rotation.y += Math.PI / 6;
  };

  const rotateRight = () => {
    if (!lungsGroupRef.current || !nodulesGroupRef.current) return;
    lungsGroupRef.current.rotation.y -= Math.PI / 6;
    nodulesGroupRef.current.rotation.y -= Math.PI / 6;
  };

  const zoomIn = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.z = Math.max(3.5, cameraRef.current.position.z - 0.7);
  };

  const zoomOut = () => {
    if (!cameraRef.current) return;
    cameraRef.current.position.z = Math.min(11.0, cameraRef.current.position.z + 0.7);
  };

  const resetView = () => {
    if (!cameraRef.current || !lungsGroupRef.current || !nodulesGroupRef.current) return;
    cameraRef.current.position.set(0, 0, 7.5);
    lungsGroupRef.current.rotation.set(0, 0, 0);
    nodulesGroupRef.current.rotation.set(0, 0, 0);
    rotationAngleRef.current = { x: 0, y: 0 };
  };

  // 5. Mouse Drag to Orbit in 3D
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMousePosRef.current.x;
    const dy = e.clientY - prevMousePosRef.current.y;
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };

    if (lungsGroupRef.current && nodulesGroupRef.current) {
      lungsGroupRef.current.rotation.y += dx * 0.008;
      lungsGroupRef.current.rotation.x += dy * 0.008;
      nodulesGroupRef.current.rotation.y += dx * 0.008;
      nodulesGroupRef.current.rotation.x += dy * 0.008;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Click on 3D nodule to select it
  const handleClick = (e: React.MouseEvent) => {
    if (!mountRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

    const meshes = Array.from(noduleMeshesRef.current.values());
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData?.noduleData) {
        onSelectNodule(hit.userData.noduleData as Nodule);
      }
    }
  };

  return (
    <div
      style={{
        background: "#08111e",
        border: "1px solid #133842",
        borderRadius: 14,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #133842",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(10,23,38,0.85)",
          backdropFilter: "blur(8px)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={14} color="#00e5ff" />
          <span style={{ fontSize: 13, fontWeight: 800, color: "#e0f2fe", letterSpacing: "0.02em" }}>
            3D Nodule Reconstruction
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(0,229,255,0.12)",
              color: "#38bdf8",
              border: "1px solid rgba(0,229,255,0.3)",
              fontFamily: "monospace",
            }}
          >
            INTERACTIVE
          </span>
        </div>

        {selectedNodule && (
          <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, fontFamily: "monospace" }}>
            Nodule #{selectedNodule.nodule_index} Focused
          </span>
        )}
      </div>

      {/* Main 3D Canvas Area */}
      <div
        style={{
          position: "relative",
          height: 280,
          width: "100%",
          cursor: "grab",
          userSelect: "none",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      >
        {/* Three.js DOM container */}
        <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

        {/* Floating Right Control Strip (Matching Inspo) */}
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            zIndex: 20,
            background: "rgba(10,23,38,0.75)",
            backdropFilter: "blur(12px)",
            padding: "10px 10px",
            borderRadius: 10,
            border: "1px solid rgba(56,189,248,0.2)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* View Toggles */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>
              View
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(nodules.length === 0
                ? [{ key: "lungs", label: "Lungs" }]
                : [
                    { key: "lungs", label: "Lungs" },
                    { key: "nodule_only", label: "Nodule Only" },
                    { key: "both", label: "Both" },
                  ]
              ).map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => setViewMode(btn.key as "lungs" | "nodule_only" | "both")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 6,
                    border: `1px solid ${viewMode === btn.key ? "#00c4e8" : "rgba(148,163,184,0.2)"}`,
                    background: viewMode === btn.key ? "#0284c7" : "transparent",
                    color: viewMode === btn.key ? "#ffffff" : "#94a3b8",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rotate Controls */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>
              Rotate
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={rotateLeft}
                title="Rotate Left"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid rgba(56,189,248,0.25)",
                  background: "rgba(15,23,42,0.6)",
                  color: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={rotateRight}
                title="Rotate Right"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid rgba(56,189,248,0.25)",
                  background: "rgba(15,23,42,0.6)",
                  color: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <RotateCw size={13} />
              </button>
            </div>
          </div>

          {/* Zoom & Reset Controls */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6, letterSpacing: "0.05em" }}>
              Zoom
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button
                onClick={zoomIn}
                title="Zoom In"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid rgba(56,189,248,0.25)",
                  background: "rgba(15,23,42,0.6)",
                  color: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={zoomOut}
                title="Zoom Out"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: "1px solid rgba(56,189,248,0.25)",
                  background: "rgba(15,23,42,0.6)",
                  color: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <ZoomOut size={13} />
              </button>
            </div>
            <button
              onClick={resetView}
              style={{
                width: "100%",
                padding: "4px",
                borderRadius: 6,
                border: "1px solid rgba(56,189,248,0.25)",
                background: "rgba(15,23,42,0.6)",
                color: "#e0f2fe",
                fontSize: 10,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
              }}
            >
              <RefreshCw size={10} /> Reset
            </button>
          </div>
        </div>

        {/* Orbit hint label / zero nodule status at bottom */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 14,
            fontSize: 10,
            color: nodules.length === 0 ? "#10b981" : "#64748b",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {nodules.length === 0 ? (
            <span>✓ Clear bilateral parenchyma · 3D lung volume reconstruction (0 nodules)</span>
          ) : (
            <span>🖱 Drag to orbit in 3D · Click nodule to select</span>
          )}
        </div>
      </div>
    </div>
  );
}

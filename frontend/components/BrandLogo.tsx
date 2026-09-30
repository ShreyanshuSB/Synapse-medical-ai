import React from "react";
import Link from "next/link";

interface BrandLogoProps {
  href?: string;
  size?: number; // image height in px
  showBadge?: boolean;
  className?: string;
}

export function BrandLogo({
  href = "/",
  size = 40,
  showBadge = true,
  className,
}: BrandLogoProps) {
  const fontSize = Math.max(16, Math.round(size * 0.52));
  const subSize = Math.max(10, Math.round(size * 0.28));

  const content = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        textDecoration: "none",
      }}
      className={className}
    >
      {/* Logo image with teal glow */}
      <div
        style={{
          position: "relative",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <img
          src="/logo.png"
          alt="PulmoScan Logo"
          style={{
            height: size,
            width: "auto",
            maxHeight: size,
            objectFit: "contain",
            display: "block",
            filter:
              "drop-shadow(0 0 10px rgba(0, 184, 156, 0.45)) drop-shadow(0 0 4px rgba(0, 184, 156, 0.3))",
          }}
        />
      </div>

      {/* Name + badge stack */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span
            style={{
              fontWeight: 900,
              fontSize: fontSize,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              background: "linear-gradient(135deg, #007a68 0%, #00b89c 50%, #00d4b1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            PulmoScan
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: fontSize,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "var(--accent-primary)",
            }}
          >
            AI
          </span>
        </div>

        {showBadge && (
          <span
            style={{
              fontSize: subSize,
              background: "rgba(0, 184, 156, 0.1)",
              border: "1px solid rgba(0, 184, 156, 0.3)",
              color: "var(--accent-secondary)",
              padding: "1px 7px",
              borderRadius: 3,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              alignSelf: "flex-start",
            }}
          >
            Research Prototype
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
      >
        {content}
      </Link>
    );
  }

  return content;
}

export default BrandLogo;

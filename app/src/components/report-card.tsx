"use client";

import { useRef } from "react";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface ReportCardProps {
  statusCounts: {
    optimal: number;
    normal: number;
    borderline: number;
    out_of_range: number;
  };
  bioAge?: {
    ensembleAge: number;
    chronologicalAge: number;
    gap: number;
  } | null;
  keyFinding?: string | null;
  markerCount: number;
  studiesCount: number;
  testDate: string;
}

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const FRAUNCES = "'Fraunces', Georgia, serif";

// ---------------------------------------------------------------------
// Leaf SVG (small, inline)
// ---------------------------------------------------------------------

function LeafIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      style={{ display: "inline-block", verticalAlign: "middle", marginLeft: 4 }}
    >
      <path
        d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 8.5-3 10-9a3 3 0 0 0 .6-4"
        stroke="#1B6B4A"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="rgba(27,107,74,0.08)"
      />
      <path
        d="M6 15c4-1 7-4 8-8"
        stroke="#1B6B4A"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

export function ReportCard({
  statusCounts,
  bioAge,
  keyFinding,
  markerCount,
  studiesCount,
  testDate,
}: ReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const formattedDate = testDate
    ? new Date(testDate).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  const totalFlagged = statusCounts.borderline + statusCounts.out_of_range;
  const totalGood = statusCounts.optimal + statusCounts.normal;

  return (
    <div
      ref={cardRef}
      id="lipa-report-card"
      style={{
        width: "100%",
        maxWidth: 600,
        aspectRatio: "3 / 2",
        background: "linear-gradient(168deg, rgba(232,245,238,0.4) 0%, #FFFFFF 28%, #FFFFFF 100%)",
        borderRadius: 20,
        border: "1px solid rgba(15,26,21,0.06)",
        boxShadow:
          "0 1px 3px rgba(15,26,21,0.04), 0 8px 32px rgba(15,26,21,0.06), 0 0 0 1px rgba(255,255,255,0.8) inset",
        overflow: "hidden",
        position: "relative",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: "20px 28px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "#1B6B4A",
            }}
          >
            LIPA HEALTH
          </span>
          <LeafIcon />
        </div>
        <span
          style={{
            fontSize: 11,
            color: "#8A928C",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {formattedDate}
        </span>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div style={{ flex: 1, padding: "16px 28px 0", display: "flex", flexDirection: "column" }}>

        {/* Status counts row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 20,
          }}
        >
          {statusCounts.optimal + statusCounts.normal > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#E8F5EE",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontFamily: FRAUNCES,
                    fontWeight: 500,
                    color: "#1B6B4A",
                    lineHeight: 1,
                  }}
                >
                  {totalGood}
                </div>
                <div style={{ fontSize: 11, color: "#5A635D", marginTop: 1 }}>
                  optimal
                </div>
              </div>
            </div>
          )}

          {statusCounts.borderline > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#FEF3C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 9v4" /><circle cx="12" cy="17" r="0.5" fill="#B45309" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontFamily: FRAUNCES,
                    fontWeight: 500,
                    color: "#B45309",
                    lineHeight: 1,
                  }}
                >
                  {statusCounts.borderline}
                </div>
                <div style={{ fontSize: 11, color: "#5A635D", marginTop: 1 }}>
                  borderline
                </div>
              </div>
            </div>
          )}

          {statusCounts.out_of_range > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "#FEE2E2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><circle cx="12" cy="16" r="0.5" fill="#B91C1C" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 28,
                    fontFamily: FRAUNCES,
                    fontWeight: 500,
                    color: "#B91C1C",
                    lineHeight: 1,
                  }}
                >
                  {statusCounts.out_of_range}
                </div>
                <div style={{ fontSize: 11, color: "#5A635D", marginTop: 1 }}>
                  need attention
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bio-age section */}
        {bioAge && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              background: "rgba(248,245,239,0.6)",
              borderRadius: 12,
              marginBottom: 16,
              border: "1px solid rgba(15,26,21,0.04)",
            }}
          >
            <div>
              <div style={{ fontSize: 10, color: "#8A928C", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
                Biological Age
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span
                  style={{
                    fontSize: 32,
                    fontFamily: FRAUNCES,
                    fontWeight: 500,
                    color: bioAge.gap < 0 ? "#1B6B4A" : bioAge.gap > 2 ? "#B91C1C" : "#0F1A15",
                    lineHeight: 1,
                  }}
                >
                  {Math.round(bioAge.ensembleAge * 10) / 10}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: 20,
                    background: bioAge.gap < 0 ? "#E8F5EE" : bioAge.gap > 2 ? "#FEE2E2" : "#F4F4F5",
                    color: bioAge.gap < 0 ? "#1B6B4A" : bioAge.gap > 2 ? "#B91C1C" : "#5A635D",
                  }}
                >
                  {bioAge.gap > 0 ? "+" : ""}{Math.round(bioAge.gap * 10) / 10} yrs vs chronological {bioAge.chronologicalAge}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Key finding */}
        {keyFinding && (
          <div
            style={{
              fontSize: 14,
              color: "#0F1A15",
              lineHeight: 1.5,
              marginBottom: 16,
              fontStyle: "italic",
              borderLeft: "3px solid #1B6B4A",
              paddingLeft: 12,
            }}
          >
            {keyFinding}
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Stats footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            paddingTop: 12,
            borderTop: "1px solid rgba(15,26,21,0.06)",
            marginBottom: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A928C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
            <span style={{ fontSize: 12, color: "#5A635D" }}>
              <strong style={{ fontFamily: FRAUNCES, fontWeight: 500, color: "#0F1A15" }}>{markerCount}</strong> markers analyzed
            </span>
          </div>
          {studiesCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A928C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span style={{ fontSize: 12, color: "#5A635D" }}>
                <strong style={{ fontFamily: FRAUNCES, fontWeight: 500, color: "#0F1A15" }}>{studiesCount}</strong> studies referenced
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom watermark ─────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 28px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 10, color: "#B0B8B2", letterSpacing: "0.02em" }}>
          lipa.health
        </span>
        <span style={{ fontSize: 10, color: "#B0B8B2", fontStyle: "italic" }}>
          Understand your biology. Keep going.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Wrapper with download action for the dashboard
// ---------------------------------------------------------------------

export function ReportCardSection({
  statusCounts,
  bioAge,
  keyFinding,
  markerCount,
  studiesCount,
  testDate,
}: ReportCardProps) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(15,26,21,0.06)",
        borderRadius: 20,
        boxShadow: "0 1px 3px rgba(15,26,21,0.04), 0 4px 16px rgba(15,26,21,0.03)",
        padding: 24,
        marginBottom: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#8A928C",
              fontWeight: 500,
              marginBottom: 4,
            }}
          >
            Share your results
          </div>
          <div
            style={{
              fontSize: 18,
              fontFamily: FRAUNCES,
              fontWeight: 500,
              color: "#0F1A15",
            }}
          >
            Your Report Card
          </div>
        </div>
        <button
          onClick={async () => {
            const el = document.getElementById("lipa-report-card");
            if (!el) return;
            try {
              // Dynamic import of html2canvas to keep bundle small
              const html2canvas = (await import("html2canvas")).default;
              const canvas = await html2canvas(el, {
                scale: 2,
                backgroundColor: "#FFFFFF",
                useCORS: true,
                logging: false,
              });
              const link = document.createElement("a");
              link.download = `lipa-report-card.png`;
              link.href = canvas.toDataURL("image/png");
              link.click();
            } catch {
              // Fallback: alert user
              alert("Download not supported in this browser. Try taking a screenshot of the card.");
            }
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 500,
            color: "#FFFFFF",
            background: "#1B6B4A",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#155A3E";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "#1B6B4A";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download PNG
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <ReportCard
          statusCounts={statusCounts}
          bioAge={bioAge}
          keyFinding={keyFinding}
          markerCount={markerCount}
          studiesCount={studiesCount}
          testDate={testDate}
        />
      </div>
    </div>
  );
}

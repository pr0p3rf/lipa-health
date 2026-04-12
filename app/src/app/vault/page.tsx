"use client";

import { AppNav } from "@/components/app-nav";
import { AskLipa } from "@/components/ask-lipa";
import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

interface BiomarkerResult {
  id: number;
  test_date: string;
  biomarker: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  category: string;
}

interface Analysis {
  id: number;
  biomarker_result_id: number;
  biomarker_name: string;
  status: "optimal" | "normal" | "borderline" | "out_of_range";
  flag: "low" | "high" | "optimal" | "borderline" | "unknown";
  summary: string;
}

interface TestGroup {
  date: string;
  markers: BiomarkerResult[];
  analyses: Analysis[];
  optimal: number;
  borderline: number;
  outOfRange: number;
  normal: number;
  flagged: Analysis[];
}

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

const FRAUNCES = "'Fraunces', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  optimal: { bg: "#E8F5EE", text: "#1B6B4A", dot: "#1B6B4A" },
  normal: { bg: "#F4F4F5", text: "#52525B", dot: "#71717A" },
  borderline: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  out_of_range: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444" },
};

const CARD_STYLE: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(15,26,21,0.06)",
  borderRadius: "20px",
  boxShadow: "0 1px 3px rgba(15,26,21,0.04)",
};

type ViewTab = "timeline" | "trends" | "compare";

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return 0;
  return ((curr - prev) / prev) * 100;
}

function getStatusForValue(value: number, refLow: number | null, refHigh: number | null): string {
  if (refLow === null || refHigh === null) return "normal";
  const range = refHigh - refLow;
  const optLow = refLow + range * 0.15;
  const optHigh = refHigh - range * 0.15;
  if (value >= optLow && value <= optHigh) return "optimal";
  if (value >= refLow && value <= refHigh) return "normal";
  const borderLow = refLow - range * 0.1;
  const borderHigh = refHigh + range * 0.1;
  if (value >= borderLow && value <= borderHigh) return "borderline";
  return "out_of_range";
}

function isImprovement(
  oldStatus: string,
  newStatus: string,
): boolean {
  const rank: Record<string, number> = { optimal: 4, normal: 3, borderline: 2, out_of_range: 1 };
  return (rank[newStatus] || 0) > (rank[oldStatus] || 0);
}

// ---------------------------------------------------------------------
// TrendChart — SVG-only biomarker trend chart
// ---------------------------------------------------------------------

interface TrendPoint {
  date: string;
  value: number;
  status: string;
}

interface ZoneBounds {
  refLow: number | null;
  refHigh: number | null;
}

function TrendChart({
  points,
  zone,
  unit,
}: {
  points: TrendPoint[];
  zone: ZoneBounds;
  unit: string;
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (points.length === 0) return null;

  // Single point view
  if (points.length === 1) {
    const p = points[0];
    const statusColor = STATUS_COLORS[p.status] || STATUS_COLORS.normal;
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontFamily: FRAUNCES, fontSize: 40, fontWeight: 600, color: statusColor.text }}>
          {p.value} <span style={{ fontSize: 16, fontWeight: 400, opacity: 0.6 }}>{unit}</span>
        </div>
        <div style={{ fontSize: 13, color: "#8A928C", marginTop: 8 }}>{formatDate(p.date)}</div>
        {zone.refLow !== null && zone.refHigh !== null && (
          <ZoneBar value={p.value} refLow={zone.refLow} refHigh={zone.refHigh} />
        )}
      </div>
    );
  }

  // Chart dimensions
  const W = 600;
  const H = 260;
  const PAD = { top: 30, right: 30, bottom: 50, left: 60 };
  const cw = W - PAD.left - PAD.right;
  const ch = H - PAD.top - PAD.bottom;

  const values = points.map((p) => p.value);
  const allVals = [...values];
  if (zone.refLow !== null) allVals.push(zone.refLow);
  if (zone.refHigh !== null) allVals.push(zone.refHigh);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const padded = range * 0.15;
  const yMin = minV - padded;
  const yMax = maxV + padded;

  const xScale = (i: number) => PAD.left + (i / (points.length - 1)) * cw;
  const yScale = (v: number) => PAD.top + ch - ((v - yMin) / (yMax - yMin)) * ch;

  // Build zone bands
  const zoneBands: { y1: number; y2: number; fill: string }[] = [];
  if (zone.refLow !== null && zone.refHigh !== null) {
    const rL = zone.refLow;
    const rH = zone.refHigh;
    const rng = rH - rL;
    const optL = rL + rng * 0.15;
    const optH = rH - rng * 0.15;
    const borderL = rL - rng * 0.1;
    const borderH = rH + rng * 0.1;

    // Out of range (below)
    zoneBands.push({ y1: yScale(yMin), y2: yScale(Math.max(yMin, borderL)), fill: "rgba(185,28,28,0.06)" });
    // Borderline low
    zoneBands.push({ y1: yScale(borderL), y2: yScale(rL), fill: "rgba(180,83,9,0.06)" });
    // Normal low
    zoneBands.push({ y1: yScale(rL), y2: yScale(optL), fill: "rgba(113,113,122,0.04)" });
    // Optimal
    zoneBands.push({ y1: yScale(optH), y2: yScale(optL), fill: "rgba(27,107,74,0.08)" });
    // Normal high
    zoneBands.push({ y1: yScale(rH), y2: yScale(optH), fill: "rgba(113,113,122,0.04)" });
    // Borderline high
    zoneBands.push({ y1: yScale(borderH), y2: yScale(rH), fill: "rgba(180,83,9,0.06)" });
    // Out of range (above)
    zoneBands.push({ y1: yScale(Math.min(yMax, borderH + padded)), y2: yScale(borderH), fill: "rgba(185,28,28,0.06)" });
  }

  // Path
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
    .join(" ");

  // Y-axis ticks
  const yTicks = 5;
  const yTickVals = Array.from({ length: yTicks }, (_, i) => yMin + ((yMax - yMin) / (yTicks - 1)) * i);

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setActiveIdx(null)}
      >
        {/* Zone bands */}
        {zoneBands.map((b, i) => {
          const y = Math.min(b.y1, b.y2);
          const h = Math.abs(b.y2 - b.y1);
          if (h <= 0) return null;
          return <rect key={i} x={PAD.left} y={y} width={cw} height={h} fill={b.fill} />;
        })}

        {/* Grid lines */}
        {yTickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yScale(v)}
              y2={yScale(v)}
              stroke="rgba(15,26,21,0.06)"
              strokeDasharray="4 3"
            />
            <text x={PAD.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="#8A928C" fontFamily={MONO}>
              {v.toFixed(v % 1 === 0 ? 0 : 1)}
            </text>
          </g>
        ))}

        {/* X-axis labels */}
        {points.map((p, i) => (
          <text
            key={i}
            x={xScale(i)}
            y={H - PAD.bottom + 20}
            textAnchor="middle"
            fontSize="10"
            fill="#8A928C"
            fontFamily={MONO}
          >
            {formatDateShort(p.date)}
          </text>
        ))}

        {/* Line */}
        <path d={pathD} fill="none" stroke="#1B6B4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Dots */}
        {points.map((p, i) => {
          const color = STATUS_COLORS[p.status]?.dot || "#71717A";
          return (
            <g key={i}>
              <circle
                cx={xScale(i)}
                cy={yScale(p.value)}
                r={activeIdx === i ? 7 : 5}
                fill={color}
                stroke="#fff"
                strokeWidth="2"
                style={{ cursor: "pointer", transition: "r 0.15s" }}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => setActiveIdx(i === activeIdx ? null : i)}
              />
            </g>
          );
        })}

        {/* Active tooltip */}
        {activeIdx !== null && (
          <g>
            <rect
              x={xScale(activeIdx) - 50}
              y={yScale(points[activeIdx].value) - 38}
              width={100}
              height={28}
              rx={8}
              fill="#0F1A15"
            />
            <text
              x={xScale(activeIdx)}
              y={yScale(points[activeIdx].value) - 20}
              textAnchor="middle"
              fontSize="11"
              fill="#fff"
              fontFamily={MONO}
            >
              {points[activeIdx].value} {unit} — {formatDateShort(points[activeIdx].date)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------
// ZoneBar — horizontal bar showing a single value's position
// ---------------------------------------------------------------------

function ZoneBar({ value, refLow, refHigh }: { value: number; refLow: number; refHigh: number }) {
  const range = refHigh - refLow;
  const barMin = refLow - range * 0.3;
  const barMax = refHigh + range * 0.3;
  const barRange = barMax - barMin;
  const pct = ((value - barMin) / barRange) * 100;
  const clampedPct = Math.max(2, Math.min(98, pct));

  const refLowPct = ((refLow - barMin) / barRange) * 100;
  const refHighPct = ((refHigh - barMin) / barRange) * 100;

  return (
    <div style={{ marginTop: 20, padding: "0 20px" }}>
      <div style={{ position: "relative", height: 12, borderRadius: 6, overflow: "hidden", background: "#FEE2E2" }}>
        <div
          style={{
            position: "absolute",
            left: `${refLowPct}%`,
            width: `${refHighPct - refLowPct}%`,
            top: 0,
            bottom: 0,
            background: "#E8F5EE",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${clampedPct}%`,
            top: -2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#0F1A15",
            border: "2px solid #fff",
            transform: "translateX(-50%)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8A928C", marginTop: 4, fontFamily: MONO }}>
        <span>{refLow}</span>
        <span>{refHigh}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------

function StatusBadge({ status, label }: { status: string; label: string }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.normal;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 500,
        color: s.text,
        background: s.bg,
        padding: "3px 10px",
        borderRadius: 99,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot }} />
      {label}
    </span>
  );
}

// =====================================================================
// VAULT PAGE
// =====================================================================

export default function VaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const [results, setResults] = useState<BiomarkerResult[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>("timeline");

  // Trends state
  const [selectedBiomarker, setSelectedBiomarker] = useState<string>("");

  // Compare state
  const [compareDate1, setCompareDate1] = useState<string>("");
  const [compareDate2, setCompareDate2] = useState<string>("");

  // -----------------------------------------------------------------
  // Auth + data fetch
  // -----------------------------------------------------------------

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);

      const [resResults, resAnalyses] = await Promise.all([
        supabase
          .from("biomarker_results")
          .select("*")
          .eq("user_id", user.id)
          .order("test_date", { ascending: false }),
        supabase
          .from("user_analyses")
          .select("*")
          .eq("user_id", user.id),
      ]);

      setResults(resResults.data || []);
      setAnalyses(resAnalyses.data || []);
      setLoading(false);
    }
    load();
  }, [router]);

  // -----------------------------------------------------------------
  // Group by test date
  // -----------------------------------------------------------------

  const testGroups: TestGroup[] = useMemo(() => {
    const dateMap = new Map<string, { markers: BiomarkerResult[]; analyses: Analysis[] }>();

    for (const r of results) {
      if (!dateMap.has(r.test_date)) dateMap.set(r.test_date, { markers: [], analyses: [] });
      dateMap.get(r.test_date)!.markers.push(r);
    }

    for (const a of analyses) {
      // Find the result to get the test date
      const r = results.find((rr) => rr.id === a.biomarker_result_id);
      if (r && dateMap.has(r.test_date)) {
        dateMap.get(r.test_date)!.analyses.push(a);
      }
    }

    const groups: TestGroup[] = [];
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => b.localeCompare(a));

    for (const date of sortedDates) {
      const { markers, analyses: dateAnalyses } = dateMap.get(date)!;
      let optimal = 0;
      let borderline = 0;
      let outOfRange = 0;
      let normal = 0;
      const flagged: Analysis[] = [];

      for (const a of dateAnalyses) {
        if (a.status === "optimal") optimal++;
        else if (a.status === "borderline") { borderline++; flagged.push(a); }
        else if (a.status === "out_of_range") { outOfRange++; flagged.push(a); }
        else normal++;
      }

      groups.push({ date, markers, analyses: dateAnalyses, optimal, borderline, outOfRange, normal, flagged });
    }

    return groups;
  }, [results, analyses]);

  // -----------------------------------------------------------------
  // Unique biomarkers list (for trends dropdown)
  // -----------------------------------------------------------------

  const biomarkerNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of results) names.add(r.biomarker);
    return Array.from(names).sort();
  }, [results]);

  // Set initial selected biomarker
  useEffect(() => {
    if (biomarkerNames.length > 0 && !selectedBiomarker) {
      setSelectedBiomarker(biomarkerNames[0]);
    }
  }, [biomarkerNames, selectedBiomarker]);

  // Set initial compare dates
  const sortedDates = useMemo(() => {
    return Array.from(new Set(results.map((r) => r.test_date))).sort((a, b) => b.localeCompare(a));
  }, [results]);

  useEffect(() => {
    if (sortedDates.length >= 2 && !compareDate1) {
      setCompareDate1(sortedDates[0]);
      setCompareDate2(sortedDates[1]);
    } else if (sortedDates.length === 1 && !compareDate1) {
      setCompareDate1(sortedDates[0]);
    }
  }, [sortedDates, compareDate1]);

  // -----------------------------------------------------------------
  // Trends data
  // -----------------------------------------------------------------

  const trendData = useMemo(() => {
    if (!selectedBiomarker) return { points: [] as TrendPoint[], zone: { refLow: null, refHigh: null } as ZoneBounds, unit: "", current: 0, change: null as number | null };

    const matching = results
      .filter((r) => r.biomarker === selectedBiomarker)
      .sort((a, b) => a.test_date.localeCompare(b.test_date));

    const points: TrendPoint[] = matching.map((r) => {
      const a = analyses.find((aa) => aa.biomarker_result_id === r.id);
      return {
        date: r.test_date,
        value: r.value,
        status: a?.status || getStatusForValue(r.value, r.ref_low, r.ref_high),
      };
    });

    const last = matching[matching.length - 1];
    const zone: ZoneBounds = last ? { refLow: last.ref_low, refHigh: last.ref_high } : { refLow: null, refHigh: null };
    const unit = last?.unit || "";
    const current = last?.value || 0;
    const change = matching.length >= 2 ? pctChange(matching[matching.length - 1].value, matching[matching.length - 2].value) : null;

    return { points, zone, unit, current, change };
  }, [selectedBiomarker, results, analyses]);

  // -----------------------------------------------------------------
  // Compare data
  // -----------------------------------------------------------------

  const compareRows = useMemo(() => {
    if (!compareDate1 || !compareDate2) return [];

    const markers1 = results.filter((r) => r.test_date === compareDate1);
    const markers2 = results.filter((r) => r.test_date === compareDate2);

    const allNames = new Set<string>();
    markers1.forEach((m) => allNames.add(m.biomarker));
    markers2.forEach((m) => allNames.add(m.biomarker));

    const rows: {
      name: string;
      val1: number | null;
      val2: number | null;
      unit: string;
      change: number | null;
      status1: string;
      status2: string;
      statusChanged: boolean;
    }[] = [];

    for (const name of Array.from(allNames).sort()) {
      const m1 = markers1.find((m) => m.biomarker === name);
      const m2 = markers2.find((m) => m.biomarker === name);
      const a1 = m1 ? analyses.find((a) => a.biomarker_result_id === m1.id) : undefined;
      const a2 = m2 ? analyses.find((a) => a.biomarker_result_id === m2.id) : undefined;
      const s1 = a1?.status || (m1 ? getStatusForValue(m1.value, m1.ref_low, m1.ref_high) : "normal");
      const s2 = a2?.status || (m2 ? getStatusForValue(m2.value, m2.ref_low, m2.ref_high) : "normal");
      const ch = m1 && m2 ? pctChange(m1.value, m2.value) : null;

      rows.push({
        name,
        val1: m1?.value ?? null,
        val2: m2?.value ?? null,
        unit: m1?.unit || m2?.unit || "",
        change: ch,
        status1: s1,
        status2: s2,
        statusChanged: s1 !== s2,
      });
    }

    return rows;
  }, [compareDate1, compareDate2, results, analyses]);

  // -----------------------------------------------------------------
  // Export JSON
  // -----------------------------------------------------------------

  const handleExport = useCallback(() => {
    const data = {
      exported_at: new Date().toISOString(),
      test_groups: testGroups.map((g) => ({
        date: g.date,
        markers: g.markers,
        analyses: g.analyses,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lipa-vault-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [testGroups]);

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------

  if (loading) {
    return (
      <div suppressHydrationWarning style={{ minHeight: "100vh", background: "#F8F5EF" }}>
        <AppNav />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
          <div style={{ fontSize: 15, color: "#8A928C" }}>Loading your vault...</div>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning style={{ minHeight: "100vh", background: "#F8F5EF" }}>
      <AppNav />

      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px 120px" }}>
        {/* ---- Header ---- */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
            <div>
              <h1 style={{ fontFamily: FRAUNCES, fontSize: 32, fontWeight: 600, color: "#0F1A15", margin: 0, lineHeight: 1.2 }}>
                Your Vault
              </h1>
              <p style={{ fontSize: 14, color: "#8A928C", margin: "6px 0 0" }}>
                Your complete biological history
              </p>
            </div>
            <button
              onClick={handleExport}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#52525B",
                background: "#FFFFFF",
                border: "1px solid rgba(15,26,21,0.1)",
                borderRadius: 10,
                padding: "8px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export JSON
            </button>
          </div>

          {/* Tab buttons */}
          <div style={{ display: "flex", gap: 4, background: "rgba(15,26,21,0.04)", borderRadius: 12, padding: 4, width: "fit-content" }}>
            {(["timeline", "trends", "compare"] as ViewTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  fontSize: 13,
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? "#0F1A15" : "#8A928C",
                  background: activeTab === tab ? "#FFFFFF" : "transparent",
                  border: "none",
                  borderRadius: 9,
                  padding: "7px 18px",
                  cursor: "pointer",
                  boxShadow: activeTab === tab ? "0 1px 3px rgba(15,26,21,0.06)" : "none",
                  transition: "all 0.2s ease",
                  textTransform: "capitalize",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ---- Empty state ---- */}
        {results.length === 0 && (
          <div style={{ ...CARD_STYLE, padding: "60px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#C4C9C6" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <div style={{ fontFamily: FRAUNCES, fontSize: 20, fontWeight: 500, color: "#0F1A15", marginBottom: 8 }}>
              No tests yet
            </div>
            <p style={{ fontSize: 14, color: "#8A928C", maxWidth: 360, margin: "0 auto 20px" }}>
              Upload your first blood test to start building your biological history.
            </p>
            <button
              onClick={() => router.push("/upload")}
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                background: "#1B6B4A",
                border: "none",
                borderRadius: 99,
                padding: "10px 24px",
                cursor: "pointer",
              }}
            >
              Upload Results
            </button>
          </div>
        )}

        {/* ============================================================
            VIEW 1: TIMELINE
            ============================================================ */}
        {activeTab === "timeline" && results.length > 0 && (
          <div style={{ position: "relative", paddingLeft: 28 }}>
            {/* Vertical line */}
            <div
              style={{
                position: "absolute",
                left: 9,
                top: 8,
                bottom: 8,
                width: 2,
                background: "rgba(15,26,21,0.08)",
                borderRadius: 1,
              }}
            />

            {testGroups.map((group, idx) => (
              <div key={group.date} style={{ position: "relative", marginBottom: 20 }}>
                {/* Timeline dot */}
                <div
                  style={{
                    position: "absolute",
                    left: -24,
                    top: 24,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: idx === 0 ? "#1B6B4A" : "#C4C9C6",
                    border: "2px solid #F8F5EF",
                  }}
                />

                <div
                  onClick={() => router.push(`/dashboard?date=${group.date}`)}
                  style={{
                    ...CARD_STYLE,
                    padding: "24px 28px",
                    cursor: "pointer",
                    transition: "box-shadow 0.2s ease, transform 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(15,26,21,0.08)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(15,26,21,0.04)";
                    (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                    <div>
                      <div style={{ fontFamily: FRAUNCES, fontSize: 22, fontWeight: 600, color: "#0F1A15", lineHeight: 1.3 }}>
                        {formatDate(group.date)}
                      </div>
                      <div style={{ fontSize: 13, color: "#8A928C", marginTop: 2 }}>
                        {group.markers.length} marker{group.markers.length !== 1 ? "s" : ""} tested
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4C9C6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 6 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>

                  {/* Status summary */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {group.optimal > 0 && <StatusBadge status="optimal" label={`${group.optimal} optimal`} />}
                    {group.normal > 0 && <StatusBadge status="normal" label={`${group.normal} in range`} />}
                    {group.borderline > 0 && <StatusBadge status="borderline" label={`${group.borderline} borderline`} />}
                    {group.outOfRange > 0 && <StatusBadge status="out_of_range" label={`${group.outOfRange} out of range`} />}
                  </div>

                  {/* Key findings */}
                  {group.flagged.length > 0 && (
                    <div style={{ fontSize: 13, color: "#52525B", lineHeight: 1.5 }}>
                      {group.flagged.slice(0, 2).map((f, fi) => (
                        <span key={fi}>
                          {fi > 0 && " · "}
                          <span style={{ fontWeight: 500, color: STATUS_COLORS[f.status]?.text || "#52525B" }}>
                            {f.biomarker_name}
                          </span>
                          {" "}
                          <span style={{ color: "#8A928C" }}>
                            ({f.flag === "high" ? "high" : f.flag === "low" ? "low" : f.status.replace("_", " ")})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ============================================================
            VIEW 2: TRENDS
            ============================================================ */}
        {activeTab === "trends" && results.length > 0 && (
          <div>
            {/* Biomarker selector */}
            <div style={{ ...CARD_STYLE, padding: "20px 24px", marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#8A928C", marginBottom: 8, display: "block" }}>
                Select biomarker
              </label>
              <select
                value={selectedBiomarker}
                onChange={(e) => setSelectedBiomarker(e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 360,
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: FRAUNCES,
                  color: "#0F1A15",
                  background: "#F8F5EF",
                  border: "1px solid rgba(15,26,21,0.1)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "auto",
                }}
              >
                {biomarkerNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Current value + change */}
            {selectedBiomarker && (
              <div style={{ ...CARD_STYLE, padding: "28px 28px 8px", marginBottom: 20 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#8A928C", marginBottom: 4 }}>
                      Current value
                    </div>
                    <div style={{ fontFamily: FRAUNCES, fontSize: 36, fontWeight: 600, color: "#0F1A15", lineHeight: 1 }}>
                      {trendData.current}
                      <span style={{ fontSize: 14, fontWeight: 400, color: "#8A928C", marginLeft: 6 }}>
                        {trendData.unit}
                      </span>
                    </div>
                  </div>

                  {trendData.change !== null && (
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        fontFamily: MONO,
                        color: trendData.change === 0 ? "#8A928C" : trendData.change > 0 ? "#B45309" : "#1B6B4A",
                        background: trendData.change === 0 ? "#F4F4F5" : trendData.change > 0 ? "#FEF3C7" : "#E8F5EE",
                        padding: "5px 12px",
                        borderRadius: 99,
                        marginBottom: 4,
                      }}
                    >
                      {trendData.change > 0 ? "+" : ""}
                      {trendData.change.toFixed(1)}%{" "}
                      {trendData.change > 0 ? "\u2191" : trendData.change < 0 ? "\u2193" : "\u2192"}
                      <span style={{ fontWeight: 400, marginLeft: 4, fontSize: 11 }}>since last test</span>
                    </div>
                  )}
                </div>

                {/* Chart */}
                <TrendChart points={trendData.points} zone={trendData.zone} unit={trendData.unit} />
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            VIEW 3: COMPARE
            ============================================================ */}
        {activeTab === "compare" && results.length > 0 && (
          <div>
            {sortedDates.length < 2 ? (
              <div style={{ ...CARD_STYLE, padding: "48px 32px", textAlign: "center" }}>
                <div style={{ fontFamily: FRAUNCES, fontSize: 18, fontWeight: 500, color: "#0F1A15", marginBottom: 8 }}>
                  Need at least two tests
                </div>
                <p style={{ fontSize: 13, color: "#8A928C" }}>
                  Upload another blood test to compare results side by side.
                </p>
              </div>
            ) : (
              <>
                {/* Date selectors */}
                <div style={{ ...CARD_STYLE, padding: "20px 24px", marginBottom: 20 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 200px" }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "#8A928C", marginBottom: 6, display: "block" }}>
                        Test 1 (newer)
                      </label>
                      <select
                        value={compareDate1}
                        onChange={(e) => setCompareDate1(e.target.value)}
                        style={{
                          width: "100%",
                          fontSize: 14,
                          fontFamily: MONO,
                          color: "#0F1A15",
                          background: "#F8F5EF",
                          border: "1px solid rgba(15,26,21,0.1)",
                          borderRadius: 10,
                          padding: "10px 14px",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {sortedDates.map((d) => (
                          <option key={d} value={d}>{formatDate(d)}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ fontSize: 18, color: "#C4C9C6", padding: "0 4px 10px" }}>vs</div>
                    <div style={{ flex: "1 1 200px" }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: "#8A928C", marginBottom: 6, display: "block" }}>
                        Test 2 (older)
                      </label>
                      <select
                        value={compareDate2}
                        onChange={(e) => setCompareDate2(e.target.value)}
                        style={{
                          width: "100%",
                          fontSize: 14,
                          fontFamily: MONO,
                          color: "#0F1A15",
                          background: "#F8F5EF",
                          border: "1px solid rgba(15,26,21,0.1)",
                          borderRadius: 10,
                          padding: "10px 14px",
                          outline: "none",
                          cursor: "pointer",
                        }}
                      >
                        {sortedDates.map((d) => (
                          <option key={d} value={d}>{formatDate(d)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Comparison table */}
                <div style={{ ...CARD_STYLE, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(15,26,21,0.08)" }}>
                          <th style={{ textAlign: "left", padding: "14px 20px", fontWeight: 500, color: "#8A928C", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Marker
                          </th>
                          <th style={{ textAlign: "right", padding: "14px 16px", fontWeight: 500, color: "#8A928C", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Test 1
                          </th>
                          <th style={{ textAlign: "right", padding: "14px 16px", fontWeight: 500, color: "#8A928C", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Test 2
                          </th>
                          <th style={{ textAlign: "right", padding: "14px 16px", fontWeight: 500, color: "#8A928C", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Change
                          </th>
                          <th style={{ textAlign: "center", padding: "14px 20px", fontWeight: 500, color: "#8A928C", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Dir
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {compareRows.map((row) => {
                          const improved = row.statusChanged && isImprovement(row.status2, row.status1);
                          const worsened = row.statusChanged && !improved;
                          const highlightBg = row.statusChanged
                            ? improved
                              ? "rgba(27,107,74,0.04)"
                              : "rgba(185,28,28,0.03)"
                            : "transparent";

                          return (
                            <tr
                              key={row.name}
                              style={{
                                borderBottom: "1px solid rgba(15,26,21,0.04)",
                                background: highlightBg,
                              }}
                            >
                              <td style={{ padding: "12px 20px", fontWeight: 500, color: "#0F1A15" }}>
                                {row.name}
                                {row.statusChanged && (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      marginLeft: 8,
                                      fontSize: 10,
                                      fontWeight: 500,
                                      color: improved ? "#1B6B4A" : "#B91C1C",
                                      background: improved ? "#E8F5EE" : "#FEE2E2",
                                      padding: "1px 7px",
                                      borderRadius: 99,
                                    }}
                                  >
                                    {row.status2.replace("_", " ")} → {row.status1.replace("_", " ")}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: MONO, color: row.val1 !== null ? "#0F1A15" : "#C4C9C6" }}>
                                {row.val1 !== null ? row.val1 : "\u2014"}
                                {row.val1 !== null && <span style={{ color: "#8A928C", marginLeft: 3, fontSize: 11 }}>{row.unit}</span>}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: MONO, color: row.val2 !== null ? "#0F1A15" : "#C4C9C6" }}>
                                {row.val2 !== null ? row.val2 : "\u2014"}
                                {row.val2 !== null && <span style={{ color: "#8A928C", marginLeft: 3, fontSize: 11 }}>{row.unit}</span>}
                              </td>
                              <td
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "right",
                                  fontFamily: MONO,
                                  fontWeight: 500,
                                  color:
                                    row.change === null
                                      ? "#C4C9C6"
                                      : row.change === 0
                                        ? "#8A928C"
                                        : improved
                                          ? "#1B6B4A"
                                          : worsened
                                            ? "#B91C1C"
                                            : row.change > 0
                                              ? "#B45309"
                                              : "#1B6B4A",
                                }}
                              >
                                {row.change !== null
                                  ? `${row.change > 0 ? "+" : ""}${row.change.toFixed(1)}%`
                                  : "\u2014"}
                              </td>
                              <td style={{ padding: "12px 20px", textAlign: "center", fontSize: 16 }}>
                                {row.change === null
                                  ? "\u2014"
                                  : row.change > 0
                                    ? "\u2191"
                                    : row.change < 0
                                      ? "\u2193"
                                      : "\u2192"}
                              </td>
                            </tr>
                          );
                        })}
                        {compareRows.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: "32px 20px", textAlign: "center", color: "#8A928C" }}>
                              No markers to compare between these dates.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {userId && <AskLipa userId={userId} />}
    </div>
  );
}

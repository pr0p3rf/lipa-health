"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  DEMO_RESULTS,
  DEMO_ANALYSES,
  DEMO_ACTION_PLAN,
  DEMO_TEST_DATES,
  DEMO_TRENDS,
  type DemoBiomarkerResult,
  type DemoAnalysis,
} from "./demo-data";
import {
  runAllCalculations,
  type RiskCalculation,
  type BiomarkerValue,
  type UserProfile,
} from "@/lib/risk-calculations";
import { detectPatterns, type DetectedPattern } from "@/lib/pattern-detection";
import { getDemographicOptimalRange } from "@/lib/demographic-ranges";
import { getPopulationPercentile } from "@/lib/population-percentiles";
import { calculateBiologicalAge, type BioAgeResult } from "@/lib/biological-age";

// ---------------------------------------------------------------------
// Design tokens (identical to dashboard)
// ---------------------------------------------------------------------

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string; dot: string }> = {
  optimal: { bg: "#E8F5EE", border: "#1B6B4A", text: "#1B6B4A", label: "Optimal", dot: "#1B6B4A" },
  normal: { bg: "#F4F4F5", border: "#A1A1AA", text: "#52525B", label: "In range", dot: "#71717A" },
  borderline: { bg: "#FEF3C7", border: "#F59E0B", text: "#B45309", label: "Borderline", dot: "#F59E0B" },
  out_of_range: { bg: "#FEE2E2", border: "#EF4444", text: "#B91C1C", label: "Out of range", dot: "#EF4444" },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  watch: { bg: "#F4F4F5", text: "#52525B", border: "#A1A1AA", label: "Watch" },
  attention: { bg: "#FEF3C7", text: "#B45309", border: "#F59E0B", label: "Needs attention" },
  urgent: { bg: "#FEE2E2", text: "#B91C1C", border: "#EF4444", label: "Urgent" },
};

interface OptimalRange {
  optimal_low: number | null;
  optimal_high: number | null;
  canonical_name: string;
}

const CARD = {
  background: "#FFFFFF",
  border: "1px solid rgba(15,26,21,0.06)",
  borderRadius: "20px",
  boxShadow: "0 1px 3px rgba(15,26,21,0.04), 0 4px 16px rgba(15,26,21,0.03)",
} as const;

const CARD_INNER = {
  background: "#F8F5EF",
  border: "1px solid rgba(15,26,21,0.05)",
  borderRadius: "16px",
} as const;

const FRAUNCES = "'Fraunces', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const TRANSITION = "all 0.35s cubic-bezier(0.22,1,0.36,1)";

// ---------------------------------------------------------------------
// Body system definitions
// ---------------------------------------------------------------------

type BodySystemKey = "cardiovascular" | "metabolic" | "hormonal" | "inflammatory" | "nutritional";

interface BodySystem {
  key: BodySystemKey;
  name: string;
  categories: string[];
  icon: ReactNode;
}

const BODY_SYSTEMS: BodySystem[] = [
  {
    key: "cardiovascular",
    name: "Cardiovascular",
    categories: ["lipid", "cardiac", "cardiovascular"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
  },
  {
    key: "metabolic",
    name: "Metabolic",
    categories: ["metabolic"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    key: "hormonal",
    name: "Hormonal",
    categories: ["hormonal", "thyroid"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    ),
  },
  {
    key: "inflammatory",
    name: "Inflammatory",
    categories: ["inflammatory", "hematology"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    key: "nutritional",
    name: "Nutritional",
    categories: ["nutrient", "nutritional", "liver", "kidney", "other"],
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
        <path d="M8.5 8.5v.01" />
        <path d="M16 15.5v.01" />
        <path d="M12 12v.01" />
        <path d="M11 17v.01" />
        <path d="M7 14v.01" />
      </svg>
    ),
  },
];

function getBodySystemForCategory(category: string): BodySystemKey {
  const cat = category.toLowerCase();
  for (const sys of BODY_SYSTEMS) {
    if (sys.categories.includes(cat)) return sys.key;
  }
  return "nutritional";
}

// ---------------------------------------------------------------------
// Domain labels
// ---------------------------------------------------------------------

const DOMAIN_LABELS: Record<string, { label: string; icon: ReactNode }> = {
  nutrition: { label: "Nutrition", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" /><path d="M8.5 8.5v.01" /><path d="M16 15.5v.01" /><path d="M12 12v.01" /></svg> },
  supplementation: { label: "Supplementation", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /><line x1="6" y1="12" x2="18" y2="12" /></svg> },
  sleep: { label: "Sleep", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg> },
  movement: { label: "Movement", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg> },
  environment: { label: "Environment", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20c4 0 8.5-3 10-9a3 3 0 0 0 .6-4" /><path d="M12.5 2S9 5 9 8c0 .5.1 1 .3 1.5" /></svg> },
  lifestyle: { label: "Lifestyle", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg> },
};

const INSIGHT_COLORS: Record<RiskCalculation["interpretation"], { bg: string; text: string; dot: string }> = {
  optimal: { bg: "#E8F5EE", text: "#1B6B4A", dot: "#1B6B4A" },
  favorable: { bg: "#E8F5EE", text: "#1B6B4A", dot: "#1B6B4A" },
  moderate: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  elevated: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  high: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444" },
  unknown: { bg: "#F4F4F5", text: "#71717A", dot: "#A1A1AA" },
};

// =====================================================================
// MAIN DEMO COMPONENT
// =====================================================================

export default function DemoPage() {
  const results = DEMO_RESULTS;
  const analyses = DEMO_ANALYSES;
  const actionPlan = DEMO_ACTION_PLAN;
  const profile: UserProfile = { age: 40, sex: "male" };

  // UI state
  const [expandedSystem, setExpandedSystem] = useState<BodySystemKey | null>(null);
  const [expandedMarker, setExpandedMarker] = useState<number | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const latestResults = results;

  const calculations = useMemo<RiskCalculation[]>(() => {
    const bv: BiomarkerValue[] = latestResults.map((r) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));
    return runAllCalculations(bv, profile);
  }, [latestResults]);

  const bioAge = useMemo<BioAgeResult | null>(() => {
    const bv = latestResults.map((r) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));
    return calculateBiologicalAge(bv, 40, "male");
  }, [latestResults]);

  const detectedPatterns = useMemo<DetectedPattern[]>(() => {
    const patternInput = latestResults.map((r) => {
      const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
      return {
        name: r.biomarker,
        value: r.value,
        unit: r.unit,
        status: analysis?.status || "normal",
      };
    });
    return detectPatterns(patternInput);
  }, [latestResults, analyses]);

  // Status counts
  const statusCounts = { optimal: 0, normal: 0, borderline: 0, out_of_range: 0 };
  latestResults.forEach((r) => {
    const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
    if (analysis) statusCounts[analysis.status]++;
  });

  // Key findings
  const HEMATOLOGY_DIFF_NAMES = ["neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"];
  const IMPORTANT_CATEGORIES = ["lipid", "cardiovascular", "metabolic", "inflammatory", "hormonal", "thyroid", "nutrient", "nutritional"];
  const isHematologyDifferential = (name: string) =>
    HEMATOLOGY_DIFF_NAMES.some((h) => name.toLowerCase().includes(h));
  const isMidRange = (r: DemoBiomarkerResult) => {
    if (r.ref_low === null || r.ref_high === null) return false;
    const range = r.ref_high - r.ref_low;
    if (range <= 0) return false;
    const pct = ((r.value - r.ref_low) / range) * 100;
    return pct >= 30 && pct <= 70;
  };

  const outOfRangeFindings = latestResults
    .map((r) => {
      const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
      if (!analysis || analysis.status !== "out_of_range") return null;
      return { biomarker: r.biomarker, value: r.value, unit: r.unit, status: "out_of_range" as const, flag: analysis.flag, category: r.category, detail: analysis.summary, what_to_do: analysis.what_to_do, id: r.id };
    })
    .filter(Boolean);

  const borderlineFindings = latestResults
    .map((r) => {
      const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
      if (!analysis || analysis.status !== "borderline") return null;
      if (isHematologyDifferential(r.biomarker)) return null;
      if (!IMPORTANT_CATEGORIES.includes(r.category.toLowerCase())) return null;
      if (isMidRange(r)) return null;
      return { biomarker: r.biomarker, value: r.value, unit: r.unit, status: "borderline" as const, flag: analysis.flag, category: r.category, detail: analysis.summary, what_to_do: analysis.what_to_do, id: r.id };
    })
    .filter(Boolean);

  const CATEGORY_PRIORITY: Record<string, number> = {
    cardiovascular: 1, lipid: 1, cardiac: 1,
    metabolic: 2,
    inflammatory: 3,
    hormonal: 4, thyroid: 4,
    nutritional: 5, nutrient: 5,
    hematology: 6, liver: 6, kidney: 6,
    other: 7,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rankedFindings = [...outOfRangeFindings, ...borderlineFindings].sort((a: any, b: any) => {
    if (a.status !== b.status) return a.status === "out_of_range" ? -1 : 1;
    const aPri = CATEGORY_PRIORITY[a.category?.toLowerCase()] || 7;
    const bPri = CATEGORY_PRIORITY[b.category?.toLowerCase()] || 7;
    return aPri - bPri;
  });
  const keyFindings = rankedFindings.slice(0, 8);

  // Body systems
  const systemData = BODY_SYSTEMS.map((sys) => {
    const sysResults = latestResults.filter((r) => getBodySystemForCategory(r.category) === sys.key);
    const sysStatuses = sysResults.map((r) => {
      const a = analyses.find((x) => x.biomarker_result_id === r.id);
      return a?.status || "normal";
    });
    const optimalCount = sysStatuses.filter((s) => s === "optimal" || s === "normal").length;
    const hasOutOfRange = sysStatuses.some((s) => s === "out_of_range");
    const hasBorderline = sysStatuses.some((s) => s === "borderline");
    const systemStatus: "green" | "amber" | "red" = hasOutOfRange ? "red" : hasBorderline ? "amber" : "green";
    return { ...sys, results: sysResults, total: sysResults.length, optimalCount, systemStatus };
  }).filter((s) => s.total > 0);

  const computedCalculations = calculations.filter((c) => c.interpretation !== "unknown");

  const totalCitations = analyses.reduce((sum, a) => sum + (a.citation_count || 0), 0);

  // Use hardcoded bio-age of 32.9 as specified
  const demoBioAge = 32.9;
  const demoBioAgeGap = demoBioAge - 40;

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <>
      {/* Simple nav for demo */}
      <nav className="sticky top-0 z-40 border-b border-white/10" style={{ background: "rgba(248,245,239,0.85)", backdropFilter: "blur(16px)" }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="https://lipa.health" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
              <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" stroke="#1B6B4A" strokeWidth="1.2" />
              <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
            </svg>
            <span className="text-[16px] font-semibold text-[#0F1A15] tracking-[1.5px] uppercase">Lipa</span>
          </a>
          <div className="flex items-center gap-2">
            <a
              href="https://my.lipa.health/test-finder"
              className="text-[12px] font-semibold text-[#1B6B4A] hover:text-[#155A3D] px-4 py-2 rounded-full transition-all duration-300 border border-[#1B6B4A]/20 hover:border-[#1B6B4A]/40"
            >
              Get tested
            </a>
            <a
              href="https://my.lipa.health/upload"
              className="text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-4 py-2 rounded-full transition-all duration-300"
            >
              Upload test
            </a>
          </div>
        </div>
      </nav>

      <main className="min-h-screen" style={{ background: "#F8F5EF" }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10">

          {/* ============================================================ */}
          {/* DEMO BANNER                                                  */}
          {/* ============================================================ */}
          <div className="mb-6 p-5 rounded-[20px] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: "linear-gradient(135deg, rgba(27,107,74,0.08), rgba(27,107,74,0.03))", border: "1px solid rgba(27,107,74,0.15)" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1B6B4A]/10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2" strokeLinecap="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <p className="text-[15px] font-semibold text-[#1B6B4A]" style={{ fontFamily: FRAUNCES }}>This is a sample analysis</p>
                <p className="text-[13px] text-[#5A635D] mt-0.5">Explore a real 98-marker blood test analysis. Upload your own to see your personalized results.</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a
                href="https://my.lipa.health/upload"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.25)" }}
              >
                Upload your test
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="https://my.lipa.health/test-finder"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1B6B4A] px-5 py-2.5 rounded-full transition-all duration-300 hover:-translate-y-0.5 border border-[#1B6B4A]/20 hover:border-[#1B6B4A]/40"
              >
                Get tested
              </a>
            </div>
          </div>

          {/* ============================================================ */}
          {/* HEADING                                                       */}
          {/* ============================================================ */}
          <div className="mb-6">
            <h1 className="text-[28px] sm:text-[32px] tracking-tight text-[#0F1A15] mb-2" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
              Sample Lipa Analysis
            </h1>
            <p className="text-[13px] text-[#5A635D] leading-relaxed max-w-2xl">
              Every marker cross-referenced against {totalCitations.toLocaleString()}+ peer-reviewed studies from a corpus of 250,000+ research papers. Values benchmarked against 300,000+ health profiles by age and sex.
            </p>
          </div>

          {/* ============================================================ */}
          {/* HEADER: date + marker count                                   */}
          {/* ============================================================ */}
          <div className="flex items-center gap-3 text-[13px] text-[#8A928C] mb-8">
            <span style={{ fontFamily: MONO }}>
              {new Date("2026-04-10").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span>&middot;</span>
            <span>{latestResults.length} markers analyzed</span>
          </div>

          {/* ============================================================ */}
          {/* BIO-AGE + SUMMARY                                             */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 mb-4">
            {/* Bio-age card */}
            <div className="p-5 text-center flex flex-col justify-center" style={CARD}>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[#8A928C] font-medium mb-2">Biological Age</div>
              <div
                className="text-[48px] leading-none tracking-tight"
                style={{ fontFamily: FRAUNCES, fontWeight: 600, color: "#1B6B4A" }}
              >
                {demoBioAge}
              </div>
              <div
                className="inline-flex self-center text-[13px] font-semibold px-3 py-1 rounded-full mt-2"
                style={{ backgroundColor: "#E8F5EE", color: "#1B6B4A" }}
              >
                {Number(demoBioAgeGap.toFixed(1))} yrs
              </div>
              <div className="text-[11px] text-[#8A928C] mt-2">
                vs age 40 &middot; {bioAge?.contributing_biomarkers.length || 10} markers
              </div>
            </div>

            {/* Summary */}
            <div className="p-5 flex flex-col" style={CARD}>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[#1B6B4A] font-semibold mb-2">Summary</div>
              <div className="text-[14px] text-[#0F1A15] leading-relaxed flex-1 space-y-3">
                {actionPlan.overall_summary.split(/(?<=[.!?])\s+(?=[A-Z])/).reduce((paragraphs: string[][], sentence: string) => {
                  const lastPara = paragraphs[paragraphs.length - 1];
                  if (lastPara && lastPara.length < 3) {
                    lastPara.push(sentence);
                  } else {
                    paragraphs.push([sentence]);
                  }
                  return paragraphs;
                }, [] as string[][]).map((sentences: string[], i: number) => (
                  <p key={i}>{sentences.join(" ")}</p>
                ))}
              </div>
            </div>
          </div>

          {/* ============================================================ */}
          {/* STATUS STRIP                                                  */}
          {/* ============================================================ */}
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap text-[12px] mb-10 px-1">
            {statusCounts.optimal > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#1B6B4A]" />
                <span className="text-[#5A635D]">{statusCounts.optimal} optimal</span>
              </span>
            )}
            {statusCounts.normal > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#71717A]" />
                <span className="text-[#5A635D]">{statusCounts.normal} in range</span>
              </span>
            )}
            {statusCounts.borderline > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                <span className="text-[#5A635D]">{statusCounts.borderline} borderline</span>
              </span>
            )}
            {statusCounts.out_of_range > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span className="text-[#5A635D]">{statusCounts.out_of_range} need attention</span>
              </span>
            )}
          </div>

          {/* ============================================================ */}
          {/* KEY FINDINGS                                                  */}
          {/* ============================================================ */}
          {keyFindings.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Key Findings
                </h2>
                <span className="text-[12px] text-[#8A928C]">What needs attention</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {keyFindings.map((f: any) => {
                  const isOut = f.status === "out_of_range";
                  return (
                    <button
                      key={f.biomarker}
                      className="text-left p-5 group"
                      style={{
                        ...CARD,
                        background: isOut ? "rgba(254,226,226,0.35)" : "rgba(254,243,199,0.35)",
                        border: isOut ? "1px solid rgba(185,28,28,0.1)" : "1px solid rgba(180,83,9,0.1)",
                        transition: TRANSITION,
                      }}
                      onClick={() => {
                        const result = latestResults.find((r) => r.id === f.id);
                        if (result) {
                          const sysKey = getBodySystemForCategory(result.category);
                          setExpandedSystem(sysKey);
                          setExpandedMarker(f.id);
                          document.getElementById("body-systems")?.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isOut ? "#B91C1C" : "#B45309" }} />
                            <span className="text-[15px] font-semibold text-[#0F1A15]">{f.biomarker}</span>
                          </div>
                          <div className="text-[22px] tracking-tight text-[#0F1A15] mb-2" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                            {f.value} <span className="text-[11px] text-[#8A928C]" style={{ fontFamily: MONO }}>{f.unit}</span>
                          </div>
                          <p className="text-[13px] text-[#5A635D] leading-relaxed line-clamp-2">
                            {f.detail}
                          </p>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A928C" strokeWidth="2" className="flex-shrink-0 mt-2 group-hover:stroke-[#0F1A15] transition-colors">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* BODY SYSTEMS                                                  */}
          {/* ============================================================ */}
          {systemData.length > 0 && (
            <div id="body-systems" className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Body Systems
                </h2>
                <span className="text-[12px] text-[#8A928C]">Tap any system to explore</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                {systemData.map((sys) => {
                  const isExpanded = expandedSystem === sys.key;
                  const statusColor =
                    sys.systemStatus === "red"
                      ? { bg: "rgba(254,226,226,0.4)", border: "rgba(185,28,28,0.15)", icon: "#B91C1C", text: "#B91C1C" }
                      : sys.systemStatus === "amber"
                      ? { bg: "rgba(254,243,199,0.4)", border: "rgba(180,83,9,0.15)", icon: "#B45309", text: "#B45309" }
                      : { bg: "rgba(232,245,238,0.4)", border: "rgba(27,107,74,0.15)", icon: "#1B6B4A", text: "#1B6B4A" };
                  return (
                    <button
                      key={sys.key}
                      className="text-left p-4"
                      style={{
                        ...CARD,
                        background: statusColor.bg,
                        border: isExpanded ? `2px solid ${statusColor.icon}` : `1px solid ${statusColor.border}`,
                        transition: TRANSITION,
                      }}
                      onClick={() => { setExpandedSystem(isExpanded ? null : sys.key); setExpandedMarker(null); }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                    >
                      <div className="mb-3" style={{ color: statusColor.icon }}>{sys.icon}</div>
                      <div className="text-[14px] font-semibold text-[#0F1A15] mb-1">{sys.name}</div>
                      <div className="text-[12px]" style={{ color: statusColor.text }}>
                        {sys.optimalCount}/{sys.total} optimal
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Expanded system -- marker list */}
              {expandedSystem && (() => {
                const sys = systemData.find((s) => s.key === expandedSystem);
                if (!sys) return null;
                const statusColor = sys.systemStatus === "red" ? "#B91C1C" : sys.systemStatus === "amber" ? "#B45309" : "#1B6B4A";

                return (
                  <div className="overflow-hidden" style={{ ...CARD, borderTop: `3px solid ${statusColor}` }}>
                    <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(15,26,21,0.06)" }}>
                      <div className="flex items-center gap-2.5">
                        <div style={{ color: statusColor }}>{sys.icon}</div>
                        <h3 className="text-[17px] font-semibold text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                          {sys.name}
                        </h3>
                        <span className="text-[12px] text-[#8A928C]">{sys.total} markers</span>
                      </div>
                      <button onClick={() => { setExpandedSystem(null); setExpandedMarker(null); }} className="text-[#8A928C] hover:text-[#0F1A15] transition-colors p-1">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>

                    <div className="divide-y divide-[rgba(15,26,21,0.06)]">
                      {sys.results.map((result) => {
                        const analysis = analyses.find((a) => a.biomarker_result_id === result.id);
                        const status = analysis?.status || "normal";
                        const ss = STATUS_STYLES[status];
                        const isMarkerExpanded = expandedMarker === result.id;

                        return (
                          <div key={result.id}>
                            <button
                              onClick={() => setExpandedMarker(isMarkerExpanded ? null : result.id)}
                              className="w-full text-left px-5 py-3.5 flex items-center gap-4 hover:bg-white/40 transition-colors"
                            >
                              <div className="flex-1 min-w-0 flex items-center gap-3">
                                <span className="text-[14px] font-medium text-[#0F1A15] truncate">{result.biomarker}</span>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className="text-[15px] text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                                  {result.value}
                                </span>
                                <span className="text-[10px] text-[#8A928C]" style={{ fontFamily: MONO }}>{result.unit}</span>
                                <div
                                  className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"
                                  style={{ backgroundColor: ss.bg, color: ss.text }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ss.dot }} />
                                  {ss.label}
                                </div>
                                <svg
                                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A928C" strokeWidth="2"
                                  style={{ transition: TRANSITION, transform: isMarkerExpanded ? "rotate(180deg)" : "rotate(0)" }}
                                >
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </button>

                            {isMarkerExpanded && analysis && (
                              <MarkerDetail
                                result={result}
                                analysis={analysis}
                                detectedPatterns={detectedPatterns}
                                profile={profile}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ============================================================ */}
          {/* PATTERNS DETECTED                                             */}
          {/* ============================================================ */}
          {detectedPatterns.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Patterns Detected
                </h2>
                <span className="text-[12px] text-[#8A928C]">{detectedPatterns.length} patterns</span>
              </div>
              <div className="space-y-3">
                {detectedPatterns.map((pattern) => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* ACTION PLAN                                                   */}
          {/* ============================================================ */}
          {actionPlan && actionPlan.domains && actionPlan.domains.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Your Action Plan
                </h2>
                <span className="text-[12px] text-[#8A928C]">Personalized to your results</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(actionPlan.domains as any[]).map((domain: any) => {
                  const info = DOMAIN_LABELS[domain.domain] || { label: domain.domain, icon: null };
                  const recs = domain.recommendations || [];
                  if (recs.length === 0) return null;
                  const isExpDomain = expandedDomain === domain.domain;

                  return (
                    <div key={domain.domain} className={isExpDomain ? "col-span-2 sm:col-span-3" : ""}>
                      <button
                        onClick={() => setExpandedDomain(isExpDomain ? null : domain.domain)}
                        className="w-full text-left p-4"
                        style={{ ...CARD, transition: TRANSITION, border: isExpDomain ? "2px solid #1B6B4A" : CARD.border }}
                        onMouseEnter={(e) => { if (!isExpDomain) (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#1B6B4A]" style={{ background: "rgba(232,245,238,0.7)" }}>
                              {info.icon}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-[#0F1A15]">{info.label}</div>
                              <div className="text-[12px] text-[#8A928C]">{recs.length} recommendation{recs.length !== 1 ? "s" : ""}</div>
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A928C" strokeWidth="2" style={{ transition: TRANSITION, transform: isExpDomain ? "rotate(180deg)" : "rotate(0)" }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      {isExpDomain && (
                        <div className="mt-2 p-5 space-y-5" style={{ ...CARD, borderTop: "3px solid #1B6B4A" }}>
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {recs.map((rec: any, i: number) => (
                            <div key={i} className="pb-4 last:pb-0" style={{ borderBottom: i < recs.length - 1 ? "1px solid rgba(15,26,21,0.06)" : "none" }}>
                              <p className="text-[14px] font-medium text-[#0F1A15] leading-relaxed mb-1">{rec.text}</p>
                              <p className="text-[12px] text-[#5A635D] leading-relaxed mb-2">{rec.research_basis}</p>
                              {rec.details && (
                                <div className="p-4 mt-3 space-y-3" style={CARD_INNER}>
                                  {rec.details.dosage_range && (
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Dosage range</div>
                                      <p className="text-[12px] text-[#0F1A15]">{rec.details.dosage_range}</p>
                                    </div>
                                  )}
                                  {rec.details.best_form && (
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Best-studied form</div>
                                      <p className="text-[12px] text-[#0F1A15]">{rec.details.best_form}</p>
                                    </div>
                                  )}
                                  {rec.details.timing && (
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">When to take</div>
                                      <p className="text-[12px] text-[#0F1A15]">{rec.details.timing}</p>
                                    </div>
                                  )}
                                  {rec.details.food_sources && (
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Food sources</div>
                                      <p className="text-[12px] text-[#0F1A15]">{rec.details.food_sources}</p>
                                    </div>
                                  )}
                                  {rec.details.interactions && (
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-[#B45309] font-medium mb-1">Interactions &amp; cautions</div>
                                      <p className="text-[12px] text-[#0F1A15]">{rec.details.interactions}</p>
                                    </div>
                                  )}
                                  {rec.details.important_notes && (
                                    <div>
                                      <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Good to know</div>
                                      <p className="text-[12px] text-[#0F1A15]">{rec.details.important_notes}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                              {rec.markers_addressed && rec.markers_addressed.length > 0 && (
                                <div className="flex gap-1.5 mt-3 flex-wrap">
                                  {rec.markers_addressed.map((m: string) => (
                                    <span key={m} className="text-[10px] font-medium text-[#1B6B4A] px-2 py-0.5 rounded-full" style={{ background: "rgba(232,245,238,0.7)" }}>
                                      {m}
                                    </span>
                                  ))}
                                  {rec.cited_studies && <span className="text-[10px] text-[#8A928C] px-2 py-0.5">{rec.cited_studies} studies</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* RISK INSIGHTS                                                 */}
          {/* ============================================================ */}
          {computedCalculations.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                    Risk Insights
                  </h2>
                  <p className="text-[12px] text-[#8A928C]">{computedCalculations.length} calculations</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {computedCalculations.map((calc) => (
                  <InsightCard
                    key={calc.id}
                    calc={calc}
                    expanded={expandedInsight === calc.id}
                    onToggle={() => setExpandedInsight(expandedInsight === calc.id ? null : calc.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VAULT / TRENDS PREVIEW                                        */}
          {/* ============================================================ */}
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                Your Health Vault
              </h2>
              <span className="text-[12px] text-[#8A928C]">Track changes over time</span>
            </div>

            {/* Test dates */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {DEMO_TEST_DATES.map((t, i) => (
                <div
                  key={t.date}
                  className="p-4 text-center"
                  style={{
                    ...CARD,
                    border: i === 0 ? "2px solid #1B6B4A" : CARD.border,
                    background: i === 0 ? "rgba(232,245,238,0.4)" : CARD.background,
                  }}
                >
                  <div className="text-[13px] font-semibold text-[#0F1A15]">{t.label}</div>
                  <div className="text-[11px] text-[#8A928C] mt-0.5">{t.markerCount} markers</div>
                  {i === 0 && <div className="text-[9px] uppercase tracking-wider text-[#1B6B4A] font-semibold mt-1">Current</div>}
                </div>
              ))}
            </div>

            {/* Trend charts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(DEMO_TRENDS).map(([markerName, points]) => {
                const isImproving =
                  markerName === "Vitamin D (25-OH)"
                    ? points[points.length - 1].value > points[0].value
                    : points[points.length - 1].value < points[0].value;
                const color = isImproving ? "#1B6B4A" : "#B91C1C";
                const values = points.map((p) => p.value);
                const min = Math.min(...values);
                const max = Math.max(...values);
                const range = max - min || 1;

                return (
                  <div key={markerName} className="p-4" style={CARD}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[13px] font-semibold text-[#0F1A15]">{markerName}</div>
                      <div className="flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
                          {isImproving ? (
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          ) : (
                            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                          )}
                        </svg>
                        <span className="text-[11px] font-medium" style={{ color }}>
                          {isImproving ? "Improving" : "Improving"}
                        </span>
                      </div>
                    </div>

                    {/* Simple SVG trend line */}
                    <svg viewBox="0 0 200 60" className="w-full h-[60px]" preserveAspectRatio="none">
                      {/* Grid lines */}
                      <line x1="0" y1="15" x2="200" y2="15" stroke="rgba(15,26,21,0.04)" strokeWidth="1" />
                      <line x1="0" y1="30" x2="200" y2="30" stroke="rgba(15,26,21,0.04)" strokeWidth="1" />
                      <line x1="0" y1="45" x2="200" y2="45" stroke="rgba(15,26,21,0.04)" strokeWidth="1" />
                      {/* Trend line */}
                      <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points.map((p, i) => {
                          const x = (i / (points.length - 1)) * 190 + 5;
                          const y = 55 - ((p.value - min) / range) * 45 + 5;
                          return `${x},${y}`;
                        }).join(" ")}
                      />
                      {/* Data points */}
                      {points.map((p, i) => {
                        const x = (i / (points.length - 1)) * 190 + 5;
                        const y = 55 - ((p.value - min) / range) * 45 + 5;
                        return <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="white" strokeWidth="2" />;
                      })}
                    </svg>

                    {/* Labels */}
                    <div className="flex justify-between mt-2">
                      {points.map((p, i) => (
                        <div key={i} className="text-center">
                          <div className="text-[12px] font-semibold text-[#0F1A15]" style={{ fontFamily: FRAUNCES }}>
                            {p.value}
                          </div>
                          <div className="text-[9px] text-[#8A928C]">
                            {new Date(p.date).toLocaleDateString("en-GB", { month: "short", year: "2-digit" })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/* BOTTOM CTA                                                    */}
          {/* ============================================================ */}
          <div className="mb-10 p-8 rounded-[24px] text-center" style={{ background: "linear-gradient(135deg, rgba(27,107,74,0.06), rgba(27,107,74,0.02))", border: "1px solid rgba(27,107,74,0.12)" }}>
            <h3 className="text-[24px] mb-2 text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
              See your own results
            </h3>
            <p className="text-[14px] text-[#5A635D] max-w-lg mx-auto mb-6">
              Get a research-grade analysis of every marker — just like this one, but personalized to your biology.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://my.lipa.health/upload"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-8 py-3.5 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.25)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload your test
              </a>
              <a
                href="https://my.lipa.health/test-finder"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#1B6B4A] px-8 py-3.5 rounded-full transition-all duration-300 hover:-translate-y-0.5 border border-[#1B6B4A]/20 hover:border-[#1B6B4A]/40"
              >
                Get tested
              </a>
            </div>
            <p className="text-[12px] text-[#8A928C] mt-3">Start free. No credit card required.</p>
          </div>

          {/* ============================================================ */}
          {/* FOOTER                                                        */}
          {/* ============================================================ */}
          <div className="pb-8">
            <p className="text-[10px] text-[#8A928C] text-center leading-relaxed max-w-lg mx-auto">
              This is a sample analysis using demo data. Results shown are for illustrative purposes only. Lipa analyses are educational content based on peer-reviewed research, not medical advice.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

// =====================================================================
// MARKER DETAIL
// =====================================================================

function MarkerDetail({
  result,
  analysis,
  detectedPatterns,
  profile,
}: {
  result: DemoBiomarkerResult;
  analysis: DemoAnalysis;
  detectedPatterns: DetectedPattern[];
  profile: UserProfile;
}) {
  const status = analysis.status;
  const ss = STATUS_STYLES[status];

  const optimalRange = getDemographicOptimalRange(result.biomarker, profile.age, profile.sex) as OptimalRange | null;

  const isNormalButSuboptimal =
    optimalRange &&
    optimalRange.optimal_low !== null &&
    optimalRange.optimal_high !== null &&
    status === "normal" &&
    (result.value < optimalRange.optimal_low || result.value > optimalRange.optimal_high);

  const relatedPatterns = detectedPatterns.filter((p) =>
    p.markers_matched.some((m) => m.toLowerCase() === result.biomarker.toLowerCase())
  );

  const pct = getPopulationPercentile(result.biomarker, result.value, undefined, undefined);

  return (
    <div className="px-5 py-5 bg-[#FAFAF8]" style={{ borderTop: "1px solid rgba(15,26,21,0.06)" }}>
      {/* Header */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-[28px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
          {result.value}
        </span>
        <span className="text-[11px] text-[#8A928C]" style={{ fontFamily: MONO }}>{result.unit}</span>
        <div className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: ss.bg, color: ss.text }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ss.dot }} />
          {ss.label}
        </div>
        {pct && <span className="text-[12px] text-[#8A928C]">{pct.label}</span>}
      </div>

      {/* Zone bar */}
      {result.ref_low !== null && result.ref_high !== null && (
        <div className="mb-5">
          <ZoneBar
            value={result.value}
            refLow={result.ref_low}
            refHigh={result.ref_high}
            optimalRange={optimalRange || undefined}
            unit={result.unit}
            statusColor={ss.dot}
          />
          {isNormalButSuboptimal && (
            <div className="mt-3 px-3 py-2 rounded-xl" style={{ background: "rgba(254,243,199,0.5)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <p className="text-[11px] text-[#B45309] leading-snug">
                <strong>Your lab says &quot;normal&quot;</strong> &mdash; but this value of {result.value} {result.unit} sits outside the research-supported optimal range ({optimalRange!.optimal_low}&ndash;{optimalRange!.optimal_high}).
              </p>
            </div>
          )}
        </div>
      )}

      {/* What to do */}
      {analysis.what_to_do && (
        <div className="mb-4 p-3 rounded-2xl" style={{ background: "#E8F5EE", border: "1px solid rgba(27,107,74,0.1)" }}>
          <div className="text-[10px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-1.5">What to do</div>
          <p className="text-[13px] text-[#0F1A15] leading-relaxed">{analysis.what_to_do}</p>
        </div>
      )}

      {/* What this means */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1.5">What this means</div>
        <p className="text-[13px] text-[#0F1A15] leading-relaxed">{analysis.what_it_means}</p>
      </div>

      {/* What the research shows */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1.5">
          What the research shows
          {analysis.citation_count > 0 && (
            <span className="normal-case tracking-normal font-normal text-[#1B6B4A] ml-2">
              &middot; {analysis.citation_count} studies
            </span>
          )}
        </div>
        <p className="text-[13px] text-[#0F1A15] leading-relaxed">{analysis.what_research_shows}</p>
      </div>

      {/* Related patterns */}
      {relatedPatterns.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">Related patterns</div>
          <div className="space-y-2">
            {relatedPatterns.map((p) => (
              <div key={p.id} className="p-3 rounded-xl" style={CARD_INNER}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-medium text-[#0F1A15]">{p.name}</span>
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: (SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.watch).bg, color: (SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.watch).text }}>
                    {(SEVERITY_STYLES[p.severity] || SEVERITY_STYLES.watch).label}
                  </span>
                </div>
                <p className="text-[12px] text-[#5A635D] leading-snug">{p.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Population percentile */}
      {pct && (
        <div className="p-4 rounded-2xl" style={CARD_INNER}>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium">Where you stand</div>
            <div className="text-[14px] font-semibold" style={{ fontFamily: FRAUNCES }}>{pct.label}</div>
          </div>
          <div className="relative h-2.5 rounded-full mb-2" style={{ background: "rgba(15,26,21,0.05)" }}>
            <div className="absolute top-0 h-2.5 rounded-full bg-[#1B6B4A]" style={{ width: `${pct.percentile}%`, opacity: 0.2 }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#1B6B4A] border-2 border-white" style={{ left: `calc(${pct.percentile}% - 7px)`, boxShadow: "0 2px 8px rgba(27,107,74,0.3)" }} />
          </div>
          <div className="text-[11px] text-[#5A635D] leading-snug">{pct.interpretation} Compared to 300,000+ {pct.context}.</div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ZONE BAR
// =====================================================================

function ZoneBar({
  value, refLow, refHigh, optimalRange, unit, statusColor,
}: {
  value: number; refLow: number; refHigh: number; optimalRange?: OptimalRange; unit: string | null; statusColor: string;
}) {
  const rangePadding = (refHigh - refLow) * 0.15;
  const visualMin = refLow - rangePadding;
  const visualMax = refHigh + rangePadding;
  const visualRange = visualMax - visualMin;
  const toPercent = (v: number) => Math.max(0, Math.min(100, ((v - visualMin) / visualRange) * 100));

  const refLowPct = toPercent(refLow);
  const refHighPct = toPercent(refHigh);
  const valuePct = toPercent(value);

  const hasOptimal = optimalRange && optimalRange.optimal_low !== null && optimalRange.optimal_high !== null;
  const optLowPct = hasOptimal ? toPercent(optimalRange!.optimal_low!) : 0;
  const optHighPct = hasOptimal ? toPercent(optimalRange!.optimal_high!) : 0;

  return (
    <div className="w-full">
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(15,26,21,0.04)" }}>
        <div className="absolute top-0 h-full rounded-l-full" style={{ left: 0, width: `${refLowPct}%`, background: "rgba(239,68,68,0.12)" }} />
        <div className="absolute top-0 h-full rounded-r-full" style={{ left: `${refHighPct}%`, width: `${100 - refHighPct}%`, background: "rgba(239,68,68,0.12)" }} />
        {hasOptimal && (
          <>
            <div className="absolute top-0 h-full" style={{ left: `${refLowPct}%`, width: `${Math.max(0, optLowPct - refLowPct)}%`, background: "rgba(245,158,11,0.15)" }} />
            <div className="absolute top-0 h-full" style={{ left: `${optHighPct}%`, width: `${Math.max(0, refHighPct - optHighPct)}%`, background: "rgba(245,158,11,0.15)" }} />
          </>
        )}
        {hasOptimal ? (
          <div className="absolute top-0 h-full" style={{ left: `${optLowPct}%`, width: `${optHighPct - optLowPct}%`, background: "rgba(27,107,74,0.18)" }} />
        ) : (
          <div className="absolute top-0 h-full" style={{ left: `${refLowPct}%`, width: `${refHighPct - refLowPct}%`, background: "rgba(27,107,74,0.12)" }} />
        )}
        <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ left: `calc(${valuePct}% - 7px)`, backgroundColor: statusColor, boxShadow: `0 2px 8px ${statusColor}40` }} />
      </div>
      <div className="flex justify-between items-center mt-1.5">
        <span className="text-[10px] text-[#8A928C]" style={{ fontFamily: MONO }}>{refLow}{unit ? ` ${unit}` : ""}</span>
        {hasOptimal && (
          <span className="text-[10px] text-[#1B6B4A] font-medium" style={{ fontFamily: MONO }}>
            optimal: {optimalRange!.optimal_low}&ndash;{optimalRange!.optimal_high}
          </span>
        )}
        <span className="text-[10px] text-[#8A928C]" style={{ fontFamily: MONO }}>{refHigh}{unit ? ` ${unit}` : ""}</span>
      </div>
    </div>
  );
}

// =====================================================================
// PATTERN CARD
// =====================================================================

function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.watch;

  return (
    <div className="overflow-hidden" style={{ ...CARD, borderLeft: `3px solid ${sev.border}`, transition: TRANSITION }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-[15px] font-semibold text-[#0F1A15]">{pattern.name}</h3>
              <div className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: sev.bg, color: sev.text }}>
                {sev.label}
              </div>
            </div>
            <p className="text-[13px] text-[#5A635D] leading-relaxed line-clamp-2">{pattern.summary}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A928C" strokeWidth="2" className="flex-shrink-0 mt-1" style={{ transition: TRANSITION, transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {pattern.markers_matched.map((m) => (
            <span key={m} className="text-[10px] font-medium text-[#1B6B4A] px-2 py-0.5 rounded-full" style={{ background: "rgba(232,245,238,0.7)" }}>
              {m}
            </span>
          ))}
        </div>
      </button>
      {expanded && (
        <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.3)" }}>
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">What the research shows</div>
            <p className="text-[14px] text-[#0F1A15] leading-relaxed">{pattern.detail}</p>
          </div>
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">What to consider</div>
            <p className="text-[14px] text-[#0F1A15] leading-relaxed">{pattern.what_to_do}</p>
          </div>
          <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}>
            <p className="text-[10px] text-[#8A928C] leading-relaxed" style={{ fontFamily: MONO }}>{pattern.citation}</p>
            <p className="text-[10px] text-[#8A928C] mt-2">This is educational content, not medical advice.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// INSIGHT CARD
// =====================================================================

function InsightCard({ calc, expanded, onToggle }: { calc: RiskCalculation; expanded: boolean; onToggle: () => void }) {
  const c = INSIGHT_COLORS[calc.interpretation];
  const hasValue = calc.interpretation !== "unknown";

  return (
    <div className="overflow-hidden" style={{ ...CARD, transition: TRANSITION }}
      onMouseEnter={(e) => { if (!expanded) { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; } }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      <button onClick={onToggle} className="w-full text-left px-5 py-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-[13px] font-medium text-[#5A635D] leading-snug">{calc.name}</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 flex-shrink-0" style={{ backgroundColor: c.bg, color: c.text }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
            {calc.interpretation_label}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="text-[30px] tracking-tight" style={{ fontFamily: FRAUNCES, fontWeight: 500, color: hasValue ? "#0F1A15" : "#A1A1AA" }}>
            {calc.value}
          </div>
          {calc.unit && hasValue && (
            <div className="text-[11px] text-[#8A928C]" style={{ fontFamily: MONO }}>{calc.unit}</div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.3)" }}>
          <p className="text-[13px] text-[#0F1A15] leading-relaxed mb-3">{calc.summary}</p>
          {calc.missing.length > 0 && (
            <div className="text-[11px] text-[#B45309] bg-[#FEF3C7]/60 rounded-xl px-3 py-2 mb-3">
              Missing: {calc.missing.join(", ")}
            </div>
          )}
          <div className="text-[10px] text-[#8A928C] leading-relaxed mb-2">
            <span className="font-medium text-[#5A635D]">Based on:</span> {calc.research_based_on}
          </div>
          <div className="text-[10px] text-[#8A928C] leading-relaxed mb-2" style={{ fontFamily: MONO }}>
            {calc.citation}
          </div>
          <p className="text-[10px] text-[#8A928C] leading-relaxed mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}>
            {calc.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

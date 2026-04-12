"use client";

import { AppNav } from "@/components/app-nav";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  runAllCalculations,
  type RiskCalculation,
  type BiomarkerValue,
  type UserProfile,
} from "@/lib/risk-calculations";
import { getNextTestSuggestions, type NextTestSuggestion } from "@/lib/next-tests";
import { detectPatterns, type DetectedPattern } from "@/lib/pattern-detection";
import { getDemographicOptimalRange } from "@/lib/demographic-ranges";
import { getPopulationPercentile, type PercentileResult } from "@/lib/population-percentiles";

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
  what_it_means: string;
  what_research_shows: string;
  related_patterns: string | null;
  suggested_exploration: string | null;
  citation_count: number;
  highest_evidence_grade: string | null;
  avg_study_year: number | null;
}

interface Citation {
  study_id: number;
  biomarker_result_id: number;
  relevance_rank: number;
  study: {
    pmid: string | null;
    title: string;
    authors: string[];
    journal: string;
    publication_year: number | null;
    grade_score: string | null;
  };
}

// ---------------------------------------------------------------------
// Category colors
// ---------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  inflammatory: "#F97316",
  lipid: "#F59E0B",
  cardiovascular: "#EF4444",
  metabolic: "#8B5CF6",
  liver: "#A3A3A3",
  kidney: "#0EA5E9",
  hormonal: "#EC4899",
  thyroid: "#14B8A6",
  nutritional: "#1B6B4A",
  hematology: "#DC2626",
  other: "#6B7280",
};

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string; dot: string }> = {
  optimal: { bg: "#E8F5EE", border: "#1B6B4A", text: "#1B6B4A", label: "Optimal", dot: "#1B6B4A" },
  normal: { bg: "#F4F4F5", border: "#A1A1AA", text: "#52525B", label: "In range", dot: "#71717A" },
  borderline: { bg: "#FEF3C7", border: "#F59E0B", text: "#B45309", label: "Borderline", dot: "#F59E0B" },
  out_of_range: { bg: "#FEE2E2", border: "#EF4444", text: "#B91C1C", label: "Out of range", dot: "#EF4444" },
};

// ---------------------------------------------------------------------
// Confidence scoring
// ---------------------------------------------------------------------

type ConfidenceLevel = "high" | "moderate" | "low" | "emerging";

function computeConfidence(analysis: Analysis | undefined): { level: ConfidenceLevel; label: string; color: string } {
  if (!analysis) return { level: "emerging", label: "No data", color: "#A1A1AA" };

  const citations = analysis.citation_count || 0;
  const grade = analysis.highest_evidence_grade || "";
  const isHighGrade = grade === "HIGH" || grade === "A+" || grade === "A";
  const isModGrade = isHighGrade || grade === "MODERATE" || grade === "B";

  if (citations >= 8 && isHighGrade) return { level: "high", label: "High confidence", color: "#1B6B4A" };
  if (citations >= 4 && isModGrade) return { level: "moderate", label: "Moderate confidence", color: "#B45309" };
  if (citations >= 1) return { level: "low", label: "Cited research", color: "#8A928C" };
  return { level: "emerging", label: "Clinical knowledge", color: "#71717A" };
}

const CONFIDENCE_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  high: "Supported by multiple high-grade peer-reviewed studies with strong evidence.",
  moderate: "Supported by published research of moderate quality. More evidence may refine this.",
  low: "Supported by peer-reviewed research from our corpus.",
  emerging: "Based on established medical literature and clinical guidelines.",
};

// ---------------------------------------------------------------------
// Optimal range types
// ---------------------------------------------------------------------

interface OptimalRange {
  optimal_low: number | null;
  optimal_high: number | null;
  canonical_name: string;
}

// ---------------------------------------------------------------------
// Free tier limits
// ---------------------------------------------------------------------

const FREE_TIER_MARKER_LIMIT = 10;
const FREE_TIER_CITATION_LIMIT = 3;
const FREE_TIER_RISK_CALC_LIMIT = 1;

// ---------------------------------------------------------------------
// Shared glass card styles
// ---------------------------------------------------------------------

const GLASS_CARD = {
  background: "rgba(255,255,255,0.6)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: "20px",
  boxShadow: "0 8px 32px rgba(15,26,21,0.06)",
} as const;

const GLASS_CARD_INNER = {
  background: "rgba(255,255,255,0.45)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: "16px",
  boxShadow: "0 4px 16px rgba(15,26,21,0.04)",
} as const;

const FRAUNCES = "'Fraunces', Georgia, serif";
const MONO = "'JetBrains Mono', monospace";

// ---------------------------------------------------------------------
// Paywall overlay component
// ---------------------------------------------------------------------

function PaywallOverlay({ featureName }: { featureName: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#F8F5EF]/80 to-[#F8F5EF] z-10 flex items-end justify-center pb-8">
        <div style={GLASS_CARD} className="p-6 max-w-md text-center">
          <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-3">
            Lipa Insight
          </div>
          <h3 className="text-[18px] font-semibold mb-2" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
            Unlock {featureName}
          </h3>
          <p className="text-[13px] text-[#5A635D] mb-4 leading-relaxed">
            Upgrade to Lipa Insight for the full analysis: all 100+ biomarkers, full citations, 16+ risk calculations, personalized action plan, vault, and research alerts. &euro;79/year. 30-day money-back guarantee.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-all duration-300"
          >
            Upgrade to Insight &mdash; &euro;79/year
          </a>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [results, setResults] = useState<BiomarkerResult[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [actionPlan, setActionPlan] = useState<any>(null);
  const [optimalRanges, setOptimalRanges] = useState<Record<string, OptimalRange>>({});
  const [userTier, setUserTier] = useState<"free" | "access" | "essential" | "complete">("free");
  const [expandedBiomarker, setExpandedBiomarker] = useState<number | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

  // Auth check + tier check
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setUserId(data.user.id);

        const { data: sub } = await supabase
          .from("user_subscriptions")
          .select("tier")
          .eq("user_id", data.user.id)
          .maybeSingle();

        setUserTier((sub?.tier as any) || "free");
        setLoading(false);
      }
    });
  }, [router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoadingData(true);

    const { data: resultsData } = await supabase
      .from("biomarker_results")
      .select("*")
      .eq("user_id", userId)
      .order("test_date", { ascending: false })
      .order("id", { ascending: true });

    setResults(resultsData || []);

    const { data: analysesData } = await supabase
      .from("user_analyses")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true });

    setAnalyses(analysesData || []);

    const { data: citationsData } = await supabase
      .from("analysis_citations")
      .select(`
        study_id,
        biomarker_result_id,
        relevance_rank,
        study:research_studies (
          pmid,
          title,
          authors,
          journal,
          publication_year,
          grade_score
        )
      `)
      .eq("user_id", userId)
      .order("relevance_rank", { ascending: true });

    setCitations((citationsData || []) as unknown as Citation[]);

    const { data: planData } = await supabase
      .from("action_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActionPlan(planData);

    const { data: refData } = await supabase
      .from("biomarker_reference")
      .select("canonical_name, optimal_low, optimal_high");

    if (refData) {
      const rangeMap: Record<string, OptimalRange> = {};
      for (const ref of refData) {
        rangeMap[ref.canonical_name.toLowerCase()] = ref;
      }
      setOptimalRanges(rangeMap);
    }

    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("age, sex, is_smoker, systolic_bp")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileData) {
      setProfile({
        age: profileData.age ?? undefined,
        sex: (profileData.sex as "male" | "female") ?? undefined,
        isSmoker: profileData.is_smoker ?? undefined,
        systolicBP: profileData.systolic_bp ?? undefined,
      });
    }

    setLoadingData(false);
  }, [userId]);

  async function saveProfile(next: UserProfile) {
    if (!userId) return;
    setProfile(next);
    await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        age: next.age ?? null,
        sex: next.sex ?? null,
        is_smoker: next.isSmoker ?? false,
        systolic_bp: next.systolicBP ?? null,
      },
      { onConflict: "user_id" }
    );
  }

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, fetchData]);

  // Group results by test_date
  const testDates = Array.from(new Set(results.map((r) => r.test_date))).sort((a, b) => b.localeCompare(a));
  const latestTestDate = testDates[0];
  const latestResults = results.filter((r) => r.test_date === latestTestDate);

  // Risk calculations
  const calculations = useMemo<RiskCalculation[]>(() => {
    if (latestResults.length === 0) return [];
    const bv: BiomarkerValue[] = latestResults.map((r) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));
    return runAllCalculations(bv, profile);
  }, [latestResults, profile]);

  // Cross-marker patterns
  const detectedPatterns = useMemo<DetectedPattern[]>(() => {
    if (latestResults.length === 0) return [];
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

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F8F5EF] via-[#F0EDE5] to-[#E8F5EE]/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#1B6B4A]/20 border-t-[#1B6B4A] animate-spin" />
          <div className="text-[#8A928C] text-sm">Loading your analysis...</div>
        </div>
      </div>
    );
  }

  // Category filter
  const filteredResults = selectedCategory
    ? latestResults.filter((r) => r.category === selectedCategory)
    : latestResults;

  const categories = Array.from(new Set(latestResults.map((r) => r.category)));
  const categoryCounts = Object.fromEntries(
    categories.map((c) => [c, latestResults.filter((r) => r.category === c).length])
  );

  // Status counts
  const statusCounts = {
    optimal: 0,
    normal: 0,
    borderline: 0,
    out_of_range: 0,
  };
  latestResults.forEach((r) => {
    const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
    if (analysis) {
      statusCounts[analysis.status]++;
    }
  });

  // Summary findings for the hero
  const keyFindings = latestResults
    .map((r) => {
      const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
      if (!analysis) return null;
      if (analysis.status === "out_of_range") {
        return {
          biomarker: r.biomarker,
          status: analysis.status,
          flag: analysis.flag,
          message: analysis.flag === "low"
            ? `Your ${r.biomarker.toLowerCase()} is low`
            : analysis.flag === "high"
            ? `Your ${r.biomarker.toLowerCase()} is elevated`
            : `${r.biomarker} needs attention`,
          detail: analysis.summary,
        };
      }
      if (analysis.status === "borderline") {
        return {
          biomarker: r.biomarker,
          status: analysis.status,
          flag: analysis.flag,
          message: `${r.biomarker} could use attention`,
          detail: analysis.summary,
        };
      }
      return null;
    })
    .filter(Boolean)
    .slice(0, 5);

  // Add a positive finding if there are optimal markers
  const allGood = keyFindings.length === 0 && statusCounts.optimal > 0;

  // Empty state
  if (!loadingData && results.length === 0) {
    return (
      <>
        <AppNav />
        <main className="min-h-screen bg-gradient-to-br from-[#F8F5EF] via-[#F0EDE5] to-[#E8F5EE]/30">
          <div className="max-w-5xl mx-auto px-6 py-12">
            <div className="text-center py-24">
              <div
                className="w-20 h-20 flex items-center justify-center mx-auto mb-6"
                style={{
                  ...GLASS_CARD,
                  background: "rgba(232,245,238,0.6)",
                }}
              >
                <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
                  <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" stroke="#1B6B4A" strokeWidth="1.2" />
                  <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
                </svg>
              </div>
              <h1
                className="text-3xl mb-3"
                style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
              >
                Welcome to Lipa
              </h1>
              <p className="text-[#5A635D] text-[16px] max-w-md mx-auto mb-8 leading-relaxed">
                Upload your blood test to get your first Living Research&trade; analysis. Every insight grounded in peer-reviewed research, cited and traceable.
              </p>
              <a
                href="/upload"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-8 py-3.5 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.25)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Upload Blood Test
              </a>
            </div>
          </div>
        </main>
      </>
    );
  }

  const isFree = userTier === "free";
  const visibleResults = isFree ? filteredResults.slice(0, FREE_TIER_MARKER_LIMIT) : filteredResults;
  const lockedCount = isFree ? Math.max(0, filteredResults.length - FREE_TIER_MARKER_LIMIT) : 0;
  const visibleCalculations = isFree ? calculations.slice(0, FREE_TIER_RISK_CALC_LIMIT) : calculations;
  const lockedCalcCount = isFree ? Math.max(0, calculations.length - FREE_TIER_RISK_CALC_LIMIT) : 0;

  return (
    <>
      <AppNav />
      <main className="min-h-screen bg-gradient-to-br from-[#F8F5EF] via-[#F0EDE5] to-[#E8F5EE]/30">
        <div className="max-w-6xl mx-auto px-6 py-10">

          {/* ============================================================ */}
          {/* 1. SUMMARY HERO                                              */}
          {/* ============================================================ */}
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-1">
              <h1
                className="text-[34px] tracking-tight text-[#0F1A15]"
                style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
              >
                {allGood ? "Everything looks great" : "Here's what stood out"}
              </h1>
              <div className="text-[13px] text-[#8A928C] font-mono" style={{ fontFamily: MONO }}>
                {latestTestDate ? new Date(latestTestDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
              </div>
            </div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-[14px] text-[#5A635D]">
                {latestResults.length} biomarkers &middot; Analyzed with Living Research&trade;
              </p>
              <div className="flex items-center gap-2">
                {testDates.length > 1 && (
                  <select
                    className="text-[12px] text-[#5A635D] bg-white/60 border border-white/30 rounded-lg px-3 py-1.5 backdrop-blur-sm"
                    value={latestTestDate}
                    onChange={(e) => {
                      // TODO: implement test date switching
                    }}
                  >
                    {testDates.map((d) => (
                      <option key={d} value={d}>
                        {new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => {
                    // Export as JSON for now
                    const exportData = {
                      test_date: latestTestDate,
                      biomarkers: latestResults.map((r) => {
                        const a = analyses.find((x) => x.biomarker_result_id === r.id);
                        return { name: r.biomarker, value: r.value, unit: r.unit, status: a?.status, summary: a?.summary };
                      }),
                      risk_calculations: calculations.map((c) => ({ name: c.name, value: c.value, interpretation: c.interpretation_label })),
                    };
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = `lipa-results-${latestTestDate}.json`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-[11px] font-medium text-[#5A635D] hover:text-[#1B6B4A] bg-white/60 border border-white/30 rounded-lg px-3 py-1.5 backdrop-blur-sm transition-colors flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export
                </button>
                <button
                  onClick={async () => {
                    if (!confirm("Delete this test and all its analyses? This cannot be undone.")) return;
                    if (!userId) return;
                    await supabase.from("analysis_citations").delete().eq("user_id", userId);
                    await supabase.from("user_analyses").delete().eq("user_id", userId);
                    await supabase.from("action_plans").delete().eq("user_id", userId);
                    await supabase.from("biomarker_results").delete().eq("user_id", userId).eq("test_date", latestTestDate);
                    window.location.reload();
                  }}
                  className="text-[11px] font-medium text-[#8A928C] hover:text-[#B91C1C] bg-white/60 border border-white/30 rounded-lg px-3 py-1.5 backdrop-blur-sm transition-colors flex items-center gap-1.5"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Delete
                </button>
              </div>
            </div>

            {/* Key findings cards */}
            {allGood ? (
              <div
                className="p-6 transition-all duration-300"
                style={{
                  ...GLASS_CARD,
                  background: "rgba(232,245,238,0.5)",
                  border: "1px solid rgba(27,107,74,0.15)",
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#1B6B4A]/10 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[16px] font-semibold text-[#1B6B4A] mb-0.5">All markers in a healthy range</div>
                    <p className="text-[13px] text-[#5A635D]">
                      {statusCounts.optimal} optimal, {statusCounts.normal} within normal range. Keep up what you're doing.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {keyFindings.map((f: any) => (
                  <div
                    key={f.biomarker}
                    className="p-4 transition-all duration-300 cursor-pointer hover:-translate-y-0.5"
                    style={{
                      ...GLASS_CARD,
                      background: f.status === "out_of_range"
                        ? "rgba(254,226,226,0.5)"
                        : "rgba(254,243,199,0.5)",
                      border: f.status === "out_of_range"
                        ? "1px solid rgba(185,28,28,0.15)"
                        : "1px solid rgba(180,83,9,0.15)",
                      boxShadow: "0 4px 20px rgba(15,26,21,0.04)",
                    }}
                    onClick={() => {
                      const r = latestResults.find((lr) => lr.biomarker === f.biomarker);
                      if (r) setExpandedBiomarker(r.id);
                      // scroll to biomarkers section
                      document.getElementById("biomarkers-section")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{
                          backgroundColor: f.status === "out_of_range" ? "#B91C1C" : "#B45309",
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-[#0F1A15] mb-1">{f.message}</div>
                        <p className="text-[13px] text-[#5A635D] line-clamp-2">{f.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ============================================================ */}
          {/* 2. STATUS OVERVIEW                                           */}
          {/* ============================================================ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
            <StatusCard label="Optimal" count={statusCounts.optimal} dotColor="#1B6B4A" />
            <StatusCard label="In range" count={statusCounts.normal} dotColor="#71717A" />
            <StatusCard label="Borderline" count={statusCounts.borderline} dotColor="#F59E0B" />
            <StatusCard label="Out of range" count={statusCounts.out_of_range} dotColor="#EF4444" />
          </div>

          {/* ============================================================ */}
          {/* 3. PATTERNS DETECTED (paid only)                             */}
          {/* ============================================================ */}
          {!isFree && detectedPatterns.length > 0 && (
            <div className="mb-10">
              <h2
                className="text-[22px] tracking-tight text-[#0F1A15] mb-1"
                style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
              >
                Patterns detected
              </h2>
              <p className="text-[13px] text-[#5A635D] mb-4">
                Cross-marker patterns your individual results don't show in isolation.
              </p>
              <div className="space-y-3">
                {detectedPatterns.map((pattern) => (
                  <PatternCard key={pattern.id} pattern={pattern} />
                ))}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 4. ACTION PLAN                                               */}
          {/* ============================================================ */}
          {!isFree && actionPlan && actionPlan.domains && actionPlan.domains.length > 0 && (
            <div className="mb-10">
              <h2
                className="text-[22px] tracking-tight text-[#0F1A15] mb-1"
                style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
              >
                Your Action Plan
              </h2>
              <p className="text-[13px] text-[#5A635D] mb-4">
                Personalized recommendations across six life domains, based on your markers.
              </p>

              {actionPlan.overall_summary && (
                <div
                  className="p-5 mb-4"
                  style={{
                    ...GLASS_CARD,
                    background: "rgba(232,245,238,0.5)",
                    border: "1px solid rgba(27,107,74,0.15)",
                  }}
                >
                  <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-medium mb-2">
                    Summary
                  </div>
                  <p className="text-[14px] text-[#0F1A15] leading-relaxed">
                    {actionPlan.overall_summary}
                  </p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(actionPlan.domains as any[]).map((domain: any) => (
                  <ActionPlanDomainCard key={domain.domain} domain={domain} />
                ))}
              </div>

              {actionPlan.disclaimer && (
                <p className="text-[10px] text-[#8A928C] mt-4 leading-relaxed text-center">
                  {actionPlan.disclaimer}
                </p>
              )}
            </div>
          )}

          {/* Free tier action plan teaser — blurred preview */}
          {isFree && actionPlan && actionPlan.domains && (
            <div className="mb-10 relative overflow-hidden" style={{ ...GLASS_CARD, padding: 0 }}>
              {/* Blurred preview of actual content */}
              <div className="p-6 select-none" style={{ filter: "blur(5px)", opacity: 0.6, pointerEvents: "none" }}>
                <h2 className="text-[20px] tracking-tight text-[#0F1A15] mb-3" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Your Action Plan
                </h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(actionPlan.domains as any[]).slice(0, 3).map((d: any) => (
                    <div key={d.domain} className="bg-white/50 rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-1">{d.domain}</div>
                      <div className="text-[13px] text-[#5A635D]">{d.recommendations?.length || 0} recommendations</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Overlay with CTA */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-white/40 to-white/70">
                <div className="text-center px-6">
                  <div className="text-[13px] text-[#5A635D] mb-3">
                    Your personalized action plan is ready — nutrition, supplements, sleep, movement, and more.
                  </div>
                  <a
                    href="/pricing"
                    className="inline-flex text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                    style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.2)" }}
                  >
                    See your action plan
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* 5. RISK INSIGHTS                                             */}
          {/* ============================================================ */}
          {visibleCalculations.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2
                    className="text-[22px] tracking-tight text-[#0F1A15]"
                    style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
                  >
                    Risk Insights
                  </h2>
                  <p className="text-[13px] text-[#5A635D]">
                    Peer-reviewed calculations applied to your biomarkers.
                  </p>
                </div>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="text-[12px] font-medium text-[#1B6B4A] hover:text-[#155A3D] transition-colors"
                >
                  {profile.age ? "Edit profile" : "Add age & sex"}
                </button>
              </div>

              {profileOpen && (
                <ProfileEditor
                  profile={profile}
                  onSave={async (next) => {
                    await saveProfile(next);
                    setProfileOpen(false);
                  }}
                  onCancel={() => setProfileOpen(false)}
                />
              )}

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleCalculations.map((calc) => (
                  <InsightCard
                    key={calc.id}
                    calc={calc}
                    expanded={expandedInsight === calc.id}
                    onToggle={() =>
                      setExpandedInsight(expandedInsight === calc.id ? null : calc.id)
                    }
                  />
                ))}
              </div>

              {isFree && lockedCalcCount > 0 && (
                <div className="mt-4 relative overflow-hidden" style={{ ...GLASS_CARD, padding: 0 }}>
                  {/* Blurred preview of locked calculations */}
                  <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 select-none" style={{ filter: "blur(4px)", opacity: 0.5, pointerEvents: "none" }}>
                    {["Bio-Age (KDM)", "HOMA-IR", "FIB-4 Liver"].map((name) => (
                      <div key={name} className="bg-white/50 rounded-2xl p-4">
                        <div className="text-[12px] text-[#5A635D]">{name}</div>
                        <div className="text-[22px] mt-1" style={{ fontFamily: FRAUNCES }}>—</div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                    <div className="text-center">
                      <p className="text-[13px] text-[#5A635D] mb-3">
                        {lockedCalcCount} more calculations — bio-age, insulin resistance, liver health, and more.
                      </p>
                      <a
                        href="/pricing"
                        className="inline-flex text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2.5 rounded-full transition-all duration-300"
                      >
                        See all insights
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* 6. BIOMARKERS                                                */}
          {/* ============================================================ */}
          <div id="biomarkers-section" className="mb-10">
            <h2
              className="text-[22px] tracking-tight text-[#0F1A15] mb-4"
              style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
            >
              Your Biomarkers
            </h2>

            {/* Category filter chips */}
            <div className="mb-6 flex flex-wrap gap-2">
              <FilterChip
                label="All"
                count={latestResults.length}
                active={selectedCategory === null}
                onClick={() => setSelectedCategory(null)}
              />
              {categories.map((cat) => (
                <FilterChip
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  count={categoryCounts[cat]}
                  color={CATEGORY_COLORS[cat] || "#6B7280"}
                  active={selectedCategory === cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              ))}
            </div>

            {/* Biomarker grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleResults.map((result) => {
                const analysis = analyses.find((a) => a.biomarker_result_id === result.id);
                const biomarkerCitations = citations.filter((c) => c.biomarker_result_id === result.id);
                const isExpanded = expandedBiomarker === result.id;

                return (
                  <BiomarkerCard
                    key={result.id}
                    result={result}
                    analysis={analysis}
                    citations={biomarkerCitations}
                    expanded={isExpanded}
                    onToggle={() =>
                      setExpandedBiomarker(isExpanded ? null : result.id)
                    }
                    optimalRange={(() => {
                      const demoRange = getDemographicOptimalRange(result.biomarker, profile.age, profile.sex);
                      if (demoRange) return { optimal_low: demoRange.optimal_low, optimal_high: demoRange.optimal_high, canonical_name: result.biomarker };
                      return optimalRanges[result.biomarker.toLowerCase()] || optimalRanges[(analysis?.biomarker_name || "").toLowerCase()];
                    })()}
                    isFree={isFree}
                  />
                );
              })}
            </div>
          </div>

          {/* Locked markers — blurred preview */}
          {isFree && lockedCount > 0 && (
            <div className="mb-10 relative overflow-hidden" style={{ ...GLASS_CARD, padding: 0 }}>
              {/* Show a few locked markers blurred */}
              <div className="p-6 select-none" style={{ filter: "blur(5px)", opacity: 0.5, pointerEvents: "none" }}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredResults.slice(FREE_TIER_MARKER_LIMIT, FREE_TIER_MARKER_LIMIT + 6).map((r) => {
                    const a = analyses.find((x) => x.biomarker_result_id === r.id);
                    return (
                      <div key={r.id} className="bg-white/50 rounded-2xl p-4">
                        <div className="text-[13px] font-semibold">{r.biomarker}</div>
                        <div className="text-[24px] mt-1" style={{ fontFamily: FRAUNCES }}>{r.value} <span className="text-[11px] text-[#8A928C]" style={{ fontFamily: MONO }}>{r.unit}</span></div>
                        <div className="text-[11px] text-[#5A635D] mt-1 line-clamp-1">{a?.summary || ""}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-transparent via-white/30 to-white/60">
                <div className="text-center px-6">
                  <h3 className="text-[20px] mb-2 text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                    {lockedCount} more markers analyzed
                  </h3>
                  <p className="text-[13px] text-[#5A635D] mb-4 max-w-md mx-auto">
                    Full citations, risk calculations, cross-marker patterns, and your personalized action plan.
                  </p>
                  <a
                    href="/pricing"
                    className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-all duration-300 hover:-translate-y-0.5"
                    style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.2)" }}
                  >
                    See all {filteredResults.length} markers
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 text-center pb-8">
            <a
              href="/upload"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1B6B4A] hover:text-[#155A3D] transition-colors"
            >
              Upload another blood test
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </main>
    </>
  );
}

// =====================================================================
// SUB-COMPONENTS
// =====================================================================

// ---------------------------------------------------------------------
// Status card (glassmorphic)
// ---------------------------------------------------------------------

function StatusCard({ label, count, dotColor }: { label: string; count: number; dotColor: string }) {
  return (
    <div
      className="p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        ...GLASS_CARD,
        boxShadow: count > 0 ? "0 8px 32px rgba(15,26,21,0.06)" : "0 4px 16px rgba(15,26,21,0.03)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
        <div className="text-[12px] text-[#5A635D] font-medium">{label}</div>
      </div>
      <div
        className="text-[32px] tracking-tight text-[#0F1A15]"
        style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
      >
        {count}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------

function FilterChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-1.5 text-[12px] font-medium transition-all duration-300 ${
        active
          ? "text-white shadow-sm"
          : "text-[#5A635D] hover:text-[#0F1A15]"
      }`}
      style={
        active
          ? {
              background: "#1B6B4A",
              borderRadius: "20px",
              boxShadow: "0 4px 12px rgba(27,107,74,0.25)",
            }
          : {
              ...GLASS_CARD,
              borderRadius: "20px",
              boxShadow: "0 2px 8px rgba(15,26,21,0.03)",
            }
      }
    >
      {color && !active && (
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className={active ? "text-white/70" : "text-[#8A928C]"}>{count}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// Pattern card (glassmorphic)
// ---------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  watch: { bg: "#F4F4F5", text: "#52525B", border: "#A1A1AA", label: "Watch" },
  attention: { bg: "#FEF3C7", text: "#B45309", border: "#F59E0B", label: "Needs attention" },
  urgent: { bg: "#FEE2E2", text: "#B91C1C", border: "#EF4444", label: "Urgent" },
};

function PatternCard({ pattern }: { pattern: DetectedPattern }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.watch;

  return (
    <div
      className="overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        ...GLASS_CARD,
        borderLeft: `3px solid ${sev.border}`,
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-6 py-5 transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-[15px] font-semibold text-[#0F1A15]">{pattern.name}</h3>
              <div
                className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: sev.bg, color: sev.text }}
              >
                {sev.label}
              </div>
            </div>
            <p className="text-[13px] text-[#5A635D] leading-relaxed line-clamp-2">{pattern.summary}</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#8A928C" strokeWidth="2"
            className={`transition-transform duration-300 flex-shrink-0 mt-1 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {pattern.markers_matched.map((m) => (
            <span
              key={m}
              className="text-[10px] font-medium text-[#1B6B4A] px-2 py-0.5 rounded-full"
              style={{ background: "rgba(232,245,238,0.7)" }}
            >
              {m}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="px-6 py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.3)" }}>
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">What the research shows</div>
            <p className="text-[14px] text-[#0F1A15] leading-relaxed">{pattern.detail}</p>
          </div>
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">What to consider</div>
            <p className="text-[14px] text-[#0F1A15] leading-relaxed">{pattern.what_to_do}</p>
          </div>
          <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}>
            <p className="text-[10px] text-[#8A928C] font-mono leading-relaxed" style={{ fontFamily: MONO }}>{pattern.citation}</p>
            <p className="text-[10px] text-[#8A928C] mt-2">This is educational content, not medical advice.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Action plan domain card
// ---------------------------------------------------------------------

const DOMAIN_LABELS: Record<string, string> = {
  nutrition: "Nutrition",
  supplementation: "Supplementation research",
  sleep: "Sleep",
  movement: "Movement",
  environment: "Environment",
  lifestyle: "Lifestyle",
};

const DOMAIN_ICONS: Record<string, string> = {
  nutrition: "N",
  supplementation: "S",
  sleep: "Z",
  movement: "M",
  environment: "E",
  lifestyle: "L",
};

function ActionPlanDomainCard({ domain }: { domain: any }) {
  const label = DOMAIN_LABELS[domain.domain] || domain.domain;
  const icon = DOMAIN_ICONS[domain.domain] || "?";
  const [expanded, setExpanded] = useState(false);
  const recs = domain.recommendations || [];

  if (recs.length === 0) return null;

  return (
    <div
      className="overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={GLASS_CARD}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-semibold text-[#1B6B4A]"
              style={{ background: "rgba(232,245,238,0.7)" }}
            >
              {icon}
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#0F1A15]">
                {label}
              </div>
              <div className="text-[12px] text-[#8A928C]">
                {recs.length} recommendation{recs.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#8A928C" strokeWidth="2"
            className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.3)" }}>
          <div className="space-y-5">
            {recs.map((rec: any, i: number) => (
              <div key={i} className="pb-4 last:pb-0" style={{ borderBottom: i < recs.length - 1 ? "1px solid rgba(255,255,255,0.4)" : "none" }}>
                <p className="text-[14px] font-medium text-[#0F1A15] leading-relaxed mb-1">
                  {rec.text}
                </p>
                <p className="text-[12px] text-[#5A635D] leading-relaxed mb-2">
                  {rec.research_basis}
                </p>

                {rec.details && (
                  <div className="p-4 mt-3 space-y-3" style={GLASS_CARD_INNER}>
                    {rec.details.dosage_range && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Dosage range (from research)</div>
                        <p className="text-[12px] text-[#0F1A15] leading-relaxed">{rec.details.dosage_range}</p>
                      </div>
                    )}
                    {rec.details.best_form && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Best-studied form</div>
                        <p className="text-[12px] text-[#0F1A15] leading-relaxed">{rec.details.best_form}</p>
                      </div>
                    )}
                    {rec.details.timing && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">When to take</div>
                        <p className="text-[12px] text-[#0F1A15] leading-relaxed">{rec.details.timing}</p>
                      </div>
                    )}
                    {rec.details.food_sources && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Food sources</div>
                        <p className="text-[12px] text-[#0F1A15] leading-relaxed">{rec.details.food_sources}</p>
                      </div>
                    )}
                    {rec.details.interactions && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#B45309] font-medium mb-1">Interactions &amp; cautions</div>
                        <p className="text-[12px] text-[#0F1A15] leading-relaxed">{rec.details.interactions}</p>
                      </div>
                    )}
                    {rec.details.important_notes && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#8A928C] font-medium mb-1">Good to know</div>
                        <p className="text-[12px] text-[#0F1A15] leading-relaxed">{rec.details.important_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {rec.markers_addressed && rec.markers_addressed.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {rec.markers_addressed.map((m: string) => (
                      <span
                        key={m}
                        className="text-[10px] font-medium text-[#1B6B4A] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(232,245,238,0.7)" }}
                      >
                        {m}
                      </span>
                    ))}
                    {rec.cited_studies && (
                      <span className="text-[10px] text-[#8A928C] px-2 py-0.5">
                        {rec.cited_studies} studies
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Insight card (risk calculations, glassmorphic)
// ---------------------------------------------------------------------

const INSIGHT_COLORS: Record<RiskCalculation["interpretation"], { bg: string; text: string; dot: string }> = {
  optimal: { bg: "#E8F5EE", text: "#1B6B4A", dot: "#1B6B4A" },
  favorable: { bg: "#E8F5EE", text: "#1B6B4A", dot: "#1B6B4A" },
  moderate: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  elevated: { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" },
  high: { bg: "#FEE2E2", text: "#B91C1C", dot: "#EF4444" },
  unknown: { bg: "#F4F4F5", text: "#71717A", dot: "#A1A1AA" },
};

function InsightCard({
  calc,
  expanded,
  onToggle,
}: {
  calc: RiskCalculation;
  expanded: boolean;
  onToggle: () => void;
}) {
  const c = INSIGHT_COLORS[calc.interpretation];
  const hasValue = calc.interpretation !== "unknown";

  return (
    <div
      className="overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={GLASS_CARD}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="text-[13px] font-medium text-[#5A635D] leading-snug">{calc.name}</div>
          <div
            className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 flex-shrink-0"
            style={{ backgroundColor: c.bg, color: c.text }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
            {calc.interpretation_label}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div
            className="text-[30px] tracking-tight"
            style={{ fontFamily: FRAUNCES, fontWeight: 500, color: hasValue ? "#0F1A15" : "#A1A1AA" }}
          >
            {calc.value}
          </div>
          {calc.unit && hasValue && (
            <div className="text-[11px] text-[#8A928C] font-mono" style={{ fontFamily: MONO }}>{calc.unit}</div>
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
          <div className="text-[10px] text-[#8A928C] leading-relaxed mb-2 font-mono" style={{ fontFamily: MONO }}>
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

// ---------------------------------------------------------------------
// Profile editor (glassmorphic)
// ---------------------------------------------------------------------

function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: UserProfile;
  onSave: (p: UserProfile) => void;
  onCancel: () => void;
}) {
  const [age, setAge] = useState<string>(profile.age ? String(profile.age) : "");
  const [sex, setSex] = useState<"" | "male" | "female">(profile.sex || "");
  const [smoker, setSmoker] = useState<boolean>(profile.isSmoker || false);
  const [sbp, setSbp] = useState<string>(profile.systolicBP ? String(profile.systolicBP) : "");

  return (
    <div className="p-5 mb-4" style={GLASS_CARD}>
      <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-3">
        Your profile
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[11px] text-[#5A635D] block mb-1">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full text-[13px] bg-white/50 border border-white/30 rounded-xl px-3 py-2 focus:outline-none focus:border-[#1B6B4A]/50 focus:ring-1 focus:ring-[#1B6B4A]/20 transition-all"
            placeholder="e.g. 42"
          />
        </div>
        <div>
          <label className="text-[11px] text-[#5A635D] block mb-1">Sex</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as "" | "male" | "female")}
            className="w-full text-[13px] bg-white/50 border border-white/30 rounded-xl px-3 py-2 focus:outline-none focus:border-[#1B6B4A]/50 focus:ring-1 focus:ring-[#1B6B4A]/20 transition-all"
          >
            <option value="">&mdash;</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-[#5A635D] block mb-1">Systolic BP</label>
          <input
            type="number"
            value={sbp}
            onChange={(e) => setSbp(e.target.value)}
            className="w-full text-[13px] bg-white/50 border border-white/30 rounded-xl px-3 py-2 focus:outline-none focus:border-[#1B6B4A]/50 focus:ring-1 focus:ring-[#1B6B4A]/20 transition-all"
            placeholder="e.g. 120"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-[13px] text-[#0F1A15] cursor-pointer">
            <input
              type="checkbox"
              checked={smoker}
              onChange={(e) => setSmoker(e.target.checked)}
              className="rounded"
            />
            Smoker
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-[12px] text-[#5A635D] hover:text-[#0F1A15] px-4 py-2 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() =>
            onSave({
              age: age ? parseInt(age, 10) : undefined,
              sex: sex || undefined,
              isSmoker: smoker,
              systolicBP: sbp ? parseInt(sbp, 10) : undefined,
            })
          }
          className="text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] rounded-full px-5 py-2 transition-all duration-300"
        >
          Save
        </button>
      </div>
      <p className="text-[10px] text-[#8A928C] mt-3 leading-relaxed">
        Used only for risk calculations (SCORE2, FIB-4, bio-age). Never shared.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Biomarker card (glassmorphic compact card with arc gauge)
// ---------------------------------------------------------------------

function ArcGauge({ value, low, high, statusColor, size = 52 }: { value: number; low: number; high: number; statusColor: string; size?: number }) {
  // Position of value within reference range, clamped 0-100
  const pct = Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
  // Arc goes from -135deg to +135deg (270 degree sweep)
  const angleDeg = -135 + (pct / 100) * 270;
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // Arc path for the track
  const startAngle = -135;
  const endAngle = 135;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const arcPath = (start: number, end: number) => {
    const s = toRad(start);
    const e = toRad(end);
    const x1 = cx + r * Math.cos(s);
    const y1 = cy + r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy + r * Math.sin(e);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Indicator dot position
  const indicatorAngle = toRad(angleDeg);
  const dotX = cx + r * Math.cos(indicatorAngle);
  const dotY = cy + r * Math.sin(indicatorAngle);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke="rgba(15,26,21,0.07)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* Filled portion */}
      <path
        d={arcPath(startAngle, angleDeg)}
        fill="none"
        stroke={statusColor}
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.4"
      />
      {/* Dot */}
      <circle cx={dotX} cy={dotY} r="4" fill={statusColor} />
      <circle cx={dotX} cy={dotY} r="2" fill="white" />
    </svg>
  );
}

function BiomarkerCard({
  result,
  analysis,
  citations,
  expanded,
  onToggle,
  optimalRange,
  isFree,
}: {
  result: BiomarkerResult;
  analysis: Analysis | undefined;
  citations: Citation[];
  expanded: boolean;
  onToggle: () => void;
  optimalRange?: OptimalRange;
  isFree?: boolean;
}) {
  const status = analysis?.status || "normal";
  const statusStyle = STATUS_STYLES[status];
  const confidence = computeConfidence(analysis);

  const rangePosition =
    result.ref_low !== null && result.ref_high !== null
      ? Math.max(
          0,
          Math.min(100, ((result.value - result.ref_low) / (result.ref_high - result.ref_low)) * 100)
        )
      : 50;

  const isNormalButSuboptimal =
    optimalRange &&
    optimalRange.optimal_low !== null &&
    optimalRange.optimal_high !== null &&
    status === "normal" &&
    (result.value < optimalRange.optimal_low || result.value > optimalRange.optimal_high);

  const [citationsOpen, setCitationsOpen] = useState(false);

  return (
    <div
      className={`overflow-hidden transition-all duration-300 ${expanded ? "sm:col-span-2 lg:col-span-3" : "hover:-translate-y-0.5"}`}
      style={{
        ...GLASS_CARD,
        boxShadow: expanded ? "0 12px 40px rgba(15,26,21,0.08)" : "0 8px 32px rgba(15,26,21,0.06)",
      }}
    >
      {/* COMPACT CARD VIEW */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 transition-colors"
      >
        <div className="flex items-start gap-3">
          {/* Arc gauge */}
          {result.ref_low !== null && result.ref_high !== null ? (
            <div className="flex-shrink-0 mt-0.5">
              <ArcGauge
                value={result.value}
                low={result.ref_low}
                high={result.ref_high}
                statusColor={statusStyle.dot}
                size={48}
              />
            </div>
          ) : (
            <div
              className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center"
              style={{ background: `${statusStyle.bg}` }}
            >
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Name */}
            <div className="text-[15px] font-semibold text-[#0F1A15] mb-1 truncate">
              {result.biomarker}
            </div>

            {/* Big number + unit */}
            <div className="flex items-baseline gap-1">
              <span
                className="text-[28px] tracking-tight text-[#0F1A15]"
                style={{ fontFamily: FRAUNCES, fontWeight: 500 }}
              >
                {result.value}
              </span>
              <span
                className="text-[11px] text-[#8A928C]"
                style={{ fontFamily: MONO }}
              >
                {result.unit}
              </span>
            </div>

            {/* Status pill + summary */}
            <div className="flex items-center gap-2 mt-1.5">
              <div
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
                {statusStyle.label}
              </div>
            </div>
            {analysis?.summary && (
              <p className="text-[12px] text-[#5A635D] mt-1.5 line-clamp-1 leading-snug">{analysis.summary}</p>
            )}
          </div>

          {/* Expand chevron */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#8A928C" strokeWidth="2"
            className={`flex-shrink-0 mt-1 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* EXPANDED DETAIL PANEL */}
      {expanded && analysis && (
        <div className="px-5 py-5" style={{ borderTop: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.35)" }}>

          {/* Range visualization */}
          {result.ref_low !== null && result.ref_high !== null && (
            <div className="mb-5">
              <div className="relative h-2.5 rounded-full" style={{ background: "rgba(15,26,21,0.05)" }}>
                {/* Lab reference range */}
                <div
                  className="absolute top-0 h-2.5 rounded-full"
                  style={{ left: "5%", right: "5%", backgroundColor: "rgba(15,26,21,0.06)" }}
                />
                {/* Optimal range overlay */}
                {optimalRange && optimalRange.optimal_low !== null && optimalRange.optimal_high !== null && (
                  <div
                    className="absolute top-0 h-2.5 rounded-full"
                    style={{
                      left: `${Math.max(5, ((optimalRange.optimal_low - result.ref_low) / (result.ref_high - result.ref_low)) * 90 + 5)}%`,
                      right: `${Math.max(5, 95 - ((optimalRange.optimal_high - result.ref_low) / (result.ref_high - result.ref_low)) * 90 + 5)}%`,
                      backgroundColor: "rgba(27, 107, 74, 0.15)",
                      border: "1px solid rgba(27, 107, 74, 0.25)",
                    }}
                    title={`Optimal range: ${optimalRange.optimal_low}–${optimalRange.optimal_high} ${result.unit || ""}`}
                  />
                )}
                {/* Value marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white"
                  style={{
                    left: `calc(${Math.max(0, Math.min(100, rangePosition))}% - 8px)`,
                    backgroundColor: statusStyle.dot,
                    boxShadow: `0 2px 8px ${statusStyle.dot}40`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#8A928C] mt-1.5 font-mono" style={{ fontFamily: MONO }}>
                <span>{result.ref_low} {result.unit}</span>
                {optimalRange && optimalRange.optimal_low !== null && optimalRange.optimal_high !== null && (
                  <span className="text-[#1B6B4A] font-medium">
                    optimal: {optimalRange.optimal_low}–{optimalRange.optimal_high}
                  </span>
                )}
                <span>{result.ref_high} {result.unit}</span>
              </div>

              {isNormalButSuboptimal && (
                <div
                  className="mt-2.5 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(254,243,199,0.5)", border: "1px solid rgba(245,158,11,0.15)" }}
                >
                  <p className="text-[11px] text-[#B45309] leading-snug">
                    <strong>Your lab says &quot;normal&quot;</strong> &mdash; but your value of {result.value} {result.unit} sits outside the research-supported optimal range ({optimalRange!.optimal_low}–{optimalRange!.optimal_high}). The research suggests this may be worth attention.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Population percentile */}
          {(() => {
            const pct = getPopulationPercentile(result.biomarker, result.value, undefined, undefined);
            if (!pct) return null;
            return (
              <div className="mb-5 p-4" style={GLASS_CARD_INNER}>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium">Where you stand</div>
                  <div
                    className="text-[14px] font-semibold"
                    style={{ fontFamily: FRAUNCES }}
                  >
                    {pct.label}
                  </div>
                </div>
                <div className="relative h-2.5 rounded-full mb-2" style={{ background: "rgba(15,26,21,0.05)" }}>
                  <div
                    className="absolute top-0 h-2.5 rounded-full bg-[#1B6B4A]"
                    style={{ width: `${pct.percentile}%`, opacity: 0.2 }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#1B6B4A] border-2 border-white"
                    style={{ left: `calc(${pct.percentile}% - 7px)`, boxShadow: "0 2px 8px rgba(27,107,74,0.3)" }}
                  />
                </div>
                <div className="text-[11px] text-[#5A635D] leading-snug">
                  {pct.interpretation} Compared to 300,000+ {pct.context}.
                </div>
              </div>
            );
          })()}

          {/* What this means */}
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">
              What this means
            </div>
            <p className="text-[14px] text-[#0F1A15] leading-relaxed">{analysis.what_it_means}</p>
          </div>

          {/* What the research shows */}
          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2 flex items-center gap-2">
              What the research shows
              {analysis.citation_count > 0 && (
                <span className="normal-case tracking-normal font-normal text-[#1B6B4A]">
                  &middot; {analysis.citation_count} studies cited
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#0F1A15] leading-relaxed">{analysis.what_research_shows}</p>
          </div>

          {/* Related patterns */}
          {analysis.related_patterns && (
            <div className="mb-5">
              <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">
                Related patterns
              </div>
              <p className="text-[14px] text-[#0F1A15] leading-relaxed">{analysis.related_patterns}</p>
            </div>
          )}

          {/* Suggested exploration */}
          {analysis.suggested_exploration && (
            <div className="mb-5">
              <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-2">
                Explore further
              </div>
              <p className="text-[14px] text-[#0F1A15] leading-relaxed">{analysis.suggested_exploration}</p>
            </div>
          )}

          {/* What to test next */}
          {(() => {
            const nextTests = getNextTestSuggestions(result.biomarker, status);
            if (nextTests.length === 0) return null;
            return (
              <div className="mb-5">
                <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-medium mb-2">
                  What to test next
                </div>
                <div className="space-y-2">
                  {nextTests.slice(0, 4).map((t) => (
                    <div key={t.test_name} className="p-3" style={GLASS_CARD_INNER}>
                      <div className="text-[13px] font-medium text-[#0F1A15] mb-1">{t.test_name}</div>
                      <div className="text-[11px] text-[#5A635D] leading-snug">{t.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Citations — collapsed by default */}
          {citations.length > 0 && (
            <div className="mb-5">
              <button
                onClick={(e) => { e.stopPropagation(); setCitationsOpen(!citationsOpen); }}
                className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-3 hover:text-[#5A635D] transition-colors"
              >
                Studies cited ({citations.length})
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  className={`transition-transform duration-300 ${citationsOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {citationsOpen && (
                <div className="space-y-2">
                  {citations.slice(0, isFree ? FREE_TIER_CITATION_LIMIT : 5).map((c) => (
                    <a
                      key={c.study_id}
                      href={c.study.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${c.study.pmid}/` : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 transition-all duration-300 hover:-translate-y-0.5"
                      style={GLASS_CARD_INNER}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="text-[12px] font-medium text-[#0F1A15] leading-snug line-clamp-2">
                          {c.study.title}
                        </div>
                        {c.study.grade_score && (
                          <div className="text-[9px] uppercase font-semibold text-[#1B6B4A] bg-[#E8F5EE]/70 px-1.5 py-0.5 rounded flex-shrink-0">
                            {c.study.grade_score}
                          </div>
                        )}
                      </div>
                      <div className="text-[11px] text-[#8A928C] font-mono" style={{ fontFamily: MONO }}>
                        {c.study.authors && c.study.authors.length > 0 && c.study.authors[0].split(" ").pop()} et al.
                        {c.study.publication_year && ` \u00b7 ${c.study.publication_year}`}
                        {c.study.journal && ` \u00b7 ${c.study.journal}`}
                      </div>
                    </a>
                  ))}
                  {citations.length > 5 && (
                    <div className="text-[11px] text-[#8A928C] mt-2 text-center">
                      +{citations.length - 5} more studies cited
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confidence + metadata */}
          <div className="pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.3)" }}>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${confidence.color}15`, color: confidence.color, border: `1px solid ${confidence.color}30` }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidence.color }} />
                {confidence.label}
              </div>
              <span className="text-[10px] text-[#8A928C] font-mono" style={{ fontFamily: MONO }}>
                {analysis.citation_count} studies cited
                {analysis.highest_evidence_grade && ` \u00b7 highest: ${analysis.highest_evidence_grade}`}
                {analysis.avg_study_year && ` \u00b7 avg year: ${analysis.avg_study_year}`}
              </span>
            </div>
            <p className="text-[10px] text-[#8A928C] leading-relaxed mb-1">
              {CONFIDENCE_DESCRIPTIONS[confidence.level]}
            </p>
            <p className="text-[10px] text-[#8A928C] leading-relaxed">
              This analysis is educational content, not medical advice. Consult your healthcare provider before making any health decisions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

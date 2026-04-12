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
  inflammatory: "#F97316", // orange
  lipid: "#F59E0B",        // amber
  cardiovascular: "#EF4444", // red
  metabolic: "#8B5CF6",    // purple
  liver: "#A3A3A3",        // gray
  kidney: "#0EA5E9",       // sky
  hormonal: "#EC4899",     // pink
  thyroid: "#14B8A6",      // teal
  nutritional: "#1B6B4A",  // lipa green
  hematology: "#DC2626",   // red-dark
  other: "#6B7280",        // gray
};

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; label: string; dot: string }> = {
  optimal: { bg: "#E8F5EE", border: "#1B6B4A", text: "#1B6B4A", label: "Optimal", dot: "#1B6B4A" },
  normal: { bg: "#F4F4F5", border: "#A1A1AA", text: "#52525B", label: "In range", dot: "#71717A" },
  borderline: { bg: "#FEF3C7", border: "#F59E0B", text: "#B45309", label: "Borderline", dot: "#F59E0B" },
  out_of_range: { bg: "#FEE2E2", border: "#EF4444", text: "#B91C1C", label: "Out of range", dot: "#EF4444" },
};

// ---------------------------------------------------------------------
// Confidence scoring (computed client-side from existing analysis fields)
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
  if (citations >= 2) return { level: "low", label: "Low confidence", color: "#8A928C" };
  return { level: "emerging", label: "Emerging research", color: "#A1A1AA" };
}

const CONFIDENCE_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  high: "Supported by multiple high-grade peer-reviewed studies with strong evidence.",
  moderate: "Supported by published research of moderate quality. More evidence may refine this.",
  low: "Limited peer-reviewed research available for this specific marker value.",
  emerging: "Very limited or no directly relevant research in our corpus for this marker.",
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
// Free tier limits (Lipa Taste)
// ---------------------------------------------------------------------

const FREE_TIER_MARKER_LIMIT = 10;
const FREE_TIER_CITATION_LIMIT = 3;
const FREE_TIER_RISK_CALC_LIMIT = 1; // Only SCORE2

// ---------------------------------------------------------------------
// Paywall overlay component
// ---------------------------------------------------------------------

function PaywallOverlay({ featureName }: { featureName: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white z-10 flex items-end justify-center pb-8">
        <div className="bg-white border border-[#E5E5E5] rounded-2xl p-6 shadow-lg max-w-md text-center">
          <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-3">
            Lipa Insight
          </div>
          <h3 className="text-[18px] font-semibold mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
            Unlock {featureName}
          </h3>
          <p className="text-[13px] text-[#6B6B6B] mb-4 leading-relaxed">
            Upgrade to Lipa Insight for the full analysis: all 100+ biomarkers, full citations, 16+ risk calculations, personalized action plan, vault, and research alerts. €79/year. 30-day money-back guarantee.
          </p>
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-colors"
          >
            Upgrade to Insight — €79/year
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

        // Check subscription tier
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

    // Fetch biomarker results (most recent test first)
    const { data: resultsData } = await supabase
      .from("biomarker_results")
      .select("*")
      .eq("user_id", userId)
      .order("test_date", { ascending: false })
      .order("id", { ascending: true });

    setResults(resultsData || []);

    // Fetch analyses
    const { data: analysesData } = await supabase
      .from("user_analyses")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true });

    setAnalyses(analysesData || []);

    // Fetch citations with joined study info
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

    // Fetch action plan (most recent)
    const { data: planData } = await supabase
      .from("action_plans")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActionPlan(planData);

    // Fetch optimal ranges from biomarker_reference
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

    // Fetch profile (for risk calculations)
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

  // Group results by test_date (computed before any early return to keep hook order stable)
  const testDates = Array.from(new Set(results.map((r) => r.test_date))).sort((a, b) => b.localeCompare(a));
  const latestTestDate = testDates[0];
  const latestResults = results.filter((r) => r.test_date === latestTestDate);

  // Run risk calculations on latest results
  const calculations = useMemo<RiskCalculation[]>(() => {
    if (latestResults.length === 0) return [];
    const bv: BiomarkerValue[] = latestResults.map((r) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));
    return runAllCalculations(bv, profile);
  }, [latestResults, profile]);

  // Detect cross-marker patterns
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[#999] text-sm">Loading...</div>
      </div>
    );
  }

  // Apply category filter
  const filteredResults = selectedCategory
    ? latestResults.filter((r) => r.category === selectedCategory)
    : latestResults;

  // Category counts
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

  // Empty state
  if (!loadingData && results.length === 0) {
    return (
      <>
        <AppNav />
        <main className="max-w-5xl mx-auto px-6 py-12">
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-[#1B6B4A]/[0.08] rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
                <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" stroke="#1B6B4A" strokeWidth="1.2" />
                <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold mb-3">Welcome to Lipa</h1>
            <p className="text-[#6B6B6B] text-[16px] max-w-md mx-auto mb-8">
              Upload your blood test to get your first Living Research™ analysis. Every insight grounded in peer-reviewed research, cited and traceable.
            </p>
            <a
              href="/upload"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-3 rounded-full transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload Blood Test
            </a>
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
      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-baseline justify-between mb-2">
            <h1 className="text-[32px] font-serif tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>Your Analysis</h1>
            <div className="text-[13px] text-[#999]">
              Test: {latestTestDate ? new Date(latestTestDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
            </div>
          </div>
          <p className="text-[14px] text-[#6B6B6B]">
            {latestResults.length} biomarkers · Analyzed with Living Research™
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-10">
          <SummaryCard label="Optimal" count={statusCounts.optimal} color="#1B6B4A" />
          <SummaryCard label="In range" count={statusCounts.normal} color="#71717A" />
          <SummaryCard label="Borderline" count={statusCounts.borderline} color="#F59E0B" />
          <SummaryCard label="Out of range" count={statusCounts.out_of_range} color="#EF4444" />
        </div>

        {/* Cross-marker patterns detected (paid only) */}
        {!isFree && detectedPatterns.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[20px] tracking-tight mb-1" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>Patterns detected</h2>
            <p className="text-[12px] text-[#6B6B6B] mb-4">
              Cross-marker patterns your individual results don&apos;t show in isolation.
            </p>
            <div className="space-y-3">
              {detectedPatterns.map((pattern) => (
                <PatternCard key={pattern.id} pattern={pattern} />
              ))}
            </div>
          </div>
        )}

        {/* Lipa Insights — risk calculations */}
        {visibleCalculations.length > 0 && (
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>Lipa Insights</h2>
                <p className="text-[12px] text-[#6B6B6B]">
                  Peer-reviewed calculations applied to your biomarkers. Educational, not diagnostic.
                </p>
              </div>
              <button
                onClick={() => setProfileOpen((v) => !v)}
                className="text-[11px] font-medium text-[#1B6B4A] hover:underline"
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
              <div className="mt-4 bg-[#FEF3C7] border border-[#F59E0B]/20 rounded-2xl p-5 text-center">
                <p className="text-[13px] text-[#B45309] mb-3">
                  <strong>{lockedCalcCount} more risk calculations</strong> available with Lipa Insight — including bio-age, HOMA-IR, FIB-4, and more.
                </p>
                <a href="/pricing" className="inline-flex text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2 rounded-full transition-colors">
                  Upgrade — €79/year
                </a>
              </div>
            )}
          </div>
        )}

        {/* Action Plan (paid only) */}
        {!isFree && actionPlan && actionPlan.domains && actionPlan.domains.length > 0 && (
          <div className="mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <h2 className="text-[20px] tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>Your Action Plan</h2>
                <p className="text-[12px] text-[#6B6B6B]">
                  Personalized recommendations across six life domains, based on your markers.
                </p>
              </div>
            </div>

            {actionPlan.overall_summary && (
              <div className="bg-[#E8F5EE] border border-[#1B6B4A]/20 rounded-2xl p-5 mb-4">
                <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-medium mb-2">
                  Summary
                </div>
                <p className="text-[14px] text-[#2A2A2A] leading-relaxed">
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
              <p className="text-[10px] text-[#999] mt-4 leading-relaxed text-center">
                {actionPlan.disclaimer}
              </p>
            )}
          </div>
        )}

        {/* Category filter */}
        <div className="mb-8 flex flex-wrap gap-2">
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

        {/* Biomarker list */}
        <div className="space-y-3">
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
                optimalRange={optimalRanges[result.biomarker.toLowerCase()] || optimalRanges[(analysis?.biomarker_name || "").toLowerCase()]}
                isFree={isFree}
              />
            );
          })}
        </div>

        {/* Locked markers paywall (free tier) */}
        {isFree && lockedCount > 0 && (
          <div className="mt-6 bg-white border border-[#E5E5E5] rounded-2xl p-8 text-center">
            <h3 className="text-[20px] mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
              {lockedCount} more markers analyzed
            </h3>
            <p className="text-[14px] text-[#6B6B6B] mb-2 max-w-lg mx-auto leading-relaxed">
              Your full panel has {filteredResults.length} markers. Upgrade to Lipa Insight to see every marker with full citations, optimal vs normal ranges, confidence scores, cross-marker patterns, and your personalized action plan.
            </p>
            <p className="text-[12px] text-[#999] mb-5">
              Plus: 16+ risk calculations · permanent vault · year-over-year trending · research alerts
            </p>
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-8 py-3 rounded-full transition-colors"
            >
              Unlock everything — €79/year
            </a>
            <p className="text-[11px] text-[#999] mt-3">30-day money-back guarantee</p>
          </div>
        )}

        {/* Free tier action plan teaser */}
        {isFree && actionPlan && (
          <div className="mt-6 bg-[#E8F5EE] border border-[#1B6B4A]/15 rounded-2xl p-6 text-center">
            <h3 className="text-[16px] font-semibold text-[#1B6B4A] mb-2">Your personalized action plan is ready</h3>
            <p className="text-[13px] text-[#2A2A2A] mb-4 max-w-md mx-auto">
              Lipa generated a personalized action plan across nutrition, supplementation, sleep, movement, environment, and lifestyle — with specific dosages, timing, food sources, and interactions. Upgrade to see it.
            </p>
            <a
              href="/pricing"
              className="inline-flex text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-5 py-2 rounded-full transition-colors"
            >
              See your action plan — Upgrade
            </a>
          </div>
        )}

        {/* Footer action */}
        <div className="mt-12 text-center">
          <a
            href="/upload"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1B6B4A] hover:text-[#155A3D]"
          >
            Upload another blood test →
          </a>
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------
// Summary card component
// ---------------------------------------------------------------------

function SummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <div className="text-[12px] text-[#6B6B6B] font-medium">{label}</div>
      </div>
      <div className="text-[28px] font-semibold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>{count}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Filter chip component
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
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
        active
          ? "bg-[#1B6B4A] text-white"
          : "bg-white border border-[#E5E5E5] text-[#6B6B6B] hover:border-[#1B6B4A]/30"
      }`}
    >
      {color && !active && (
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {label}
      <span className={active ? "text-white/70" : "text-[#999]"}>{count}</span>
    </button>
  );
}

// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// Pattern card (cross-marker detection)
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
      className="bg-white border rounded-2xl overflow-hidden"
      style={{ borderColor: sev.border, borderLeftWidth: "3px" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-6 py-5 hover:bg-[#FAFAF8] transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-[15px] font-semibold">{pattern.name}</h3>
              <div
                className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: sev.bg, color: sev.text }}
              >
                {sev.label}
              </div>
            </div>
            <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{pattern.summary}</p>
          </div>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#999" strokeWidth="2"
            className={`transition-transform flex-shrink-0 mt-1 ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {pattern.markers_matched.map((m) => (
            <span key={m} className="text-[10px] font-medium text-[#1B6B4A] bg-[#E8F5EE] px-2 py-0.5 rounded-full">
              {m}
            </span>
          ))}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#F4F4F5] px-6 py-5 bg-[#FAFAF8]">
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2">What the research shows</div>
            <p className="text-[14px] text-[#2A2A2A] leading-relaxed">{pattern.detail}</p>
          </div>
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2">What to consider</div>
            <p className="text-[14px] text-[#2A2A2A] leading-relaxed">{pattern.what_to_do}</p>
          </div>
          <div className="pt-3 border-t border-[#F4F4F5]">
            <p className="text-[10px] text-[#999] font-mono leading-relaxed">{pattern.citation}</p>
            <p className="text-[10px] text-[#999] mt-2">This is educational content, not medical advice.</p>
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

function ActionPlanDomainCard({ domain }: { domain: any }) {
  const label = DOMAIN_LABELS[domain.domain] || domain.domain;
  const [expanded, setExpanded] = useState(false);
  const recs = domain.recommendations || [];

  if (recs.length === 0) return null;

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 hover:bg-[#FAFAF8] transition-colors"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-semibold mb-1">
              {label}
            </div>
            <div className="text-[13px] text-[#6B6B6B]">
              {recs.length} recommendation{recs.length !== 1 ? "s" : ""}
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#999"
            strokeWidth="2"
            className={`transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#F4F4F5] px-5 py-4 bg-[#FAFAF8]">
          <div className="space-y-5">
            {recs.map((rec: any, i: number) => (
              <div key={i} className="pb-4 border-b border-[#F4F4F5] last:border-b-0 last:pb-0">
                <p className="text-[14px] font-medium text-[#2A2A2A] leading-relaxed mb-1">
                  {rec.text}
                </p>
                <p className="text-[12px] text-[#6B6B6B] leading-relaxed mb-2">
                  {rec.research_basis}
                </p>

                {rec.details && (
                  <div className="bg-white border border-[#E5E5E5] rounded-xl p-4 mt-3 space-y-3">
                    {rec.details.dosage_range && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#999] font-medium mb-1">Dosage range (from research)</div>
                        <p className="text-[12px] text-[#2A2A2A] leading-relaxed">{rec.details.dosage_range}</p>
                      </div>
                    )}
                    {rec.details.best_form && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#999] font-medium mb-1">Best-studied form</div>
                        <p className="text-[12px] text-[#2A2A2A] leading-relaxed">{rec.details.best_form}</p>
                      </div>
                    )}
                    {rec.details.timing && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#999] font-medium mb-1">When to take</div>
                        <p className="text-[12px] text-[#2A2A2A] leading-relaxed">{rec.details.timing}</p>
                      </div>
                    )}
                    {rec.details.food_sources && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#999] font-medium mb-1">Food sources</div>
                        <p className="text-[12px] text-[#2A2A2A] leading-relaxed">{rec.details.food_sources}</p>
                      </div>
                    )}
                    {rec.details.interactions && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#B45309] font-medium mb-1">Interactions &amp; cautions</div>
                        <p className="text-[12px] text-[#2A2A2A] leading-relaxed">{rec.details.interactions}</p>
                      </div>
                    )}
                    {rec.details.important_notes && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-[#999] font-medium mb-1">Good to know</div>
                        <p className="text-[12px] text-[#2A2A2A] leading-relaxed">{rec.details.important_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {rec.markers_addressed && rec.markers_addressed.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {rec.markers_addressed.map((m: string) => (
                      <span
                        key={m}
                        className="text-[10px] font-medium text-[#1B6B4A] bg-[#E8F5EE] px-2 py-0.5 rounded-full"
                      >
                        {m}
                      </span>
                    ))}
                    {rec.cited_studies && (
                      <span className="text-[10px] text-[#999] px-2 py-0.5">
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

// Insight card (risk calculations)
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
    <div className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 hover:bg-[#FAFAF8] transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="text-[12px] font-medium text-[#6B6B6B] leading-snug">{calc.name}</div>
          <div
            className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 flex-shrink-0"
            style={{ backgroundColor: c.bg, color: c.text }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
            {calc.interpretation_label}
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="text-[26px] font-semibold tracking-tight" style={{ color: hasValue ? "#1A1A1A" : "#A1A1AA" }}>
            {calc.value}
          </div>
          {calc.unit && hasValue && (
            <div className="text-[11px] text-[#999]">{calc.unit}</div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[#F4F4F5] px-5 py-4 bg-[#FAFAF8]">
          <p className="text-[12px] text-[#2A2A2A] leading-relaxed mb-3">{calc.summary}</p>
          {calc.missing.length > 0 && (
            <div className="text-[11px] text-[#B45309] bg-[#FEF3C7] rounded-lg px-3 py-2 mb-3">
              Missing: {calc.missing.join(", ")}
            </div>
          )}
          <div className="text-[10px] text-[#999] leading-relaxed mb-2">
            <span className="font-medium text-[#6B6B6B]">Based on:</span> {calc.research_based_on}
          </div>
          <div className="text-[10px] text-[#999] leading-relaxed mb-2 font-mono">
            {calc.citation}
          </div>
          <p className="text-[10px] text-[#999] leading-relaxed mt-3 pt-3 border-t border-[#F4F4F5]">
            {calc.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Profile editor
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
    <div className="bg-white border border-[#E5E5E5] rounded-2xl p-5 mb-4">
      <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-3">
        Your profile
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="text-[11px] text-[#6B6B6B] block mb-1">Age</label>
          <input
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full text-[13px] border border-[#E5E5E5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B6B4A]"
            placeholder="e.g. 42"
          />
        </div>
        <div>
          <label className="text-[11px] text-[#6B6B6B] block mb-1">Sex</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value as "" | "male" | "female")}
            className="w-full text-[13px] border border-[#E5E5E5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B6B4A] bg-white"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-[#6B6B6B] block mb-1">Systolic BP</label>
          <input
            type="number"
            value={sbp}
            onChange={(e) => setSbp(e.target.value)}
            className="w-full text-[13px] border border-[#E5E5E5] rounded-lg px-3 py-2 focus:outline-none focus:border-[#1B6B4A]"
            placeholder="e.g. 120"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-[13px] text-[#2A2A2A] cursor-pointer">
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
          className="text-[12px] text-[#6B6B6B] hover:text-[#2A2A2A] px-4 py-2"
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
          className="text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] rounded-full px-5 py-2 transition-colors"
        >
          Save
        </button>
      </div>
      <p className="text-[10px] text-[#999] mt-3 leading-relaxed">
        Used only for risk calculations (SCORE2, FIB-4, bio-age). Never shared.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------
// Biomarker card component
// ---------------------------------------------------------------------

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
  const categoryColor = CATEGORY_COLORS[result.category] || "#6B7280";
  const confidence = computeConfidence(analysis);

  // Compute position within reference range (for the slider visual)
  const rangePosition =
    result.ref_low !== null && result.ref_high !== null
      ? Math.max(
          0,
          Math.min(100, ((result.value - result.ref_low) / (result.ref_high - result.ref_low)) * 100)
        )
      : 50;

  // Check if "normal by lab" but "suboptimal by research"
  const isNormalButSuboptimal =
    optimalRange &&
    optimalRange.optimal_low !== null &&
    optimalRange.optimal_high !== null &&
    status === "normal" &&
    (result.value < optimalRange.optimal_low || result.value > optimalRange.optimal_high);

  return (
    <div
      className="bg-white border border-[#E5E5E5] rounded-2xl overflow-hidden transition-shadow hover:shadow-sm"
      style={{ borderLeft: `3px solid ${categoryColor}` }}
    >
      {/* Card header — clickable to expand */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-5 text-left flex items-center gap-6 hover:bg-[#FAFAF8] transition-colors"
      >
        {/* Biomarker name + category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-[16px] font-semibold">{result.biomarker}</h3>
            <div
              className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
            >
              {result.category}
            </div>
          </div>
          {analysis?.summary && (
            <p className="text-[13px] text-[#6B6B6B] line-clamp-1">{analysis.summary}</p>
          )}
        </div>

        {/* Value + status */}
        <div className="text-right flex-shrink-0">
          <div className="text-[24px] font-semibold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500 }}>
            {result.value}
            <span className="text-[12px] text-[#999] ml-1 font-normal" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{result.unit}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap justify-end">
            <div
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusStyle.dot }} />
              {statusStyle.label}
            </div>
            {analysis && (
              <div
                className="inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${confidence.color}12`, color: confidence.color, border: `1px solid ${confidence.color}25` }}
                title={CONFIDENCE_DESCRIPTIONS[confidence.level]}
              >
                {confidence.label}
              </div>
            )}
          </div>
        </div>

        {/* Expand indicator */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#999"
          strokeWidth="2"
          className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Range visualization with optimal overlay */}
      {result.ref_low !== null && result.ref_high !== null && (
        <div className="px-6 pb-3">
          <div className="relative h-2 bg-[#F4F4F5] rounded-full">
            {/* Lab reference range */}
            <div
              className="absolute top-0 h-2 rounded-full"
              style={{
                left: "5%",
                right: "5%",
                backgroundColor: "#E5E5E5",
              }}
            />
            {/* Optimal range overlay (green zone) */}
            {optimalRange && optimalRange.optimal_low !== null && optimalRange.optimal_high !== null && result.ref_low !== null && result.ref_high !== null && (
              <div
                className="absolute top-0 h-2 rounded-full"
                style={{
                  left: `${Math.max(5, ((optimalRange.optimal_low - result.ref_low) / (result.ref_high - result.ref_low)) * 90 + 5)}%`,
                  right: `${Math.max(5, 95 - ((optimalRange.optimal_high - result.ref_low) / (result.ref_high - result.ref_low)) * 90 + 5)}%`,
                  backgroundColor: "rgba(27, 107, 74, 0.2)",
                  border: "1px solid rgba(27, 107, 74, 0.3)",
                }}
                title={`Optimal range: ${optimalRange.optimal_low}–${optimalRange.optimal_high} ${result.unit || ""}`}
              />
            )}
            {/* Current value marker */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
              style={{
                left: `calc(${Math.max(0, Math.min(100, rangePosition))}% - 7px)`,
                backgroundColor: statusStyle.dot,
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#999] mt-1">
            <span>{result.ref_low} {result.unit}</span>
            {optimalRange && optimalRange.optimal_low !== null && optimalRange.optimal_high !== null && (
              <span className="text-[#1B6B4A] font-medium">
                optimal: {optimalRange.optimal_low}–{optimalRange.optimal_high}
              </span>
            )}
            <span>{result.ref_high} {result.unit}</span>
          </div>

          {/* Normal-but-suboptimal callout */}
          {isNormalButSuboptimal && (
            <div className="mt-2 bg-[#FEF3C7] border border-[#F59E0B]/20 rounded-lg px-3 py-2">
              <p className="text-[11px] text-[#B45309] leading-snug">
                <strong>Your lab says "normal"</strong> — but your value of {result.value} {result.unit} sits outside the research-supported optimal range ({optimalRange!.optimal_low}–{optimalRange!.optimal_high}). The research suggests this may be worth attention.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && analysis && (
        <div className="border-t border-[#F4F4F5] px-6 py-6 bg-[#FAFAF8]">
          {/* What it means */}
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2">
              What it means
            </div>
            <p className="text-[14px] text-[#2A2A2A] leading-relaxed">{analysis.what_it_means}</p>
          </div>

          {/* What research shows */}
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2 flex items-center gap-2">
              What the research shows
              {analysis.citation_count > 0 && (
                <span className="normal-case tracking-normal font-normal text-[#1B6B4A]">
                  · {analysis.citation_count} studies cited
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#2A2A2A] leading-relaxed">{analysis.what_research_shows}</p>
          </div>

          {/* Related patterns */}
          {analysis.related_patterns && (
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2">
                Related patterns
              </div>
              <p className="text-[14px] text-[#2A2A2A] leading-relaxed">{analysis.related_patterns}</p>
            </div>
          )}

          {/* Suggested exploration */}
          {analysis.suggested_exploration && (
            <div className="mb-6">
              <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-2">
                Explore further
              </div>
              <p className="text-[14px] text-[#2A2A2A] leading-relaxed">{analysis.suggested_exploration}</p>
            </div>
          )}

          {/* What to test next (borderline/out_of_range only) */}
          {(() => {
            const nextTests = getNextTestSuggestions(result.biomarker, status);
            if (nextTests.length === 0) return null;
            return (
              <div className="mb-6">
                <div className="text-[11px] uppercase tracking-wider text-[#1B6B4A] font-medium mb-2">
                  What to test next
                </div>
                <div className="space-y-2">
                  {nextTests.slice(0, 4).map((t) => (
                    <div key={t.test_name} className="bg-white border border-[#E5E5E5] rounded-xl p-3">
                      <div className="text-[13px] font-medium text-[#2A2A2A] mb-1">{t.test_name}</div>
                      <div className="text-[11px] text-[#6B6B6B] leading-snug">{t.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Citations */}
          {citations.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-[#999] font-medium mb-3">
                Citations
              </div>
              <div className="space-y-2">
                {citations.slice(0, isFree ? FREE_TIER_CITATION_LIMIT : 5).map((c) => (
                  <a
                    key={c.study_id}
                    href={c.study.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${c.study.pmid}/` : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-white border border-[#E5E5E5] rounded-xl p-3 hover:border-[#1B6B4A]/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="text-[12px] font-medium text-[#2A2A2A] leading-snug line-clamp-2">
                        {c.study.title}
                      </div>
                      {c.study.grade_score && (
                        <div className="text-[9px] uppercase font-semibold text-[#1B6B4A] bg-[#E8F5EE] px-1.5 py-0.5 rounded flex-shrink-0">
                          {c.study.grade_score}
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] text-[#999]">
                      {c.study.authors && c.study.authors.length > 0 && c.study.authors[0].split(" ").pop()} et al.
                      {c.study.publication_year && ` · ${c.study.publication_year}`}
                      {c.study.journal && ` · ${c.study.journal}`}
                    </div>
                  </a>
                ))}
              </div>
              {citations.length > 5 && (
                <div className="text-[11px] text-[#999] mt-2 text-center">
                  +{citations.length - 5} more studies cited
                </div>
              )}
            </div>
          )}

          {/* Confidence + metadata */}
          <div className="mt-6 pt-4 border-t border-[#F4F4F5]">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <div
                className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: `${confidence.color}15`, color: confidence.color, border: `1px solid ${confidence.color}30` }}
              >
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidence.color }} />
                {confidence.label}
              </div>
              <span className="text-[10px] text-[#999]">
                {analysis.citation_count} studies cited
                {analysis.highest_evidence_grade && ` · highest: ${analysis.highest_evidence_grade}`}
                {analysis.avg_study_year && ` · avg year: ${analysis.avg_study_year}`}
              </span>
            </div>
            <p className="text-[10px] text-[#999] leading-relaxed mb-1">
              {CONFIDENCE_DESCRIPTIONS[confidence.level]}
            </p>
            <p className="text-[10px] text-[#999] leading-relaxed">
              This analysis is educational content, not medical advice. Consult your healthcare provider before making any health decisions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

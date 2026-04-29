"use client";

import dynamic from "next/dynamic";
import { AppNav } from "@/components/app-nav";
import { AskLipa } from "@/components/ask-lipa";
import { SupportButton } from "@/components/support-button";
import { ReportCardSection } from "@/components/report-card";
import { useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from "react";
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
import { calculateBiologicalAge, type BioAgeResult } from "@/lib/biological-age";
import { formatPrice } from "@/lib/geo-pricing";
import { useCountry } from "@/lib/use-country";

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
  what_to_do: string | null;
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
// Design tokens
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

const FREE_TIER_MARKER_LIMIT = 5;

// ---------------------------------------------------------------------
// Confidence
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
// MAIN COMPONENT
// =====================================================================

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [analysisInProgress, setAnalysisInProgress] = useState(false);
  const country = useCountry();
  const oneDisplay = formatPrice(country, 39);
  const lifeDisplay = formatPrice(country, 89);

  // Check for post-payment success and analyzing state
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("subscription") === "success") {
        setShowSuccess(true);
        // Fire Meta Pixel Purchase event
        if (typeof (window as any).fbq === "function") {
          (window as any).fbq("track", "Purchase", { currency: "EUR", value: 39 });
        }
        // Clean URL
        window.history.replaceState({}, "", "/dashboard");
      }
      if (params.get("analyzing") === "true") {
        setAnalysisInProgress(true);
        // Clean URL
        window.history.replaceState({}, "", "/dashboard");
      }
    }
  }, []);

  const [results, setResults] = useState<BiomarkerResult[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [profile, setProfile] = useState<UserProfile>({});
  const [actionPlan, setActionPlan] = useState<any>(null);
  const [optimalRanges, setOptimalRanges] = useState<Record<string, OptimalRange>>({});
  const [userTier, setUserTier] = useState<"free" | "one" | "insight" | "access" | "essential" | "complete">("free");

  // UI state
  const [expandedSystem, setExpandedSystem] = useState<BodySystemKey | null>(null);
  const [expandedMarker, setExpandedMarker] = useState<number | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // Pre-checkout email gate — when an anonymous user clicks Buy with no
  // email on file, we capture it in a modal then proceed to Stripe with
  // the email prefilled. Validated competitor pattern (InsideTracker).
  const [pendingCheckoutTier, setPendingCheckoutTier] = useState<"one" | "insight" | null>(null);
  const [checkoutEmail, setCheckoutEmail] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [convertEmail, setConvertEmail] = useState("");
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState("");
  const [convertSuccess, setConvertSuccess] = useState(false);

  // Auth check + tier check
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
      } else {
        setUserId(data.user.id);
        setUserEmail(data.user.email || null);
        setIsAnonymous(data.user.is_anonymous === true);
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

    let citationsData: any[] | null = null;
    try {
      const { data, error } = await supabase
        .from("analysis_citations")
        .select(`
          study_id,
          biomarker_result_id,
          retrieval_rank,
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
        .order("retrieval_rank", { ascending: true });
      if (!error) {
        citationsData = (data || []).map((c: any) => ({ ...c, relevance_rank: c.retrieval_rank }));
      } else {
        const { data: plainCitations } = await supabase
          .from("analysis_citations")
          .select("study_id, biomarker_result_id, retrieval_rank, biomarker_name")
          .eq("user_id", userId)
          .order("retrieval_rank", { ascending: true });
        citationsData = (plainCitations || []).map((c: any) => ({
          ...c,
          relevance_rank: c.retrieval_rank,
          study: { pmid: null, title: `Study #${c.study_id}`, authors: [], journal: null, publication_year: null, grade_score: null },
        }));
      }
    } catch {
      citationsData = [];
    }

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

  // Auto-refresh while analysis is in progress (Inngest background job)
  useEffect(() => {
    if (!userId || loadingData) return;

    // Detect incomplete analysis: results exist but analyses count < results count, or no action plan
    // Skip detection while data is still loading
    if (loadingData) return;

    const latestDate = results.length > 0 ? results[0]?.test_date : null;
    const latestCount = latestDate ? results.filter((r) => r.test_date === latestDate).length : 0;
    const analysedCount = analyses.length;
    const isIncomplete = latestCount > 0 && (analysedCount < latestCount || !actionPlan);

    if (isIncomplete) {
      setAnalysisInProgress(true);
    } else if (analysisInProgress && !isIncomplete && latestCount > 0) {
      setAnalysisInProgress(false);
      // Clean URL
      if (typeof window !== "undefined" && window.location.search.includes("analyzing")) {
        window.history.replaceState({}, "", "/dashboard");
      }
    }
  }, [results, analyses, actionPlan, analysisInProgress, loadingData]);

  // Auto-refresh while analysis is in progress
  useEffect(() => {
    if (!analysisInProgress || !userId) return;
    const interval = setInterval(() => {
      fetchData();
    }, 8000);
    return () => clearInterval(interval);
  }, [analysisInProgress, userId, fetchData]);

  // Reset checkout state when the page is restored from bfcache after the
  // user navigated to Stripe and hit browser-back. Without this, the loading
  // state from the previous click stays "stuck" and blocks further clicks.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setCheckoutLoading(null);
        setCheckoutError(null);
        setPendingCheckoutTier(null);
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Direct checkout from dashboard — skips pricing page.
  // If userEmail is missing (anonymous user), prompt for email first via modal,
  // then proceed via startCheckout(). This is the InsideTracker two-stage pattern:
  // capture email pre-payment (recoverable account asset) but no password yet
  // (magic-link auth handles return visits — better for 3-12 month return cycle).
  async function handleCheckout(tier: "one" | "insight") {
    if (!userId || checkoutLoading) return;
    if (userEmail) {
      await startCheckout(tier, userEmail);
    } else {
      setCheckoutEmail("");
      setCheckoutError(null);
      setPendingCheckoutTier(tier);
    }
  }

  async function startCheckout(tier: "one" | "insight", email: string) {
    if (!userId) return;
    setCheckoutLoading(tier);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, userId, email }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError(data.details || data.error || "Checkout failed");
        setCheckoutLoading(null);
      }
    } catch {
      setCheckoutError("Something went wrong. Please try again.");
      setCheckoutLoading(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const testDates = Array.from(new Set(results.map((r) => r.test_date))).sort((a, b) => b.localeCompare(a));
  const latestTestDate = testDates[0];
  const latestResults = results.filter((r) => r.test_date === latestTestDate);

  const calculations = useMemo<RiskCalculation[]>(() => {
    if (latestResults.length === 0) return [];
    const bv: BiomarkerValue[] = latestResults.map((r) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));
    return runAllCalculations(bv, profile);
  }, [latestResults, profile]);

  const bioAge = useMemo<BioAgeResult | null>(() => {
    if (latestResults.length === 0 || !profile.age) return null;
    const bv = latestResults.map((r) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));
    return calculateBiologicalAge(bv, profile.age, profile.sex);
  }, [latestResults, profile]);

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

  // Status counts
  const statusCounts = { optimal: 0, normal: 0, borderline: 0, out_of_range: 0 };
  latestResults.forEach((r) => {
    const analysis = analyses.find((a) => a.biomarker_result_id === r.id);
    if (analysis) statusCounts[analysis.status]++;
  });

  // Key findings — smart priority
  const HEMATOLOGY_DIFF_NAMES = ["neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"];
  const IMPORTANT_CATEGORIES = ["lipid", "cardiovascular", "metabolic", "inflammatory", "hormonal", "thyroid", "nutrient", "nutritional"];
  const isHematologyDifferential = (name: string) =>
    HEMATOLOGY_DIFF_NAMES.some((h) => name.toLowerCase().includes(h));
  const isMidRange = (r: BiomarkerResult) => {
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

  // Rank findings by clinical importance: important categories first, then by how far out of range
  const CATEGORY_PRIORITY: Record<string, number> = {
    cardiovascular: 1, lipid: 1, cardiac: 1,
    metabolic: 2,
    inflammatory: 3,
    hormonal: 4, thyroid: 4,
    nutritional: 5, nutrient: 5,
    hematology: 6, liver: 6, kidney: 6,
    other: 7,
  };
  const rankedFindings = [...outOfRangeFindings, ...borderlineFindings]
    .sort((a: any, b: any) => {
      // Out of range before borderline
      if (a.status !== b.status) return a.status === "out_of_range" ? -1 : 1;
      // Then by category importance
      const aPri = CATEGORY_PRIORITY[a.category?.toLowerCase()] || 7;
      const bPri = CATEGORY_PRIORITY[b.category?.toLowerCase()] || 7;
      return aPri - bPri;
    });
  const keyFindings = rankedFindings.slice(0, 8);
  const allGood = keyFindings.length === 0 && statusCounts.optimal > 0;

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

  const isFree = userTier === "free";
  const computedCalculations = calculations.filter((c) => c.interpretation !== "unknown");
  const allMarkerNames = latestResults.map((r) => r.biomarker);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F5EF] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#1B6B4A]/20 border-t-[#1B6B4A] animate-spin" />
          <div className="text-[#8A928C] text-sm">Loading your analysis...</div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!loadingData && results.length === 0) {
    return (
      <>
        <AppNav />
        <main className="min-h-screen bg-[#F8F5EF]">
          <div className="max-w-3xl mx-auto px-6 py-16 text-center">
            <div
              className="w-20 h-20 flex items-center justify-center mx-auto mb-6 rounded-[20px]"
              style={{ ...CARD, background: "rgba(232,245,238,0.6)" }}
            >
              <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="13" stroke="#1B6B4A" strokeWidth="1.5" />
                <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="#1B6B4A" opacity="0.15" stroke="#1B6B4A" strokeWidth="1.2" />
                <line x1="14" y1="11" x2="14" y2="21" stroke="#1B6B4A" strokeWidth="0.8" />
              </svg>
            </div>
            <h1 className="text-3xl mb-3" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
              Welcome to Lipa
            </h1>
            <p className="text-[#5A635D] text-[16px] max-w-md mx-auto mb-8 leading-relaxed">
              Upload your blood test to get the most comprehensive research-backed analysis available.
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
        </main>
      </>
    );
  }

  // =========================================================================
  // MAIN DASHBOARD RENDER — Apple Health Hybrid Layout
  // =========================================================================

  return (
    <>
      <AppNav />
      <main className="min-h-screen" style={{ background: "#F8F5EF" }} suppressHydrationWarning>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-10" suppressHydrationWarning>

          {/* ============================================================ */}
          {/* ANONYMOUS USER BANNER — save your analysis                   */}
          {/* ============================================================ */}
          {isAnonymous && !convertSuccess && (
            <div
              className="mb-6 p-6 sm:p-7 rounded-[24px] border border-[rgba(15,26,21,0.06)]"
              style={{ background: "linear-gradient(135deg, #FCFAF5 0%, #F2EDE2 100%)" }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0"
                  style={{ boxShadow: "0 2px 8px rgba(15,26,21,0.06)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-[20px] sm:text-[22px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                    Save your analysis
                  </h3>
                  <p className="text-[13px] text-[#5A635D] mt-1.5 max-w-lg leading-relaxed">
                    We&apos;ll email a sign-in link so you can return anytime — across devices, retest visits, and to track trends over time.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={convertEmail}
                  onChange={(e) => setConvertEmail(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-full border border-[rgba(15,26,21,0.10)] text-[14px] bg-white focus:outline-none focus:border-[#1B6B4A]"
                />
                <button
                  disabled={convertLoading || !convertEmail}
                  onClick={async () => {
                    setConvertLoading(true);
                    setConvertError("");
                    // updateUser on the existing anonymous session attaches the email
                    // to this user_id and triggers Supabase's confirmation email.
                    // Their data stays linked because user_id never changes.
                    const { error } = await supabase.auth.updateUser({ email: convertEmail });
                    if (error) {
                      setConvertError(error.message);
                      setConvertLoading(false);
                    } else {
                      setUserEmail(convertEmail);
                      setConvertSuccess(true);
                      setConvertLoading(false);
                    }
                  }}
                  className="px-6 py-2.5 rounded-full text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {convertLoading ? "Sending…" : "Email me a sign-in link"}
                </button>
              </div>
              {convertError && <p className="text-[12px] text-[#B91C1C] mt-3">{convertError}</p>}
            </div>
          )}
          {convertSuccess && (
            <div
              className="mb-6 p-5 rounded-[24px] flex items-center gap-3 border border-[rgba(15,26,21,0.06)]"
              style={{ background: "linear-gradient(135deg, #FCFAF5 0%, #EEF5EF 100%)" }}
            >
              <div
                className="w-9 h-9 rounded-full bg-white flex items-center justify-center flex-shrink-0"
                style={{ boxShadow: "0 2px 8px rgba(15,26,21,0.06)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-[14px] text-[#0F1A15]">
                <span className="font-medium">Sign-in link sent.</span>{" "}
                <span className="text-[#5A635D]">Your analysis is saved to {userEmail}.</span>
              </p>
            </div>
          )}

          {/* ============================================================ */}
          {/* SUCCESS BANNER — post-payment                                */}
          {/* ============================================================ */}
          {showSuccess && (
            <div className="mb-6 p-5 rounded-[20px] flex items-start justify-between gap-4" style={{ background: "rgba(232,245,238,0.6)", border: "1px solid rgba(27,107,74,0.15)" }}>
              <div>
                <div className="text-[18px] text-[#1B6B4A] mb-1" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  {userTier === "insight" ? "Welcome to Lipa Life!" : "Your analysis is unlocked!"}
                </div>
                <p className="text-[14px] text-[#5A635D] leading-relaxed">
                  {userTier === "insight"
                    ? "Your full analysis is unlocked — every marker, action plans, Ask Lipa, vault, and research alerts. Upload up to 12 tests per year and track your health over time."
                    : "Your full analysis is unlocked — every marker with detailed insights, your personalized action plan, risk calculations, and Ask Lipa for the next 7 days."
                  }
                </p>
                {!latestResults.length && (
                  <a href="/upload" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1B6B4A] mt-3 hover:underline">
                    Upload your blood test to get started
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                  </a>
                )}
                <p className="text-[12px] text-[#8A928C] mt-3">
                  We&apos;ll email you sign-in links by default.{" "}
                  <a href="/account" className="text-[#1B6B4A] hover:underline">Set a password</a>
                  {" "}for faster sign-in across devices.
                </p>
              </div>
              <button onClick={() => setShowSuccess(false)} className="text-[#8A928C] hover:text-[#0F1A15] p-1 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* ANALYSIS IN PROGRESS BANNER                                  */}
          {/* ============================================================ */}
          {analysisInProgress && (
            <div className="mb-6 p-5 rounded-[20px] flex items-start gap-4" style={{ background: "rgba(232,245,238,0.6)", border: "1px solid rgba(27,107,74,0.15)" }}>
              <div className="w-10 h-10 rounded-full border-2 border-[#1B6B4A]/20 border-t-[#1B6B4A] animate-spin flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-[16px] text-[#1B6B4A] mb-1" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Analyzing your biology
                </div>
                <p className="text-[13px] text-[#5A635D] leading-relaxed">
                  {analyses.length > 0
                    ? `${analyses.length} of ${latestResults.length} markers analyzed so far. ${!actionPlan ? "Building your action plan next." : "Finalizing..."}`
                    : `${latestResults.length} biomarkers extracted — deep analysis running in the background. This page refreshes automatically.`
                  }
                </p>
                <div className="mt-2 h-1.5 bg-[#E5E5E5] rounded-full overflow-hidden" style={{ maxWidth: 280 }}>
                  <div
                    className="h-1.5 bg-[#1B6B4A] rounded-full transition-all duration-1000"
                    style={{ width: `${latestResults.length > 0 ? Math.max(5, Math.round((analyses.length / latestResults.length) * (actionPlan ? 100 : 90))) : 5}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* HEADING + METHODOLOGY                                        */}
          {/* ============================================================ */}
          <div className="mb-6">
            <h1 className="text-[28px] sm:text-[32px] tracking-tight text-[#0F1A15] mb-2" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
              Your Lipa Analysis
            </h1>
            <p className="text-[13px] text-[#5A635D] leading-relaxed max-w-2xl">
              {(() => {
                const summed = analyses.reduce((sum, a) => sum + (a.citation_count || 0), 0);
                const cited = summed > 0 ? summed : citations.length;
                const prefix = cited > 0
                  ? `Every marker cross-referenced against ${cited.toLocaleString()}+ peer-reviewed studies from a corpus of 250,000+ research papers.`
                  : `Every marker cross-referenced against a corpus of 250,000+ peer-reviewed research papers.`;
                return `${prefix} Your values benchmarked against 300,000+ health profiles by age and sex. This is the most comprehensive analysis of your blood work available.`;
              })()}
            </p>
          </div>

          {/* ============================================================ */}
          {/* HEADER: date + marker count + actions                        */}
          {/* ============================================================ */}
          <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
            <div className="flex items-center gap-3 text-[13px] text-[#8A928C]">
              <span style={{ fontFamily: MONO }}>
                {latestTestDate ? new Date(latestTestDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : ""}
              </span>
              <span>&middot;</span>
              <span>{latestResults.length} markers analyzed</span>
            </div>
            <div className="flex items-center gap-2">
              {!isFree && (
                <button
                  onClick={async () => {
                    if (!userId) return;
                    const btn = document.activeElement as HTMLButtonElement;
                    if (btn) btn.textContent = "Generating...";
                    try {
                      const res = await fetch("/api/export-pdf", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId, testDate: latestTestDate }),
                      });
                      if (!res.ok) throw new Error("Export failed");
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `lipa-report-${latestTestDate}.pdf`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      alert("Export failed. Please try again.");
                    }
                    if (btn) btn.textContent = "Export PDF";
                  }}
                  className="text-[11px] font-medium text-[#5A635D] hover:text-[#1B6B4A] bg-white/60 border border-white/30 rounded-lg px-3 py-1.5 backdrop-blur-sm flex items-center gap-1.5 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export PDF
                </button>
              )}
              <button
                onClick={async () => {
                  if (!confirm("Delete this test and all its analyses? This cannot be undone.")) return;
                  if (!userId) return;
                  await fetch("/api/delete-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
                  window.location.reload();
                }}
                className="text-[11px] font-medium text-[#8A928C] hover:text-[#B91C1C] bg-white/60 border border-white/30 rounded-lg px-3 py-1.5 backdrop-blur-sm flex items-center gap-1.5 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Delete
              </button>
            </div>
          </div>

          {/* ============================================================ */}
          {/* BIO-AGE + SUMMARY — side by side                             */}
          {/* ============================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 mb-4">
            {/* Bio-age card */}
            {bioAge && bioAge.ensemble_age !== null ? (
              <div className="p-5 text-center flex flex-col justify-center" style={CARD}>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#8A928C] font-medium mb-2">Biological Age</div>
                <div
                  className="text-[48px] leading-none tracking-tight"
                  style={{
                    fontFamily: FRAUNCES,
                    fontWeight: 600,
                    color: bioAge.gap !== null && bioAge.gap < 0 ? "#1B6B4A" : bioAge.gap !== null && bioAge.gap > 2 ? "#B91C1C" : "#0F1A15",
                  }}
                >
                  {Number(bioAge.ensemble_age.toFixed(1))}
                </div>
                {bioAge.gap !== null && (
                  <div
                    className="inline-flex self-center text-[13px] font-semibold px-3 py-1 rounded-full mt-2"
                    style={{
                      backgroundColor: bioAge.gap < 0 ? "#E8F5EE" : bioAge.gap > 2 ? "#FEE2E2" : "#F4F4F5",
                      color: bioAge.gap < 0 ? "#1B6B4A" : bioAge.gap > 2 ? "#B91C1C" : "#5A635D",
                    }}
                  >
                    {bioAge.gap < 0 ? "" : "+"}{Number(bioAge.gap.toFixed(1))} yrs
                  </div>
                )}
                <div className="text-[11px] text-[#8A928C] mt-2">
                  vs age {bioAge.chronological_age} &middot; {bioAge.contributing_biomarkers.length} markers
                </div>
              </div>
            ) : (
              <div className="p-5 text-center flex flex-col justify-center" style={CARD}>
                <div className="text-[10px] uppercase tracking-[0.1em] text-[#8A928C] font-medium mb-2">Biological Age</div>
                {!profile.age ? (
                  <>
                    <div className="text-[14px] text-[#8A928C] leading-relaxed">
                      Add your age to calculate bio-age
                    </div>
                    <button
                      onClick={() => setProfileOpen(true)}
                      className="text-[12px] font-medium text-[#1B6B4A] mt-2 hover:underline"
                    >
                      Set up profile
                    </button>
                  </>
                ) : bioAge && bioAge.ensemble_age === null ? (
                  <>
                    <div className="text-[14px] text-[#8A928C] leading-relaxed mb-2">
                      Not enough markers for bio-age
                    </div>
                    <div className="text-[11px] text-[#8A928C] leading-relaxed">
                      Needs at least 4 of: albumin, creatinine, glucose, cholesterol, CRP, alkaline phosphatase, BUN. Your next comprehensive panel should include these.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-[14px] text-[#8A928C] leading-relaxed">
                      Calculating...
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="p-5 flex flex-col" style={CARD}>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[#1B6B4A] font-semibold mb-2">Your Summary</div>
              {actionPlan?.overall_summary ? (
                isFree ? (
                  <>
                    <p className="text-[14px] text-[#0F1A15] leading-relaxed line-clamp-3 flex-1">{actionPlan.overall_summary}</p>
                    <p className="text-[12px] text-[#8A928C] mt-2">Full summary with personalized recommendations available with Lipa One ({oneDisplay}) or Lipa Life ({lifeDisplay}/year).</p>
                  </>
                ) : (
                  <div className="text-[14px] text-[#0F1A15] leading-relaxed flex-1 space-y-3">
                    {actionPlan.overall_summary.split(/(?<=[.!?])\s+(?=[A-Z])/).reduce((paragraphs: string[][], sentence: string, i: number) => {
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
                )
              ) : (
                <p className="text-[14px] text-[#8A928C] leading-relaxed flex-1">
                  Your executive summary will appear here once analysis is complete.
                </p>
              )}
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
          {allGood ? (
            <div className="p-6 mb-10" style={{ ...CARD, background: "rgba(232,245,238,0.5)", border: "1px solid rgba(27,107,74,0.15)" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#1B6B4A]/10 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <div>
                  <div className="text-[18px] text-[#1B6B4A] mb-1" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                    Your markers look healthy
                  </div>
                  <p className="text-[14px] text-[#5A635D] leading-relaxed">
                    {statusCounts.optimal} of {latestResults.length} markers are in the optimal zone. But &ldquo;normal&rdquo; and &ldquo;optimal&rdquo; aren&apos;t the same thing. Your full analysis shows where you rank against 300,000+ people your age, what&apos;s keeping each marker healthy, and how to stay ahead.
                  </p>
                </div>
              </div>
            </div>
          ) : keyFindings.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Key Findings
                </h2>
                <span className="text-[12px] text-[#8A928C]">What needs your attention</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        // Find the body system this marker belongs to
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
          {/* BODY SYSTEMS — expandable grid                                */}
          {/* ============================================================ */}
          {systemData.length > 0 && (
            <div id="body-systems" className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Body Systems
                </h2>
                <span className="text-[12px] text-[#8A928C]">Tap any system to explore</span>
              </div>

              {/* System cards grid */}
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
                      onClick={() => {
                        setExpandedSystem(isExpanded ? null : sys.key);
                        setExpandedMarker(null);
                      }}
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

              {/* Expanded system — marker list */}
              {expandedSystem && (() => {
                const sys = systemData.find((s) => s.key === expandedSystem);
                if (!sys) return null;
                const statusColor =
                  sys.systemStatus === "red" ? "#B91C1C" : sys.systemStatus === "amber" ? "#B45309" : "#1B6B4A";

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

                    {/* Marker rows */}
                    <div className="divide-y divide-[rgba(15,26,21,0.06)]">
                      {sys.results.map((result) => {
                        const analysis = analyses.find((a) => a.biomarker_result_id === result.id);
                        const biomarkerCitations = citations.filter((c) => c.biomarker_result_id === result.id);
                        const status = analysis?.status || "normal";
                        const ss = STATUS_STYLES[status];
                        const isMarkerExpanded = expandedMarker === result.id;

                        return (
                          <div key={result.id}>
                            {/* Marker row — compact */}
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

                            {/* Expanded marker detail — free users see upgrade prompt */}
                            {isMarkerExpanded && analysis && (
                              isFree ? (
                                <div className="px-5 py-6 text-center" style={{ borderTop: "1px solid rgba(15,26,21,0.06)", background: "#FAFAF8" }}>
                                  <p className="text-[14px] text-[#0F1A15] mb-1" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                                    Your full {result.biomarker} analysis is ready
                                  </p>
                                  <p className="text-[13px] text-[#5A635D] mb-4 max-w-md mx-auto">
                                    What it means, what to do, {analysis.citation_count > 0 ? `${analysis.citation_count} cited studies` : "research insights"}, and how it connects to your other markers.
                                  </p>
                                  <button
                                    onClick={() => handleCheckout("one")}
                                    disabled={!!checkoutLoading}
                                    className="inline-flex text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] px-6 py-2.5 rounded-full transition-all duration-300 disabled:opacity-50"
                                    style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.2)" }}
                                  >
                                    {checkoutLoading ? "Loading..." : `See full analysis — ${oneDisplay}`}
                                  </button>
                                </div>
                              ) : (
                              <MarkerDetail
                                result={result}
                                analysis={analysis}
                                citations={biomarkerCitations}
                                optimalRange={(() => {
                                  const demoRange = getDemographicOptimalRange(result.biomarker, profile.age, profile.sex);
                                  if (demoRange) return { optimal_low: demoRange.optimal_low, optimal_high: demoRange.optimal_high, canonical_name: result.biomarker };
                                  return optimalRanges[result.biomarker.toLowerCase()] || optimalRanges[(analysis?.biomarker_name || "").toLowerCase()];
                                })()}
                                detectedPatterns={detectedPatterns}
                                profile={profile}
                              />
                              )
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
                {detectedPatterns.map((pattern) =>
                  isFree ? (
                    <div key={pattern.id} className="p-4" style={{ ...CARD, borderLeft: `3px solid ${(SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.watch).border}` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[14px] font-semibold text-[#0F1A15]">{pattern.name}</span>
                          <span
                            className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: (SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.watch).bg, color: (SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.watch).text }}
                          >
                            {(SEVERITY_STYLES[pattern.severity] || SEVERITY_STYLES.watch).label}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#8A928C]">Full analysis available</span>
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {pattern.markers_matched.map((m) => (
                          <span key={m} className="text-[10px] text-[#8A928C] px-2 py-0.5 rounded-full bg-[#F4F4F5]">{m}</span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <PatternCard key={pattern.id} pattern={pattern} />
                  )
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* YOUR ACTION PLAN                                              */}
          {/* ============================================================ */}
          {actionPlan && actionPlan.domains && actionPlan.domains.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  Your Action Plan
                </h2>
                <span className="text-[12px] text-[#8A928C]">Personalized to your results</span>
              </div>

              {isFree ? (
                /* Free: show domain names + counts with hint */
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(actionPlan.domains as any[]).map((d: any) => {
                      const info = DOMAIN_LABELS[d.domain] || { label: d.domain, icon: "?" };
                      const recs = d.recommendations || [];
                      if (recs.length === 0) return null;
                      return (
                        <div key={d.domain} className="p-4" style={CARD}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[#1B6B4A]" style={{ background: "rgba(232,245,238,0.7)" }}>
                              {info.icon}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold text-[#0F1A15]">{info.label}</div>
                              <div className="text-[12px] text-[#8A928C]">{recs.length} recommendation{recs.length !== 1 ? "s" : ""} ready</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[12px] text-[#8A928C] text-center mt-4">
                    Your personalized action plan covers nutrition, supplements, sleep, movement, and more — with specific dosages and cited research.
                  </p>
                </>
              ) : (
                /* Paid: domain cards grid → expandable */
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(actionPlan.domains as any[]).map((domain: any) => {
                    const info = DOMAIN_LABELS[domain.domain] || { label: domain.domain, emoji: "?" };
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
                            {actionPlan.disclaimer && (
                              <p className="text-[10px] text-[#8A928C] leading-relaxed text-center pt-3" style={{ borderTop: "1px solid rgba(15,26,21,0.06)" }}>
                                {actionPlan.disclaimer}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* RISK INSIGHTS — paid only                                     */}
          {/* ============================================================ */}
          {!isFree && computedCalculations.length > 0 && (
            <div className="mb-10">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h2 className="text-[20px] tracking-tight text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                    Risk Insights
                  </h2>
                  <p className="text-[12px] text-[#8A928C]">{computedCalculations.length} calculations</p>
                </div>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="text-[12px] font-medium text-[#1B6B4A] hover:text-[#155A3D] transition-colors"
                >
                  {profile.age ? "Edit profile" : "Add age & sex"}
                </button>
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

          {/* Report card removed — not adding value */}

          {/* ============================================================ */}
          {/* UPGRADE CTA — free users only                                 */}
          {/* ============================================================ */}
          {isFree && (
            <div className="mb-10">
              <div className="text-center mb-8">
                <h3 className="text-[24px] mb-2 text-[#0F1A15]" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
                  {allGood ? "Healthy is good. Optimized is better." : "Your full analysis is ready"}
                </h3>
                <p className="text-[14px] text-[#5A635D] max-w-lg mx-auto">
                  {allGood
                    ? `Your markers are in range — but are they truly optimal? See where each one ranks against 300,000+ people your age, what's keeping them healthy, and exactly what to do to stay ahead. ${analyses.reduce((sum, a) => sum + (a.citation_count || 0), 0)}+ cited studies analyzed for your biology.`
                    : `${latestResults.length} markers analyzed. Detailed insights, personalized action plan, and ${analyses.reduce((sum, a) => sum + (a.citation_count || 0), 0)}+ cited studies — all waiting for you.`
                  }
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {/* Lipa Life */}
                <div className="p-6 relative" style={{ ...CARD, border: "2px solid #1B6B4A" }}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1B6B4A] text-white text-[9px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full">Best value</div>
                  <div className="text-[20px] font-semibold text-[#0F1A15] mb-1" style={{ fontFamily: FRAUNCES }}>Lipa Life</div>
                  <p className="text-[12px] text-[#5A635D] mb-3">For people who test regularly and want to track their health over time.</p>
                  <div className="text-[28px] text-[#1B6B4A] mb-1" style={{ fontFamily: FRAUNCES, fontWeight: 600 }}>{lifeDisplay}<span className="text-[14px] text-[#8A928C] font-normal">/year</span></div>
                  <p className="text-[11px] text-[#1B6B4A] font-medium mb-4">Everything in Lipa One, plus:</p>
                  <ul className="text-[12px] text-[#5A635D] space-y-2 mb-5">
                    {[
                      "Up to 12 blood test analyses per year — test quarterly, see what changes",
                      "Vault — your complete biological history, stored and searchable",
                      "Trend tracking — see how every marker moves over months and years",
                      "Bio-age trajectory — watch your biological age improve over time",
                      "Ask Lipa — unlimited, forever. Your personal health research assistant",
                      "Research alerts — notified when new studies are published on your markers",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" className="flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleCheckout("insight")}
                    disabled={!!checkoutLoading}
                    className="block w-full text-center text-[13px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] py-3 rounded-full transition-all duration-300 disabled:opacity-50"
                    style={{ boxShadow: "0 4px 16px rgba(27,107,74,0.2)" }}
                  >
                    {checkoutLoading === "insight" ? "Loading..." : `Get Lipa Life — ${lifeDisplay}/year`}
                  </button>
                  <p className="text-[10px] text-[#8A928C] text-center mt-2 leading-relaxed">
                    Cross-referenced against 250,000+ peer-reviewed studies · Cancel anytime · No long-term commitment
                  </p>
                </div>
                {/* Lipa One */}
                <div className="p-6" style={CARD}>
                  <div className="text-[20px] font-semibold text-[#0F1A15] mb-1" style={{ fontFamily: FRAUNCES }}>Lipa One</div>
                  <p className="text-[12px] text-[#5A635D] mb-3">A single deep-dive into this blood test.</p>
                  <div className="text-[28px] text-[#0F1A15] mb-4" style={{ fontFamily: FRAUNCES, fontWeight: 600 }}>{oneDisplay}<span className="text-[14px] text-[#8A928C] font-normal"> one-time</span></div>
                  <ul className="text-[12px] text-[#5A635D] space-y-2 mb-5">
                    {[
                      `Full analysis of all ${latestResults.length} markers — what each means, what to do, cited research`,
                      "Personalized action plan — nutrition, supplements, sleep, movement with specific dosages",
                      "Cross-marker pattern detection — connections your doctor might miss",
                      "16+ risk calculations + biological age estimate",
                      "Ask Lipa for 7 days — ask anything about your results",
                      "PDF report you can share with your doctor",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" className="flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12" /></svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => handleCheckout("one")}
                    disabled={!!checkoutLoading}
                    className="block w-full text-center text-[13px] font-semibold text-[#0F1A15] bg-[#F4F4F5] hover:bg-[#E5E5E5] py-3 rounded-full transition-all duration-300 disabled:opacity-50"
                  >
                    {checkoutLoading === "one" ? "Loading..." : `Get Single Analysis — ${oneDisplay}`}
                  </button>
                  <p className="text-[10px] text-[#8A928C] text-center mt-2 leading-relaxed">
                    Cross-referenced against 250,000+ peer-reviewed studies · {oneDisplay} credited toward Life if you upgrade within 30 days
                  </p>
                </div>
              </div>
              {checkoutError && (
                <p className="text-[12px] text-[#B91C1C] text-center mt-4">{checkoutError}</p>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* FOOTER                                                        */}
          {/* ============================================================ */}
          <div className="mt-12 pb-24 sm:pb-8">
            <div className="flex justify-center mb-6">
              <a href="/upload" className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#1B6B4A] hover:text-[#155A3D] transition-colors">
                Upload another blood test
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14" /><path d="M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
            <p className="text-[10px] text-[#8A928C] text-center leading-relaxed max-w-lg mx-auto">
              This analysis is educational content based on peer-reviewed research, not medical advice. Consult your healthcare provider before making any health decisions.
            </p>
          </div>
        </div>
      </main>

      {/* Profile modal overlay */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setProfileOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <ProfileEditor
              profile={profile}
              onSave={async (next) => { await saveProfile(next); setProfileOpen(false); }}
              onCancel={() => setProfileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Pre-checkout email gate. Single field. We capture email here so
          (a) Stripe gets it prefilled, (b) the webhook can attach it to the
          anonymous user_id post-payment turning the anon session into a
          real, recoverable account. No password — magic-link auth handles
          returns. */}
      {pendingCheckoutTier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => !checkoutLoading && setPendingCheckoutTier(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl p-7 w-full max-w-md mx-4"
            style={{ boxShadow: "0 24px 80px rgba(15,26,21,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#1B6B4A] font-semibold mb-2">
              {pendingCheckoutTier === "insight" ? "Lipa Life — €89/year" : "Lipa One — €39"}
            </div>
            <h3 className="text-[22px] tracking-tight mb-2" style={{ fontFamily: FRAUNCES, fontWeight: 500 }}>
              One last step
            </h3>
            <p className="text-[13px] text-[#5A635D] leading-relaxed mb-5">
              Enter your email — we&apos;ll send your receipt and unlock your full results. Your analysis stays linked to this email so you can come back anytime.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const email = checkoutEmail.trim();
                if (!email || !pendingCheckoutTier) return;
                await startCheckout(pendingCheckoutTier, email);
              }}
            >
              <input
                type="email"
                required
                autoFocus
                placeholder="your@email.com"
                value={checkoutEmail}
                onChange={(e) => setCheckoutEmail(e.target.value)}
                disabled={!!checkoutLoading}
                className="w-full px-4 py-3 rounded-full border border-[#E5E5E5] text-[14px] bg-white focus:outline-none focus:border-[#1B6B4A] mb-3"
              />
              {checkoutError && (
                <p className="text-[12px] text-[#B91C1C] mb-3">{checkoutError}</p>
              )}
              <button
                type="submit"
                disabled={!checkoutEmail.trim() || !!checkoutLoading}
                className="w-full px-6 py-3 rounded-full text-[14px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {checkoutLoading ? "Loading..." : "Continue to checkout →"}
              </button>
              <button
                type="button"
                onClick={() => setPendingCheckoutTier(null)}
                disabled={!!checkoutLoading}
                className="w-full mt-2 px-6 py-2 text-[12px] text-[#8A928C] hover:text-[#0F1A15] disabled:opacity-50"
              >
                Cancel
              </button>
            </form>
            <ul className="text-[11px] text-[#5A635D] mt-5 space-y-1.5">
              {[
                "180+ biomarkers cross-referenced against 250,000+ peer-reviewed studies",
                "Cited research for every recommendation",
                pendingCheckoutTier === "insight" ? "Cancel anytime, no long-term commitment" : "€39 credited toward Life if you upgrade within 30 days",
                "GDPR-compliant. Encrypted. Never sold.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1B6B4A" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-[#8A928C] mt-3 leading-relaxed">
              Secure payment via Stripe.
            </p>
          </div>
        </div>
      )}

      {/* Floating Ask Lipa for when scrolled past inline section */}
      {userId && <AskLipa userId={userId} />}
      {userId && <SupportButton userId={userId} email={userEmail || undefined} />}
    </>
  );
}

// =====================================================================
// INLINE ASK LIPA — prominent section per wireframe
// =====================================================================

function InlineAskLipa({ userId, isFree }: { userId: string | null; isFree: boolean }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [streaming, setStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTED = [
    "Why is my cholesterol high?",
    "What supplements should I take?",
    "Should I retest in 3 months?",
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text?: string) {
    const msg = text || input.trim();
    if (!msg || streaming || !userId) return;

    if (isFree) {
      // Gate — show upgrade prompt
      return;
    }

    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setInput("");
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, userId, history: messages.slice(-10) }),
      });
      if (!res.ok) throw new Error("Chat failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content: fullText };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Sorry, something went wrong. Please try again." };
        return updated;
      });
    }
    setStreaming(false);
  }

  // Simple markdown
  function fmt(text: string): string {
    let html = text;
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>');
    html = html.replace(/\n\n/g, '<div style="height:8px"></div>');
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  return (
    <div className="mb-10 p-5 sm:p-6" style={{ ...CARD, background: "rgba(232,245,238,0.25)", border: "1px solid rgba(27,107,74,0.12)" }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-[#1B6B4A] rounded-full flex items-center justify-center flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="13" stroke="white" strokeWidth="1.5" />
            <path d="M14 7C14 7 10 10 10 15C10 18 11.5 20 14 21C16.5 20 18 18 18 15C18 10 14 7 14 7Z" fill="white" opacity="0.3" stroke="white" strokeWidth="1" />
          </svg>
        </div>
        <div>
          <div className="text-[15px] font-semibold text-[#0F1A15]">Ask Lipa</div>
          <div className="text-[11px] text-[#8A928C]">Your Personal Health Assistant</div>
        </div>
      </div>

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {SUGGESTED.map((q) => (
            <button
              key={q}
              onClick={() => isFree ? undefined : sendMessage(q)}
              className="text-[12px] text-[#0F1A15] px-3.5 py-2 rounded-full transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.5)", boxShadow: "0 1px 4px rgba(15,26,21,0.04)" }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto mb-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed ${msg.role === "user" ? "bg-[#1B6B4A] text-white" : ""}`}
                style={msg.role === "assistant" ? { background: "rgba(255,255,255,0.8)", border: "1px solid rgba(255,255,255,0.5)", color: "#0F1A15" } : undefined}
              >
                {msg.content ? (
                  <div dangerouslySetInnerHTML={{ __html: fmt(msg.content) }} />
                ) : (
                  <div className="flex items-center gap-2 text-[#8A928C]">
                    <div className="w-2 h-2 bg-[#1B6B4A] rounded-full animate-pulse" />
                    Thinking...
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input bar */}
      {isFree ? (
        <div className="flex items-center gap-3">
          <div className="flex-1 text-[13px] bg-white/50 border border-white/30 rounded-full px-4 py-2.5 text-[#8A928C]">
            Ask anything about your results...
          </div>
          <a href="/pricing" className="text-[12px] font-semibold text-[#1B6B4A] hover:underline whitespace-nowrap">
            Upgrade to ask
          </a>
        </div>
      ) : (
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about your results..."
            disabled={streaming}
            className="flex-1 text-[13px] bg-white/70 border border-white/40 rounded-full px-4 py-2.5 focus:outline-none focus:border-[#1B6B4A]/40 placeholder:text-[#B5B5B5] disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="w-10 h-10 rounded-full bg-[#1B6B4A] flex items-center justify-center flex-shrink-0 transition-all duration-200 hover:bg-[#155A3D] disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}

// =====================================================================
// MARKER DETAIL — expanded view inside body system
// =====================================================================

function MarkerDetail({
  result,
  analysis,
  citations,
  optimalRange,
  detectedPatterns,
  profile,
}: {
  result: BiomarkerResult;
  analysis: Analysis;
  citations: Citation[];
  optimalRange?: OptimalRange;
  detectedPatterns: DetectedPattern[];
  profile: UserProfile;
}) {
  const [citationsOpen, setCitationsOpen] = useState(false);
  const status = analysis.status;
  const ss = STATUS_STYLES[status];

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

      {/* Header: value + status + percentile */}
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
            optimalRange={optimalRange}
            unit={result.unit}
            statusColor={ss.dot}
          />
          {isNormalButSuboptimal && (
            <div className="mt-3 px-3 py-2 rounded-xl" style={{ background: "rgba(254,243,199,0.5)", border: "1px solid rgba(245,158,11,0.15)" }}>
              <p className="text-[11px] text-[#B45309] leading-snug">
                <strong>Your lab says &quot;normal&quot;</strong> &mdash; but your value of {result.value} {result.unit} sits outside the research-supported optimal range ({optimalRange!.optimal_low}&ndash;{optimalRange!.optimal_high}).
              </p>
            </div>
          )}
        </div>
      )}

      {/* What to do — green box */}
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

      {/* Citations */}
      {citations.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setCitationsOpen(!citationsOpen)}
            className="text-[12px] font-medium text-[#1B6B4A] hover:underline flex items-center gap-1"
          >
            Show {citations.length} cited studies
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transition: TRANSITION, transform: citationsOpen ? "rotate(180deg)" : "rotate(0)" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {citationsOpen && (
            <div className="mt-2 space-y-2">
              {citations.map((c, i) => (
                <div key={i} className="text-[11px] text-[#5A635D] leading-snug p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.5)" }}>
                  <span className="font-medium">{c.study.title}</span>
                  {c.study.journal && <span className="text-[#8A928C]"> &mdash; {c.study.journal}</span>}
                  {c.study.publication_year && <span className="text-[#8A928C]"> ({c.study.publication_year})</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
            <p className="text-[10px] text-[#8A928C] font-mono leading-relaxed" style={{ fontFamily: MONO }}>{pattern.citation}</p>
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
          {calc.warnings && calc.warnings.length > 0 && (
            <div className="space-y-2 mb-3">
              {calc.warnings.map((w: string, i: number) => (
                <div key={i} className="text-[11px] text-[#B91C1C] bg-[#FEE2E2]/60 rounded-xl px-3 py-2 flex items-start gap-2">
                  <span className="flex-shrink-0 mt-0.5">⚠</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {calc.missing.length > 0 && (
            <div className="text-[11px] text-[#B45309] bg-[#FEF3C7]/60 rounded-xl px-3 py-2 mb-3">
              Missing: {calc.missing.join(", ")}
            </div>
          )}
          <div className="text-[10px] text-[#8A928C] leading-relaxed mb-1">
            <span className="font-medium text-[#5A635D]">Inputs:</span> {calc.based_on || calc.research_based_on}
          </div>
          <div className="text-[10px] text-[#8A928C] leading-relaxed mb-2">
            <span className="font-medium text-[#5A635D]">Method:</span> {calc.research_based_on}
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

// =====================================================================
// PROFILE EDITOR
// =====================================================================

function ProfileEditor({ profile, onSave, onCancel }: { profile: UserProfile; onSave: (p: UserProfile) => void; onCancel: () => void }) {
  const [age, setAge] = useState<string>(profile.age ? String(profile.age) : "");
  const [sex, setSex] = useState<"" | "male" | "female">(profile.sex || "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smoker, setSmoker] = useState<boolean>(profile.isSmoker || false);
  const [sbp, setSbp] = useState<string>(profile.systolicBP ? String(profile.systolicBP) : "");

  return (
    <div className="p-5 mb-4" style={CARD}>
      <div className="text-[11px] uppercase tracking-wider text-[#8A928C] font-medium mb-3">Your profile</div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[11px] text-[#5A635D] block mb-1">Age</label>
          <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full text-[13px] bg-white/50 border border-white/30 rounded-xl px-3 py-2 focus:outline-none focus:border-[#1B6B4A]/50 focus:ring-1 focus:ring-[#1B6B4A]/20 transition-all" placeholder="e.g. 42" />
        </div>
        <div>
          <label className="text-[11px] text-[#5A635D] block mb-1">Sex</label>
          <select value={sex} onChange={(e) => setSex(e.target.value as "" | "male" | "female")} className="w-full text-[13px] bg-white/50 border border-white/30 rounded-xl px-3 py-2 focus:outline-none focus:border-[#1B6B4A]/50 focus:ring-1 focus:ring-[#1B6B4A]/20 transition-all">
            <option value="">&mdash;</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>
      {!showAdvanced ? (
        <button onClick={() => setShowAdvanced(true)} className="text-[11px] text-[#8A928C] hover:text-[#5A635D] mb-3">
          + Add blood pressure &amp; smoking status (optional, for risk calculations)
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[11px] text-[#5A635D] block mb-1">Blood pressure (top number)</label>
            <input type="number" value={sbp} onChange={(e) => setSbp(e.target.value)} className="w-full text-[13px] bg-white/50 border border-white/30 rounded-xl px-3 py-2 focus:outline-none focus:border-[#1B6B4A]/50 focus:ring-1 focus:ring-[#1B6B4A]/20 transition-all" placeholder="e.g. 120" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] text-[#0F1A15] cursor-pointer">
              <input type="checkbox" checked={smoker} onChange={(e) => setSmoker(e.target.checked)} className="rounded" />
              Smoker
            </label>
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-[12px] text-[#5A635D] hover:text-[#0F1A15] px-4 py-2 transition-colors">Cancel</button>
        <button
          onClick={() => onSave({ age: age ? parseInt(age, 10) : undefined, sex: sex || undefined, isSmoker: smoker, systolicBP: sbp ? parseInt(sbp, 10) : undefined })}
          className="text-[12px] font-semibold text-white bg-[#1B6B4A] hover:bg-[#155A3D] rounded-full px-5 py-2 transition-all duration-300"
        >
          Save
        </button>
      </div>
      <p className="text-[10px] text-[#8A928C] mt-3 leading-relaxed">Used for biological age and risk calculations. Never shared.</p>
    </div>
  );
}

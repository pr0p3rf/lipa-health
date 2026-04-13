import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { analyzeBiomarker, generateActionPlan, analyzePanelTwoPass } from "@/lib/living-research";
import { runAllCalculations, type BiomarkerValue, type UserProfile } from "@/lib/risk-calculations";

export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const { userId, testDate } = await request.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    console.log(`[analyze-bg] Starting background analysis for user ${userId}`);

    // Fetch the stored biomarker results
    const { data: insertedResults } = await supabase
      .from("biomarker_results")
      .select("*")
      .eq("user_id", userId)
      .eq("test_date", testDate || new Date().toISOString().split("T")[0])
      .order("id");

    if (!insertedResults || insertedResults.length === 0) {
      return NextResponse.json({ error: "No biomarker results found" }, { status: 404 });
    }

    // Fetch user profile
    const { data: profileData } = await supabase
      .from("user_profiles")
      .select("age, sex, is_smoker, systolic_bp")
      .eq("user_id", userId)
      .maybeSingle();

    const userProfile: UserProfile = profileData ? {
      age: profileData.age ?? undefined,
      sex: (profileData.sex as "male" | "female") ?? undefined,
      isSmoker: profileData.is_smoker ?? undefined,
      systolicBP: profileData.systolic_bp ?? undefined,
    } : {};

    // Build biomarker inputs
    const biomarkerInputs = insertedResults.map((r: any) => ({
      id: r.id,
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
      ref_low: r.ref_low,
      ref_high: r.ref_high,
      category: r.category,
      user_id: userId,
      test_date: testDate,
    }));

    // Progressive storage callback
    const storeBatch = async (batchIndex: number, analyses: any[]) => {
      console.log(`[analyze-bg] Storing batch ${batchIndex + 1} (${analyses.length} markers)...`);
      for (const analysis of analyses) {
        const matchedResult = insertedResults.find(
          (r: any) => r.biomarker.toLowerCase() === (analysis.biomarker_name || "").toLowerCase()
        );
        if (!matchedResult) continue;

        const { data: row, error } = await supabase
          .from("user_analyses")
          .insert({
            user_id: userId,
            biomarker_result_id: matchedResult.id,
            biomarker_name: analysis.biomarker_name,
            status: analysis.status,
            flag: analysis.flag,
            summary: analysis.summary,
            what_it_means: analysis.what_it_means,
            what_research_shows: analysis.what_research_shows,
            related_patterns: analysis.related_patterns,
            suggested_exploration: analysis.suggested_exploration,
            what_to_do: analysis.what_to_do || null,
            citation_count: analysis.citation_count,
            avg_study_year: analysis.avg_study_year,
            highest_evidence_grade: analysis.highest_evidence_grade,
            retrieval_time_ms: analysis.retrieval_time_ms,
            generation_time_ms: analysis.generation_time_ms,
          })
          .select()
          .single();

        if (error) {
          console.error(`[analyze-bg] Failed: ${analysis.biomarker_name}:`, error.message);
        } else if (row && analysis.citations?.length > 0) {
          await supabase.from("analysis_citations").insert(
            analysis.citations.map((c: any) => ({
              user_id: userId,
              biomarker_result_id: matchedResult.id,
              study_id: c.study_id,
              relevance_score: c.similarity,
              retrieval_rank: c.relevance_rank,
              biomarker_name: analysis.biomarker_name,
              query_used: "two-pass batch",
            }))
          );
        }
      }
    };

    // Try two-pass Opus first
    try {
      const result = await analyzePanelTwoPass(
        supabase, anthropic, null, biomarkerInputs,
        { age: userProfile.age, sex: userProfile.sex as "male" | "female" | undefined },
        storeBatch
      );

      console.log(`[analyze-bg] Two-pass complete: ${result.markers.length} markers in ${result.pass1_time_ms + result.pass2_time_ms}ms`);

      // Risk calculations
      const biomarkerValues: BiomarkerValue[] = insertedResults.map((r: any) => ({
        name: r.biomarker, value: r.value, unit: r.unit,
      }));
      const riskCalcs = runAllCalculations(biomarkerValues, userProfile);

      // Store action plan
      await supabase.from("action_plans").insert({
        user_id: userId,
        test_date: testDate || new Date().toISOString().split("T")[0],
        overall_summary: result.action_plan.overall_summary,
        disclaimer: result.action_plan.disclaimer,
        domains: result.action_plan.domains,
        generation_time_ms: result.action_plan.generation_time_ms,
      });

      return NextResponse.json({
        success: true,
        analyses: result.markers.length,
        riskCalcs: riskCalcs.length,
        hasActionPlan: true,
        timeMs: Date.now() - start,
      });

    } catch (twoPassError: any) {
      console.error("[analyze-bg] Two-pass failed, falling back to per-marker:", twoPassError.message);

      // Fallback: per-marker Sonnet analysis
      const CONCURRENCY = 5;
      const analyses = [];
      for (let i = 0; i < insertedResults.length; i += CONCURRENCY) {
        const batch = insertedResults.slice(i, i + CONCURRENCY);
        const results = await Promise.all(batch.map(async (r: any) => {
          try {
            const a = await analyzeBiomarker(supabase, anthropic, {
              id: r.id, name: r.biomarker, value: r.value, unit: r.unit,
              ref_low: r.ref_low, ref_high: r.ref_high, category: r.category,
              user_id: userId, test_date: testDate,
            });
            await supabase.from("user_analyses").insert({
              user_id: userId, biomarker_result_id: r.id, biomarker_name: a.biomarker_name,
              status: a.status, flag: a.flag, summary: a.summary,
              what_it_means: a.what_it_means, what_research_shows: a.what_research_shows,
              related_patterns: a.related_patterns, suggested_exploration: a.suggested_exploration,
              citation_count: a.citation_count, avg_study_year: a.avg_study_year,
              highest_evidence_grade: a.highest_evidence_grade,
              retrieval_time_ms: a.retrieval_time_ms, generation_time_ms: a.generation_time_ms,
            });
            return a;
          } catch { return null; }
        }));
        analyses.push(...results.filter(Boolean));
      }

      // Generate action plan
      try {
        const panelForPlan = analyses.filter(Boolean).map((a: any) => ({
          name: a.biomarker_name, value: 0, unit: null, status: a.status, flag: a.flag,
          summary: a.summary, what_research_shows: a.what_research_shows,
          suggested_exploration: a.suggested_exploration, category: "other",
        }));
        const biomarkerValues: BiomarkerValue[] = insertedResults.map((r: any) => ({
          name: r.biomarker, value: r.value, unit: r.unit,
        }));
        const riskCalcs = runAllCalculations(biomarkerValues, userProfile);
        const plan = await generateActionPlan(anthropic, panelForPlan, riskCalcs.map(c => ({
          name: c.name, value: c.value, interpretation: c.interpretation,
          interpretation_label: c.interpretation_label, summary: c.summary,
        })));
        await supabase.from("action_plans").insert({
          user_id: userId, test_date: testDate || new Date().toISOString().split("T")[0],
          overall_summary: plan.overall_summary, disclaimer: plan.disclaimer,
          domains: plan.domains, generation_time_ms: plan.generation_time_ms,
        });
      } catch (e) { console.error("[analyze-bg] Action plan failed:", e); }

      return NextResponse.json({ success: true, analyses: analyses.length, fallback: true });
    }

  } catch (error: any) {
    console.error("[analyze-bg] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { analyzeBiomarker, generateActionPlan } from "@/lib/living-research";
import { runAllCalculations, type BiomarkerValue, type UserProfile } from "@/lib/risk-calculations";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXTRACTION_PROMPT = `You are a medical laboratory results parser. Analyze this blood test document and extract ALL biomarker results AND the test date.

Return a JSON object with two fields:
1. "test_date": the date the blood was collected/tested, in YYYY-MM-DD format. Look for "Date of collection", "Sample date", "Date", "Datum", "Data pobrania", or similar. If not found, use null.
2. "biomarkers": an array of objects, each containing:
   - "name": the biomarker name (standardized English name, e.g., "Vitamin D (25-OH)", "hs-CRP", "TSH", "Total Cholesterol")
   - "value": the numeric value (number only, no units)
   - "unit": the unit of measurement (e.g., "ng/mL", "mg/L", "mIU/L", "mg/dL")
   - "ref_low": lower bound of the lab reference range (number or null)
   - "ref_high": upper bound of the lab reference range (number or null)
   - "category": one of: "metabolic", "hormonal", "inflammatory", "cardiac", "liver", "kidney", "thyroid", "hematology", "nutrient", "lipid", "other"

Important:
- Extract EVERY biomarker visible in the document
- Use standardized English names even if the document is in Polish, German, Dutch, or Spanish
- If a reference range shows "> X" or "< X", set the appropriate bound and leave the other as null
- Return ONLY the JSON object, no other text
- If you cannot read the document or find no biomarkers, return {"test_date": null, "biomarkers": []}

Return format: {"test_date": "2026-04-10", "biomarkers": [{"name": "...", "value": ..., "unit": "...", "ref_low": ..., "ref_high": ..., "category": "..."}, ...]}`;

export async function POST(request: NextRequest) {
  const overallStart = Date.now();

  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const testDate = formData.get("testDate") as string;

    // Support single file ("file") or multiple files ("files" or "file" repeated)
    const files: File[] = [];
    const singleFile = formData.get("file") as File | null;
    if (singleFile) files.push(singleFile);

    // Also check for multiple files via getAll
    const multiFiles = formData.getAll("files") as File[];
    if (multiFiles.length > 0) files.push(...multiFiles);

    if (files.length === 0 || !userId) {
      return NextResponse.json(
        { error: "At least one file and userId required" },
        { status: 400 }
      );
    }

    // Process all files — extract biomarkers from each
    let allBiomarkers: any[] = [];
    let totalExtractTimeMs = 0;
    let extractedTestDate: string | null = null;

    // ================================================================
    // STEP 1: Extract biomarkers from each file using Claude vision
    // ================================================================
    for (const file of files) {
      const extractStart = Date.now();

      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");

      const isPdf = file.type === "application/pdf";
      const mediaType = isPdf
        ? ("application/pdf" as const)
        : file.type.startsWith("image/")
        ? (file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
        : ("image/jpeg" as const);

      const extractionMessage = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 16384,
        messages: [
          {
            role: "user",
            content: [
              {
                type: isPdf ? "document" : "image",
                source: {
                  type: "base64",
                  media_type: mediaType,
                  data: base64,
                },
              } as any,
              {
                type: "text",
                text: EXTRACTION_PROMPT,
              },
            ],
          },
        ],
      });

      const extractTimeMs = Date.now() - extractStart;
      totalExtractTimeMs += extractTimeMs;

      const responseText =
        extractionMessage.content[0].type === "text"
          ? extractionMessage.content[0].text
          : "";

      // Parse response — try object format first, then array fallback
      let fileBiomarkers: any[] = [];
      try {
        // Try parsing as {"test_date": "...", "biomarkers": [...]}
        const jsonObjMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonObjMatch) {
          const parsed = JSON.parse(jsonObjMatch[0]);
          if (parsed.biomarkers && Array.isArray(parsed.biomarkers)) {
            fileBiomarkers = parsed.biomarkers;
            if (parsed.test_date && !testDate) {
              extractedTestDate = parsed.test_date;
            }
          }
        }
      } catch {
        // Object parse failed — try array fallback
      }

      if (fileBiomarkers.length === 0) {
        try {
          const jsonArrMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonArrMatch) {
            fileBiomarkers = JSON.parse(jsonArrMatch[0]);
          }
        } catch {
          console.error(`[analyze] Failed to parse biomarkers from ${file.name}:`, responseText.slice(0, 300));
        }
      }

      if (fileBiomarkers.length > 0) {
        allBiomarkers.push(...fileBiomarkers);
        console.log(`[analyze] Extracted ${fileBiomarkers.length} biomarkers from ${file.name} in ${extractTimeMs}ms`);
      } else {
        console.error(`[analyze] No biomarkers extracted from ${file.name}. Response start:`, responseText.slice(0, 300));
      }
    }

    const biomarkers = allBiomarkers;

    if (biomarkers.length === 0) {
      return NextResponse.json(
        { error: "No biomarkers could be extracted from the uploaded files" },
        { status: 500 }
      );
    }

    console.log(`[analyze] Total: ${biomarkers.length} biomarkers from ${files.length} file(s) in ${totalExtractTimeMs}ms`);

    // ================================================================
    // STEP 2: Store biomarker results
    // ================================================================
    // Priority: manual date > extracted from PDF > today
    const date = testDate || extractedTestDate || new Date().toISOString().split("T")[0];

    const records = biomarkers.map((b: any) => ({
      user_id: userId,
      test_date: date,
      biomarker: b.name,
      value: b.value,
      unit: b.unit || null,
      ref_low: b.ref_low || null,
      ref_high: b.ref_high || null,
      category: b.category || "other",
    }));

    let insertedResults: any[] = [];
    if (records.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("biomarker_results")
        .insert(records)
        .select();

      if (insertError) {
        console.error("DB insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to save results", details: insertError.message },
          { status: 500 }
        );
      }
      insertedResults = inserted || [];
    }

    // ================================================================
    // STEP 3: Living Research™ analysis for each biomarker
    // ================================================================
    // Run analyses in parallel (with concurrency limit)
    const CONCURRENCY = 5;
    const analyses = [];

    for (let i = 0; i < insertedResults.length; i += CONCURRENCY) {
      const batch = insertedResults.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map(async (result: any, idx: number) => {
        try {
          const analysis = await analyzeBiomarker(supabase, anthropic, {
            id: result.id,
            name: result.biomarker,
            value: result.value,
            unit: result.unit,
            ref_low: result.ref_low,
            ref_high: result.ref_high,
            category: result.category,
            user_id: userId,
            test_date: date,
          });

          // Store the analysis
          const { data: analysisRow, error: analysisError } = await supabase
            .from("user_analyses")
            .insert({
              user_id: userId,
              biomarker_result_id: result.id,
              biomarker_name: analysis.biomarker_name,
              status: analysis.status,
              flag: analysis.flag,
              summary: analysis.summary,
              what_it_means: analysis.what_it_means,
              what_research_shows: analysis.what_research_shows,
              related_patterns: analysis.related_patterns,
              suggested_exploration: analysis.suggested_exploration,
              citation_count: analysis.citation_count,
              avg_study_year: analysis.avg_study_year,
              highest_evidence_grade: analysis.highest_evidence_grade,
              retrieval_time_ms: analysis.retrieval_time_ms,
              generation_time_ms: analysis.generation_time_ms,
            })
            .select()
            .single();

          if (analysisError) {
            console.error(`Failed to store analysis for ${result.biomarker}:`, analysisError);
          } else if (analysisRow && analysis.citations.length > 0) {
            // Store citations
            const citationRecords = analysis.citations.map((c) => ({
              user_id: userId,
              biomarker_result_id: result.id,
              study_id: c.study_id,
              relevance_score: c.similarity,
              retrieval_rank: c.relevance_rank,
              biomarker_name: analysis.biomarker_name,
              query_used: `${analysis.canonical_name} analysis`,
            }));

            await supabase.from("analysis_citations").insert(citationRecords);
          }

          return analysis;
        } catch (err) {
          console.error(`Analysis failed for ${result.biomarker}:`, err);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      analyses.push(...batchResults.filter(Boolean));
    }

    // ================================================================
    // STEP 4: Run risk calculations
    // ================================================================
    const biomarkerValues: BiomarkerValue[] = insertedResults.map((r: any) => ({
      name: r.biomarker,
      value: r.value,
      unit: r.unit,
    }));

    // Fetch user profile for risk calculations requiring age/sex
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

    const riskCalcs = runAllCalculations(biomarkerValues, userProfile);

    console.log(`[analyze] ${riskCalcs.length} risk calculations computed`);

    // ================================================================
    // STEP 5: Generate personalized action plan
    // ================================================================
    let actionPlan = null;

    try {
      const panelForActionPlan = analyses
        .filter(Boolean)
        .map((a: any) => {
          const result = insertedResults.find((r: any) => r.biomarker === a.biomarker_name || r.id === a.biomarker_result_id);
          return {
            name: a.biomarker_name || a.canonical_name,
            value: result?.value ?? 0,
            unit: result?.unit ?? null,
            status: a.status,
            flag: a.flag,
            summary: a.summary,
            what_research_shows: a.what_research_shows,
            suggested_exploration: a.suggested_exploration,
            category: result?.category ?? "other",
          };
        });

      const riskCalcSummary = riskCalcs.map((r) => ({
        name: r.name,
        value: r.value,
        interpretation: r.interpretation,
        interpretation_label: r.interpretation_label,
        summary: r.summary,
      }));

      actionPlan = await generateActionPlan(anthropic, panelForActionPlan, riskCalcSummary);

      // Store action plan
      await supabase.from("action_plans").insert({
        user_id: userId,
        test_date: date,
        overall_summary: actionPlan.overall_summary,
        disclaimer: actionPlan.disclaimer,
        domains: actionPlan.domains,
        generation_time_ms: actionPlan.generation_time_ms,
      });

      console.log(
        `[analyze] Action plan generated in ${actionPlan.generation_time_ms}ms with ${actionPlan.domains.length} domains`
      );
    } catch (err) {
      console.error("[analyze] Action plan generation failed:", err);
    }

    const totalTimeMs = Date.now() - overallStart;

    console.log(
      `[analyze] Complete. ${analyses.length}/${insertedResults.length} analyses + action plan generated in ${totalTimeMs}ms`
    );

    return NextResponse.json({
      success: true,
      count: biomarkers.length,
      analyses_count: analyses.length,
      risk_calculations_count: riskCalcs.length,
      has_action_plan: !!actionPlan,
      extraction_time_ms: totalExtractTimeMs,
      total_time_ms: totalTimeMs,
      biomarkers,
      analyses,
      risk_calculations: riskCalcs,
      action_plan: actionPlan,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: error.message },
      { status: 500 }
    );
  }
}

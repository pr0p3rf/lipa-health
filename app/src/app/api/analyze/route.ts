import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";

export const maxDuration = 300; // Vercel Pro max

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

    // Rate limiting: check user's tier and upload count
    const { data: subData } = await supabase
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle();

    const tier = subData?.tier || "free";

    // Count uploads in the last 24 hours (use biomarker_results as proxy if uploads table doesn't exist)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let recentUploads = 0;
    try {
      const { count } = await supabase
        .from("uploads")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", oneDayAgo);
      recentUploads = count || 0;
    } catch {
      // uploads table may not exist — skip rate limiting
    }

    const dailyLimit = tier === "free" ? 5 : 20;
    if (recentUploads >= dailyLimit) {
      return NextResponse.json(
        { error: tier === "free"
          ? "Free accounts can upload 1 test per day. Upgrade to Lipa Life for more."
          : "You've reached the daily upload limit. Try again tomorrow."
        },
        { status: 429 }
      );
    }

    // (original validation moved above rate limiting)

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

    // Filter out markers with non-numeric values (e.g., "Negative", "Normal", "<0.01")
    const validBiomarkers = biomarkers.filter((b: any) => typeof b.value === "number" && !isNaN(b.value));
    console.log(`[analyze] ${validBiomarkers.length}/${biomarkers.length} markers have numeric values`);

    const records = validBiomarkers.map((b: any) => ({
      user_id: userId,
      test_date: date,
      biomarker: b.name,
      value: b.value,
      unit: b.unit || null,
      ref_low: typeof b.ref_low === "number" ? b.ref_low : null,
      ref_high: typeof b.ref_high === "number" ? b.ref_high : null,
      category: b.category || "other",
    }));

    let insertedResults: any[] = [];
    if (records.length > 0) {
      // Clean up any existing data for this user + date (re-upload / duplicate prevention)
      await supabase.from("analysis_citations").delete().eq("user_id", userId);
      await supabase.from("user_analyses").delete().eq("user_id", userId);
      await supabase.from("action_plans").delete().eq("user_id", userId);
      await supabase.from("biomarker_results").delete().eq("user_id", userId).eq("test_date", date);

      const { data: inserted, error: insertError } = await supabase
        .from("biomarker_results")
        .insert(records)
        .select();

      if (insertError) {
        console.error("DB insert error:", insertError);
        console.error("First record:", JSON.stringify(records[0]));
        console.error("Record count:", records.length);
        return NextResponse.json(
          { error: "Failed to save results", details: insertError.message },
          { status: 500 }
        );
      }
      insertedResults = inserted || [];
    }

    // Send Inngest event to trigger background analysis
    await inngest.send({
      name: "lipa/panel.uploaded",
      data: {
        userId,
        testDate: date,
      },
    });

    console.log(`[analyze] Sent lipa/panel.uploaded event for user ${userId}, date ${date}`);

    return NextResponse.json({
      success: true,
      count: validBiomarkers.length,
      testDate: date,
      analyses_count: 0,
      risk_calculations_count: 0,
      has_action_plan: false,
      extraction_time_ms: totalExtractTimeMs,
      total_time_ms: Date.now() - overallStart,
      message: `${validBiomarkers.length} biomarkers extracted. Analysis running in background.`,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: error.message },
      { status: 500 }
    );
  }
}


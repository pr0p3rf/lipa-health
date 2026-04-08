import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXTRACTION_PROMPT = `You are a medical laboratory results parser. Analyze this blood test document and extract ALL biomarker results.

For each biomarker found, return a JSON array with objects containing:
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
- Return ONLY the JSON array, no other text
- If you cannot read the document or find no biomarkers, return an empty array []

Return format: [{"name": "...", "value": ..., "unit": "...", "ref_low": ..., "ref_high": ..., "category": "..."}, ...]`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;
    const testDate = formData.get("testDate") as string;

    if (!file || !userId) {
      return NextResponse.json(
        { error: "File and userId required" },
        { status: 400 }
      );
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    // Determine media type
    const isPdf = file.type === "application/pdf";
    const mediaType = isPdf
      ? "application/pdf" as const
      : file.type.startsWith("image/")
      ? (file.type as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
      : "image/jpeg" as const;

    // Send to Claude Vision
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
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

    // Parse Claude's response
    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let biomarkers;
    try {
      biomarkers = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse biomarker data", raw: responseText },
        { status: 500 }
      );
    }

    // Store in database
    const date = testDate || new Date().toISOString().split("T")[0];

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

    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from("biomarker_results")
        .insert(records);

      if (insertError) {
        console.error("DB insert error:", insertError);
        return NextResponse.json(
          { error: "Failed to save results", details: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      count: biomarkers.length,
      biomarkers,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: error.message },
      { status: 500 }
    );
  }
}

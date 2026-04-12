/**
 * =====================================================================
 * LIVING RESEARCH™ — RAG Retrieval and Analysis
 * =====================================================================
 *
 * Core engine for Lipa's biomarker analysis:
 *   1. Normalize biomarker name → canonical form
 *   2. Embed query using OpenAI
 *   3. Retrieve relevant studies via pgvector similarity
 *   4. Generate research-grounded analysis via Claude
 *   5. Store analysis + citations for audit
 * =====================================================================
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface BiomarkerInput {
  id?: number;
  name: string;
  value: number;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  category: string;
  user_id: string;
  test_date: string;
}

export interface RetrievedStudy {
  id: number;
  pmid: string | null;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publication_year: number | null;
  study_type: string;
  grade_score: "HIGH" | "MODERATE" | "LOW" | "VERY_LOW" | null;
  confidence_score: number;
  similarity: number;
}

export interface BiomarkerReference {
  id: number;
  canonical_name: string;
  aliases: string[];
  abbreviation: string | null;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  what_it_measures: string | null;
  why_it_matters: string | null;
  standard_unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  optimal_low: number | null;
  optimal_high: number | null;
}

export interface LivingResearchAnalysis {
  biomarker_name: string;
  canonical_name: string;
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
  retrieval_time_ms: number;
  generation_time_ms: number;
  citations: Array<{
    study_id: number;
    pmid: string | null;
    title: string;
    authors: string[];
    journal: string;
    year: number | null;
    grade: string | null;
    similarity: number;
    relevance_rank: number;
  }>;
}

// ---------------------------------------------------------------------
// OpenAI client (for embeddings)
// ---------------------------------------------------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ---------------------------------------------------------------------
// Biomarker name normalization
// ---------------------------------------------------------------------

/**
 * Find the canonical biomarker reference by matching name or alias.
 */
export async function findBiomarkerReference(
  supabase: SupabaseClient,
  biomarkerName: string
): Promise<BiomarkerReference | null> {
  const trimmed = biomarkerName.trim();

  // Try exact canonical match first
  const { data: exactMatch } = await supabase
    .from("biomarker_reference")
    .select("*")
    .ilike("canonical_name", trimmed)
    .limit(1)
    .maybeSingle();

  if (exactMatch) return exactMatch;

  // Try alias match
  const { data: aliasMatch } = await supabase
    .from("biomarker_reference")
    .select("*")
    .contains("aliases", [trimmed])
    .limit(1)
    .maybeSingle();

  if (aliasMatch) return aliasMatch;

  // Fuzzy fallback: check if name appears anywhere
  const { data: fuzzyMatch } = await supabase
    .from("biomarker_reference")
    .select("*")
    .or(`canonical_name.ilike.%${trimmed}%,abbreviation.ilike.%${trimmed}%`)
    .limit(1)
    .maybeSingle();

  return fuzzyMatch;
}

// ---------------------------------------------------------------------
// Status computation
// ---------------------------------------------------------------------

export function computeStatus(
  value: number,
  reference: BiomarkerReference | null,
  labRefLow: number | null,
  labRefHigh: number | null
): { status: "optimal" | "normal" | "borderline" | "out_of_range"; flag: "low" | "high" | "optimal" | "borderline" | "unknown" } {
  // Prefer canonical optimal range from reference; fall back to lab range
  const optimalLow = reference?.optimal_low;
  const optimalHigh = reference?.optimal_high;
  const refLow = labRefLow ?? reference?.ref_low;
  const refHigh = labRefHigh ?? reference?.ref_high;

  // Out of range (lab reference)
  if (refLow !== null && refLow !== undefined && value < refLow) {
    return { status: "out_of_range", flag: "low" };
  }
  if (refHigh !== null && refHigh !== undefined && value > refHigh) {
    return { status: "out_of_range", flag: "high" };
  }

  // Optimal range (Lipa's evidence-based)
  if (optimalLow !== null && optimalLow !== undefined && optimalHigh !== null && optimalHigh !== undefined) {
    if (value >= optimalLow && value <= optimalHigh) {
      return { status: "optimal", flag: "optimal" };
    }
    return { status: "borderline", flag: "borderline" };
  }

  // No optimal range defined; if in lab range, it's normal
  if (refLow !== null && refLow !== undefined && refHigh !== null && refHigh !== undefined &&
      value >= refLow && value <= refHigh) {
    return { status: "normal", flag: "optimal" };
  }

  return { status: "normal", flag: "unknown" };
}

// ---------------------------------------------------------------------
// RAG Retrieval
// ---------------------------------------------------------------------

/**
 * Retrieve relevant studies for a biomarker from the Living Research™ corpus.
 *
 * 1. Embed the query with OpenAI
 * 2. Call Supabase match_research_studies RPC for vector similarity
 * 3. Return ranked studies
 */
export async function retrieveStudiesForBiomarker(
  supabase: SupabaseClient,
  biomarkerName: string,
  canonicalName: string | null,
  userContext?: { value: number; flag: string; ageGroup?: string }
): Promise<{ studies: RetrievedStudy[]; retrievalTimeMs: number }> {
  const start = Date.now();

  // Build a contextual query for embedding
  const contextParts = [
    canonicalName || biomarkerName,
    userContext ? `value ${userContext.value} status ${userContext.flag}` : "",
    "clinical significance, reference ranges, optimal levels, associated conditions",
  ].filter(Boolean);

  const queryText = contextParts.join(" ");

  // Embed query
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: queryText,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Call Supabase similarity search
  const { data, error } = await supabase.rpc("match_research_studies", {
    query_embedding: queryEmbedding,
    match_threshold: 0.35,
    match_count: 15,
    filter_biomarker: canonicalName || null,
  });

  const retrievalTimeMs = Date.now() - start;

  if (error) {
    console.error("RAG retrieval error:", error);
    return { studies: [], retrievalTimeMs };
  }

  return { studies: data || [], retrievalTimeMs };
}

// ---------------------------------------------------------------------
// Analysis generation via Claude
// ---------------------------------------------------------------------

const ANALYSIS_SYSTEM_PROMPT = `You are Lipa's Living Research™ analysis engine. You analyze biomarker results by grounding every insight in retrieved peer-reviewed research studies.

Your job: given a user's biomarker value and relevant studies, produce a research-grounded analysis.

CRITICAL RULES:
1. Ground every claim in the provided studies. Do NOT use general knowledge.
2. If the studies don't directly address something, say so honestly.
3. NEVER give medical advice, diagnose, or recommend specific treatments.
4. Use phrases like "In published research...", "Studies have observed...", "Researchers have found..."
5. Be educational, not prescriptive.
6. When citing, reference studies by author/year format (e.g., "Smith et al., 2023").
7. Always remind the user to consult their healthcare provider for medical decisions.

You MUST return valid JSON matching this exact schema:
{
  "summary": "1-2 sentence plain-English takeaway about this biomarker value",
  "what_it_means": "2-3 sentences explaining what the value suggests, grounded in research",
  "what_research_shows": "3-5 sentences synthesizing the retrieved studies with author/year citations",
  "related_patterns": "Optional: if research commonly connects this marker to other biomarkers or patterns, mention it (null if not applicable)",
  "suggested_exploration": "Optional: 'Research has studied these topics in relation to [biomarker]...' (null if no relevant topics from the studies)"
}`;

/**
 * Generate a research-grounded analysis for a single biomarker.
 */
export async function generateAnalysis(
  anthropic: Anthropic,
  biomarker: BiomarkerInput,
  reference: BiomarkerReference | null,
  studies: RetrievedStudy[],
  status: { status: string; flag: string }
): Promise<{
  analysis: {
    summary: string;
    what_it_means: string;
    what_research_shows: string;
    related_patterns: string | null;
    suggested_exploration: string | null;
  };
  generationTimeMs: number;
}> {
  const start = Date.now();

  // Build the studies context (top 10 most relevant)
  const studiesContext = studies
    .slice(0, 10)
    .map((s, i) => {
      const authorStr = s.authors && s.authors.length > 0
        ? `${s.authors[0].split(" ").pop()} et al.`
        : "Unknown";
      return `[STUDY ${i + 1}] ${authorStr}, ${s.publication_year || "n.d."} (${s.study_type || "Article"}, Evidence: ${s.grade_score || "UNGRADED"})
Title: ${s.title}
Abstract: ${s.abstract.substring(0, 800)}${s.abstract.length > 800 ? "..." : ""}
Journal: ${s.journal || "Unknown"}
`;
    })
    .join("\n---\n\n");

  const userPrompt = `BIOMARKER: ${biomarker.name}
USER VALUE: ${biomarker.value} ${biomarker.unit || ""}
LAB REFERENCE: ${biomarker.ref_low ?? "N/A"} - ${biomarker.ref_high ?? "N/A"} ${biomarker.unit || ""}
STATUS: ${status.status} (${status.flag})

${reference ? `CANONICAL NAME: ${reference.canonical_name}
CATEGORY: ${reference.category}
WHAT IT MEASURES: ${reference.what_it_measures || "N/A"}
WHY IT MATTERS: ${reference.why_it_matters || "N/A"}
LIPA OPTIMAL RANGE: ${reference.optimal_low ?? "N/A"} - ${reference.optimal_high ?? "N/A"} ${reference.standard_unit || ""}` : ""}

RETRIEVED STUDIES (top ${Math.min(studies.length, 10)} most relevant):

${studiesContext || "(No studies retrieved — generate a conservative analysis noting the absence of direct research in our corpus.)"}

Now generate the analysis. Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const generationTimeMs = Date.now() - start;

  // Extract JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in analysis response");
  }

  const analysis = JSON.parse(jsonMatch[0]);
  return { analysis, generationTimeMs };
}

// ---------------------------------------------------------------------
// Full pipeline: analyze one biomarker end-to-end
// ---------------------------------------------------------------------

export async function analyzeBiomarker(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  biomarker: BiomarkerInput
): Promise<LivingResearchAnalysis> {
  // 1. Find canonical reference
  const reference = await findBiomarkerReference(supabase, biomarker.name);

  // 2. Compute status
  const status = computeStatus(
    biomarker.value,
    reference,
    biomarker.ref_low,
    biomarker.ref_high
  );

  // 3. Retrieve relevant studies
  const { studies, retrievalTimeMs } = await retrieveStudiesForBiomarker(
    supabase,
    biomarker.name,
    reference?.canonical_name || null,
    { value: biomarker.value, flag: status.flag }
  );

  // 4. Generate analysis
  const { analysis, generationTimeMs } = await generateAnalysis(
    anthropic,
    biomarker,
    reference,
    studies,
    status
  );

  // 5. Build citation list
  const citations = studies.slice(0, 10).map((s, i) => ({
    study_id: s.id,
    pmid: s.pmid,
    title: s.title,
    authors: s.authors || [],
    journal: s.journal,
    year: s.publication_year,
    grade: s.grade_score,
    similarity: s.similarity,
    relevance_rank: i + 1,
  }));

  // 6. Compute metadata
  const years = studies.filter(s => s.publication_year).map(s => s.publication_year!);
  const avgYear = years.length > 0 ? Math.round(years.reduce((a, b) => a + b, 0) / years.length) : null;
  const grades = studies.map(s => s.grade_score).filter(Boolean);
  const highestGrade = grades.includes("HIGH") ? "HIGH"
    : grades.includes("MODERATE") ? "MODERATE"
    : grades.includes("LOW") ? "LOW"
    : null;

  return {
    biomarker_name: biomarker.name,
    canonical_name: reference?.canonical_name || biomarker.name,
    status: status.status,
    flag: status.flag,
    summary: analysis.summary,
    what_it_means: analysis.what_it_means,
    what_research_shows: analysis.what_research_shows,
    related_patterns: analysis.related_patterns,
    suggested_exploration: analysis.suggested_exploration,
    citation_count: citations.length,
    highest_evidence_grade: highestGrade,
    avg_study_year: avgYear,
    retrieval_time_ms: retrievalTimeMs,
    generation_time_ms: generationTimeMs,
    citations,
  };
}

// ---------------------------------------------------------------------
// Action Plan generation (cross-biomarker, 6 domains)
// ---------------------------------------------------------------------

export interface ActionPlanItemDetails {
  dosage_range: string | null;
  best_form: string | null;
  timing: string | null;
  food_sources: string | null;
  interactions: string | null;
  important_notes: string | null;
}

export interface ActionPlanItem {
  text: string;
  markers_addressed: string[];
  research_basis: string;
  cited_studies: number;
  details: ActionPlanItemDetails | null;
}

export interface ActionPlanDomain {
  domain: "nutrition" | "supplementation" | "sleep" | "movement" | "environment" | "lifestyle";
  recommendations: ActionPlanItem[];
}

export interface ActionPlan {
  domains: ActionPlanDomain[];
  overall_summary: string;
  disclaimer: string;
  generation_time_ms: number;
}

const ACTION_PLAN_SYSTEM_PROMPT = `You are Lipa's personalized action plan generator. Given a user's complete biomarker panel with individual analyses, generate a DEEPLY DETAILED, research-grounded personalized action plan across six life domains.

CRITICAL RULES:
1. Ground every recommendation in published research. Reference the biomarker analyses and their cited studies.
2. NEVER recommend prescription medications or specific medical treatments.
3. Frame as research exploration: "Research has explored...", "Studies have found...", "The literature suggests..."
4. Organize into exactly 6 domains: nutrition, supplementation, sleep, movement, environment, lifestyle.
5. For each recommendation, note which biomarker(s) it addresses.
6. Be DEEPLY SPECIFIC and practical — not generic wellness advice. This is the difference between free and paid.
7. Focus on borderline and out-of-range markers.
8. Include 2-4 recommendations per domain. Skip if no relevant markers (empty array).
9. Write in warm, supportive, direct plain English. No unexplained jargon.

FOR EACH RECOMMENDATION, provide a "details" object with:
- "dosage_range": What dose ranges have clinical trials explored? Be specific with numbers from the research. Say "null" if not applicable (e.g., for lifestyle changes).
- "best_form": What form/type is best-studied? (e.g., "Triglyceride-form EPA+DHA" or "Magnesium glycinate or threonate" or "Methylcobalamin, not cyanocobalamin"). Say null if not applicable.
- "timing": When to take it / when to do it? With food? Morning vs evening? Before or after exercise? What does the research suggest?
- "food_sources": Natural whole-food alternatives or sources. Be specific — name actual foods and approximate quantities where research supports it.
- "interactions": What NOT to combine it with. Drug interactions, nutrient interactions, timing conflicts. Be specific and cite if possible.
- "important_notes": Any other critical context — quality markers to look for (third-party testing, certifications), common mistakes, what to monitor, when to retest.

The goal: a reader should be able to take this action plan to a pharmacy, a grocery store, or their daily routine and know EXACTLY what to do, what form, what amount, when, and what to watch out for — all grounded in published research.

Return ONLY valid JSON matching this schema:
{
  "domains": [
    {
      "domain": "nutrition",
      "recommendations": [
        {
          "text": "Concise plain-English recommendation headline",
          "markers_addressed": ["hs-CRP", "fasting insulin"],
          "research_basis": "2-3 sentences grounding this in specific research with author/year citations where possible.",
          "cited_studies": 3,
          "details": {
            "dosage_range": "Specific dose ranges from published trials, or null",
            "best_form": "Best-studied form/type, or null",
            "timing": "When/how to take or do this based on research, or null",
            "food_sources": "Specific whole-food alternatives with quantities, or null",
            "interactions": "What not to combine with — drug and nutrient interactions, or null",
            "important_notes": "Quality markers, common mistakes, monitoring advice, or null"
          }
        }
      ]
    }
  ],
  "overall_summary": "2-3 sentence plain-English summary of top priorities from this panel",
  "disclaimer": "This action plan is based on published research and is educational content, not medical advice. Discuss any changes with your healthcare provider before starting."
}`;

/**
 * Generate a personalized action plan across 6 life domains based on the
 * user's full biomarker panel and individual analyses.
 *
 * Called AFTER all individual biomarker analyses are complete.
 */
export async function generateActionPlan(
  anthropic: Anthropic,
  biomarkerResults: Array<{
    name: string;
    value: number;
    unit: string | null;
    status: string;
    flag: string;
    summary: string;
    what_research_shows: string;
    suggested_exploration: string | null;
    category: string;
  }>,
  riskCalculations?: Array<{
    name: string;
    value: string | number;
    interpretation: string;
    interpretation_label: string;
    summary: string;
  }>
): Promise<ActionPlan> {
  const start = Date.now();

  // Build condensed panel summary for the prompt
  const panelSummary = biomarkerResults
    .map((b) => {
      const statusIcon =
        b.status === "optimal" ? "✓"
        : b.status === "out_of_range" ? "⚠️ OUT"
        : b.status === "borderline" ? "⚡ BORDERLINE"
        : "—";
      return `${b.name}: ${b.value} ${b.unit || ""} [${statusIcon}] — ${b.summary}`;
    })
    .join("\n");

  const riskSummary = riskCalculations
    ? riskCalculations
        .map((r) => `${r.name}: ${r.value} (${r.interpretation_label}) — ${r.summary}`)
        .join("\n")
    : "No risk calculations available.";

  // Focus on borderline + out of range for the action plan
  const priorityMarkers = biomarkerResults
    .filter((b) => b.status === "borderline" || b.status === "out_of_range")
    .map((b) => `${b.name} (${b.value} ${b.unit || ""}, ${b.status}): ${b.what_research_shows}\n${b.suggested_exploration ? `Exploration: ${b.suggested_exploration}` : ""}`)
    .join("\n\n");

  const userPrompt = `COMPLETE BIOMARKER PANEL (${biomarkerResults.length} markers):

${panelSummary}

RISK CALCULATIONS:
${riskSummary}

PRIORITY MARKERS (borderline or out of range — focus the action plan here):

${priorityMarkers || "(All markers are optimal or normal — generate a maintenance plan.)"}

Generate the personalized action plan. Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 6000,
    system: ACTION_PLAN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  const generationTimeMs = Date.now() - start;

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in action plan response");
  }

  const plan = JSON.parse(jsonMatch[0]);

  return {
    domains: plan.domains || [],
    overall_summary: plan.overall_summary || "",
    disclaimer: plan.disclaimer || "This is educational content, not medical advice. Consult your healthcare provider.",
    generation_time_ms: generationTimeMs,
  };
}

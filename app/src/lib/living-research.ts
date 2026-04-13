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
// OpenAI client (for embeddings) — lazy init to allow env loading
// ---------------------------------------------------------------------

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

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
    // Only borderline if meaningfully outside optimal but still in lab range
    // If value is within the middle 70% of lab range, call it "normal" not "borderline"
    if (refLow !== null && refLow !== undefined && refHigh !== null && refHigh !== undefined) {
      const rangeSize = refHigh - refLow;
      const midLow = refLow + rangeSize * 0.15;
      const midHigh = refHigh - rangeSize * 0.15;
      if (value >= midLow && value <= midHigh) {
        return { status: "normal", flag: "borderline" };
      }
    }
    return { status: "borderline", flag: value < optimalLow ? "low" : "high" };
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
  const embeddingResponse = await getOpenAI().embeddings.create({
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

const ANALYSIS_SYSTEM_PROMPT = `You are Lipa's analysis engine. You explain blood test results to regular people — not doctors, not scientists. Write like a smart, warm friend who happens to know a lot about health.

YOUR AUDIENCE: A 30-year-old who got their blood test back and wants to understand it. They're smart but not medical professionals. They want to know: is this good or bad? Should I worry? What can I do?

VOICE:
- Plain English. Short sentences. No jargon.
- Say "your body" not "the organism." Say "fight off infections" not "immune function." Say "how well your kidneys work" not "renal function."
- Be direct: "This is low" not "This value falls below the optimal threshold."
- Be specific to THEIR value: "At 12.4, your hemoglobin is at the low end" not "Hemoglobin measures oxygen-carrying capacity."
- Be warm but honest. Don't sugarcoat, don't alarm.

GROUNDING:
1. ALWAYS give a complete, useful analysis. Never say "no studies found."
2. When retrieved studies are available, cite them naturally: "A 2024 study of 160,000 people found..." (not "Smith et al., 2024 demonstrated...")
3. When no studies are retrieved, use established medical knowledge. Say "Research has consistently shown..." or "Doctors typically look for..."
4. NEVER give medical advice or recommend treatments. Frame as: "Some people discuss with their doctor..." or "Research has looked at..."

You MUST return valid JSON matching this exact schema:
{
  "summary": "1 sentence, plain English. What does this result mean for me? e.g. 'Your iron is low — this could explain feeling tired or short of breath.'",
  "what_it_means": "2-3 short sentences. What does this marker do in my body, and what does my specific value suggest? Be concrete and personal.",
  "what_research_shows": "2-4 sentences. What has research found about values like mine? Cite studies naturally when available. Keep it conversational, not academic.",
  "related_patterns": "1-2 sentences connecting this to other markers if relevant (e.g. 'Low iron often shows up alongside low hemoglobin and ferritin'). null if nothing relevant.",
  "suggested_exploration": "1 sentence suggesting what else to look into. e.g. 'If this stays low, a full iron panel (ferritin, TIBC, transferrin saturation) can give a clearer picture.' null only if truly nothing."
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

const ACTION_PLAN_SYSTEM_PROMPT = `You are Lipa's action plan generator. You create specific, actionable health plans based on someone's blood test results.

Write like a knowledgeable friend — warm, direct, practical. Your reader is smart but not a doctor. They want to know exactly what to do, not read a research paper.

RULES:
1. Be SPECIFIC. "Take 2,000mg EPA+DHA omega-3 daily" not "increase omega-3 intake." "Take 2,000-4,000 IU vitamin D3 with a fat-containing meal" not "consider vitamin D supplementation."
2. NEVER recommend prescription medications. DO recommend supplements, vitamins, minerals, and OTC nutrients when the biomarkers support it.
3. Say "Research has found..." or "Studies show..." — never "the literature suggests" or "evidence indicates."
4. Organize into exactly 6 domains: nutrition, supplementation, sleep, movement, environment, lifestyle.
5. Note which biomarker(s) each recommendation addresses.
6. Focus on what's borderline or out of range. Don't give generic wellness advice for markers that are fine.
7. Include 2-4 recommendations per domain. For environment and lifestyle, always include at least 1 recommendation if any markers are borderline or out of range — even general ones like reducing toxin exposure or managing stress. Only skip a domain if truly nothing applies.
8. Short sentences. No jargon. If you must use a technical term, explain it in parentheses.
9. IMPORTANT: If a marker is low or out of range, ALWAYS include a supplement recommendation in the supplementation domain — not just dietary advice. For example: low omega-3 → recommend fish oil supplement AND dietary fish. Low vitamin D → recommend D3 supplement AND sun exposure. Low iron → recommend iron bisglycinate AND iron-rich foods. People expect to see supplement recommendations when their markers are low.
10. Include NATURAL and HOLISTIC interventions where research supports them. This means:
    - Adaptogens and herbs: ashwagandha for cortisol, berberine for glucose/lipids, curcumin for inflammation, milk thistle for liver support — but only cite research-backed options
    - Mind-body: meditation/breathwork for cortisol and HRV, cold exposure for inflammation, sauna for cardiovascular markers
    - Specific functional foods: bone broth for gut, fermented foods for inflammation, cruciferous vegetables for liver detox pathways, Brazil nuts for selenium
    - Environmental: reducing plastics/BPA exposure for hormones, water filtration, air quality for inflammatory markers
    - Don't be generic — be as specific as "10 minutes of box breathing before bed lowers morning cortisol by 15% in published studies"
    - Always ground in research. The holistic recommendations should be just as cited as the conventional ones.

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
// ---------------------------------------------------------------------
// TWO-PASS PANEL ANALYSIS — batch RAG + single Opus call
// ---------------------------------------------------------------------

/**
 * Category groupings for batch RAG retrieval.
 * Each group gets ONE embedding + ONE vector search.
 */
const CATEGORY_GROUPS: Record<string, string[]> = {
  metabolic_lipid: ["metabolic", "lipid"],
  hormonal_thyroid: ["hormonal", "thyroid"],
  inflammatory_cardiac: ["inflammatory", "cardiac"],
  liver_kidney: ["liver", "kidney"],
  hematology_nutrient: ["hematology", "nutrient"],
  other: ["other"],
};

function groupBiomarkersByCategory(
  biomarkers: BiomarkerInput[]
): Map<string, BiomarkerInput[]> {
  const groups = new Map<string, BiomarkerInput[]>();

  for (const bm of biomarkers) {
    let assignedGroup = "other";
    for (const [groupName, categories] of Object.entries(CATEGORY_GROUPS)) {
      if (categories.includes(bm.category?.toLowerCase() || "other")) {
        assignedGroup = groupName;
        break;
      }
    }
    if (!groups.has(assignedGroup)) groups.set(assignedGroup, []);
    groups.get(assignedGroup)!.push(bm);
  }

  return groups;
}

/**
 * Build a batch RAG query for a group of biomarkers.
 * Combines marker names + key clinical terms into one embedding query.
 */
function buildGroupQuery(
  biomarkers: BiomarkerInput[],
  references: Map<string, BiomarkerReference>
): string {
  const names = biomarkers.map(
    (b) => references.get(b.name)?.canonical_name || b.name
  );
  // Add clinical context keywords based on flags
  const contextTerms: string[] = [];
  for (const bm of biomarkers) {
    const ref = references.get(bm.name);
    const status = computeStatus(bm.value, ref || null, bm.ref_low, bm.ref_high);
    if (status.flag === "low") contextTerms.push("deficiency", "low levels");
    if (status.flag === "high") contextTerms.push("elevated", "excess");
  }
  const unique = [...new Set([...names, ...contextTerms])];
  return unique.join(" ") + " clinical significance optimal levels";
}

/**
 * Embed a query and retrieve studies from the Living Research corpus.
 * Reuses the same Supabase RPC as retrieveStudiesForBiomarker but
 * with a broader query and no single-biomarker filter.
 */
async function batchRetrieveStudies(
  supabase: SupabaseClient,
  queryText: string,
  matchCount: number = 20
): Promise<RetrievedStudy[]> {
  const embeddingResponse = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: queryText,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const { data, error } = await supabase.rpc("match_research_studies", {
    query_embedding: queryEmbedding,
    match_threshold: 0.30,
    match_count: matchCount,
    filter_biomarker: null,
  });

  if (error) {
    console.error("Batch RAG retrieval error:", error);
    return [];
  }

  return data || [];
}

const TWO_PASS_SYSTEM_PROMPT = `You are Lipa's comprehensive analysis engine. You have the COMPLETE blood panel in front of you — every single marker the user tested. Analyze markers in the context of each other.

YOUR AUDIENCE: A 30-year-old who got their blood test back and wants to understand it. They're smart but not medical professionals. They want to know: is this good or bad? Should I worry? What can I do?

VOICE:
- Plain English. Short sentences. No jargon.
- Say "your body" not "the organism." Say "fight off infections" not "immune function." Say "how well your kidneys work" not "renal function."
- Be direct: "This is low" not "This value falls below the optimal threshold."
- Be specific to THEIR value: "At 12.4, your hemoglobin is at the low end" not "Hemoglobin measures oxygen-carrying capacity."
- Be warm but honest. Don't sugarcoat, don't alarm.

GROUNDING:
1. ALWAYS give a complete, useful analysis for every marker. Never say "no studies found."
2. When retrieved studies are available, cite them naturally: "A 2024 study of 160,000 people found..." (not "Smith et al., 2024 demonstrated...")
3. When no studies are retrieved for a marker, use established medical knowledge. Say "Research has consistently shown..." or "Doctors typically look for..."
4. NEVER give medical advice or recommend treatments in the marker analyses. Frame as: "Some people discuss with their doctor..." or "Research has looked at..."
5. Look for PATTERNS across markers. If iron, ferritin, and hemoglobin are all low, that's a pattern. If LDL is high and HDL is low, that's a pattern. Call these out.

ACTION PLAN RULES:
1. Be SPECIFIC. "Take 2,000mg EPA+DHA omega-3 daily" not "increase omega-3 intake." "Take 2,000-4,000 IU vitamin D3 with a fat-containing meal" not "consider vitamin D supplementation."
2. NEVER recommend prescription medications. DO recommend supplements, vitamins, minerals, and OTC nutrients when the biomarkers support it.
3. Say "Research has found..." or "Studies show..." — never "the literature suggests" or "evidence indicates."
4. Organize into exactly 6 domains: nutrition, supplementation, sleep, movement, environment, lifestyle.
5. Note which biomarker(s) each recommendation addresses.
6. Focus on what's borderline or out of range. Don't give generic wellness advice for markers that are fine.
7. Include 2-4 recommendations per domain. For environment and lifestyle, always include at least 1 recommendation if any markers are borderline or out of range. Only skip a domain if truly nothing applies.
8. Short sentences. No jargon. If you must use a technical term, explain it in parentheses.
9. IMPORTANT: If a marker is low or out of range, ALWAYS include a supplement recommendation in the supplementation domain — not just dietary advice.
10. Include NATURAL and HOLISTIC interventions where research supports them:
    - Adaptogens and herbs: ashwagandha for cortisol, berberine for glucose/lipids, curcumin for inflammation, milk thistle for liver support — but only cite research-backed options
    - Mind-body: meditation/breathwork for cortisol and HRV, cold exposure for inflammation, sauna for cardiovascular markers
    - Specific functional foods: bone broth for gut, fermented foods for inflammation, cruciferous vegetables for liver detox pathways, Brazil nuts for selenium
    - Environmental: reducing plastics/BPA exposure for hormones, water filtration, air quality for inflammatory markers
    - Don't be generic — be as specific as "10 minutes of box breathing before bed lowers morning cortisol by 15% in published studies"
    - Always ground in research. The holistic recommendations should be just as cited as the conventional ones.

FOR EACH ACTION PLAN RECOMMENDATION, provide a "details" object with:
- "dosage_range": What dose ranges have clinical trials explored? Be specific with numbers. null if not applicable.
- "best_form": What form/type is best-studied? null if not applicable.
- "timing": When to take it / when to do it? With food? Morning vs evening?
- "food_sources": Natural whole-food alternatives. Be specific — name actual foods and approximate quantities.
- "interactions": What NOT to combine it with. Drug interactions, nutrient interactions, timing conflicts.
- "important_notes": Quality markers to look for, common mistakes, what to monitor, when to retest.

You MUST return valid JSON matching this exact schema:
{
  "executive_summary": "3-5 sentences summarizing the most important findings from the full panel. What should this person focus on? What looks great?",
  "markers": [
    {
      "name": "Exact biomarker name as provided",
      "status": "optimal|normal|borderline|out_of_range",
      "flag": "low|high|optimal|borderline|unknown",
      "summary": "1 sentence, plain English. What does this result mean for me?",
      "what_it_means": "2-3 short sentences. What does this marker do in my body, and what does my specific value suggest?",
      "what_research_shows": "2-4 sentences. What has research found about values like mine? Cite studies naturally when available.",
      "related_patterns": "1-2 sentences connecting this to other markers in this panel. null if nothing relevant.",
      "suggested_exploration": "1 sentence suggesting what else to look into. null only if truly nothing."
    }
  ],
  "cross_marker_patterns": [
    {
      "name": "Pattern name, e.g. 'Iron deficiency pattern'",
      "markers_involved": ["Iron", "Ferritin", "Transferrin Saturation"],
      "summary": "What this pattern means in plain English",
      "severity": "attention|watch|informational"
    }
  ],
  "action_plan": {
    "overall_summary": "2-3 sentence plain-English summary of top priorities",
    "domains": [
      {
        "domain": "nutrition",
        "recommendations": [
          {
            "text": "Concise plain-English recommendation headline",
            "markers_addressed": ["hs-CRP", "fasting insulin"],
            "research_basis": "2-3 sentences grounding this in specific research.",
            "cited_studies": 3,
            "details": {
              "dosage_range": "...",
              "best_form": "...",
              "timing": "...",
              "food_sources": "...",
              "interactions": "...",
              "important_notes": "..."
            }
          }
        ]
      }
    ],
    "disclaimer": "This is educational content, not medical advice. Discuss any changes with your healthcare provider before starting."
  }
}

CRITICAL: You must include an entry in "markers" for EVERY biomarker provided. Do not skip any.`;

/**
 * Two-pass panel analysis:
 *   Pass 1 — Batch RAG retrieval (grouped by category)
 *   Pass 2 — Single Claude Opus call for full-panel analysis + action plan
 */
export async function analyzePanelTwoPass(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  openai: any,
  biomarkers: BiomarkerInput[],
  userProfile?: { age?: number; sex?: "male" | "female" }
): Promise<{
  executive_summary: string;
  markers: LivingResearchAnalysis[];
  cross_marker_patterns: any[];
  action_plan: ActionPlan;
  studies_retrieved: number;
  pass1_time_ms: number;
  pass2_time_ms: number;
}> {
  // =================================================================
  // PASS 1: Batch RAG Retrieval
  // =================================================================
  const pass1Start = Date.now();

  // 1a. Resolve canonical references for all biomarkers (parallel)
  const referenceMap = new Map<string, BiomarkerReference>();
  const refPromises = biomarkers.map(async (bm) => {
    const ref = await findBiomarkerReference(supabase, bm.name);
    if (ref) referenceMap.set(bm.name, ref);
  });
  await Promise.all(refPromises);

  // 1b. Compute status for each biomarker
  const statusMap = new Map<string, { status: "optimal" | "normal" | "borderline" | "out_of_range"; flag: "low" | "high" | "optimal" | "borderline" | "unknown" }>();
  for (const bm of biomarkers) {
    const ref = referenceMap.get(bm.name) || null;
    statusMap.set(bm.name, computeStatus(bm.value, ref, bm.ref_low, bm.ref_high));
  }

  // 1c. Group biomarkers by category and run batch RAG
  const groups = groupBiomarkersByCategory(biomarkers);
  const allStudies: RetrievedStudy[] = [];
  const studyIdsSeen = new Set<number>();

  const groupQueries: Array<{ groupName: string; query: string }> = [];
  for (const [groupName, groupBiomarkers] of groups) {
    const query = buildGroupQuery(groupBiomarkers, referenceMap);
    groupQueries.push({ groupName, query });
  }

  // 1d. Build a "priority concerns" query from the most concerning markers
  const priorityMarkers = biomarkers
    .filter((bm) => {
      const s = statusMap.get(bm.name);
      return s && (s.status === "out_of_range" || s.status === "borderline");
    })
    .slice(0, 5);

  if (priorityMarkers.length > 0) {
    const priorityNames = priorityMarkers.map(
      (bm) => referenceMap.get(bm.name)?.canonical_name || bm.name
    );
    const priorityQuery =
      priorityNames.join(" ") +
      " interaction pattern clinical significance deficiency";
    groupQueries.push({ groupName: "priority_concerns", query: priorityQuery });
  }

  // Run all RAG queries in parallel
  const ragResults = await Promise.all(
    groupQueries.map(async ({ groupName, query }) => {
      const studies = await batchRetrieveStudies(supabase, query, 20);
      console.log(
        `[two-pass] RAG group "${groupName}": ${studies.length} studies for query "${query.slice(0, 80)}..."`
      );
      return studies;
    })
  );

  // Deduplicate studies
  for (const studies of ragResults) {
    for (const study of studies) {
      if (!studyIdsSeen.has(study.id)) {
        studyIdsSeen.add(study.id);
        allStudies.push(study);
      }
    }
  }

  const pass1TimeMs = Date.now() - pass1Start;
  console.log(
    `[two-pass] Pass 1 complete: ${allStudies.length} unique studies from ${groupQueries.length} queries in ${pass1TimeMs}ms`
  );

  // =================================================================
  // PASS 2: Comprehensive Opus Analysis
  // =================================================================
  const pass2Start = Date.now();

  // Build full panel text
  const panelText = biomarkers
    .map((bm) => {
      const ref = referenceMap.get(bm.name);
      const status = statusMap.get(bm.name)!;
      const statusLabel =
        status.status === "optimal"
          ? "OPTIMAL"
          : status.status === "out_of_range"
          ? `OUT OF RANGE (${status.flag})`
          : status.status === "borderline"
          ? `BORDERLINE (${status.flag})`
          : "NORMAL";
      return `- ${bm.name}: ${bm.value} ${bm.unit || ""} | Lab ref: ${bm.ref_low ?? "?"}-${bm.ref_high ?? "?"} | Optimal: ${ref?.optimal_low ?? "?"}-${ref?.optimal_high ?? "?"} | Status: ${statusLabel} | Category: ${bm.category}`;
    })
    .join("\n");

  // Build studies text (top 50 most relevant by similarity)
  const sortedStudies = allStudies
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 50);

  const studiesText = sortedStudies
    .map((s, i) => {
      const authorStr =
        s.authors && s.authors.length > 0
          ? `${s.authors[0].split(" ").pop()} et al.`
          : "Unknown";
      return `[STUDY ${i + 1}] ${authorStr}, ${s.publication_year || "n.d."} (${s.study_type || "Article"}, Evidence: ${s.grade_score || "UNGRADED"}, Similarity: ${s.similarity.toFixed(3)})
Title: ${s.title}
Abstract: ${s.abstract.substring(0, 600)}${s.abstract.length > 600 ? "..." : ""}
Journal: ${s.journal || "Unknown"}`;
    })
    .join("\n---\n");

  const demographicText = userProfile
    ? `\nUSER DEMOGRAPHICS: Age ${userProfile.age || "unknown"}, Sex ${userProfile.sex || "unknown"}`
    : "";

  const userPrompt = `COMPLETE BLOOD PANEL (${biomarkers.length} markers):
${demographicText}

${panelText}

RETRIEVED RESEARCH STUDIES (${sortedStudies.length} studies from Living Research corpus):

${studiesText || "(No studies retrieved — use established medical knowledge for all analyses.)"}

Analyze the COMPLETE panel. Return a marker analysis for EVERY biomarker listed above (${biomarkers.length} total). Include cross-marker patterns and a full action plan. Return ONLY valid JSON.`;

  const message = await anthropic.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 16384,
    system: TWO_PASS_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  const pass2TimeMs = Date.now() - pass2Start;

  console.log(
    `[two-pass] Pass 2 complete: Opus response in ${pass2TimeMs}ms (${responseText.length} chars)`
  );

  // Parse the JSON response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON in two-pass Opus response");
  }

  const result = JSON.parse(jsonMatch[0]);

  // Map Opus output to LivingResearchAnalysis format for each marker
  const markerAnalyses: LivingResearchAnalysis[] = (result.markers || []).map(
    (m: any) => {
      const bm = biomarkers.find(
        (b) => b.name === m.name || b.name.toLowerCase() === m.name?.toLowerCase()
      );
      const ref = bm ? referenceMap.get(bm.name) : null;
      const status = bm ? statusMap.get(bm.name) : null;

      // Find studies that are relevant to this marker by name matching
      const markerStudies = allStudies.filter(
        (s) =>
          s.title.toLowerCase().includes((m.name || "").toLowerCase()) ||
          s.abstract.toLowerCase().includes((m.name || "").toLowerCase()) ||
          (ref?.canonical_name &&
            s.abstract.toLowerCase().includes(ref.canonical_name.toLowerCase()))
      );

      const citations = markerStudies.slice(0, 10).map((s, i) => ({
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

      const years = markerStudies
        .filter((s) => s.publication_year)
        .map((s) => s.publication_year!);
      const avgYear =
        years.length > 0
          ? Math.round(years.reduce((a, b) => a + b, 0) / years.length)
          : null;
      const grades = markerStudies
        .map((s) => s.grade_score)
        .filter(Boolean);
      const highestGrade = grades.includes("HIGH")
        ? "HIGH"
        : grades.includes("MODERATE")
        ? "MODERATE"
        : grades.includes("LOW")
        ? "LOW"
        : null;

      return {
        biomarker_name: m.name || bm?.name || "Unknown",
        canonical_name: ref?.canonical_name || m.name || bm?.name || "Unknown",
        status: (m.status as LivingResearchAnalysis["status"]) || status?.status || "normal",
        flag: (m.flag as LivingResearchAnalysis["flag"]) || status?.flag || "unknown",
        summary: m.summary || "",
        what_it_means: m.what_it_means || "",
        what_research_shows: m.what_research_shows || "",
        related_patterns: m.related_patterns || null,
        suggested_exploration: m.suggested_exploration || null,
        citation_count: citations.length,
        highest_evidence_grade: highestGrade,
        avg_study_year: avgYear,
        retrieval_time_ms: pass1TimeMs,
        generation_time_ms: pass2TimeMs,
        citations,
      };
    }
  );

  // Build action plan from the Opus response
  const actionPlanData = result.action_plan || {};
  const actionPlan: ActionPlan = {
    domains: actionPlanData.domains || [],
    overall_summary: actionPlanData.overall_summary || "",
    disclaimer:
      actionPlanData.disclaimer ||
      "This is educational content, not medical advice. Consult your healthcare provider.",
    generation_time_ms: pass2TimeMs,
  };

  return {
    executive_summary: result.executive_summary || "",
    markers: markerAnalyses,
    cross_marker_patterns: result.cross_marker_patterns || [],
    action_plan: actionPlan,
    studies_retrieved: allStudies.length,
    pass1_time_ms: pass1TimeMs,
    pass2_time_ms: pass2TimeMs,
  };
}

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

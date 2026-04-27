import { inngest } from "../client";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import {
  findBiomarkerReference,
  computeStatus,
  type BiomarkerInput,
  type BiomarkerReference,
  type RetrievedStudy,
} from "@/lib/living-research";
import {
  runAllCalculations,
  type BiomarkerValue,
  type UserProfile,
} from "@/lib/risk-calculations";
import { detectPatterns, type DetectedPattern } from "@/lib/pattern-detection";
import {
  retrievePatternResearch,
  formatPatternResearchForPrompt,
} from "@/lib/pattern-rag";

// ---------------------------------------------------------------------------
// Clients (lazy-init to avoid cold-start overhead when not needed)
// ---------------------------------------------------------------------------

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
}

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

// ---------------------------------------------------------------------------
// Category groups for batch RAG
// ---------------------------------------------------------------------------
const CATEGORY_GROUPS: Record<string, string[]> = {
  metabolic_lipid: ["metabolic", "lipid"],
  hormonal_thyroid: ["hormonal", "thyroid"],
  inflammatory_cardiac: ["inflammatory", "cardiac"],
  liver_kidney: ["liver", "kidney"],
  hematology_nutrient: ["hematology", "nutrient"],
  other: ["other"],
};

function assignCategoryGroup(category: string): string {
  const cat = category?.toLowerCase() || "other";
  for (const [groupName, categories] of Object.entries(CATEGORY_GROUPS)) {
    if (categories.includes(cat)) return groupName;
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Batch RAG retrieval
// ---------------------------------------------------------------------------
async function batchRetrieveStudies(
  queryText: string,
  matchCount: number = 20
): Promise<RetrievedStudy[]> {
  const supabase = getSupabase();
  const embeddingResponse = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: queryText,
    dimensions: 1536,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  const { data, error } = await supabase.rpc("match_research_studies", {
    query_embedding: queryEmbedding,
    match_threshold: 0.3,
    match_count: matchCount,
    filter_biomarker: null,
  });

  if (error) {
    console.error("Batch RAG retrieval error:", error);
    return [];
  }

  return data || [];
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------
const BATCH_SYSTEM_PROMPT = `You are Lipa's comprehensive analysis engine. You have the COMPLETE blood panel in front of you for context, but your task is to analyze only a specific subset of markers.

YOUR AUDIENCE: A 30-year-old who got their blood test back and wants to understand it. They're smart but not medical professionals. They want to know: is this good or bad? Should I worry? What can I do?

VOICE:
- Plain English. Short sentences. No jargon.
- Say "your body" not "the organism." Say "fight off infections" not "immune function." Say "how well your kidneys work" not "renal function."
- Be direct: "This is low" not "This value falls below the optimal threshold."
- Be specific to THEIR value: "At 12.4, your hemoglobin is at the low end" not "Hemoglobin measures oxygen-carrying capacity."
- Be warm but honest. Don't sugarcoat, don't alarm.

GROUNDING:
1. ALWAYS give a complete, useful analysis for every marker. Never say "no studies found."
2. When retrieved studies are available, cite them with specifics: "A 2024 study of 160,000 people found..." Include sample sizes, effect sizes, journal names. Be a research analyst, not a summarizer.
3. When no studies are retrieved for a marker, use established medical knowledge with specifics. Reference clinical guidelines (ESC, ACC, AHA) with thresholds and dates.
4. Frame interventions as research findings: "Research shows that 2g/day EPA+DHA reduces..." not "Take omega-3." Include expected improvement timelines and magnitudes.
5. Look for PATTERNS across markers. Connect dots that a doctor in a 10-minute appointment would miss. If LDL is high and HDL is low and TG is high and glucose is borderline — that's metabolic syndrome, not just "high cholesterol." Say so clearly.
6. For what_to_do: Be a health protocol designer. Specific doses, specific forms, specific timing, specific expected outcomes, specific retest timeline. This is what people pay for — not generic advice they can get from Google.
7. NEVER recommend prescription medications (statins, metformin, etc.). ONLY recommend supplements, vitamins, minerals, adaptogens, herbs, dietary changes, and lifestyle interventions. For conditions where medication might be appropriate, say "Discuss with your doctor whether medication is appropriate" — never name specific drugs or dosages.

You MUST return valid JSON matching this exact schema:
{
  "markers": [
    {
      "name": "Exact biomarker name as provided",
      "status": "optimal|normal|borderline|out_of_range",
      "flag": "low|high|optimal|borderline|unknown",
      "summary": "1 sentence, plain English. What does this result mean for me? Reference the actual value.",
      "what_it_means": "3-5 sentences. What does this marker do? What does MY specific value suggest? What are the possible root causes for this level — genetics, diet, other conditions, medication, lifestyle? Connect to other markers in this panel when relevant (e.g., 'Your elevated LDL combined with your ApoB at 118 suggests...'). This is where you go deeper than a doctor's 5-minute explanation.",
      "what_research_shows": "3-5 sentences. Cite SPECIFIC studies with numbers: 'A 2023 meta-analysis of 27 RCTs (n=12,400) found that values above X are associated with Y% increased risk of Z (Journal Name).' Include effect sizes, sample sizes, and journal names when available. If multiple studies, summarize the consensus and note any disagreements. This section should make the user feel they're reading a research brief, not a WebMD article.",
      "what_to_do": "For borderline or out-of-range markers: 3-5 specific interventions with evidence. Format as a mini-protocol: specific supplement with dose, form, timing, and expected timeline (e.g., 'Take 2g EPA+DHA daily in triglyceride form with food — a 2022 JAMA meta-analysis found this reduces LDL by 10-15% over 8-12 weeks'). Include both nutritional and supplement interventions. End with retest timeline. For optimal/normal markers: 1-2 sentences on what's keeping this healthy and what to maintain.",
      "related_patterns": "2-3 sentences connecting this to other markers in the panel. What story do multiple markers tell together? (e.g., 'Your elevated LDL + ApoB + low HDL together suggest atherogenic dyslipidemia — a pattern driven by insulin resistance, not just dietary cholesterol. Your borderline glucose at 98 supports this.'). null only if truly isolated.",
      "suggested_exploration": "1-2 sentences on what to explore further. Additional tests, lifestyle experiments, things to discuss with their doctor."
    }
  ]
}

CRITICAL: You must include an entry in "markers" for EVERY biomarker you are asked to analyze. Do not skip any. The analysis should be SIGNIFICANTLY more detailed than what a doctor provides in a routine appointment — that's the value proposition.`;

const SUMMARY_SYSTEM_PROMPT = `You are Lipa's health summary engine. You produce executive summaries, cross-marker patterns, and actionable health plans from blood panel analyses. Write in plain English for a smart non-medical audience. Be specific, warm, and research-grounded.`;

// ---------------------------------------------------------------------------
// Helpers (ported from analyze-step/route.ts)
// ---------------------------------------------------------------------------

async function fetchBiomarkers(userId: string, testDate?: string) {
  const supabase = getSupabase();
  if (testDate) {
    const { data: exact } = await supabase
      .from("biomarker_results")
      .select("*")
      .eq("user_id", userId)
      .eq("test_date", testDate)
      .order("id");
    if (exact && exact.length > 0) return exact;
  }
  // Fallback: get latest test date
  const { data: all } = await supabase
    .from("biomarker_results")
    .select("*")
    .eq("user_id", userId)
    .order("test_date", { ascending: false })
    .order("id");
  if (!all || all.length === 0) return [];
  const latestDate = all[0].test_date;
  return all.filter((r: any) => r.test_date === latestDate);
}

function toBiomarkerInput(
  r: any,
  userId: string,
  testDate: string
): BiomarkerInput {
  return {
    id: r.id,
    name: r.biomarker,
    value: r.value,
    unit: r.unit,
    ref_low: r.ref_low,
    ref_high: r.ref_high,
    category: r.category,
    user_id: userId,
    test_date: testDate,
  };
}

function buildPanelText(
  biomarkers: BiomarkerInput[],
  referenceMap: Map<string, BiomarkerReference>,
  statusMap: Map<string, { status: string; flag: string }>
): string {
  return biomarkers
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
}

function buildStudiesText(studies: RetrievedStudy[]): string {
  return studies
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 30)
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
}

async function resolvePanel(biomarkers: BiomarkerInput[]) {
  const supabase = getSupabase();
  const referenceMap = new Map<string, BiomarkerReference>();
  await Promise.all(
    biomarkers.map(async (bm) => {
      const ref = await findBiomarkerReference(supabase, bm.name);
      if (ref) referenceMap.set(bm.name, ref);
    })
  );

  const statusMap = new Map<string, { status: string; flag: string }>();
  for (const bm of biomarkers) {
    const ref = referenceMap.get(bm.name) || null;
    statusMap.set(
      bm.name,
      computeStatus(bm.value, ref, bm.ref_low, bm.ref_high)
    );
  }

  return { referenceMap, statusMap };
}

async function retrieveStudiesForBatch(
  batchBiomarkers: BiomarkerInput[],
  referenceMap: Map<string, BiomarkerReference>,
  statusMap: Map<string, { status: string; flag: string }>
): Promise<RetrievedStudy[]> {
  const groups = new Map<string, BiomarkerInput[]>();
  for (const bm of batchBiomarkers) {
    const group = assignCategoryGroup(bm.category);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(bm);
  }

  const allStudies: RetrievedStudy[] = [];
  const seenIds = new Set<number>();

  const ragPromises = Array.from(groups.entries()).map(
    async ([_groupName, markers]) => {
      const names = markers.map(
        (b) => referenceMap.get(b.name)?.canonical_name || b.name
      );
      const contextTerms: string[] = [];
      for (const bm of markers) {
        const status = statusMap.get(bm.name);
        if (status?.flag === "low") contextTerms.push("deficiency", "low levels");
        if (status?.flag === "high") contextTerms.push("elevated", "excess");
      }
      const unique = [...new Set([...names, ...contextTerms])];
      const query = unique.join(" ") + " clinical significance optimal levels";
      return batchRetrieveStudies(query, 20);
    }
  );

  // Priority query for out-of-range / borderline markers
  const priorityMarkers = batchBiomarkers.filter((bm) => {
    const s = statusMap.get(bm.name);
    return s && (s.status === "out_of_range" || s.status === "borderline");
  });
  if (priorityMarkers.length > 0) {
    const priorityNames = priorityMarkers.map(
      (bm) => referenceMap.get(bm.name)?.canonical_name || bm.name
    );
    const priorityQuery =
      priorityNames.join(" ") +
      " interaction pattern clinical significance deficiency";
    ragPromises.push(batchRetrieveStudies(priorityQuery, 20));
  }

  const results = await Promise.all(ragPromises);
  for (const studies of results) {
    for (const study of studies) {
      if (!seenIds.has(study.id)) {
        seenIds.add(study.id);
        allStudies.push(study);
      }
    }
  }

  return allStudies;
}

// Marker alias map for citation matching
const MARKER_ALIASES: Record<string, string[]> = {
  ast: ["aspartate aminotransferase", "ast", "got", "sgot"],
  alt: ["alanine aminotransferase", "alt", "gpt", "sgpt"],
  ggt: ["gamma-glutamyl transferase", "gamma-glutamyltransferase", "ggt"],
  egfr: ["glomerular filtration rate", "egfr", "gfr", "ckd-epi"],
  bun: ["blood urea nitrogen", "bun", "urea"],
  urea: ["blood urea nitrogen", "bun", "urea"],
  platelets: ["platelet count", "platelets", "thrombocytes", "plt"],
  testosterone: ["testosterone", "total testosterone", "free testosterone"],
  cortisol: ["cortisol", "hydrocortisone", "serum cortisol"],
  crp: ["c-reactive protein", "crp", "hs-crp", "high-sensitivity crp"],
  hba1c: ["glycated hemoglobin", "hba1c", "hemoglobin a1c", "a1c"],
  ldl: ["low-density lipoprotein", "ldl cholesterol", "ldl-c"],
  hdl: ["high-density lipoprotein", "hdl cholesterol", "hdl-c"],
  tsh: ["thyroid stimulating hormone", "tsh", "thyrotropin"],
  ferritin: ["ferritin", "serum ferritin", "iron storage"],
  "vitamin d": ["vitamin d", "25-hydroxyvitamin d", "25(oh)d", "calcidiol"],
  "vitamin b12": ["vitamin b12", "cobalamin", "cyanocobalamin"],
  folate: ["folate", "folic acid", "vitamin b9"],
  iron: ["serum iron", "iron", "fe"],
  transferrin: ["transferrin", "transferrin saturation", "tsat"],
  fibrinogen: ["fibrinogen", "factor i"],
  homocysteine: ["homocysteine", "hcy"],
  apob: ["apolipoprotein b", "apob", "apo b"],
  // Hematology differentials — "absolute" variants should match base term
  basophils: ["basophil", "basophils", "basophil count"],
  "basophils absolute": ["basophil", "basophils", "basophil count"],
  "basophils (absolute)": ["basophil", "basophils", "basophil count"],
  neutrophils: ["neutrophil", "neutrophils", "neutrophil count"],
  "neutrophils absolute": ["neutrophil", "neutrophils", "neutrophil count"],
  "neutrophils (absolute)": ["neutrophil", "neutrophils", "neutrophil count"],
  lymphocytes: ["lymphocyte", "lymphocytes", "lymphocyte count"],
  "lymphocytes absolute": ["lymphocyte", "lymphocytes", "lymphocyte count"],
  "lymphocytes (absolute)": ["lymphocyte", "lymphocytes", "lymphocyte count"],
  monocytes: ["monocyte", "monocytes", "monocyte count"],
  "monocytes absolute": ["monocyte", "monocytes", "monocyte count"],
  "monocytes (absolute)": ["monocyte", "monocytes", "monocyte count"],
  eosinophils: ["eosinophil", "eosinophils", "eosinophil count"],
  "eosinophils absolute": ["eosinophil", "eosinophils", "eosinophil count"],
  "eosinophils (absolute)": ["eosinophil", "eosinophils", "eosinophil count"],
  // Ratios
  "cholesterol/hdl ratio": ["cholesterol ratio", "total cholesterol", "hdl ratio", "cardiovascular risk ratio"],
  "total cholesterol/hdl ratio": ["cholesterol ratio", "total cholesterol", "hdl ratio", "cardiovascular risk ratio"],
  // Other uncited markers
  "tnf-alpha": ["tumor necrosis factor", "tnf-alpha", "tnf alpha", "tnf-α", "cachectin"],
  "dhea-s": ["dehydroepiandrosterone sulfate", "dhea-s", "dheas", "dhea sulfate"],
  "vitamin a": ["vitamin a", "retinol", "retinyl", "beta-carotene"],
  "coenzyme q10": ["coenzyme q10", "coq10", "ubiquinone", "ubiquinol"],
  "d-dimer": ["d-dimer", "fibrin degradation", "fibrinolysis"],
  "direct bilirubin": ["direct bilirubin", "conjugated bilirubin", "bilirubin"],
  "total protein": ["total protein", "serum protein", "albumin globulin"],
  "urine albumin/creatinine ratio": ["albumin creatinine ratio", "microalbumin", "uacr", "albuminuria"],
};

async function storeBatchAnalyses(
  userId: string,
  markerResults: any[],
  insertedResults: any[],
  studies: RetrievedStudy[],
  referenceMap: Map<string, BiomarkerReference>,
  retrievalTimeMs: number,
  generationTimeMs: number
) {
  const supabase = getSupabase();

  for (const m of markerResults) {
    const matchedResult = insertedResults.find(
      (r: any) => r.biomarker.toLowerCase() === (m.name || "").toLowerCase()
    );
    if (!matchedResult) continue;

    const ref = referenceMap.get(matchedResult.biomarker);

    const markerLower = (m.name || "").toLowerCase();
    const aliases =
      MARKER_ALIASES[markerLower] ||
      Object.entries(MARKER_ALIASES).find(([_, v]) =>
        v.some((a) => markerLower.includes(a))
      )?.[1] ||
      [markerLower];
    const searchTerms = [
      ...new Set([
        markerLower,
        ...(ref?.canonical_name ? [ref.canonical_name.toLowerCase()] : []),
        ...aliases,
      ]),
    ];

    const markerStudies = studies.filter((s) => {
      const text = (s.title + " " + s.abstract).toLowerCase();
      return searchTerms.some((term) => text.includes(term));
    });

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
    const grades = markerStudies.map((s) => s.grade_score).filter(Boolean);
    const highestGrade = grades.includes("HIGH")
      ? "HIGH"
      : grades.includes("MODERATE")
      ? "MODERATE"
      : grades.includes("LOW")
      ? "LOW"
      : null;

    const insertData: any = {
      user_id: userId,
      biomarker_result_id: matchedResult.id,
      biomarker_name: m.name,
      status: m.status,
      flag: m.flag,
      summary: m.summary,
      what_it_means: m.what_it_means,
      what_research_shows: m.what_research_shows,
      related_patterns: m.related_patterns,
      suggested_exploration: m.suggested_exploration,
      citation_count: citations.length,
      avg_study_year: avgYear,
      highest_evidence_grade: highestGrade,
      retrieval_time_ms: retrievalTimeMs,
      generation_time_ms: generationTimeMs,
    };

    insertData.what_to_do = m.what_to_do || null;

    // Delete any existing analysis for this marker (dedup)
    await supabase
      .from("user_analyses")
      .delete()
      .eq("user_id", userId)
      .eq("biomarker_result_id", matchedResult.id);

    let { data: row, error } = await supabase
      .from("user_analyses")
      .insert(insertData)
      .select()
      .single();

    // Fallback if what_to_do column doesn't exist
    if (error && error.message?.includes("what_to_do")) {
      delete insertData.what_to_do;
      ({ data: row, error } = await supabase
        .from("user_analyses")
        .insert(insertData)
        .select()
        .single());
    }

    if (error) {
      console.error(
        `[analyze-panel] Store failed for ${m.name}:`,
        error.message
      );
    } else if (row && citations.length > 0) {
      await supabase.from("analysis_citations").insert(
        citations.map((c) => ({
          user_id: userId,
          biomarker_result_id: matchedResult.id,
          study_id: c.study_id,
          relevance_score: c.similarity,
          retrieval_rank: c.relevance_rank,
          biomarker_name: m.name,
          query_used: "inngest-batch",
        }))
      );
    }
  }
}

// ===========================================================================
// INNGEST FUNCTION: lipa/panel.uploaded
// ===========================================================================

export const analyzePanel = inngest.createFunction(
  {
    id: "analyze-panel",
    retries: 2,
    triggers: [{ event: "lipa/panel.uploaded" }],
  },
  async ({ event, step }) => {
    const { userId, testDate } = event.data;

    // -----------------------------------------------------------------
    // Step 1: Fetch biomarkers and resolve references
    // -----------------------------------------------------------------
    const panelData = await step.run("fetch-biomarkers", async () => {
      const insertedResults = await fetchBiomarkers(userId, testDate);
      if (!insertedResults || insertedResults.length === 0) {
        throw new Error("No biomarker results found");
      }

      const effectiveDate =
        testDate || insertedResults[0]?.test_date || new Date().toISOString().split("T")[0];
      const allBiomarkers = insertedResults.map((r: any) =>
        toBiomarkerInput(r, userId, effectiveDate)
      );

      const { referenceMap, statusMap } = await resolvePanel(allBiomarkers);

      // Fetch user profile
      const supabase = getSupabase();
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("age, sex")
        .eq("user_id", userId)
        .maybeSingle();

      // Serialize maps for step return
      const refEntries = Array.from(referenceMap.entries());
      const statusEntries = Array.from(statusMap.entries());

      return {
        effectiveDate,
        insertedResults,
        allBiomarkers,
        refEntries,
        statusEntries,
        profileData,
        totalMarkers: allBiomarkers.length,
      };
    });

    const {
      effectiveDate,
      insertedResults,
      allBiomarkers,
      refEntries,
      statusEntries,
      profileData,
      totalMarkers,
    } = panelData;

    // Reconstruct maps from serialized entries
    const referenceMap = new Map<string, BiomarkerReference>(refEntries);
    const statusMap = new Map<string, { status: string; flag: string }>(statusEntries);

    const demographicText = profileData
      ? `\nUSER DEMOGRAPHICS: Age ${profileData.age || "unknown"}, Sex ${profileData.sex || "unknown"}`
      : "";

    // Build full panel text (used in all batch prompts)
    const panelText = buildPanelText(allBiomarkers, referenceMap, statusMap);

    // -----------------------------------------------------------------
    // Step 2-N: Batch analysis (10 markers per batch)
    // -----------------------------------------------------------------
    const BATCH_SIZE = 10;
    const numBatches = Math.ceil(totalMarkers / BATCH_SIZE);

    for (let i = 0; i < numBatches; i++) {
      await step.run(`batch-analysis-${i}`, async () => {
        const batchStart = i * BATCH_SIZE;
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalMarkers);
        const batchBiomarkers = allBiomarkers.slice(batchStart, batchEnd);

        if (batchBiomarkers.length === 0) return { analyzed: 0 };

        // RAG retrieval scoped to this batch
        const ragStart = Date.now();
        const batchStudies = await retrieveStudiesForBatch(
          batchBiomarkers,
          referenceMap,
          statusMap
        );
        const ragTimeMs = Date.now() - ragStart;
        console.log(
          `[analyze-panel] batch ${i}: RAG retrieved ${batchStudies.length} studies in ${ragTimeMs}ms`
        );

        const studiesText = buildStudiesText(batchStudies);

        // Build batch-specific marker list
        const batchMarkerList = batchBiomarkers
          .map((bm) => {
            const status = statusMap.get(bm.name)!;
            const statusLabel =
              status.status === "optimal"
                ? "OPTIMAL"
                : status.status === "out_of_range"
                ? `OUT OF RANGE (${status.flag})`
                : status.status === "borderline"
                ? `BORDERLINE (${status.flag})`
                : "NORMAL";
            return `- ${bm.name}: ${bm.value} ${bm.unit || ""} | Status: ${statusLabel}`;
          })
          .join("\n");

        const batchPrompt = `Here is the patient's FULL blood panel for context (${allBiomarkers.length} markers):
${demographicText}

${panelText}

RETRIEVED RESEARCH STUDIES (${batchStudies.length} studies from Living Research corpus):

${studiesText || "(No studies retrieved — use established medical knowledge for all analyses.)"}

YOUR TASK: Analyze ONLY these ${batchBiomarkers.length} specific markers in detail:
${batchMarkerList}

For each marker, provide: name, status, flag, summary, what_it_means, what_research_shows, what_to_do, related_patterns, suggested_exploration.

IMPORTANT — 'what_to_do' field: For borderline/out-of-range markers: 3-5 specific interventions with evidence, doses, forms, timing, and expected improvement timeline. For optimal/normal markers: 1-2 sentences on what's keeping this healthy and what to maintain. NEVER set what_to_do to null.

Return ONLY valid JSON with a "markers" array containing exactly ${batchBiomarkers.length} entries.`;

        // Call Claude Sonnet
        const anthropic = getAnthropic();
        const model = "claude-sonnet-4-20250514";
        const genStart = Date.now();

        const message = await anthropic.messages.create({
          model,
          max_tokens: 8192,
          system: BATCH_SYSTEM_PROMPT,
          messages: [{ role: "user", content: batchPrompt }],
        });

        const responseText =
          message.content[0].type === "text" ? message.content[0].text : "";
        const generationTimeMs = Date.now() - genStart;

        console.log(
          `[analyze-panel] batch ${i}: ${model} responded in ${generationTimeMs}ms (${responseText.length} chars)`
        );

        // Parse JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error(`[analyze-panel] batch ${i}: no JSON in response, retrying individually`);
          // Fallback: analyze each marker individually
          let fallbackCount = 0;
          for (const bm of batchBiomarkers) {
            try {
              const singleStatus = statusMap.get(bm.name);
              const singlePrompt = `Analyze this single biomarker:\n- ${bm.name}: ${bm.value} ${bm.unit || ""} | Status: ${singleStatus?.status || "normal"}\n\nReturn JSON with a "markers" array containing exactly 1 entry with: name, status, flag, summary, what_it_means, what_research_shows, what_to_do, related_patterns, suggested_exploration.`;
              const singleMsg = await anthropic.messages.create({
                model,
                max_tokens: 2048,
                system: BATCH_SYSTEM_PROMPT,
                messages: [{ role: "user", content: singlePrompt }],
              });
              const singleText = singleMsg.content[0].type === "text" ? singleMsg.content[0].text : "";
              const singleJson = singleText.match(/\{[\s\S]*\}/);
              if (singleJson) {
                const singleResult = JSON.parse(singleJson[0]);
                const singleMarkers = singleResult.markers || [];
                if (singleMarkers.length > 0) {
                  await storeBatchAnalyses(userId, singleMarkers, insertedResults, [], referenceMap, 0, 0);
                  fallbackCount++;
                }
              }
            } catch (e) {
              console.error(`[analyze-panel] batch ${i}: fallback failed for ${bm.name}:`, e);
            }
          }
          return { analyzed: fallbackCount, batch: i, fallback: true };
        }

        const batchResult = JSON.parse(jsonMatch[0]);
        const markerResults = batchResult.markers || [];

        console.log(
          `[analyze-panel] batch ${i}: parsed ${markerResults.length} marker analyses`
        );

        // If Claude returned fewer markers than expected, analyze missing ones individually
        if (markerResults.length < batchBiomarkers.length) {
          const analyzedNames = new Set(markerResults.map((m: any) => (m.name || m.biomarker_name || "").toLowerCase()));
          const missingBms = batchBiomarkers.filter((bm) => !analyzedNames.has(bm.name.toLowerCase()));
          console.log(`[analyze-panel] batch ${i}: ${missingBms.length} markers missing from response, analyzing individually`);
          for (const bm of missingBms) {
            try {
              const singleStatus = statusMap.get(bm.name);
              const singlePrompt = `Analyze this single biomarker:\n- ${bm.name}: ${bm.value} ${bm.unit || ""} | Status: ${singleStatus?.status || "normal"}\n\nReturn JSON with a "markers" array containing exactly 1 entry.`;
              const singleMsg = await anthropic.messages.create({
                model,
                max_tokens: 2048,
                system: BATCH_SYSTEM_PROMPT,
                messages: [{ role: "user", content: singlePrompt }],
              });
              const singleText = singleMsg.content[0].type === "text" ? singleMsg.content[0].text : "";
              const singleJson = singleText.match(/\{[\s\S]*\}/);
              if (singleJson) {
                const singleResult = JSON.parse(singleJson[0]);
                const singleMarkers = singleResult.markers || [];
                if (singleMarkers.length > 0) {
                  await storeBatchAnalyses(userId, singleMarkers, insertedResults, [], referenceMap, 0, 0);
                  markerResults.push(...singleMarkers);
                }
              }
            } catch (e) {
              console.error(`[analyze-panel] batch ${i}: individual fallback failed for ${bm.name}:`, e);
            }
          }
        }

        // Store analyses
        await storeBatchAnalyses(
          userId,
          markerResults,
          insertedResults,
          batchStudies,
          referenceMap,
          ragTimeMs,
          generationTimeMs
        );

        return { analyzed: markerResults.length, batch: i };
      });
    }

    // -----------------------------------------------------------------
    // Final step: Summary + action plan
    // -----------------------------------------------------------------
    const summaryResult = await step.run("generate-summary", async () => {
      const supabase = getSupabase();
      const anthropic = getAnthropic();

      // Fetch all stored analyses
      const { data: allAnalyses } = await supabase
        .from("user_analyses")
        .select("*")
        .eq("user_id", userId)
        .order("id");

      if (!allAnalyses || allAnalyses.length === 0) {
        throw new Error("No analyses found after batch steps");
      }

      // Fetch user profile for risk calculations
      const { data: fullProfileData } = await supabase
        .from("user_profiles")
        .select("age, sex, is_smoker, systolic_bp")
        .eq("user_id", userId)
        .maybeSingle();

      const userProfile: UserProfile = fullProfileData
        ? {
            age: fullProfileData.age ?? undefined,
            sex: (fullProfileData.sex as "male" | "female") ?? undefined,
            isSmoker: fullProfileData.is_smoker ?? undefined,
            systolicBP: fullProfileData.systolic_bp ?? undefined,
          }
        : {};

      const fullDemographicText = fullProfileData
        ? `\nUSER DEMOGRAPHICS: Age ${fullProfileData.age || "unknown"}, Sex ${fullProfileData.sex || "unknown"}`
        : "";

      // Build marker analyses text — prioritize out-of-range and borderline markers
      // to keep prompt within token limits for large panels
      const sortedAnalyses = [...allAnalyses].sort((a: any, b: any) => {
        const priority: Record<string, number> = { out_of_range: 0, borderline: 1, normal: 2, optimal: 3 };
        return (priority[a.status] ?? 2) - (priority[b.status] ?? 2);
      });

      const allMarkerAnalysesText = sortedAnalyses
        .map((a: any) => {
          // Full detail for out-of-range and borderline, abbreviated for normal/optimal
          if (a.status === "out_of_range" || a.status === "borderline") {
            return `${a.biomarker_name} [${a.status}/${a.flag}]: ${a.summary} | What to do: ${a.what_to_do || "N/A"}`;
          }
          return `${a.biomarker_name} [${a.status}]: ${(a.summary || "").slice(0, 80)}`;
        })
        .join("\n");

      // ---------------------------------------------------------------
      // Phase 2: Cross-marker pattern detection + RAG retrieval
      // ---------------------------------------------------------------

      // 1. Run rule-based pattern detection
      const patternInput = allBiomarkers.map((bm: BiomarkerInput) => ({
        name: bm.name,
        value: bm.value,
        unit: bm.unit,
        status: statusMap.get(bm.name)?.status || "normal",
      }));
      const detectedPatterns: DetectedPattern[] = detectPatterns(patternInput);

      console.log(
        `[analyze-panel] Pattern detection: ${detectedPatterns.length} patterns found`
      );

      // 2. RAG retrieval for pattern combinations
      let patternResearchText = "";
      try {
        const patternRAGResult = await retrievePatternResearch(
          supabase,
          allBiomarkers,
          statusMap,
          referenceMap,
          detectedPatterns
        );

        patternResearchText = formatPatternResearchForPrompt(
          patternRAGResult,
          detectedPatterns
        );

        console.log(
          `[analyze-panel] Pattern RAG: ${patternRAGResult.total_studies} studies retrieved in ${patternRAGResult.retrieval_time_ms}ms`
        );
      } catch (err) {
        console.error("[analyze-panel] Pattern RAG failed, continuing without:", err);
      }

      // Build the detected patterns text for the prompt
      const detectedPatternsText =
        detectedPatterns.length > 0
          ? detectedPatterns
              .map(
                (p) =>
                  `- [${p.severity.toUpperCase()}] ${p.name}: ${p.summary} (Markers: ${p.markers_matched.join(", ")})`
              )
              .join("\n")
          : "(No rule-based patterns detected)";

      // Focus summary on out-of-range and borderline markers only
      const criticalAnalysesText = sortedAnalyses
        .filter((a: any) => a.status === "out_of_range" || a.status === "borderline")
        .map((a: any) => `${a.biomarker_name} [${a.status}/${a.flag}]: ${a.summary} | What to do: ${a.what_to_do || "N/A"}`)
        .join("\n");

      const normalCount = allAnalyses.filter((a: any) => a.status === "normal" || a.status === "optimal").length;

      const summaryPrompt = `Patient blood panel: ${allAnalyses.length} markers analyzed. ${normalCount} normal/optimal.
${fullDemographicText}

MARKERS NEEDING ATTENTION:
${criticalAnalysesText}

DETECTED PATTERNS:
${detectedPatternsText}

Produce a JSON object with:
1. "executive_summary": 8-12 sentences. Start with what's going well (mention specific optimal markers). Then explain the 3-4 most important findings with actual values. Give top 3 priority actions. End with retest timeline.
2. "action_plan": Object with:
   - "overall_summary": 6-10 sentence summary covering what's excellent, what needs attention with values, top 3 priorities, and when to retest.
   - "domains": Array of 6 domains (nutrition, supplementation, sleep, movement, environment, lifestyle). Each has "domain" and "recommendations" array. Each recommendation: "text" (headline), "markers_addressed" (array), "research_basis" (1-2 sentences), "cited_studies" (number), "details" (object with "dosage_range", "best_form", "timing", "food_sources" — string or null).
   - "disclaimer": "This is educational content, not medical advice."

RULES: Be specific with doses/forms. Never recommend prescription drugs. Focus on borderline/out-of-range markers. 2-3 recommendations per domain. Reference specific marker names.

Return ONLY valid JSON.`;

      const model = "claude-sonnet-4-20250514";
      const message = await anthropic.messages.create({
        model,
        max_tokens: 8192,
        system: SUMMARY_SYSTEM_PROMPT,
        messages: [{ role: "user", content: summaryPrompt }],
      });

      const responseText =
        message.content[0].type === "text" ? message.content[0].text : "";

      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON in summary response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const actionPlanData = parsed.action_plan || {};

      // Store action plan
      await supabase.from("action_plans").insert({
        user_id: userId,
        test_date: effectiveDate,
        overall_summary:
          actionPlanData.overall_summary || parsed.executive_summary || "",
        disclaimer:
          actionPlanData.disclaimer ||
          "This is educational content, not medical advice. Consult your healthcare provider.",
        domains: actionPlanData.domains || [],
        generation_time_ms: 0,
      });

      // Run risk calculations
      const biomarkerValues: BiomarkerValue[] = insertedResults.map(
        (r: any) => ({
          name: r.biomarker,
          value: r.value,
          unit: r.unit,
        })
      );
      const riskCalcs = runAllCalculations(biomarkerValues, userProfile);

      return {
        complete: true,
        analysesCount: allAnalyses.length,
        riskCalcs: riskCalcs.length,
        model,
      };
    });

    return {
      success: true,
      userId,
      testDate: effectiveDate,
      totalMarkers,
      ...summaryResult,
    };
  }
);

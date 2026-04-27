/**
 * =====================================================================
 * LIPA -- Pattern RAG: Research-Backed Cross-Marker Pattern Discovery
 * =====================================================================
 *
 * Phase 2 of cross-marker pattern detection.
 *
 * Takes the user's biomarker results + rule-detected patterns from
 * pattern-detection.ts, generates targeted embedding queries for marker
 * COMBINATIONS, and retrieves studies from the 250K Living Research
 * corpus via pgvector similarity search.
 *
 * The key insight: querying "elevated LDL combined with high ApoB and
 * inflammation hs-CRP cardiovascular risk" returns DIFFERENT studies
 * than querying each marker individually.
 * =====================================================================
 */

import OpenAI from "openai";
import { SupabaseClient } from "@supabase/supabase-js";
import type { DetectedPattern } from "@/lib/pattern-detection";
import type { BiomarkerInput, RetrievedStudy, BiomarkerReference } from "@/lib/living-research";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface PatternResearchContext {
  pattern_id: string;
  pattern_name: string;
  query_used: string;
  studies: RetrievedStudy[];
}

export interface PatternRAGResult {
  /** Research context for rule-detected patterns */
  rule_pattern_research: PatternResearchContext[];
  /** Research context for novel marker combinations (out-of-range grouped by body system) */
  combination_research: PatternResearchContext[];
  /** Total unique studies retrieved */
  total_studies: number;
  /** Time taken in ms */
  retrieval_time_ms: number;
}

// ---------------------------------------------------------------------
// Body system groupings for combination queries
// ---------------------------------------------------------------------

const BODY_SYSTEM_GROUPS: Record<string, string[]> = {
  cardiovascular: ["lipid", "cardiac"],
  metabolic: ["metabolic"],
  thyroid_hormonal: ["thyroid", "hormonal"],
  inflammatory_immune: ["inflammatory", "hematology"],
  liver_kidney: ["liver", "kidney"],
  nutritional: ["nutrient"],
};

function assignBodySystem(category: string): string {
  const cat = category?.toLowerCase() || "other";
  for (const [system, categories] of Object.entries(BODY_SYSTEM_GROUPS)) {
    if (categories.includes(cat)) return system;
  }
  return "other";
}

// ---------------------------------------------------------------------
// OpenAI client (lazy init)
// ---------------------------------------------------------------------

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

// ---------------------------------------------------------------------
// Batch embedding helper — embeds multiple queries in a single API call
// ---------------------------------------------------------------------

async function batchEmbed(
  queries: string[]
): Promise<number[][]> {
  if (queries.length === 0) return [];

  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: queries,
    dimensions: 1536,
  });

  // Return embeddings in the same order as input queries
  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// ---------------------------------------------------------------------
// Vector search helper
// ---------------------------------------------------------------------

async function searchStudies(
  supabase: SupabaseClient,
  embedding: number[],
  matchCount: number = 15
): Promise<RetrievedStudy[]> {
  const { data, error } = await supabase.rpc("match_research_studies", {
    query_embedding: embedding,
    match_threshold: 0.3,
    match_count: matchCount,
    filter_biomarker: null,
  });

  if (error) {
    console.error("[pattern-rag] Vector search error:", error);
    return [];
  }

  return data || [];
}

// ---------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------

/**
 * Build a targeted embedding query for a rule-detected pattern.
 * Combines the pattern's marker names with clinical context.
 */
function buildPatternQuery(
  pattern: DetectedPattern,
  markerValues: Map<string, { value: number; unit: string | null; status: string; flag: string }>
): string {
  const markerContextParts = pattern.markers_matched.map((name) => {
    const mv = markerValues.get(name);
    if (!mv) return name;
    const direction = mv.flag === "high" ? "elevated" : mv.flag === "low" ? "low" : "";
    return `${direction} ${name}`.trim();
  });

  const categoryContext: Record<string, string> = {
    metabolic: "metabolic syndrome insulin resistance glucose metabolism",
    cardiovascular: "cardiovascular risk atherosclerosis lipid profile",
    thyroid: "thyroid function hypothyroid hyperthyroid",
    inflammatory: "systemic inflammation immune response",
    nutritional: "nutritional deficiency micronutrient status",
    hormonal: "hormonal balance endocrine function",
  };

  const contextSuffix = categoryContext[pattern.category] || "";

  return `${markerContextParts.join(" combined with ")} ${pattern.name} ${contextSuffix} clinical significance risk interaction`.trim();
}

/**
 * Build combination queries for groups of out-of-range / borderline markers
 * within the same body system.
 */
function buildCombinationQueries(
  biomarkers: BiomarkerInput[],
  statusMap: Map<string, { status: string; flag: string }>,
  referenceMap: Map<string, BiomarkerReference>
): Array<{ id: string; name: string; query: string; markers: string[] }> {
  // Group abnormal markers by body system
  const systemGroups = new Map<string, BiomarkerInput[]>();

  for (const bm of biomarkers) {
    const status = statusMap.get(bm.name);
    if (!status) continue;
    if (status.status !== "out_of_range" && status.status !== "borderline") continue;

    const system = assignBodySystem(bm.category);
    if (!systemGroups.has(system)) systemGroups.set(system, []);
    systemGroups.get(system)!.push(bm);
  }

  const queries: Array<{ id: string; name: string; query: string; markers: string[] }> = [];

  for (const [system, markers] of systemGroups.entries()) {
    // Only generate combination queries when there are 2+ abnormal markers in a system
    if (markers.length < 2) continue;

    const markerNames = markers.map((bm) => {
      const ref = referenceMap.get(bm.name);
      return ref?.canonical_name || bm.name;
    });

    const markerDescriptions = markers.map((bm) => {
      const status = statusMap.get(bm.name)!;
      const direction = status.flag === "high" ? "elevated" : status.flag === "low" ? "low" : "abnormal";
      return `${direction} ${bm.name}`;
    });

    const queryText = `${markerDescriptions.join(" combined with ")} interaction pattern clinical significance risk ${system.replace("_", " ")}`;

    queries.push({
      id: `combo_${system}`,
      name: `${system.replace("_", " ")} marker combination`,
      query: queryText,
      markers: markerNames,
    });
  }

  // Also look for cross-system interactions when there are abnormal markers
  // in multiple systems
  const abnormalBySystem = Array.from(systemGroups.entries()).filter(
    ([_, markers]) => markers.length > 0
  );

  if (abnormalBySystem.length >= 2) {
    // Pick the most concerning marker from each system for a cross-system query
    const crossSystemMarkers: string[] = [];
    const crossSystemDescriptions: string[] = [];

    for (const [_, markers] of abnormalBySystem.slice(0, 4)) {
      // Take the most out-of-range marker from each system
      const worst = markers.sort((a, b) => {
        const sa = statusMap.get(a.name)!;
        const sb = statusMap.get(b.name)!;
        const severityOrder: Record<string, number> = { out_of_range: 2, borderline: 1 };
        return (severityOrder[sb.status] || 0) - (severityOrder[sa.status] || 0);
      })[0];

      const status = statusMap.get(worst.name)!;
      const direction = status.flag === "high" ? "elevated" : status.flag === "low" ? "low" : "abnormal";
      crossSystemMarkers.push(worst.name);
      crossSystemDescriptions.push(`${direction} ${worst.name}`);
    }

    if (crossSystemMarkers.length >= 2) {
      queries.push({
        id: "combo_cross_system",
        name: "Cross-system marker interaction",
        query: `${crossSystemDescriptions.join(" with ")} multi-organ interaction systemic pattern clinical significance`,
        markers: crossSystemMarkers,
      });
    }
  }

  return queries;
}

// ---------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------

/**
 * Retrieve research studies for cross-marker patterns and combinations.
 *
 * @param supabase     - Supabase client
 * @param biomarkers   - Full panel of biomarker results
 * @param statusMap    - Status map from resolvePanel
 * @param referenceMap - Reference map from resolvePanel
 * @param detectedPatterns - Rule-detected patterns from pattern-detection.ts
 */
export async function retrievePatternResearch(
  supabase: SupabaseClient,
  biomarkers: BiomarkerInput[],
  statusMap: Map<string, { status: string; flag: string }>,
  referenceMap: Map<string, BiomarkerReference>,
  detectedPatterns: DetectedPattern[]
): Promise<PatternRAGResult> {
  const start = Date.now();

  // Build a lookup for marker values
  const markerValues = new Map<string, { value: number; unit: string | null; status: string; flag: string }>();
  for (const bm of biomarkers) {
    const status = statusMap.get(bm.name);
    if (status) {
      markerValues.set(bm.name, {
        value: bm.value,
        unit: bm.unit,
        status: status.status,
        flag: status.flag,
      });
    }
  }

  // 1. Build queries for rule-detected patterns
  const patternQueries = detectedPatterns.map((p) => ({
    id: p.id,
    name: p.name,
    query: buildPatternQuery(p, markerValues),
  }));

  // 2. Build queries for notable marker combinations
  const combinationQueries = buildCombinationQueries(
    biomarkers,
    statusMap,
    referenceMap
  );

  // 3. Collect all query texts for batch embedding
  const allQueryTexts = [
    ...patternQueries.map((q) => q.query),
    ...combinationQueries.map((q) => q.query),
  ];

  if (allQueryTexts.length === 0) {
    return {
      rule_pattern_research: [],
      combination_research: [],
      total_studies: 0,
      retrieval_time_ms: Date.now() - start,
    };
  }

  console.log(
    `[pattern-rag] Generating ${allQueryTexts.length} embeddings (${patternQueries.length} pattern + ${combinationQueries.length} combination queries)`
  );

  // 4. Batch embed all queries in a single API call
  const embeddings = await batchEmbed(allQueryTexts);

  // 5. Run all vector searches in parallel
  const seenStudyIds = new Set<number>();
  let totalStudies = 0;

  const patternSearches = patternQueries.map(async (pq, i) => {
    const studies = await searchStudies(supabase, embeddings[i], 10);
    return {
      pattern_id: pq.id,
      pattern_name: pq.name,
      query_used: pq.query,
      studies,
    } satisfies PatternResearchContext;
  });

  const comboOffset = patternQueries.length;
  const comboSearches = combinationQueries.map(async (cq, i) => {
    const studies = await searchStudies(supabase, embeddings[comboOffset + i], 10);
    return {
      pattern_id: cq.id,
      pattern_name: cq.name,
      query_used: cq.query,
      studies,
    } satisfies PatternResearchContext;
  });

  const [patternResults, comboResults] = await Promise.all([
    Promise.all(patternSearches),
    Promise.all(comboSearches),
  ]);

  // Count unique studies
  for (const ctx of [...patternResults, ...comboResults]) {
    for (const s of ctx.studies) {
      if (!seenStudyIds.has(s.id)) {
        seenStudyIds.add(s.id);
        totalStudies++;
      }
    }
  }

  const retrievalTimeMs = Date.now() - start;

  console.log(
    `[pattern-rag] Retrieved ${totalStudies} unique studies across ${patternResults.length + comboResults.length} queries in ${retrievalTimeMs}ms`
  );

  return {
    rule_pattern_research: patternResults,
    combination_research: comboResults,
    total_studies: totalStudies,
    retrieval_time_ms: retrievalTimeMs,
  };
}

// ---------------------------------------------------------------------
// Format research context for the summary prompt
// ---------------------------------------------------------------------

/**
 * Format the PatternRAGResult into text suitable for injection into
 * the summary prompt. Returns a string block the LLM can reference.
 */
export function formatPatternResearchForPrompt(
  ragResult: PatternRAGResult,
  detectedPatterns: DetectedPattern[]
): string {
  const sections: string[] = [];

  // Section 1: Rule-detected patterns with research backing
  if (detectedPatterns.length > 0) {
    sections.push("=== RULE-DETECTED PATTERNS (confirmed by pattern engine) ===");

    for (const pattern of detectedPatterns) {
      const research = ragResult.rule_pattern_research.find(
        (r) => r.pattern_id === pattern.id
      );

      let block = `\n[PATTERN: ${pattern.name}]
Severity: ${pattern.severity}
Markers involved: ${pattern.markers_matched.join(", ")}
Rule engine summary: ${pattern.summary}
Founding citation: ${pattern.citation}`;

      if (research && research.studies.length > 0) {
        block += `\nAdditional research from corpus (${research.studies.length} studies):`;
        for (const study of research.studies.slice(0, 5)) {
          const authorStr =
            study.authors && study.authors.length > 0
              ? `${study.authors[0].split(" ").pop()} et al.`
              : "Unknown";
          block += `\n  - ${authorStr}, ${study.publication_year || "n.d."} (${study.study_type || "Article"}, Evidence: ${study.grade_score || "UNGRADED"}, Similarity: ${study.similarity.toFixed(3)})
    Title: "${study.title}"
    Journal: ${study.journal || "Unknown"}
    Abstract excerpt: ${study.abstract.substring(0, 400)}${study.abstract.length > 400 ? "..." : ""}`;
        }
      } else {
        block += `\nNo additional corpus studies found for this pattern.`;
      }

      sections.push(block);
    }
  }

  // Section 2: Novel combination research
  if (ragResult.combination_research.length > 0) {
    sections.push(
      "\n=== MARKER COMBINATION RESEARCH (for novel pattern discovery) ==="
    );
    sections.push(
      "These studies were retrieved for notable marker combinations in the panel. Use ONLY these studies to identify additional patterns not covered by the rule engine above."
    );

    for (const combo of ragResult.combination_research) {
      if (combo.studies.length === 0) continue;

      let block = `\n[COMBINATION: ${combo.pattern_name}]
Query used: "${combo.query_used}"
Studies retrieved: ${combo.studies.length}`;

      for (const study of combo.studies.slice(0, 5)) {
        const authorStr =
          study.authors && study.authors.length > 0
            ? `${study.authors[0].split(" ").pop()} et al.`
            : "Unknown";
        block += `\n  - ${authorStr}, ${study.publication_year || "n.d."} (${study.study_type || "Article"}, Evidence: ${study.grade_score || "UNGRADED"}, Similarity: ${study.similarity.toFixed(3)})
    Title: "${study.title}"
    Journal: ${study.journal || "Unknown"}
    Abstract excerpt: ${study.abstract.substring(0, 400)}${study.abstract.length > 400 ? "..." : ""}`;
      }

      sections.push(block);
    }
  }

  if (sections.length === 0) {
    return "";
  }

  return sections.join("\n");
}

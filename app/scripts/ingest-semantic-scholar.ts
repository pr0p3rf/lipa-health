/**
 * =====================================================================
 * LIVING RESEARCH™ ENGINE — Semantic Scholar Ingestion Pipeline
 * =====================================================================
 *
 * Pulls highly-cited papers from Semantic Scholar, embeds them with
 * OpenAI, and stores them in Supabase pgvector for RAG retrieval.
 *
 * Strategy: For each biomarker topic, search Semantic Scholar and take
 * the top 100 most-cited papers. This captures landmark studies that
 * define each field.
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/ingest-semantic-scholar.ts
 *
 * Environment variables required (in .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - OPENAI_API_KEY
 * =====================================================================
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

const CONFIG = {
  // Semantic Scholar API
  S2_BASE_URL: 'https://api.semanticscholar.org/graph/v1',
  S2_SEARCH_LIMIT: 100, // Max results per search query
  S2_DELAY_MS: 10000, // Conservative 10s delay to avoid rate limiting
  S2_MIN_CITATIONS: 50, // Only keep highly-cited papers

  // Batch sizes
  EMBED_BATCH_SIZE: 50, // Texts per OpenAI embedding request
  INSERT_BATCH_SIZE: 100, // Studies per Supabase insert

  // Rate limiting
  OPENAI_DELAY_MS: 500,

  // Limits
  MAX_ABSTRACT_LENGTH: 7000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 10000,
};

// ---------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// ---------------------------------------------------------------------
// Search query definitions
// ---------------------------------------------------------------------

const QUERIES: string[] = [
  // Biomarker interpretation (20)
  'vitamin D blood levels health outcomes',
  'iron deficiency ferritin clinical significance',
  'thyroid TSH interpretation subclinical',
  'testosterone deficiency blood test',
  'cholesterol LDL cardiovascular risk',
  'HbA1c diabetes risk prediction',
  'C-reactive protein inflammation cardiovascular',
  'homocysteine cardiovascular disease',
  'vitamin B12 deficiency neurological',
  'omega-3 index cardiovascular health',
  'magnesium deficiency health outcomes',
  'cortisol stress health impact',
  'insulin resistance biomarkers',
  'liver enzymes ALT AST clinical significance',
  'kidney function eGFR creatinine',
  'hematocrit hemoglobin clinical relevance',
  'ferritin iron overload hemochromatosis',
  'apolipoprotein B cardiovascular risk',
  'lipoprotein(a) heart disease risk',
  'fasting insulin metabolic syndrome',

  // Supplementation evidence (15)
  'vitamin D supplementation randomized trial',
  'omega-3 supplementation cardiovascular',
  'magnesium supplementation health',
  'iron supplementation efficacy',
  'vitamin B12 supplementation outcomes',
  'curcumin supplementation inflammation',
  'ashwagandha cortisol stress',
  'berberine glucose cholesterol',
  'coenzyme Q10 supplementation',
  'selenium supplementation thyroid',
  'zinc supplementation immune',
  'creatine supplementation health',
  'probiotics gut health biomarkers',
  'melatonin sleep health outcomes',
  'NAC N-acetyl cysteine clinical',

  // Lifestyle interventions (9)
  'Mediterranean diet biomarkers health',
  'intermittent fasting blood markers',
  'exercise blood biomarkers improvement',
  'sleep deprivation blood test changes',
  'cold exposure health biomarkers',
  'sauna cardiovascular health',
  'meditation cortisol stress reduction',
  'caloric restriction aging biomarkers',
  'weight loss blood test improvement',

  // Protocols / medications (7)
  'testosterone replacement therapy monitoring',
  'semaglutide blood biomarker changes',
  'tirzepatide metabolic outcomes',
  'BPC-157 healing mechanisms',
  'growth hormone peptides IGF-1',
  'metformin longevity biomarkers',
  'statin therapy biomarker changes',

  // Aging / longevity (9)
  'biological age blood biomarkers',
  'Klemera Doubal biological age',
  'PhenoAge Levine aging',
  'DunedinPACE pace of aging',
  'telomere length blood biomarkers',
  'epigenetic clock blood',
  'longevity biomarkers prediction',
  'all-cause mortality blood biomarkers',
  'healthy aging blood test predictors',
];

// ---------------------------------------------------------------------
// Semantic Scholar API types
// ---------------------------------------------------------------------

interface S2Author {
  authorId: string | null;
  name: string;
}

interface S2ExternalIds {
  PubMed?: string;
  DOI?: string;
  ArXiv?: string;
  [key: string]: string | undefined;
}

interface S2Paper {
  paperId: string;
  title: string;
  abstract: string | null;
  authors: S2Author[];
  year: number | null;
  journal: { name: string } | null;
  citationCount: number;
  externalIds: S2ExternalIds | null;
}

interface S2SearchResponse {
  total: number;
  offset: number;
  data: S2Paper[];
}

// ---------------------------------------------------------------------
// Semantic Scholar API functions
// ---------------------------------------------------------------------

const S2_FIELDS = 'paperId,title,abstract,authors,year,journal,citationCount,externalIds';

async function searchSemanticScholar(query: string): Promise<S2Paper[]> {
  const url = `${CONFIG.S2_BASE_URL}/paper/search?query=${encodeURIComponent(query)}&limit=${CONFIG.S2_SEARCH_LIMIT}&fields=${S2_FIELDS}`;

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`S2 search failed (${response.status}): ${body}`);
  }

  const data: S2SearchResponse = await response.json();
  return data.data || [];
}

async function fetchWithRetry(url: string, retries = CONFIG.MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      // Rate limited — back off and retry
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        console.log(`   Rate limited. Waiting ${retryAfter}s before retry ${attempt}/${retries}...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`   Network error, retry ${attempt}/${retries} in ${CONFIG.RETRY_DELAY_MS / 1000}s...`);
      await sleep(CONFIG.RETRY_DELAY_MS);
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw new Error('fetchWithRetry exhausted retries');
}

// ---------------------------------------------------------------------
// Processing helpers
// ---------------------------------------------------------------------

interface ProcessedPaper {
  pmid: string;
  doi: string | null;
  title: string;
  abstract: string;
  authors: string[];
  journal: string;
  publication_year: number | null;
  publication_date: string | null;
  study_type: string;
  is_systematic_review: boolean;
  is_meta_analysis: boolean;
  is_clinical_trial: boolean;
  mesh_terms: string[];
  keywords: string[];
  biomarker_tags: string[];
  grade_score: string;
  confidence_score: number;
  citation_count: number;
  source: string;
}

function inferStudyType(title: string, abstract: string): {
  study_type: string;
  is_systematic_review: boolean;
  is_meta_analysis: boolean;
  is_clinical_trial: boolean;
} {
  const combined = `${title} ${abstract}`.toLowerCase();

  const is_meta_analysis = /meta-analysis|meta analysis/.test(combined);
  const is_systematic_review = /systematic review/.test(combined);
  const is_rct = /randomized controlled trial|randomised controlled trial|rct/.test(combined);
  const is_clinical_trial = /clinical trial|controlled trial/.test(combined);
  const is_review = /\breview\b/.test(combined) && !is_systematic_review;

  let study_type = 'Article';
  if (is_meta_analysis) study_type = 'Meta-Analysis';
  else if (is_systematic_review) study_type = 'Systematic Review';
  else if (is_rct) study_type = 'Randomized Controlled Trial';
  else if (is_clinical_trial) study_type = 'Clinical Trial';
  else if (is_review) study_type = 'Review';

  return { study_type, is_systematic_review, is_meta_analysis, is_clinical_trial: is_clinical_trial || is_rct };
}

function computeConfidenceScore(paper: ProcessedPaper): number {
  let score = 0.5;

  if (paper.is_meta_analysis) score += 0.3;
  else if (paper.is_systematic_review) score += 0.25;
  else if (paper.study_type === 'Randomized Controlled Trial') score += 0.2;
  else if (paper.is_clinical_trial) score += 0.15;
  else if (paper.study_type === 'Review') score += 0.1;

  // Recency bonus
  if (paper.publication_year && paper.publication_year >= 2020) score += 0.05;

  // Citation bonus for highly-cited papers
  if (paper.citation_count >= 1000) score += 0.1;
  else if (paper.citation_count >= 500) score += 0.05;

  return Math.min(score, 1.0);
}

function computeGradeScore(paper: ProcessedPaper): 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW' {
  if (paper.is_meta_analysis || paper.is_systematic_review) return 'HIGH';
  if (paper.study_type === 'Randomized Controlled Trial') return 'HIGH';
  if (paper.is_clinical_trial) return 'MODERATE';
  if (paper.study_type === 'Review') return 'MODERATE';
  return 'LOW';
}

function processPapers(papers: S2Paper[], query: string): ProcessedPaper[] {
  const results: ProcessedPaper[] = [];

  for (const paper of papers) {
    // Must have an abstract
    if (!paper.abstract || paper.abstract.length < 50) continue;

    // Must be highly cited
    if (paper.citationCount < CONFIG.S2_MIN_CITATIONS) continue;

    // Determine PMID — use PubMed ID if available, otherwise synthetic
    const pubmedId = paper.externalIds?.PubMed || null;
    const pmid = pubmedId || `S2-${paper.paperId}`;

    // DOI
    const doi = paper.externalIds?.DOI || null;

    // Truncate abstract
    const abstract = paper.abstract.slice(0, CONFIG.MAX_ABSTRACT_LENGTH);

    // Infer study type from title + abstract
    const typeInfo = inferStudyType(paper.title, abstract);

    const processed: ProcessedPaper = {
      pmid,
      doi,
      title: paper.title,
      abstract,
      authors: paper.authors.map(a => a.name),
      journal: paper.journal?.name || '',
      publication_year: paper.year,
      publication_date: null,
      ...typeInfo,
      mesh_terms: [],
      keywords: [],
      biomarker_tags: [query],
      grade_score: 'LOW', // placeholder, computed below
      confidence_score: 0, // placeholder, computed below
      citation_count: paper.citationCount,
      source: 'semantic_scholar',
    };

    processed.grade_score = computeGradeScore(processed);
    processed.confidence_score = computeConfidenceScore(processed);

    results.push(processed);
  }

  // Sort by citation count descending, take the most cited
  results.sort((a, b) => b.citation_count - a.citation_count);

  return results;
}

// ---------------------------------------------------------------------
// Embedding functions
// ---------------------------------------------------------------------

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
    dimensions: 1536,
  });

  return response.data.map(d => d.embedding);
}

// ---------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------

async function upsertStudies(
  papers: ProcessedPaper[],
  embeddings: number[][]
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < papers.length; i += CONFIG.INSERT_BATCH_SIZE) {
    const batchPapers = papers.slice(i, i + CONFIG.INSERT_BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + CONFIG.INSERT_BATCH_SIZE);

    const records = batchPapers.map((paper, j) => ({
      pmid: paper.pmid,
      doi: paper.doi,
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors,
      journal: paper.journal,
      publication_year: paper.publication_year,
      publication_date: paper.publication_date,
      study_type: paper.study_type,
      is_systematic_review: paper.is_systematic_review,
      is_meta_analysis: paper.is_meta_analysis,
      is_clinical_trial: paper.is_clinical_trial,
      mesh_terms: paper.mesh_terms,
      keywords: paper.keywords,
      biomarker_tags: paper.biomarker_tags,
      grade_score: paper.grade_score,
      confidence_score: paper.confidence_score,
      source: paper.source,
      embedding: batchEmbeddings[j],
    }));

    const { error } = await supabase
      .from('research_studies')
      .upsert(records, { onConflict: 'pmid', ignoreDuplicates: false });

    if (error) {
      console.error('   Upsert error:', error.message);
    } else {
      totalInserted += records.length;
    }
  }

  return totalInserted;
}

// ---------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------
// Main ingestion pipeline
// ---------------------------------------------------------------------

async function ingestQuery(query: string, index: number, total: number): Promise<number> {
  console.log(`\n[${index + 1}/${total}] Searching: "${query}"`);

  try {
    // 1. Search Semantic Scholar
    const papers = await searchSemanticScholar(query);
    console.log(`   API returned ${papers.length} results`);

    // 2. Process: filter by citations, deduplicate IDs, sort
    const processed = processPapers(papers, query);
    console.log(`   After filtering (citations >= ${CONFIG.S2_MIN_CITATIONS}): ${processed.length} papers`);

    const withPmid = processed.filter(p => !p.pmid.startsWith('S2-')).length;
    const withSyntheticId = processed.length - withPmid;
    console.log(`   With PubMed ID: ${withPmid} | Synthetic ID: ${withSyntheticId}`);

    if (processed.length === 0) {
      console.log('   Skipping — no papers passed filters');
      return 0;
    }

    // 3. Embed in batches
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < processed.length; i += CONFIG.EMBED_BATCH_SIZE) {
      const batch = processed.slice(i, i + CONFIG.EMBED_BATCH_SIZE);
      const texts = batch.map(p => `${p.title}\n\n${p.abstract}`);

      const embeddings = await embedTexts(texts);
      allEmbeddings.push(...embeddings);

      if (i + CONFIG.EMBED_BATCH_SIZE < processed.length) {
        await sleep(CONFIG.OPENAI_DELAY_MS);
      }
    }

    // 4. Upsert to Supabase
    const inserted = await upsertStudies(processed, allEmbeddings);
    console.log(`   Upserted ${inserted} studies to research_studies`);

    return inserted;
  } catch (err) {
    console.error(`   ERROR on "${query}":`, err instanceof Error ? err.message : err);
    return 0;
  }
}

async function main() {
  console.log('='.repeat(65));
  console.log('LIVING RESEARCH™ — Semantic Scholar Highly-Cited Papers Pipeline');
  console.log('='.repeat(65));
  console.log(`Queries: ${QUERIES.length}`);
  console.log(`Min citations: ${CONFIG.S2_MIN_CITATIONS}`);
  console.log(`Max per query: ${CONFIG.S2_SEARCH_LIMIT}`);
  console.log(`Delay between queries: ${CONFIG.S2_DELAY_MS / 1000}s`);
  console.log(`Expected yield: 3,000–6,000 highly-cited papers`);
  console.log();

  // Validate env vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    process.exit(1);
  }

  const startTime = Date.now();
  let totalIngested = 0;
  const perQueryResults: { query: string; count: number }[] = [];

  // Track global dedup — avoid re-embedding papers seen in earlier queries
  const seenPmids = new Set<string>();

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];

    // Search
    console.log(`\n[${i + 1}/${QUERIES.length}] Searching: "${query}"`);

    try {
      const papers = await searchSemanticScholar(query);
      console.log(`   API returned ${papers.length} results`);

      // Process and filter
      let processed = processPapers(papers, query);
      console.log(`   After citation filter (>= ${CONFIG.S2_MIN_CITATIONS}): ${processed.length} papers`);

      // Deduplicate against papers already seen in this run
      const beforeDedup = processed.length;
      processed = processed.filter(p => !seenPmids.has(p.pmid));
      if (beforeDedup !== processed.length) {
        console.log(`   After cross-query dedup: ${processed.length} papers (${beforeDedup - processed.length} duplicates removed)`);
      }

      // Track these PMIDs
      for (const p of processed) {
        seenPmids.add(p.pmid);
      }

      const withPmid = processed.filter(p => !p.pmid.startsWith('S2-')).length;
      const withSyntheticId = processed.length - withPmid;
      console.log(`   With PubMed ID: ${withPmid} | Synthetic ID: ${withSyntheticId}`);

      if (processed.length === 0) {
        console.log('   Skipping — no new papers');
        perQueryResults.push({ query, count: 0 });
      } else {
        // Embed in batches
        const allEmbeddings: number[][] = [];
        for (let j = 0; j < processed.length; j += CONFIG.EMBED_BATCH_SIZE) {
          const batch = processed.slice(j, j + CONFIG.EMBED_BATCH_SIZE);
          const texts = batch.map(p => `${p.title}\n\n${p.abstract}`);

          const embeddings = await embedTexts(texts);
          allEmbeddings.push(...embeddings);

          if (j + CONFIG.EMBED_BATCH_SIZE < processed.length) {
            await sleep(CONFIG.OPENAI_DELAY_MS);
          }
        }

        // Upsert
        const inserted = await upsertStudies(processed, allEmbeddings);
        totalIngested += inserted;
        perQueryResults.push({ query, count: inserted });
        console.log(`   Upserted ${inserted} studies (running total: ${totalIngested})`);
      }
    } catch (err) {
      console.error(`   ERROR on "${query}":`, err instanceof Error ? err.message : err);
      perQueryResults.push({ query, count: 0 });
    }

    // Rate limit delay between queries
    if (i < QUERIES.length - 1) {
      await sleep(CONFIG.S2_DELAY_MS);
    }
  }

  // Summary
  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);
  const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

  console.log();
  console.log('='.repeat(65));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(65));
  console.log(`Total studies upserted: ${totalIngested}`);
  console.log(`Unique papers seen: ${seenPmids.size}`);
  console.log(`Elapsed time: ${elapsedMinutes > 0 ? `${elapsedMinutes} minutes` : `${elapsedSeconds} seconds`}`);
  console.log();
  console.log('Per-query breakdown:');
  for (const r of perQueryResults) {
    const status = r.count > 0 ? `${r.count} papers` : 'no new papers';
    console.log(`  - "${r.query}": ${status}`);
  }
  console.log();
  console.log('Next step: Check Supabase dashboard to verify research_studies table.');
}

main().catch(console.error);

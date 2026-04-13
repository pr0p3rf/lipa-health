/**
 * =====================================================================
 * LIVING RESEARCH™ ENGINE — Cochrane, Guidelines & Landmark Studies
 * =====================================================================
 *
 * Complements the core PubMed corpus with three high-quality sources:
 *   1. Cochrane Systematic Reviews (gold-standard evidence)
 *   2. Clinical Practice Guidelines (actionable reference ranges)
 *   3. Landmark/Highly-Cited Studies (foundational evidence)
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/ingest-cochrane-guidelines.ts
 *
 * Environment variables required (in .env.local):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - OPENAI_API_KEY
 *   - NCBI_API_KEY (optional but recommended for higher rate limits)
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
  // PubMed API
  PUBMED_BASE_URL: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
  NCBI_API_KEY: process.env.NCBI_API_KEY || '',
  NCBI_EMAIL: 'hello@lipa.health',

  // Batch sizes
  FETCH_BATCH_SIZE: 100,        // Studies per PubMed fetch request
  EMBED_BATCH_SIZE: 50,         // Texts per OpenAI embedding request
  INSERT_BATCH_SIZE: 50,        // Studies per Supabase insert (smaller to avoid timeouts)

  // Rate limiting
  PUBMED_DELAY_MS: 350,
  OPENAI_DELAY_MS: 500,

  // Limits
  MAX_ABSTRACT_CHARS: 7000,     // Truncate abstracts to avoid 8192 token embedding error
  MIN_YEAR: 2000,

  // Retry
  RETRY_DELAY_MS: 5000,
  MAX_RETRIES: 1,
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
// Query definitions
// ---------------------------------------------------------------------

interface QueryConfig {
  name: string;
  biomarkerTag: string;
  query: string;
  maxResults: number;
  source: 'cochrane' | 'guideline' | 'landmark';
}

// SOURCE 1: Cochrane Systematic Reviews
const COCHRANE_QUERIES: QueryConfig[] = [
  'vitamin D supplementation',
  'iron supplementation',
  'omega-3 fatty acids',
  'cholesterol lowering',
  'blood pressure',
  'diabetes prevention',
  'thyroid',
  'testosterone',
  'vitamin B12',
  'magnesium supplementation',
  'inflammation biomarkers',
  'cardiovascular risk',
  'liver disease',
  'kidney disease',
  'anemia',
  'metabolic syndrome',
  'insulin resistance',
  'selenium supplementation',
  'zinc supplementation',
  'coenzyme Q10',
  'folate folic acid',
  'homocysteine',
  'exercise health outcomes',
  'Mediterranean diet',
  'sleep health',
  'weight loss biomarkers',
].map(term => ({
  name: `Cochrane: ${term}`,
  biomarkerTag: term.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  query: `${term} AND "Cochrane Database Syst Rev"[Journal]`,
  maxResults: 200,
  source: 'cochrane' as const,
}));

// SOURCE 2: Clinical Practice Guidelines
const GUIDELINE_QUERIES: QueryConfig[] = [
  {
    name: 'Guideline: Endocrine Society CPG',
    biomarkerTag: 'Endocrine',
    query: '"Endocrine Society clinical practice guideline"',
    maxResults: 100,
  },
  {
    name: 'Guideline: ESC guidelines',
    biomarkerTag: 'Cardiovascular',
    query: '"European Society of Cardiology guidelines"',
    maxResults: 100,
  },
  {
    name: 'Guideline: ADA standards of care',
    biomarkerTag: 'Diabetes',
    query: '"American Diabetes Association standards of care"',
    maxResults: 100,
  },
  {
    name: 'Guideline: WHO vitamin/mineral',
    biomarkerTag: 'Nutrition',
    query: '"WHO guideline" AND (vitamin OR mineral OR nutrition)',
    maxResults: 100,
  },
  {
    name: 'Guideline: NICE blood/biomarker',
    biomarkerTag: 'Screening',
    query: '"NICE guideline" AND (blood test OR biomarker OR screening)',
    maxResults: 100,
  },
  {
    name: 'Guideline: USPSTF screening',
    biomarkerTag: 'Screening',
    query: '"USPSTF recommendation" AND screening',
    maxResults: 100,
  },
  {
    name: 'Guideline: ATA thyroid',
    biomarkerTag: 'Thyroid',
    query: '"American Thyroid Association guideline"',
    maxResults: 100,
  },
  {
    name: 'Guideline: AHA scientific statement',
    biomarkerTag: 'Cardiovascular',
    query: '"American Heart Association scientific statement"',
    maxResults: 100,
  },
  {
    name: 'Guideline: EASL liver',
    biomarkerTag: 'Liver',
    query: '"European Association for Study of Liver guidelines"',
    maxResults: 100,
  },
  {
    name: 'Guideline: KDIGO kidney',
    biomarkerTag: 'Kidney',
    query: '"KDIGO guideline" kidney',
    maxResults: 100,
  },
  {
    name: 'Guideline: ACR rheumatology',
    biomarkerTag: 'Inflammation',
    query: '"American College of Rheumatology guideline"',
    maxResults: 100,
  },
  {
    name: 'Guideline: Endocrine Society testosterone',
    biomarkerTag: 'Testosterone',
    query: '"Endocrine Society" testosterone',
    maxResults: 100,
  },
  {
    name: 'Guideline: ESHRE PCOS',
    biomarkerTag: 'Reproductive',
    query: '"European Society of Human Reproduction" PCOS',
    maxResults: 100,
  },
  {
    name: 'Guideline: IOF vitamin D',
    biomarkerTag: 'Vitamin D',
    query: '"International Osteoporosis Foundation" vitamin D',
    maxResults: 100,
  },
  {
    name: 'Guideline: WGO liver',
    biomarkerTag: 'Liver',
    query: '"World Gastroenterology Organisation" liver',
    maxResults: 100,
  },
].map(q => ({ ...q, source: 'guideline' as const }));

// SOURCE 3: Landmark/Highly-Cited Studies
const LANDMARK_QUERIES: QueryConfig[] = [
  {
    name: 'Landmark: Framingham biomarkers',
    biomarkerTag: 'Cardiovascular',
    query: '"Framingham Heart Study" biomarkers',
    maxResults: 50,
  },
  {
    name: 'Landmark: UK Biobank blood',
    biomarkerTag: 'Biomarkers',
    query: '"UK Biobank" blood biomarkers',
    maxResults: 50,
  },
  {
    name: 'Landmark: NHANES reference ranges',
    biomarkerTag: 'Reference Ranges',
    query: '"NHANES" biomarker reference ranges',
    maxResults: 50,
  },
  {
    name: 'Landmark: WHI blood tests',
    biomarkerTag: 'Women Health',
    query: '"Women\'s Health Initiative" blood tests',
    maxResults: 50,
  },
  {
    name: 'Landmark: JUPITER statin CRP',
    biomarkerTag: 'hs-CRP',
    query: '"JUPITER trial" statin CRP',
    maxResults: 50,
  },
  {
    name: 'Landmark: REDUCE-IT omega-3',
    biomarkerTag: 'Omega-3',
    query: '"REDUCE-IT" omega-3 cardiovascular',
    maxResults: 50,
  },
  {
    name: 'Landmark: VITAL vitamin D',
    biomarkerTag: 'Vitamin D',
    query: '"VITAL trial" vitamin D',
    maxResults: 50,
  },
  {
    name: 'Landmark: DPP diabetes prevention',
    biomarkerTag: 'Diabetes',
    query: '"DPP" diabetes prevention program',
    maxResults: 50,
  },
  {
    name: 'Landmark: PREDIMED Mediterranean',
    biomarkerTag: 'Nutrition',
    query: '"PREDIMED" Mediterranean diet',
    maxResults: 50,
  },
  {
    name: 'Landmark: CALERIE caloric restriction',
    biomarkerTag: 'Aging',
    query: '"CALERIE" caloric restriction aging',
    maxResults: 50,
  },
  {
    name: 'Landmark: STEP semaglutide',
    biomarkerTag: 'GLP-1',
    query: '"STEP trial" semaglutide',
    maxResults: 50,
  },
  {
    name: 'Landmark: SUSTAIN semaglutide',
    biomarkerTag: 'GLP-1',
    query: '"SUSTAIN trial" semaglutide',
    maxResults: 50,
  },
  {
    name: 'Landmark: SURMOUNT tirzepatide',
    biomarkerTag: 'GLP-1',
    query: '"SURMOUNT trial" tirzepatide',
    maxResults: 50,
  },
  {
    name: 'Landmark: TRAVERSE testosterone',
    biomarkerTag: 'Testosterone',
    query: '"TRAVERSE trial" testosterone',
    maxResults: 50,
  },
  {
    name: 'Landmark: InCHIANTI aging',
    biomarkerTag: 'Aging',
    query: '"InCHIANTI" aging biomarkers',
    maxResults: 50,
  },
  {
    name: 'Landmark: Whitehall health',
    biomarkerTag: 'Health Outcomes',
    query: '"Whitehall study" health outcomes',
    maxResults: 50,
  },
].map(q => ({ ...q, source: 'landmark' as const }));

// All queries combined
const ALL_QUERIES: QueryConfig[] = [
  ...COCHRANE_QUERIES,
  ...GUIDELINE_QUERIES,
  ...LANDMARK_QUERIES,
];

// ---------------------------------------------------------------------
// PubMed API functions
// ---------------------------------------------------------------------

interface PubMedArticle {
  pmid: string;
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
  doi: string | null;
}

async function searchPubMed(query: string, maxResults: number): Promise<string[]> {
  const apiKeyParam = CONFIG.NCBI_API_KEY ? `&api_key=${CONFIG.NCBI_API_KEY}` : '';
  const url = `${CONFIG.PUBMED_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}&tool=lipa&email=${CONFIG.NCBI_EMAIL}${apiKeyParam}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PubMed search failed: ${response.status}`);
  }

  const data = await response.json();
  return data.esearchresult?.idlist || [];
}

async function fetchArticles(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const apiKeyParam = CONFIG.NCBI_API_KEY ? `&api_key=${CONFIG.NCBI_API_KEY}` : '';
  const url = `${CONFIG.PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml&tool=lipa&email=${CONFIG.NCBI_EMAIL}${apiKeyParam}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`PubMed fetch failed: ${response.status}`);
  }

  const xml = await response.text();
  return parsePubMedXML(xml);
}

function parsePubMedXML(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  const articleBlocks = xml.split('<PubmedArticle>').slice(1);

  for (const block of articleBlocks) {
    try {
      const pmid = extractFirst(block, /<PMID[^>]*>(\d+)<\/PMID>/);
      if (!pmid) continue;

      const title = extractFirst(block, /<ArticleTitle[^>]*>([^<]+)<\/ArticleTitle>/) || '';
      const abstract = extractAbstract(block);
      const journal = extractFirst(block, /<Title>([^<]+)<\/Title>/) || '';
      const year = extractFirst(block, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);

      const authorMatches = block.matchAll(/<LastName>([^<]+)<\/LastName>\s*<ForeName>([^<]+)<\/ForeName>/g);
      const authors = Array.from(authorMatches).map(m => `${m[2]} ${m[1]}`);

      const meshMatches = block.matchAll(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g);
      const mesh_terms = Array.from(meshMatches).map(m => m[1]);

      const keywordMatches = block.matchAll(/<Keyword[^>]*>([^<]+)<\/Keyword>/g);
      const keywords = Array.from(keywordMatches).map(m => m[1]);

      const pubTypeMatches = block.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g);
      const pubTypes = Array.from(pubTypeMatches).map(m => m[1]);

      const is_systematic_review = pubTypes.some(t => /systematic review/i.test(t));
      const is_meta_analysis = pubTypes.some(t => /meta-analysis/i.test(t));
      const is_clinical_trial = pubTypes.some(t => /clinical trial/i.test(t));

      let study_type = 'Article';
      if (is_meta_analysis) study_type = 'Meta-Analysis';
      else if (is_systematic_review) study_type = 'Systematic Review';
      else if (pubTypes.some(t => /randomized controlled trial/i.test(t))) study_type = 'Randomized Controlled Trial';
      else if (is_clinical_trial) study_type = 'Clinical Trial';
      else if (pubTypes.some(t => /review/i.test(t))) study_type = 'Review';

      const doi = extractFirst(block, /<ELocationID EIdType="doi"[^>]*>([^<]+)<\/ELocationID>/);

      articles.push({
        pmid,
        title: cleanText(title),
        abstract: cleanText(abstract),
        authors,
        journal,
        publication_year: year ? parseInt(year) : null,
        publication_date: null,
        study_type,
        is_systematic_review,
        is_meta_analysis,
        is_clinical_trial,
        mesh_terms,
        keywords,
        doi,
      });
    } catch (err) {
      console.error('Error parsing article:', err);
    }
  }

  return articles;
}

function extractFirst(text: string, regex: RegExp): string | null {
  const match = text.match(regex);
  return match ? match[1] : null;
}

function extractAbstract(block: string): string {
  const abstractSections = block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
  return Array.from(abstractSections).map(m => m[1]).join(' ').trim();
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------
// Embedding functions (with retry)
// ---------------------------------------------------------------------

async function embedTextsWithRetry(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Truncate texts to avoid 8192 token limit
  const truncated = texts.map(t => t.slice(0, CONFIG.MAX_ABSTRACT_CHARS));

  for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: truncated,
        dimensions: 1536,
      });
      return response.data.map(d => d.embedding);
    } catch (err) {
      if (attempt < CONFIG.MAX_RETRIES) {
        console.warn(`     Embed failed, retrying in ${CONFIG.RETRY_DELAY_MS / 1000}s...`, (err as Error).message);
        await sleep(CONFIG.RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }

  return []; // unreachable
}

// ---------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------

function computeConfidenceScore(article: PubMedArticle): number {
  let score = 0.5;

  if (article.is_meta_analysis) score += 0.3;
  else if (article.is_systematic_review) score += 0.25;
  else if (article.study_type === 'Randomized Controlled Trial') score += 0.2;
  else if (article.is_clinical_trial) score += 0.15;
  else if (article.study_type === 'Review') score += 0.1;

  if (article.publication_year && article.publication_year >= 2020) score += 0.05;

  return Math.min(score, 1.0);
}

function computeGradeScore(article: PubMedArticle): 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW' {
  if (article.is_meta_analysis || article.is_systematic_review) return 'HIGH';
  if (article.study_type === 'Randomized Controlled Trial') return 'HIGH';
  if (article.is_clinical_trial) return 'MODERATE';
  if (article.study_type === 'Review') return 'MODERATE';
  return 'LOW';
}

// ---------------------------------------------------------------------
// Supabase insert (with retry, smaller batch size)
// ---------------------------------------------------------------------

async function insertStudiesWithRetry(
  articles: PubMedArticle[],
  embeddings: number[][],
  biomarkerTag: string,
  sourceTag: 'cochrane' | 'guideline' | 'landmark'
): Promise<number> {
  let totalInserted = 0;

  // Process in smaller batches to avoid statement timeouts
  for (let i = 0; i < articles.length; i += CONFIG.INSERT_BATCH_SIZE) {
    const batchArticles = articles.slice(i, i + CONFIG.INSERT_BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + CONFIG.INSERT_BATCH_SIZE);

    const records = batchArticles.map((article, idx) => ({
      pmid: article.pmid,
      doi: article.doi,
      title: article.title,
      abstract: `[${sourceTag.toUpperCase()}] ${article.abstract}`.slice(0, CONFIG.MAX_ABSTRACT_CHARS),
      authors: article.authors,
      journal: article.journal,
      publication_year: article.publication_year,
      publication_date: article.publication_date,
      study_type: article.study_type,
      is_systematic_review: article.is_systematic_review,
      is_meta_analysis: article.is_meta_analysis,
      is_clinical_trial: article.is_clinical_trial,
      mesh_terms: article.mesh_terms,
      keywords: [...article.keywords, `source:${sourceTag}`],
      biomarker_tags: [biomarkerTag],
      grade_score: computeGradeScore(article),
      confidence_score: computeConfidenceScore(article),
      source: 'pubmed',
      embedding: batchEmbeddings[idx],
    }));

    for (let attempt = 0; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      const { error } = await supabase
        .from('research_studies')
        .upsert(records, { onConflict: 'pmid', ignoreDuplicates: false });

      if (!error) {
        totalInserted += records.length;
        break;
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        console.warn(`     Insert failed, retrying in ${CONFIG.RETRY_DELAY_MS / 1000}s...`, error.message);
        await sleep(CONFIG.RETRY_DELAY_MS);
      } else {
        console.error('     Insert error (giving up):', error.message);
      }
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

async function ingestQuery(queryConfig: QueryConfig, runningTotal: number): Promise<number> {
  const sourceLabel = queryConfig.source.toUpperCase();
  console.log(`\n[${sourceLabel}] ${queryConfig.name}`);
  console.log(`   Query: ${queryConfig.query}`);
  console.log(`   Limit: ${queryConfig.maxResults}`);

  try {
    // 1. Search PubMed
    const pmids = await searchPubMed(queryConfig.query, queryConfig.maxResults);
    console.log(`   Found: ${pmids.length} PMIDs`);

    if (pmids.length === 0) return 0;

    let totalInserted = 0;

    // 2. Process in batches
    for (let i = 0; i < pmids.length; i += CONFIG.FETCH_BATCH_SIZE) {
      const batch = pmids.slice(i, i + CONFIG.FETCH_BATCH_SIZE);
      const batchNum = Math.floor(i / CONFIG.FETCH_BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(pmids.length / CONFIG.FETCH_BATCH_SIZE);
      console.log(`   Batch ${batchNum}/${totalBatches}...`);

      // Fetch full articles
      const articles = await fetchArticles(batch);
      await sleep(CONFIG.PUBMED_DELAY_MS);

      // Filter: must have abstract, must be recent enough
      const filtered = articles.filter(a =>
        a.abstract.length > 50 &&
        a.publication_year !== null &&
        a.publication_year >= CONFIG.MIN_YEAR
      );

      if (filtered.length === 0) continue;

      // Embed in sub-batches of EMBED_BATCH_SIZE
      const allEmbeddings: number[][] = [];
      for (let j = 0; j < filtered.length; j += CONFIG.EMBED_BATCH_SIZE) {
        const embedBatch = filtered.slice(j, j + CONFIG.EMBED_BATCH_SIZE);
        const texts = embedBatch.map(a => `${a.title}\n\n${a.abstract}`.slice(0, CONFIG.MAX_ABSTRACT_CHARS));
        const embeddings = await embedTextsWithRetry(texts);
        allEmbeddings.push(...embeddings);
        await sleep(CONFIG.OPENAI_DELAY_MS);
      }

      // Insert
      const inserted = await insertStudiesWithRetry(filtered, allEmbeddings, queryConfig.biomarkerTag, queryConfig.source);
      totalInserted += inserted;
      console.log(`     Inserted ${inserted} | Query total: ${totalInserted} | Running total: ${runningTotal + totalInserted}`);
    }

    console.log(`   Done: ${queryConfig.name} -> ${totalInserted} studies`);
    return totalInserted;
  } catch (err) {
    console.error(`   ERROR on ${queryConfig.name}:`, (err as Error).message);
    return 0;
  }
}

async function main() {
  console.log('='.repeat(65));
  console.log('LIVING RESEARCH™ — Cochrane, Guidelines & Landmark Ingestion');
  console.log('='.repeat(65));

  const cochraneCount = COCHRANE_QUERIES.length;
  const guidelineCount = GUIDELINE_QUERIES.length;
  const landmarkCount = LANDMARK_QUERIES.length;

  console.log(`Cochrane queries:  ${cochraneCount}`);
  console.log(`Guideline queries: ${guidelineCount}`);
  console.log(`Landmark queries:  ${landmarkCount}`);
  console.log(`Total queries:     ${ALL_QUERIES.length}`);
  console.log(`Max possible studies: ${ALL_QUERIES.reduce((sum, q) => sum + q.maxResults, 0)}`);
  console.log();

  const startTime = Date.now();
  let totalIngested = 0;
  let queryIndex = 0;

  // Process Cochrane
  console.log('\n' + '='.repeat(65));
  console.log('SOURCE 1: COCHRANE SYSTEMATIC REVIEWS');
  console.log('='.repeat(65));
  for (const query of COCHRANE_QUERIES) {
    queryIndex++;
    console.log(`\n--- Query ${queryIndex}/${ALL_QUERIES.length} ---`);
    const count = await ingestQuery(query, totalIngested);
    totalIngested += count;
  }

  // Process Guidelines
  console.log('\n' + '='.repeat(65));
  console.log('SOURCE 2: CLINICAL PRACTICE GUIDELINES');
  console.log('='.repeat(65));
  for (const query of GUIDELINE_QUERIES) {
    queryIndex++;
    console.log(`\n--- Query ${queryIndex}/${ALL_QUERIES.length} ---`);
    const count = await ingestQuery(query, totalIngested);
    totalIngested += count;
  }

  // Process Landmark Studies
  console.log('\n' + '='.repeat(65));
  console.log('SOURCE 3: LANDMARK / HIGHLY-CITED STUDIES');
  console.log('='.repeat(65));
  for (const query of LANDMARK_QUERIES) {
    queryIndex++;
    console.log(`\n--- Query ${queryIndex}/${ALL_QUERIES.length} ---`);
    const count = await ingestQuery(query, totalIngested);
    totalIngested += count;
  }

  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);

  console.log();
  console.log('='.repeat(65));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(65));
  console.log(`Total studies ingested: ${totalIngested}`);
  console.log(`Elapsed time: ${elapsedMinutes} minutes`);
  console.log();
  console.log('PMID-based dedup ensures no duplicates with existing PubMed corpus.');
  console.log('Check Supabase dashboard to verify research_studies table.');
}

main().catch(console.error);

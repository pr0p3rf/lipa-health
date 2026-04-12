/**
 * =====================================================================
 * LIVING RESEARCH™ ENGINE — PubMed Ingestion Pipeline
 * =====================================================================
 *
 * Pulls peer-reviewed studies from PubMed, embeds them with OpenAI,
 * and stores them in Supabase pgvector for RAG retrieval.
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/ingest-pubmed.ts
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
  NCBI_API_KEY: process.env.NCBI_API_KEY || '', // Optional - higher rate limits
  NCBI_EMAIL: 'hello@lipa.health', // Required per NCBI guidelines

  // Batch sizes
  FETCH_BATCH_SIZE: 100,        // Studies per PubMed fetch request
  EMBED_BATCH_SIZE: 100,         // Texts per OpenAI embedding request
  INSERT_BATCH_SIZE: 100,        // Studies per Supabase insert

  // Rate limiting
  PUBMED_DELAY_MS: 350,          // 3 req/sec without API key, 10/sec with key
  OPENAI_DELAY_MS: 500,          // OpenAI has higher limits

  // Target
  MAX_STUDIES_PER_QUERY: 5000,   // How many studies to fetch per biomarker query
  MIN_YEAR: 2000,                // Only include studies from this year onwards
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
// These PubMed queries target high-quality research relevant to Lipa's
// biomarker analysis. Each query produces studies that will be tagged
// with the relevant biomarker.

interface QueryConfig {
  name: string;
  biomarkerTag: string;
  query: string;
  maxResults: number;
}

const QUERIES: QueryConfig[] = [
  // Cardiovascular / inflammatory
  {
    name: 'hs-CRP research',
    biomarkerTag: 'hs-CRP',
    query: '("C-Reactive Protein"[Mesh] OR "high-sensitivity C-reactive protein" OR "hs-CRP") AND ("inflammation" OR "cardiovascular" OR "risk")',
    maxResults: 3000,
  },
  {
    name: 'ApoB research',
    biomarkerTag: 'ApoB',
    query: '("Apolipoprotein B"[Mesh] OR "apolipoprotein B") AND ("cardiovascular" OR "atherosclerosis" OR "risk")',
    maxResults: 2000,
  },
  {
    name: 'Lp(a) research',
    biomarkerTag: 'Lp(a)',
    query: '"lipoprotein(a)" OR "lipoprotein a"',
    maxResults: 2000,
  },
  {
    name: 'Homocysteine research',
    biomarkerTag: 'Homocysteine',
    query: '"Homocysteine"[Mesh] AND ("cardiovascular" OR "cognitive" OR "methylation")',
    maxResults: 2000,
  },

  // Metabolic
  {
    name: 'HbA1c research',
    biomarkerTag: 'HbA1c',
    query: '("Glycated Hemoglobin"[Mesh] OR "HbA1c" OR "hemoglobin A1c") AND ("diabetes" OR "glucose" OR "metabolic")',
    maxResults: 3000,
  },
  {
    name: 'Fasting insulin research',
    biomarkerTag: 'Fasting Insulin',
    query: '("Insulin Resistance"[Mesh] OR "fasting insulin" OR "HOMA-IR")',
    maxResults: 2500,
  },
  {
    name: 'Fasting glucose research',
    biomarkerTag: 'Fasting Glucose',
    query: '("Blood Glucose"[Mesh] OR "fasting glucose") AND ("metabolic" OR "insulin" OR "diabetes")',
    maxResults: 2500,
  },

  // Hormones
  {
    name: 'Total testosterone research',
    biomarkerTag: 'Total Testosterone',
    query: '("Testosterone"[Mesh] OR "serum testosterone") AND ("hypogonadism" OR "hormone replacement" OR "men" OR "androgen")',
    maxResults: 3000,
  },
  {
    name: 'Free testosterone research',
    biomarkerTag: 'Free Testosterone',
    query: '"free testosterone" AND ("bioavailable" OR "SHBG" OR "androgen")',
    maxResults: 1500,
  },
  {
    name: 'SHBG research',
    biomarkerTag: 'SHBG',
    query: '"Sex Hormone-Binding Globulin"[Mesh] OR "SHBG"',
    maxResults: 1500,
  },
  {
    name: 'Estradiol research',
    biomarkerTag: 'Estradiol',
    query: '("Estradiol"[Mesh] OR "E2" OR "estradiol") AND ("hormone" OR "aromatase" OR "testosterone")',
    maxResults: 2000,
  },
  {
    name: 'Cortisol research',
    biomarkerTag: 'Cortisol',
    query: '("Hydrocortisone"[Mesh] OR "cortisol") AND ("stress" OR "HPA" OR "circadian")',
    maxResults: 2500,
  },

  // Thyroid
  {
    name: 'TSH research',
    biomarkerTag: 'TSH',
    query: '("Thyrotropin"[Mesh] OR "TSH" OR "thyroid stimulating hormone") AND ("thyroid" OR "hypothyroidism" OR "optimal")',
    maxResults: 2500,
  },
  {
    name: 'Free T3 research',
    biomarkerTag: 'Free T3',
    query: '("free T3" OR "free triiodothyronine") AND "thyroid"',
    maxResults: 1500,
  },
  {
    name: 'Free T4 research',
    biomarkerTag: 'Free T4',
    query: '("free T4" OR "free thyroxine") AND "thyroid"',
    maxResults: 1500,
  },

  // Vitamins / nutrients
  {
    name: 'Vitamin D research',
    biomarkerTag: 'Vitamin D',
    query: '("Vitamin D"[Mesh] OR "25-hydroxyvitamin D" OR "25(OH)D") AND ("deficiency" OR "supplementation" OR "status")',
    maxResults: 3000,
  },
  {
    name: 'Vitamin B12 research',
    biomarkerTag: 'Vitamin B12',
    query: '("Vitamin B 12"[Mesh] OR "cobalamin") AND ("deficiency" OR "supplementation")',
    maxResults: 2000,
  },
  {
    name: 'Ferritin research',
    biomarkerTag: 'Ferritin',
    query: '"Ferritins"[Mesh] AND ("iron" OR "anemia" OR "inflammation")',
    maxResults: 2000,
  },
  {
    name: 'Magnesium research',
    biomarkerTag: 'Magnesium',
    query: '("Magnesium"[Mesh] OR "serum magnesium") AND ("deficiency" OR "supplementation")',
    maxResults: 1500,
  },

  // Growth factors
  {
    name: 'IGF-1 research',
    biomarkerTag: 'IGF-1',
    query: '("Insulin-Like Growth Factor I"[Mesh] OR "IGF-1") AND ("aging" OR "growth hormone" OR "longevity")',
    maxResults: 2000,
  },

  // Hematology
  {
    name: 'Hemoglobin research',
    biomarkerTag: 'Hemoglobin',
    query: '"Hemoglobins"[Mesh] AND ("anemia" OR "oxygen" OR "reference range")',
    maxResults: 1500,
  },

  // ===================================================================
  // EXPANDED QUERIES — added 2026-04-12
  // ===================================================================

  // Additional cardiovascular
  {
    name: 'Triglycerides metabolic',
    biomarkerTag: 'Triglycerides',
    query: '("Triglycerides"[Mesh] OR "hypertriglyceridemia") AND ("cardiovascular" OR "metabolic syndrome" OR "insulin resistance")',
    maxResults: 2000,
  },
  {
    name: 'HDL cholesterol',
    biomarkerTag: 'HDL Cholesterol',
    query: '("Cholesterol, HDL"[Mesh] OR "high-density lipoprotein") AND ("cardiovascular" OR "protective" OR "risk")',
    maxResults: 2000,
  },
  {
    name: 'LDL cholesterol',
    biomarkerTag: 'LDL Cholesterol',
    query: '("Cholesterol, LDL"[Mesh] OR "low-density lipoprotein") AND ("cardiovascular" OR "statin" OR "atherosclerosis")',
    maxResults: 2000,
  },

  // Additional hormones
  {
    name: 'DHEA-S adrenal',
    biomarkerTag: 'DHEA-S',
    query: '("Dehydroepiandrosterone Sulfate"[Mesh] OR "DHEA-S" OR "DHEAS") AND ("aging" OR "adrenal" OR "hormone")',
    maxResults: 1500,
  },
  {
    name: 'FSH LH reproductive',
    biomarkerTag: 'FSH',
    query: '("Follicle Stimulating Hormone"[Mesh] OR "FSH") AND ("menopause" OR "fertility" OR "ovarian")',
    maxResults: 1500,
  },
  {
    name: 'Progesterone research',
    biomarkerTag: 'Progesterone',
    query: '("Progesterone"[Mesh]) AND ("menstrual" OR "pregnancy" OR "perimenopause" OR "luteal")',
    maxResults: 1500,
  },
  {
    name: 'Prolactin research',
    biomarkerTag: 'Prolactin',
    query: '("Prolactin"[Mesh]) AND ("hyperprolactinemia" OR "testosterone" OR "pituitary")',
    maxResults: 1000,
  },

  // Additional thyroid
  {
    name: 'TPO antibodies Hashimoto',
    biomarkerTag: 'TPO Antibodies',
    query: '"thyroid peroxidase" AND ("antibodies" OR "Hashimoto" OR "autoimmune thyroiditis")',
    maxResults: 1500,
  },
  {
    name: 'Reverse T3 research',
    biomarkerTag: 'Reverse T3',
    query: '"reverse T3" OR "reverse triiodothyronine" OR "rT3"',
    maxResults: 800,
  },

  // Additional nutritional
  {
    name: 'Iron deficiency without anemia',
    biomarkerTag: 'Iron',
    query: '"iron deficiency" AND ("non-anemic" OR "fatigue" OR "hair loss" OR "ferritin")',
    maxResults: 1500,
  },
  {
    name: 'Folate research',
    biomarkerTag: 'Folate',
    query: '("Folic Acid"[Mesh] OR "folate") AND ("deficiency" OR "methylation" OR "homocysteine")',
    maxResults: 1500,
  },
  {
    name: 'Zinc immune',
    biomarkerTag: 'Zinc',
    query: '("Zinc"[Mesh]) AND ("deficiency" OR "immune" OR "supplementation")',
    maxResults: 1500,
  },
  {
    name: 'Selenium thyroid',
    biomarkerTag: 'Selenium',
    query: '("Selenium"[Mesh]) AND ("thyroid" OR "selenoprotein" OR "Hashimoto")',
    maxResults: 1000,
  },
  {
    name: 'Omega-3 index EPA DHA',
    biomarkerTag: 'Omega-3',
    query: '("Fatty Acids, Omega-3"[Mesh] OR "EPA" OR "DHA" OR "omega-3 index") AND ("cardiovascular" OR "inflammation" OR "supplementation")',
    maxResults: 2500,
  },

  // Liver
  {
    name: 'ALT AST liver enzymes',
    biomarkerTag: 'ALT',
    query: '("Alanine Transaminase"[Mesh] OR "ALT") AND ("liver" OR "NAFLD" OR "hepatic")',
    maxResults: 2000,
  },
  {
    name: 'GGT liver research',
    biomarkerTag: 'GGT',
    query: '("gamma-Glutamyltransferase"[Mesh] OR "GGT") AND ("liver" OR "alcohol" OR "metabolic")',
    maxResults: 1500,
  },

  // Kidney
  {
    name: 'Creatinine eGFR kidney',
    biomarkerTag: 'Creatinine',
    query: '("Creatinine"[Mesh] OR "eGFR" OR "CKD-EPI") AND ("kidney" OR "renal function" OR "glomerular filtration")',
    maxResults: 2000,
  },
  {
    name: 'Cystatin C kidney',
    biomarkerTag: 'Cystatin C',
    query: '"Cystatin C"[Mesh] AND ("kidney" OR "GFR" OR "renal")',
    maxResults: 1000,
  },

  // Metabolic extras
  {
    name: 'Uric acid metabolic',
    biomarkerTag: 'Uric Acid',
    query: '("Uric Acid"[Mesh]) AND ("gout" OR "metabolic syndrome" OR "cardiovascular")',
    maxResults: 1500,
  },

  // Hematology extras
  {
    name: 'WBC differential inflammation',
    biomarkerTag: 'WBC',
    query: '("Leukocyte Count"[Mesh] OR "white blood cell") AND ("inflammation" OR "infection" OR "neutrophil-lymphocyte ratio")',
    maxResults: 1500,
  },
  {
    name: 'Platelet count research',
    biomarkerTag: 'Platelets',
    query: '("Platelet Count"[Mesh]) AND ("thrombocytopenia" OR "cardiovascular" OR "inflammation")',
    maxResults: 1000,
  },

  // ===================================================================
  // INTERVENTION-SPECIFIC QUERIES (for action plan grounding)
  // ===================================================================
  {
    name: 'Omega-3 supplementation outcomes',
    biomarkerTag: 'Omega-3',
    query: '("fish oil" OR "EPA" OR "DHA" OR "omega-3") AND ("supplementation" OR "randomized controlled trial") AND ("inflammation" OR "cardiovascular" OR "triglycerides")',
    maxResults: 2000,
  },
  {
    name: 'Vitamin D supplementation outcomes',
    biomarkerTag: 'Vitamin D',
    query: '("vitamin D" OR "cholecalciferol") AND ("supplementation" OR "randomized controlled trial") AND ("outcomes" OR "mortality" OR "bone")',
    maxResults: 2000,
  },
  {
    name: 'Magnesium supplementation outcomes',
    biomarkerTag: 'Magnesium',
    query: '("magnesium" AND "supplementation") AND ("sleep" OR "insulin" OR "blood pressure" OR "anxiety")',
    maxResults: 1500,
  },
  {
    name: 'Iron supplementation fatigue',
    biomarkerTag: 'Ferritin',
    query: '"iron supplementation" AND ("fatigue" OR "non-anemic" OR "ferritin" OR "quality of life")',
    maxResults: 1000,
  },
  {
    name: 'B12 supplementation neurological',
    biomarkerTag: 'Vitamin B12',
    query: '("vitamin B12" OR "cobalamin" OR "methylcobalamin") AND ("supplementation" OR "neurological" OR "cognition")',
    maxResults: 1000,
  },
  {
    name: 'Mediterranean diet biomarkers',
    biomarkerTag: 'Nutrition',
    query: '("Mediterranean diet" OR "PREDIMED") AND ("biomarkers" OR "inflammation" OR "cardiovascular" OR "metabolic")',
    maxResults: 1500,
  },
  {
    name: 'Exercise inflammation metabolic',
    biomarkerTag: 'Exercise',
    query: '("exercise" OR "physical activity") AND ("C-reactive protein" OR "insulin resistance" OR "inflammation") AND ("meta-analysis" OR "randomized")',
    maxResults: 2000,
  },
  {
    name: 'Sleep duration health outcomes',
    biomarkerTag: 'Sleep',
    query: '("sleep duration" OR "sleep deprivation") AND ("inflammation" OR "insulin" OR "cortisol" OR "metabolic")',
    maxResults: 1500,
  },
  {
    name: 'Weight loss metabolic markers',
    biomarkerTag: 'Weight Loss',
    query: '("weight loss" OR "caloric restriction") AND ("insulin resistance" OR "C-reactive protein" OR "biomarkers")',
    maxResults: 1500,
  },
  {
    name: 'GLP-1 agonist biomarker effects',
    biomarkerTag: 'GLP-1',
    query: '("semaglutide" OR "tirzepatide" OR "GLP-1 receptor agonist") AND ("biomarkers" OR "B12" OR "muscle" OR "metabolic")',
    maxResults: 1500,
  },
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

/**
 * Search PubMed and return a list of PMIDs.
 */
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

/**
 * Fetch full article data for a batch of PMIDs.
 * Uses the XML format because it has better structured metadata than JSON.
 */
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

/**
 * Parse PubMed XML response into structured article data.
 * Uses regex extraction for simplicity (avoids XML parser dependency).
 */
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

      // Authors
      const authorMatches = block.matchAll(/<LastName>([^<]+)<\/LastName>\s*<ForeName>([^<]+)<\/ForeName>/g);
      const authors = Array.from(authorMatches).map(m => `${m[2]} ${m[1]}`);

      // MeSH terms
      const meshMatches = block.matchAll(/<DescriptorName[^>]*>([^<]+)<\/DescriptorName>/g);
      const mesh_terms = Array.from(meshMatches).map(m => m[1]);

      // Keywords
      const keywordMatches = block.matchAll(/<Keyword[^>]*>([^<]+)<\/Keyword>/g);
      const keywords = Array.from(keywordMatches).map(m => m[1]);

      // Publication types
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

      // DOI
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
  // Handle structured abstracts with multiple sections
  const abstractSections = block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
  return Array.from(abstractSections).map(m => m[1]).join(' ').trim();
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '') // Strip HTML/XML tags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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

/**
 * Confidence score based on study type and sample size.
 */
function computeConfidenceScore(article: PubMedArticle): number {
  let score = 0.5; // baseline

  if (article.is_meta_analysis) score += 0.3;
  else if (article.is_systematic_review) score += 0.25;
  else if (article.study_type === 'Randomized Controlled Trial') score += 0.2;
  else if (article.is_clinical_trial) score += 0.15;
  else if (article.study_type === 'Review') score += 0.1;

  // Recency bonus
  if (article.publication_year && article.publication_year >= 2020) score += 0.05;

  return Math.min(score, 1.0);
}

/**
 * GRADE evidence score based on study type.
 */
function computeGradeScore(article: PubMedArticle): 'HIGH' | 'MODERATE' | 'LOW' | 'VERY_LOW' {
  if (article.is_meta_analysis || article.is_systematic_review) return 'HIGH';
  if (article.study_type === 'Randomized Controlled Trial') return 'HIGH';
  if (article.is_clinical_trial) return 'MODERATE';
  if (article.study_type === 'Review') return 'MODERATE';
  return 'LOW';
}

// ---------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------

async function insertStudies(
  articles: PubMedArticle[],
  embeddings: number[][],
  biomarkerTag: string
): Promise<number> {
  const records = articles.map((article, i) => ({
    pmid: article.pmid,
    doi: article.doi,
    title: article.title,
    abstract: article.abstract,
    authors: article.authors,
    journal: article.journal,
    publication_year: article.publication_year,
    publication_date: article.publication_date,
    study_type: article.study_type,
    is_systematic_review: article.is_systematic_review,
    is_meta_analysis: article.is_meta_analysis,
    is_clinical_trial: article.is_clinical_trial,
    mesh_terms: article.mesh_terms,
    keywords: article.keywords,
    biomarker_tags: [biomarkerTag],
    grade_score: computeGradeScore(article),
    confidence_score: computeConfidenceScore(article),
    source: 'pubmed',
    embedding: embeddings[i],
  }));

  const { data, error } = await supabase
    .from('research_studies')
    .upsert(records, { onConflict: 'pmid', ignoreDuplicates: false });

  if (error) {
    console.error('Insert error:', error);
    return 0;
  }

  return records.length;
}

// ---------------------------------------------------------------------
// Utility: sleep
// ---------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------
// Main ingestion pipeline
// ---------------------------------------------------------------------

async function ingestQuery(queryConfig: QueryConfig): Promise<number> {
  console.log(`\n🔬 Starting: ${queryConfig.name}`);
  console.log(`   Query: ${queryConfig.query}`);
  console.log(`   Target: ${queryConfig.maxResults} studies`);

  try {
    // 1. Search PubMed
    console.log('   Searching PubMed...');
    const pmids = await searchPubMed(queryConfig.query, queryConfig.maxResults);
    console.log(`   Found ${pmids.length} PMIDs`);

    if (pmids.length === 0) return 0;

    let totalInserted = 0;

    // 2. Process in batches
    for (let i = 0; i < pmids.length; i += CONFIG.FETCH_BATCH_SIZE) {
      const batch = pmids.slice(i, i + CONFIG.FETCH_BATCH_SIZE);
      console.log(`   Processing batch ${Math.floor(i / CONFIG.FETCH_BATCH_SIZE) + 1}/${Math.ceil(pmids.length / CONFIG.FETCH_BATCH_SIZE)}...`);

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

      // Embed
      const texts = filtered.map(a => `${a.title}\n\n${a.abstract}`);
      const embeddings = await embedTexts(texts);
      await sleep(CONFIG.OPENAI_DELAY_MS);

      // Insert
      const inserted = await insertStudies(filtered, embeddings, queryConfig.biomarkerTag);
      totalInserted += inserted;
      console.log(`     Inserted ${inserted} studies (total: ${totalInserted})`);
    }

    console.log(`✅ ${queryConfig.name}: ${totalInserted} studies ingested`);
    return totalInserted;
  } catch (err) {
    console.error(`❌ Error on ${queryConfig.name}:`, err);
    return 0;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('LIVING RESEARCH™ INGESTION PIPELINE');
  console.log('='.repeat(60));
  console.log(`Total queries: ${QUERIES.length}`);
  console.log(`Target studies: ${QUERIES.reduce((sum, q) => sum + q.maxResults, 0)}`);
  console.log(`Expected time: ~${Math.ceil(QUERIES.reduce((sum, q) => sum + q.maxResults, 0) / 5000)} hours`);
  console.log();

  const startTime = Date.now();
  let totalIngested = 0;

  for (const query of QUERIES) {
    const count = await ingestQuery(query);
    totalIngested += count;
  }

  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);

  console.log();
  console.log('='.repeat(60));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total studies ingested: ${totalIngested}`);
  console.log(`Elapsed time: ${elapsedMinutes} minutes`);
  console.log();
  console.log('Next step: Check Supabase dashboard to verify research_studies table.');
}

main().catch(console.error);

/**
 * =====================================================================
 * LIVING RESEARCH™ ENGINE — Uncited Biomarker Gap-Filler
 * =====================================================================
 *
 * Identifies biomarkers with 0 citations in the user_analyses table,
 * generates targeted PubMed queries for each, and ingests studies
 * to fill gaps in the RAG corpus. Goal: 95%+ citation coverage.
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/ingest-uncited-markers.ts
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
  FETCH_BATCH_SIZE: 50,          // Studies per PubMed fetch request
  EMBED_BATCH_SIZE: 50,          // Texts per OpenAI embedding request
  INSERT_BATCH_SIZE: 50,         // Studies per Supabase insert

  // Rate limiting
  PUBMED_DELAY_MS: 350,
  OPENAI_DELAY_MS: 500,

  // Target
  MAX_STUDIES_PER_QUERY: 500,    // Smaller target per query (we have many queries)
  MIN_YEAR: 2000,
  ABSTRACT_MAX_CHARS: 7000,      // Truncate abstracts beyond this

  // Retry
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
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
// Targeted query map for commonly uncited biomarkers
// ---------------------------------------------------------------------
// Each biomarker maps to 2-3 specific PubMed queries designed to
// retrieve clinically relevant studies for RAG grounding.

interface MarkerQuerySet {
  biomarkerTag: string;
  queries: { name: string; query: string }[];
}

const MARKER_QUERY_MAP: Record<string, MarkerQuerySet> = {
  // Lipids
  'Total Cholesterol': {
    biomarkerTag: 'Total Cholesterol',
    queries: [
      { name: 'total cholesterol CVD risk', query: '("Cholesterol"[Mesh] OR "total cholesterol") AND ("cardiovascular risk" OR "atherosclerosis" OR "mortality")' },
      { name: 'total cholesterol clinical significance', query: '"total cholesterol" AND ("clinical significance" OR "reference range" OR "optimal level")' },
      { name: 'total cholesterol ratio guidelines', query: '"total cholesterol" AND ("guideline" OR "lipid panel" OR "non-HDL cholesterol")' },
    ],
  },

  // Hematology — Red cell indices
  'MCV': {
    biomarkerTag: 'MCV',
    queries: [
      { name: 'MCV anemia classification', query: '("Mean Corpuscular Volume" OR "MCV") AND ("anemia" OR "macrocytic" OR "microcytic" OR "classification")' },
      { name: 'MCV clinical interpretation', query: '"mean corpuscular volume" AND ("clinical interpretation" OR "differential diagnosis" OR "B12" OR "folate")' },
    ],
  },
  'MCH': {
    biomarkerTag: 'MCH',
    queries: [
      { name: 'MCH clinical significance', query: '("Mean Corpuscular Hemoglobin" OR "MCH") AND ("anemia" OR "iron deficiency" OR "thalassemia")' },
      { name: 'MCH red cell indices', query: '"mean corpuscular hemoglobin" AND ("red cell indices" OR "complete blood count" OR "clinical utility")' },
    ],
  },
  'MCHC': {
    biomarkerTag: 'MCHC',
    queries: [
      { name: 'MCHC clinical significance', query: '("mean corpuscular hemoglobin concentration" OR "MCHC") AND ("anemia" OR "spherocytosis" OR "iron deficiency")' },
      { name: 'MCHC red cell indices diagnostic', query: '"MCHC" AND ("diagnostic" OR "complete blood count" OR "hemoglobin")' },
    ],
  },
  'RDW': {
    biomarkerTag: 'RDW',
    queries: [
      { name: 'RDW mortality predictor', query: '("Red Cell Distribution Width" OR "RDW") AND ("mortality" OR "prognosis" OR "cardiovascular")' },
      { name: 'RDW anemia differential', query: '"red cell distribution width" AND ("anemia" OR "iron deficiency" OR "differential diagnosis")' },
      { name: 'RDW inflammation marker', query: '"RDW" AND ("inflammation" OR "biomarker" OR "chronic disease")' },
    ],
  },

  // Hematology — White cell differential
  'Neutrophils': {
    biomarkerTag: 'Neutrophils',
    queries: [
      { name: 'neutrophil count clinical significance', query: '("Neutrophils"[Mesh] OR "neutrophil count") AND ("infection" OR "inflammation" OR "clinical significance")' },
      { name: 'neutrophil-to-lymphocyte ratio', query: '("neutrophil-to-lymphocyte ratio" OR "NLR") AND ("prognosis" OR "inflammation" OR "mortality")' },
    ],
  },
  'Lymphocytes': {
    biomarkerTag: 'Lymphocytes',
    queries: [
      { name: 'lymphocyte count clinical', query: '("Lymphocyte Count"[Mesh] OR "lymphocyte count") AND ("immune" OR "infection" OR "clinical significance")' },
      { name: 'lymphopenia clinical', query: '("lymphopenia" OR "lymphocytopenia") AND ("prognosis" OR "immune deficiency" OR "clinical")' },
    ],
  },
  'Monocytes': {
    biomarkerTag: 'Monocytes',
    queries: [
      { name: 'monocyte count clinical significance', query: '("Monocytes"[Mesh] OR "monocyte count") AND ("inflammation" OR "atherosclerosis" OR "clinical significance")' },
      { name: 'monocyte-to-HDL ratio', query: '("monocyte-to-HDL ratio" OR "monocyte") AND ("cardiovascular" OR "prognostic")' },
    ],
  },
  'Eosinophils': {
    biomarkerTag: 'Eosinophils',
    queries: [
      { name: 'eosinophil count clinical', query: '("Eosinophils"[Mesh] OR "eosinophil count") AND ("allergy" OR "asthma" OR "parasitic" OR "clinical significance")' },
      { name: 'eosinophilia differential diagnosis', query: '"eosinophilia" AND ("differential diagnosis" OR "causes" OR "evaluation")' },
    ],
  },
  'Basophils': {
    biomarkerTag: 'Basophils',
    queries: [
      { name: 'basophil count clinical significance', query: '("Basophils"[Mesh] OR "basophil count") AND ("allergy" OR "myeloproliferative" OR "clinical significance")' },
      { name: 'basophil activation immune', query: '"basophil" AND ("activation" OR "IgE" OR "immune response" OR "hypersensitivity")' },
    ],
  },

  // Electrolytes
  'Sodium': {
    biomarkerTag: 'Sodium',
    queries: [
      { name: 'serum sodium clinical', query: '("Sodium"[Mesh] OR "serum sodium") AND ("hyponatremia" OR "hypernatremia" OR "clinical significance")' },
      { name: 'sodium balance health outcomes', query: '"sodium" AND ("electrolyte" OR "fluid balance" OR "mortality" OR "outcomes")' },
    ],
  },
  'Potassium': {
    biomarkerTag: 'Potassium',
    queries: [
      { name: 'serum potassium clinical', query: '("Potassium"[Mesh] OR "serum potassium") AND ("hypokalemia" OR "hyperkalemia" OR "clinical significance")' },
      { name: 'potassium cardiac arrhythmia', query: '"potassium" AND ("cardiac" OR "arrhythmia" OR "renal" OR "mortality")' },
    ],
  },
  'Chloride': {
    biomarkerTag: 'Chloride',
    queries: [
      { name: 'serum chloride clinical', query: '("Chlorides"[Mesh] OR "serum chloride") AND ("metabolic acidosis" OR "alkalosis" OR "clinical significance")' },
      { name: 'chloride electrolyte balance', query: '"chloride" AND ("electrolyte" OR "acid-base" OR "diagnostic" OR "kidney")' },
    ],
  },
  'Calcium': {
    biomarkerTag: 'Calcium',
    queries: [
      { name: 'serum calcium clinical', query: '("Calcium"[Mesh] OR "serum calcium") AND ("hypercalcemia" OR "hypocalcemia" OR "clinical significance")' },
      { name: 'calcium bone cardiovascular', query: '"serum calcium" AND ("bone density" OR "parathyroid" OR "cardiovascular" OR "vitamin D")' },
      { name: 'calcium corrected albumin', query: '"corrected calcium" AND ("albumin" OR "ionized calcium" OR "interpretation")' },
    ],
  },
  'Phosphorus': {
    biomarkerTag: 'Phosphorus',
    queries: [
      { name: 'serum phosphorus clinical', query: '("Phosphorus"[Mesh] OR "serum phosphorus" OR "phosphate") AND ("clinical significance" OR "kidney" OR "bone")' },
      { name: 'phosphorus cardiovascular mortality', query: '"phosphorus" AND ("cardiovascular" OR "mortality" OR "CKD" OR "FGF23")' },
    ],
  },
  'Bicarbonate': {
    biomarkerTag: 'Bicarbonate',
    queries: [
      { name: 'serum bicarbonate clinical', query: '("Bicarbonates"[Mesh] OR "serum bicarbonate" OR "CO2") AND ("metabolic acidosis" OR "kidney" OR "clinical significance")' },
      { name: 'bicarbonate acid-base', query: '"bicarbonate" AND ("acid-base balance" OR "renal tubular" OR "CKD progression")' },
    ],
  },

  // Liver enzymes
  'ALT': {
    biomarkerTag: 'ALT',
    queries: [
      { name: 'ALT liver clinical significance', query: '("Alanine Transaminase"[Mesh] OR "ALT" OR "SGPT") AND ("liver disease" OR "NAFLD" OR "clinical significance")' },
      { name: 'ALT upper limit normal', query: '"ALT" AND ("upper limit of normal" OR "reference range" OR "healthy" OR "optimal")' },
    ],
  },
  'AST': {
    biomarkerTag: 'AST',
    queries: [
      { name: 'AST liver clinical significance', query: '("Aspartate Aminotransferases"[Mesh] OR "AST" OR "SGOT") AND ("liver" OR "cardiac" OR "clinical significance")' },
      { name: 'AST/ALT ratio diagnostic', query: '("AST/ALT ratio" OR "De Ritis ratio") AND ("liver disease" OR "alcoholic" OR "fibrosis")' },
    ],
  },
  'Alkaline Phosphatase': {
    biomarkerTag: 'Alkaline Phosphatase',
    queries: [
      { name: 'ALP clinical significance', query: '("Alkaline Phosphatase"[Mesh] OR "ALP") AND ("liver" OR "bone" OR "clinical significance")' },
      { name: 'ALP elevated differential', query: '"alkaline phosphatase" AND ("elevated" OR "differential diagnosis" OR "cholestatic" OR "Paget")' },
    ],
  },

  // Liver — other
  'Total Bilirubin': {
    biomarkerTag: 'Total Bilirubin',
    queries: [
      { name: 'total bilirubin clinical', query: '("Bilirubin"[Mesh] OR "total bilirubin") AND ("liver" OR "jaundice" OR "clinical significance")' },
      { name: 'bilirubin antioxidant', query: '"bilirubin" AND ("antioxidant" OR "cardiovascular protection" OR "Gilbert syndrome")' },
    ],
  },
  'Direct Bilirubin': {
    biomarkerTag: 'Direct Bilirubin',
    queries: [
      { name: 'direct bilirubin clinical', query: '("direct bilirubin" OR "conjugated bilirubin") AND ("cholestasis" OR "liver disease" OR "clinical significance")' },
      { name: 'direct bilirubin differential', query: '("conjugated bilirubin") AND ("obstruction" OR "hepatocellular" OR "neonatal" OR "differential diagnosis")' },
    ],
  },
  'Albumin': {
    biomarkerTag: 'Albumin',
    queries: [
      { name: 'serum albumin clinical', query: '("Serum Albumin"[Mesh] OR "serum albumin") AND ("nutritional status" OR "liver function" OR "clinical significance")' },
      { name: 'albumin mortality prognosis', query: '"albumin" AND ("mortality" OR "prognosis" OR "inflammation" OR "malnutrition")' },
      { name: 'albumin reference range', query: '"serum albumin" AND ("reference range" OR "low albumin" OR "hypoalbuminemia" OR "outcomes")' },
    ],
  },
  'Total Protein': {
    biomarkerTag: 'Total Protein',
    queries: [
      { name: 'total protein clinical', query: '("total protein" OR "serum protein") AND ("clinical significance" OR "liver" OR "kidney" OR "nutritional")' },
      { name: 'total protein electrophoresis', query: '("serum protein" OR "total protein") AND ("electrophoresis" OR "globulin" OR "myeloma" OR "dehydration")' },
    ],
  },

  // Kidney
  'BUN': {
    biomarkerTag: 'BUN',
    queries: [
      { name: 'BUN clinical significance', query: '("Blood Urea Nitrogen" OR "BUN") AND ("kidney" OR "renal function" OR "clinical significance")' },
      { name: 'BUN/creatinine ratio', query: '("BUN-to-creatinine ratio" OR "BUN/creatinine") AND ("prerenal" OR "dehydration" OR "GI bleeding" OR "diagnostic")' },
    ],
  },
  'eGFR': {
    biomarkerTag: 'eGFR',
    queries: [
      { name: 'eGFR kidney function', query: '("Glomerular Filtration Rate"[Mesh] OR "eGFR" OR "estimated GFR") AND ("chronic kidney disease" OR "CKD staging" OR "clinical significance")' },
      { name: 'eGFR CKD-EPI equation', query: '("CKD-EPI" OR "eGFR equation") AND ("race-free" OR "creatinine" OR "cystatin" OR "accuracy")' },
      { name: 'eGFR cardiovascular outcomes', query: '"eGFR" AND ("cardiovascular" OR "mortality" OR "outcomes" OR "decline")' },
    ],
  },

  // Coagulation / Iron
  'Fibrinogen': {
    biomarkerTag: 'Fibrinogen',
    queries: [
      { name: 'fibrinogen cardiovascular risk', query: '("Fibrinogen"[Mesh] OR "fibrinogen") AND ("cardiovascular risk" OR "thrombosis" OR "inflammation")' },
      { name: 'fibrinogen clinical significance', query: '"fibrinogen" AND ("acute phase" OR "coagulation" OR "clinical significance" OR "stroke")' },
    ],
  },
  'Transferrin Saturation': {
    biomarkerTag: 'Transferrin Saturation',
    queries: [
      { name: 'transferrin saturation iron status', query: '("transferrin saturation" OR "TSAT") AND ("iron deficiency" OR "iron overload" OR "clinical significance")' },
      { name: 'transferrin saturation hemochromatosis', query: '"transferrin saturation" AND ("hemochromatosis" OR "screening" OR "ferritin" OR "diagnosis")' },
    ],
  },

  // Vitamins
  'Vitamin A': {
    biomarkerTag: 'Vitamin A',
    queries: [
      { name: 'vitamin A clinical significance', query: '("Vitamin A"[Mesh] OR "retinol") AND ("deficiency" OR "toxicity" OR "clinical significance")' },
      { name: 'vitamin A immune function', query: '("vitamin A" OR "retinol") AND ("immune function" OR "vision" OR "supplementation" OR "status")' },
    ],
  },
  'Vitamin E': {
    biomarkerTag: 'Vitamin E',
    queries: [
      { name: 'vitamin E clinical significance', query: '("Vitamin E"[Mesh] OR "alpha-tocopherol") AND ("deficiency" OR "antioxidant" OR "clinical significance")' },
      { name: 'vitamin E supplementation outcomes', query: '("vitamin E" OR "tocopherol") AND ("supplementation" OR "cardiovascular" OR "neurological" OR "outcomes")' },
    ],
  },
  'Vitamin K': {
    biomarkerTag: 'Vitamin K',
    queries: [
      { name: 'vitamin K clinical significance', query: '("Vitamin K"[Mesh] OR "phylloquinone" OR "menaquinone") AND ("deficiency" OR "coagulation" OR "clinical significance")' },
      { name: 'vitamin K bone cardiovascular', query: '("vitamin K" OR "menaquinone") AND ("bone health" OR "vascular calcification" OR "osteocalcin")' },
    ],
  },

  // Specialty markers
  'Omega-3 Index': {
    biomarkerTag: 'Omega-3 Index',
    queries: [
      { name: 'omega-3 index cardiovascular', query: '("omega-3 index") AND ("cardiovascular" OR "risk" OR "mortality" OR "target")' },
      { name: 'omega-3 index EPA DHA measurement', query: '("omega-3 index" OR "EPA+DHA") AND ("measurement" OR "reference range" OR "red blood cell" OR "clinical utility")' },
      { name: 'omega-3 index intervention', query: '("omega-3 index") AND ("fish oil" OR "supplementation" OR "response" OR "dose")' },
    ],
  },
  'NT-proBNP': {
    biomarkerTag: 'NT-proBNP',
    queries: [
      { name: 'NT-proBNP heart failure', query: '("NT-proBNP" OR "N-terminal pro-B-type natriuretic peptide") AND ("heart failure" OR "diagnosis" OR "prognosis")' },
      { name: 'NT-proBNP screening healthy', query: '("NT-proBNP" OR "BNP") AND ("screening" OR "asymptomatic" OR "cardiovascular risk" OR "age-related")' },
    ],
  },
  'Growth Hormone': {
    biomarkerTag: 'Growth Hormone',
    queries: [
      { name: 'growth hormone clinical significance', query: '("Growth Hormone"[Mesh] OR "GH" OR "somatotropin") AND ("deficiency" OR "acromegaly" OR "clinical significance")' },
      { name: 'growth hormone aging', query: '("growth hormone") AND ("aging" OR "body composition" OR "IGF-1" OR "adult deficiency")' },
    ],
  },
  'LH': {
    biomarkerTag: 'LH',
    queries: [
      { name: 'LH clinical significance', query: '("Luteinizing Hormone"[Mesh] OR "LH") AND ("hypogonadism" OR "fertility" OR "clinical significance")' },
      { name: 'LH reproductive endocrinology', query: '("luteinizing hormone") AND ("PCOS" OR "menopause" OR "testosterone" OR "pituitary")' },
    ],
  },

  // Additional commonly uncited markers
  'Hematocrit': {
    biomarkerTag: 'Hematocrit',
    queries: [
      { name: 'hematocrit clinical significance', query: '("Hematocrit"[Mesh] OR "hematocrit") AND ("anemia" OR "polycythemia" OR "clinical significance")' },
      { name: 'hematocrit dehydration cardiovascular', query: '"hematocrit" AND ("dehydration" OR "cardiovascular" OR "viscosity" OR "mortality")' },
    ],
  },
  'RBC': {
    biomarkerTag: 'RBC',
    queries: [
      { name: 'RBC count clinical', query: '("Erythrocyte Count"[Mesh] OR "red blood cell count" OR "RBC count") AND ("anemia" OR "polycythemia" OR "clinical significance")' },
      { name: 'RBC morphology diagnostic', query: '("erythrocyte" OR "red blood cell") AND ("morphology" OR "indices" OR "diagnostic" OR "complete blood count")' },
    ],
  },
  'Globulin': {
    biomarkerTag: 'Globulin',
    queries: [
      { name: 'globulin clinical significance', query: '("globulins" OR "serum globulin") AND ("liver" OR "immune" OR "clinical significance" OR "A/G ratio")' },
      { name: 'globulin myeloma inflammation', query: '("globulin" OR "immunoglobulins") AND ("multiple myeloma" OR "inflammation" OR "chronic infection" OR "elevated")' },
    ],
  },
  'Urea': {
    biomarkerTag: 'Urea',
    queries: [
      { name: 'urea kidney function', query: '("Urea"[Mesh] OR "blood urea") AND ("kidney function" OR "renal" OR "clinical significance" OR "nitrogen")' },
      { name: 'urea dehydration protein', query: '"urea" AND ("dehydration" OR "protein intake" OR "catabolism" OR "GFR")' },
    ],
  },
  'LDH': {
    biomarkerTag: 'LDH',
    queries: [
      { name: 'LDH clinical significance', query: '("L-Lactate Dehydrogenase"[Mesh] OR "LDH" OR "lactate dehydrogenase") AND ("tissue damage" OR "hemolysis" OR "clinical significance")' },
      { name: 'LDH prognostic marker', query: '"LDH" AND ("prognostic" OR "cancer" OR "lymphoma" OR "inflammation")' },
    ],
  },
  'Amylase': {
    biomarkerTag: 'Amylase',
    queries: [
      { name: 'amylase clinical significance', query: '("Amylases"[Mesh] OR "serum amylase") AND ("pancreatitis" OR "clinical significance" OR "diagnostic")' },
      { name: 'amylase lipase comparison', query: '("amylase" AND "lipase") AND ("pancreatitis" OR "sensitivity" OR "specificity" OR "acute abdomen")' },
    ],
  },
  'Lipase': {
    biomarkerTag: 'Lipase',
    queries: [
      { name: 'lipase pancreatitis diagnostic', query: '("Lipase"[Mesh] OR "serum lipase") AND ("pancreatitis" OR "diagnostic" OR "clinical significance")' },
      { name: 'lipase elevated causes', query: '"lipase" AND ("elevated" OR "non-pancreatic" OR "differential diagnosis" OR "macrolipasemia")' },
    ],
  },
};

// ---------------------------------------------------------------------
// PubMed API functions (same pattern as ingest-pubmed.ts)
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

async function fetchWithRetry(url: string, retries = CONFIG.MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      if (response.status === 429 || response.status >= 500) {
        console.warn(`  [retry ${attempt}/${retries}] HTTP ${response.status}, waiting...`);
        await sleep(CONFIG.RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`  [retry ${attempt}/${retries}] ${(err as Error).message}, waiting...`);
      await sleep(CONFIG.RETRY_DELAY_MS * attempt);
    }
  }
  throw new Error('Exhausted retries');
}

async function searchPubMed(query: string, maxResults: number): Promise<string[]> {
  const apiKeyParam = CONFIG.NCBI_API_KEY ? `&api_key=${CONFIG.NCBI_API_KEY}` : '';
  const url = `${CONFIG.PUBMED_BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}&sort=relevance&tool=lipa&email=${CONFIG.NCBI_EMAIL}${apiKeyParam}`;

  const response = await fetchWithRetry(url);
  const data = await response.json();
  return data.esearchresult?.idlist || [];
}

async function fetchArticles(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const apiKeyParam = CONFIG.NCBI_API_KEY ? `&api_key=${CONFIG.NCBI_API_KEY}` : '';
  const url = `${CONFIG.PUBMED_BASE_URL}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml&tool=lipa&email=${CONFIG.NCBI_EMAIL}${apiKeyParam}`;

  const response = await fetchWithRetry(url);
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
      let abstract = extractAbstract(block);
      const journal = extractFirst(block, /<Title>([^<]+)<\/Title>/) || '';
      const year = extractFirst(block, /<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/);

      // Truncate abstract to configured max
      if (abstract.length > CONFIG.ABSTRACT_MAX_CHARS) {
        abstract = abstract.slice(0, CONFIG.ABSTRACT_MAX_CHARS) + '...';
      }

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
// Embedding functions
// ---------------------------------------------------------------------

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Process in sub-batches of EMBED_BATCH_SIZE
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += CONFIG.EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + CONFIG.EMBED_BATCH_SIZE);
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
          dimensions: 1536,
        });
        allEmbeddings.push(...response.data.map(d => d.embedding));
        break;
      } catch (err) {
        if (attempt === CONFIG.MAX_RETRIES) throw err;
        console.warn(`  [embed retry ${attempt}] ${(err as Error).message}`);
        await sleep(CONFIG.RETRY_DELAY_MS * attempt);
      }
    }
    if (i + CONFIG.EMBED_BATCH_SIZE < texts.length) {
      await sleep(CONFIG.OPENAI_DELAY_MS);
    }
  }

  return allEmbeddings;
}

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
// Supabase operations
// ---------------------------------------------------------------------

async function insertStudies(
  articles: PubMedArticle[],
  embeddings: number[][],
  biomarkerTag: string
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < articles.length; i += CONFIG.INSERT_BATCH_SIZE) {
    const batchArticles = articles.slice(i, i + CONFIG.INSERT_BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + CONFIG.INSERT_BATCH_SIZE);

    const records = batchArticles.map((article, j) => ({
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
      embedding: batchEmbeddings[j],
    }));

    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        const { error } = await supabase
          .from('research_studies')
          .upsert(records, { onConflict: 'pmid', ignoreDuplicates: false });

        if (error) {
          throw new Error(`Supabase upsert error: ${error.message}`);
        }
        totalInserted += records.length;
        break;
      } catch (err) {
        if (attempt === CONFIG.MAX_RETRIES) {
          console.error(`  Failed to insert batch after ${CONFIG.MAX_RETRIES} retries:`, (err as Error).message);
        } else {
          console.warn(`  [insert retry ${attempt}] ${(err as Error).message}`);
          await sleep(CONFIG.RETRY_DELAY_MS * attempt);
        }
      }
    }
  }

  return totalInserted;
}

/**
 * Query user_analyses to find biomarker names that have 0 citations.
 * Returns deduplicated list of biomarker names.
 */
async function findUncitedMarkers(): Promise<string[]> {
  console.log('Querying user_analyses for biomarkers with citation_count = 0...\n');

  const { data, error } = await supabase
    .from('user_analyses')
    .select('biomarker_name')
    .eq('citation_count', 0);

  if (error) {
    console.error('Error querying user_analyses:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    console.log('No uncited markers found in user_analyses.');
    return [];
  }

  // Deduplicate
  const unique = Array.from(new Set(data.map(row => row.biomarker_name))).sort();
  console.log(`Found ${unique.length} unique uncited biomarker names from ${data.length} rows:\n`);
  for (const name of unique) {
    console.log(`  - ${name}`);
  }
  console.log();

  return unique;
}

/**
 * Generate fallback queries for a biomarker name that is not in the
 * hardcoded MARKER_QUERY_MAP. Creates generic but useful PubMed queries.
 */
function generateFallbackQueries(biomarkerName: string): MarkerQuerySet {
  const safeName = biomarkerName.replace(/[()]/g, '');
  return {
    biomarkerTag: biomarkerName,
    queries: [
      {
        name: `${biomarkerName} clinical significance`,
        query: `"${safeName}" AND ("clinical significance" OR "reference range" OR "interpretation")`,
      },
      {
        name: `${biomarkerName} health outcomes`,
        query: `"${safeName}" AND ("health outcomes" OR "deficiency" OR "elevated" OR "risk factor")`,
      },
      {
        name: `${biomarkerName} biomarker review`,
        query: `"${safeName}" AND ("biomarker" OR "diagnostic" OR "screening" OR "review")`,
      },
    ],
  };
}

// ---------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------

async function ingestMarker(markerName: string, querySet: MarkerQuerySet): Promise<number> {
  console.log(`\n--- ${markerName} (tag: ${querySet.biomarkerTag}) ---`);

  let totalForMarker = 0;

  for (const q of querySet.queries) {
    console.log(`  Query: ${q.name}`);

    try {
      // 1. Search PubMed
      const pmids = await searchPubMed(q.query, CONFIG.MAX_STUDIES_PER_QUERY);
      console.log(`    Found ${pmids.length} PMIDs`);

      if (pmids.length === 0) continue;

      // 2. Process in batches
      for (let i = 0; i < pmids.length; i += CONFIG.FETCH_BATCH_SIZE) {
        const batch = pmids.slice(i, i + CONFIG.FETCH_BATCH_SIZE);
        const batchNum = Math.floor(i / CONFIG.FETCH_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pmids.length / CONFIG.FETCH_BATCH_SIZE);
        console.log(`    Batch ${batchNum}/${totalBatches}...`);

        // Fetch articles
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
        const inserted = await insertStudies(filtered, embeddings, querySet.biomarkerTag);
        totalForMarker += inserted;
        console.log(`      Inserted ${inserted} (marker total: ${totalForMarker})`);
      }
    } catch (err) {
      console.error(`    Error on query "${q.name}":`, (err as Error).message);
    }
  }

  console.log(`  => ${markerName}: ${totalForMarker} studies ingested`);
  return totalForMarker;
}

async function main() {
  console.log('='.repeat(65));
  console.log('LIVING RESEARCH(TM) — UNCITED BIOMARKER GAP-FILLER');
  console.log('='.repeat(65));
  console.log('Goal: 95%+ citation coverage across all tested biomarkers\n');

  // Step 1: Find uncited markers from the database
  const uncitedFromDB = await findUncitedMarkers();

  // Step 2: Combine DB-discovered markers with the known gap list
  // (The hardcoded list ensures coverage even if user_analyses is empty)
  const knownGaps = Object.keys(MARKER_QUERY_MAP);
  const allTargets = Array.from(new Set(uncitedFromDB.concat(knownGaps))).sort();

  console.log(`\nTotal markers to ingest: ${allTargets.length}`);
  console.log(`  - From user_analyses: ${uncitedFromDB.length}`);
  console.log(`  - From hardcoded gap list: ${knownGaps.length}`);
  console.log(`  - Deduplicated total: ${allTargets.length}\n`);

  const startTime = Date.now();
  let totalIngested = 0;
  const results: { marker: string; count: number }[] = [];

  for (const marker of allTargets) {
    const querySet = MARKER_QUERY_MAP[marker] || generateFallbackQueries(marker);
    const count = await ingestMarker(marker, querySet);
    totalIngested += count;
    results.push({ marker, count });
  }

  const elapsedMinutes = Math.round((Date.now() - startTime) / 60000);

  // Summary
  console.log('\n' + '='.repeat(65));
  console.log('INGESTION COMPLETE');
  console.log('='.repeat(65));
  console.log(`Total markers processed: ${results.length}`);
  console.log(`Total studies ingested: ${totalIngested}`);
  console.log(`Elapsed time: ${elapsedMinutes} minutes`);
  console.log();

  // Show per-marker results
  const succeeded = results.filter(r => r.count > 0);
  const failed = results.filter(r => r.count === 0);

  console.log(`Markers with studies: ${succeeded.length}/${results.length}`);
  if (failed.length > 0) {
    console.log(`\nMarkers with 0 studies (may need manual queries):`);
    for (const f of failed) {
      console.log(`  - ${f.marker}`);
    }
  }

  console.log('\nPer-marker breakdown:');
  for (const r of results.sort((a, b) => b.count - a.count)) {
    console.log(`  ${r.marker.padEnd(30)} ${r.count} studies`);
  }

  console.log('\nNext: Re-run batch-test-analysis.ts to verify improved citation rates.');
}

main().catch(console.error);

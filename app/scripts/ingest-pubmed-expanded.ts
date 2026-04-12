/**
 * =====================================================================
 * LIVING RESEARCH™ ENGINE — PubMed Expanded Ingestion Pipeline
 * =====================================================================
 *
 * Fills coverage gaps for biomarkers that currently have 0 citations
 * in our corpus. Follows the exact same pattern as ingest-pubmed.ts.
 *
 * Usage:
 *   cd /Users/plipnicki/Projects/lipa-health/app
 *   npx tsx scripts/ingest-pubmed-expanded.ts
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
// Search query definitions — GAP FILLING
// ---------------------------------------------------------------------
// These queries target biomarkers that currently have 0 citations in
// the research_studies table. Each marker gets 2-3 queries for breadth.

interface QueryConfig {
  name: string;
  biomarkerTag: string;
  query: string;
  maxResults: number;
}

const QUERIES: QueryConfig[] = [
  // ===================================================================
  // HEMATOLOGY — CBC components
  // ===================================================================

  // Hematocrit
  {
    name: 'Hematocrit clinical significance',
    biomarkerTag: 'Hematocrit',
    query: '("Hematocrit"[Mesh] OR "hematocrit") AND ("health outcomes" OR "clinical significance" OR "reference range")',
    maxResults: 1500,
  },
  {
    name: 'Hematocrit cardiovascular risk',
    biomarkerTag: 'Hematocrit',
    query: '("hematocrit") AND ("cardiovascular" OR "mortality" OR "polycythemia" OR "anemia")',
    maxResults: 1500,
  },

  // MCV
  {
    name: 'MCV clinical implications',
    biomarkerTag: 'MCV',
    query: '("Erythrocyte Indices"[Mesh] OR "mean corpuscular volume" OR "MCV") AND ("clinical" OR "anemia" OR "macrocytosis" OR "microcytosis")',
    maxResults: 1500,
  },
  {
    name: 'MCV B12 folate deficiency',
    biomarkerTag: 'MCV',
    query: '("mean corpuscular volume" OR "MCV") AND ("B12" OR "folate" OR "iron deficiency" OR "thalassemia")',
    maxResults: 1000,
  },

  // MCH
  {
    name: 'MCH clinical interpretation',
    biomarkerTag: 'MCH',
    query: '("mean corpuscular hemoglobin" OR "MCH") AND ("anemia" OR "iron" OR "clinical")',
    maxResults: 1000,
  },
  {
    name: 'MCH MCHC differential diagnosis',
    biomarkerTag: 'MCH',
    query: '("MCH" OR "MCHC") AND ("erythrocyte" OR "hemoglobin concentration" OR "differential diagnosis")',
    maxResults: 800,
  },

  // MCHC
  {
    name: 'MCHC clinical significance',
    biomarkerTag: 'MCHC',
    query: '("mean corpuscular hemoglobin concentration" OR "MCHC") AND ("anemia" OR "spherocytosis" OR "clinical")',
    maxResults: 1000,
  },
  {
    name: 'MCHC red cell disorders',
    biomarkerTag: 'MCHC',
    query: '("MCHC") AND ("hyperchromia" OR "hypochromia" OR "red blood cell" OR "hemolysis")',
    maxResults: 800,
  },

  // RDW
  {
    name: 'RDW mortality prognosis',
    biomarkerTag: 'RDW',
    query: '("red cell distribution width" OR "RDW") AND ("mortality" OR "prognosis" OR "cardiovascular")',
    maxResults: 1500,
  },
  {
    name: 'RDW clinical significance',
    biomarkerTag: 'RDW',
    query: '("RDW" OR "red cell distribution width") AND ("anemia" OR "inflammation" OR "clinical significance")',
    maxResults: 1500,
  },
  {
    name: 'RDW disease outcomes',
    biomarkerTag: 'RDW',
    query: '("red cell distribution width") AND ("heart failure" OR "cancer" OR "all-cause mortality")',
    maxResults: 1000,
  },

  // Neutrophils
  {
    name: 'Neutrophil count clinical',
    biomarkerTag: 'Neutrophils',
    query: '("Neutrophils"[Mesh] OR "neutrophil count") AND ("infection" OR "inflammation" OR "neutropenia" OR "neutrophilia")',
    maxResults: 1500,
  },
  {
    name: 'NLR ratio prognosis',
    biomarkerTag: 'Neutrophils',
    query: '("neutrophil-to-lymphocyte ratio" OR "NLR") AND ("prognosis" OR "inflammation" OR "cardiovascular")',
    maxResults: 2000,
  },

  // Lymphocytes
  {
    name: 'Lymphocyte count clinical',
    biomarkerTag: 'Lymphocytes',
    query: '("Lymphocyte Count"[Mesh] OR "lymphocyte count") AND ("immune" OR "infection" OR "lymphopenia" OR "lymphocytosis")',
    maxResults: 1500,
  },
  {
    name: 'Lymphocytes cardiovascular mortality',
    biomarkerTag: 'Lymphocytes',
    query: '("lymphocyte count" OR "lymphopenia") AND ("cardiovascular" OR "mortality" OR "prognosis")',
    maxResults: 1000,
  },

  // Monocytes
  {
    name: 'Monocyte count inflammation',
    biomarkerTag: 'Monocytes',
    query: '("Monocytes"[Mesh] OR "monocyte count") AND ("inflammation" OR "atherosclerosis" OR "cardiovascular")',
    maxResults: 1500,
  },
  {
    name: 'Monocyte clinical significance',
    biomarkerTag: 'Monocytes',
    query: '("monocytosis" OR "monocyte count") AND ("clinical significance" OR "prognosis" OR "infection")',
    maxResults: 1000,
  },

  // Eosinophils
  {
    name: 'Eosinophil count clinical',
    biomarkerTag: 'Eosinophils',
    query: '("Eosinophils"[Mesh] OR "eosinophil count") AND ("allergy" OR "asthma" OR "eosinophilia" OR "parasitic")',
    maxResults: 1500,
  },
  {
    name: 'Eosinophils health outcomes',
    biomarkerTag: 'Eosinophils',
    query: '("eosinophil count" OR "eosinophilia") AND ("clinical significance" OR "outcomes" OR "cardiovascular")',
    maxResults: 1000,
  },

  // Basophils
  {
    name: 'Basophil count clinical',
    biomarkerTag: 'Basophils',
    query: '("Basophils"[Mesh] OR "basophil count") AND ("allergy" OR "inflammation" OR "myeloproliferative")',
    maxResults: 800,
  },
  {
    name: 'Basophils immune function',
    biomarkerTag: 'Basophils',
    query: '("basophil" OR "basophilia") AND ("immune" OR "IgE" OR "clinical significance")',
    maxResults: 800,
  },

  // ESR
  {
    name: 'ESR inflammation clinical',
    biomarkerTag: 'ESR',
    query: '("Blood Sedimentation"[Mesh] OR "erythrocyte sedimentation rate" OR "ESR") AND ("inflammation" OR "clinical" OR "autoimmune")',
    maxResults: 2000,
  },
  {
    name: 'ESR vs CRP comparison',
    biomarkerTag: 'ESR',
    query: '("erythrocyte sedimentation rate" OR "ESR") AND ("C-reactive protein" OR "CRP") AND ("comparison" OR "diagnostic")',
    maxResults: 1000,
  },
  {
    name: 'ESR age gender interpretation',
    biomarkerTag: 'ESR',
    query: '("ESR" OR "sedimentation rate") AND ("reference range" OR "age" OR "gender" OR "interpretation")',
    maxResults: 800,
  },

  // ===================================================================
  // METABOLIC — C-Peptide
  // ===================================================================

  {
    name: 'C-Peptide insulin secretion',
    biomarkerTag: 'C-Peptide',
    query: '("C-Peptide"[Mesh] OR "C-peptide") AND ("insulin secretion" OR "beta cell" OR "diabetes")',
    maxResults: 1500,
  },
  {
    name: 'C-Peptide clinical utility',
    biomarkerTag: 'C-Peptide',
    query: '("C-peptide") AND ("clinical utility" OR "insulin resistance" OR "type 1" OR "type 2")',
    maxResults: 1500,
  },
  {
    name: 'C-Peptide cardiovascular risk',
    biomarkerTag: 'C-Peptide',
    query: '("C-peptide") AND ("cardiovascular" OR "mortality" OR "metabolic syndrome")',
    maxResults: 1000,
  },

  // ===================================================================
  // ELECTROLYTES
  // ===================================================================

  // Sodium
  {
    name: 'Sodium clinical significance',
    biomarkerTag: 'Sodium',
    query: '("Sodium"[Mesh] OR "serum sodium") AND ("hyponatremia" OR "hypernatremia" OR "electrolyte")',
    maxResults: 2000,
  },
  {
    name: 'Sodium mortality outcomes',
    biomarkerTag: 'Sodium',
    query: '("hyponatremia" OR "serum sodium") AND ("mortality" OR "hospitalization" OR "outcomes")',
    maxResults: 1500,
  },

  // Potassium
  {
    name: 'Potassium clinical significance',
    biomarkerTag: 'Potassium',
    query: '("Potassium"[Mesh] OR "serum potassium") AND ("hypokalemia" OR "hyperkalemia" OR "electrolyte")',
    maxResults: 2000,
  },
  {
    name: 'Potassium cardiovascular arrhythmia',
    biomarkerTag: 'Potassium',
    query: '("potassium") AND ("cardiac" OR "arrhythmia" OR "heart failure" OR "mortality")',
    maxResults: 1500,
  },

  // Chloride
  {
    name: 'Chloride clinical significance',
    biomarkerTag: 'Chloride',
    query: '("Chlorides"[Mesh] OR "serum chloride") AND ("metabolic acidosis" OR "alkalosis" OR "electrolyte")',
    maxResults: 1000,
  },
  {
    name: 'Chloride heart failure outcomes',
    biomarkerTag: 'Chloride',
    query: '("chloride" OR "hypochloremia") AND ("heart failure" OR "prognosis" OR "mortality")',
    maxResults: 1000,
  },

  // Calcium
  {
    name: 'Calcium serum clinical',
    biomarkerTag: 'Calcium',
    query: '("Calcium"[Mesh] OR "serum calcium") AND ("hypercalcemia" OR "hypocalcemia" OR "parathyroid")',
    maxResults: 2000,
  },
  {
    name: 'Calcium cardiovascular bone',
    biomarkerTag: 'Calcium',
    query: '("serum calcium") AND ("cardiovascular" OR "osteoporosis" OR "bone mineral density")',
    maxResults: 1500,
  },

  // Phosphorus
  {
    name: 'Phosphorus clinical significance',
    biomarkerTag: 'Phosphorus',
    query: '("Phosphorus"[Mesh] OR "serum phosphorus" OR "phosphate") AND ("kidney" OR "bone" OR "cardiovascular")',
    maxResults: 1500,
  },
  {
    name: 'Phosphorus mortality CKD',
    biomarkerTag: 'Phosphorus',
    query: '("hyperphosphatemia" OR "serum phosphorus") AND ("mortality" OR "chronic kidney disease" OR "vascular calcification")',
    maxResults: 1000,
  },

  // ===================================================================
  // LIPIDS — Total Cholesterol & Non-HDL
  // ===================================================================

  {
    name: 'Total cholesterol clinical',
    biomarkerTag: 'Total Cholesterol',
    query: '("Cholesterol"[Mesh] OR "total cholesterol") AND ("cardiovascular risk" OR "mortality" OR "clinical significance")',
    maxResults: 2000,
  },
  {
    name: 'Total cholesterol optimal range',
    biomarkerTag: 'Total Cholesterol',
    query: '("total cholesterol") AND ("optimal" OR "target" OR "guidelines" OR "statin")',
    maxResults: 1500,
  },

  {
    name: 'Non-HDL cholesterol risk',
    biomarkerTag: 'Non-HDL Cholesterol',
    query: '("non-HDL cholesterol" OR "non-high-density lipoprotein") AND ("cardiovascular" OR "risk" OR "atherosclerosis")',
    maxResults: 1500,
  },
  {
    name: 'Non-HDL cholesterol vs LDL',
    biomarkerTag: 'Non-HDL Cholesterol',
    query: '("non-HDL cholesterol") AND ("LDL" OR "ApoB" OR "residual risk" OR "prediction")',
    maxResults: 1000,
  },

  // ===================================================================
  // LIVER FUNCTION
  // ===================================================================

  // ALT
  {
    name: 'ALT liver enzyme clinical',
    biomarkerTag: 'ALT',
    query: '("Alanine Transaminase"[Mesh] OR "ALT" OR "SGPT") AND ("liver disease" OR "NAFLD" OR "hepatotoxicity")',
    maxResults: 2000,
  },
  {
    name: 'ALT normal range redefinition',
    biomarkerTag: 'ALT',
    query: '("ALT" OR "alanine aminotransferase") AND ("normal range" OR "upper limit" OR "healthy" OR "metabolic")',
    maxResults: 1000,
  },

  // AST
  {
    name: 'AST liver enzyme clinical',
    biomarkerTag: 'AST',
    query: '("Aspartate Aminotransferases"[Mesh] OR "AST" OR "SGOT") AND ("liver" OR "hepatic" OR "muscle")',
    maxResults: 1500,
  },
  {
    name: 'AST ALT ratio clinical use',
    biomarkerTag: 'AST',
    query: '("AST/ALT ratio" OR "De Ritis ratio") AND ("liver fibrosis" OR "alcoholic" OR "prognosis")',
    maxResults: 1000,
  },

  // Total Bilirubin
  {
    name: 'Bilirubin clinical significance',
    biomarkerTag: 'Total Bilirubin',
    query: '("Bilirubin"[Mesh] OR "total bilirubin") AND ("liver" OR "Gilbert" OR "hemolysis" OR "jaundice")',
    maxResults: 1500,
  },
  {
    name: 'Bilirubin antioxidant cardiovascular',
    biomarkerTag: 'Total Bilirubin',
    query: '("bilirubin") AND ("antioxidant" OR "cardiovascular protective" OR "mortality")',
    maxResults: 1000,
  },

  // Albumin
  {
    name: 'Albumin clinical significance',
    biomarkerTag: 'Albumin',
    query: '("Serum Albumin"[Mesh] OR "serum albumin") AND ("malnutrition" OR "inflammation" OR "liver function")',
    maxResults: 1500,
  },
  {
    name: 'Albumin mortality prognosis',
    biomarkerTag: 'Albumin',
    query: '("hypoalbuminemia" OR "serum albumin") AND ("mortality" OR "prognosis" OR "hospitalization")',
    maxResults: 1500,
  },

  // Total Protein
  {
    name: 'Total protein clinical',
    biomarkerTag: 'Total Protein',
    query: '("serum total protein" OR "total protein") AND ("clinical significance" OR "malnutrition" OR "liver" OR "myeloma")',
    maxResults: 1000,
  },
  {
    name: 'Total protein interpretation',
    biomarkerTag: 'Total Protein',
    query: '("total protein" OR "hyperproteinemia" OR "hypoproteinemia") AND ("diagnosis" OR "differential" OR "electrophoresis")',
    maxResults: 800,
  },

  // Alkaline Phosphatase
  {
    name: 'Alkaline phosphatase clinical',
    biomarkerTag: 'Alkaline Phosphatase',
    query: '("Alkaline Phosphatase"[Mesh] OR "alkaline phosphatase") AND ("liver" OR "bone" OR "cholestasis")',
    maxResults: 1500,
  },
  {
    name: 'ALP elevated clinical significance',
    biomarkerTag: 'Alkaline Phosphatase',
    query: '("alkaline phosphatase" OR "ALP") AND ("elevated" OR "clinical significance" OR "cardiovascular" OR "mortality")',
    maxResults: 1000,
  },

  // ===================================================================
  // KIDNEY FUNCTION
  // ===================================================================

  // BUN
  {
    name: 'BUN clinical significance',
    biomarkerTag: 'BUN',
    query: '("Blood Urea Nitrogen"[Mesh] OR "BUN" OR "blood urea nitrogen") AND ("kidney" OR "renal" OR "dehydration")',
    maxResults: 1500,
  },
  {
    name: 'BUN creatinine ratio clinical',
    biomarkerTag: 'BUN',
    query: '("BUN/creatinine ratio" OR "blood urea nitrogen") AND ("prerenal" OR "GI bleeding" OR "heart failure")',
    maxResults: 1000,
  },

  // eGFR
  {
    name: 'eGFR kidney staging',
    biomarkerTag: 'eGFR',
    query: '("Glomerular Filtration Rate"[Mesh] OR "eGFR" OR "estimated glomerular filtration rate") AND ("chronic kidney disease" OR "CKD staging")',
    maxResults: 2000,
  },
  {
    name: 'eGFR equations clinical',
    biomarkerTag: 'eGFR',
    query: '("eGFR" OR "CKD-EPI" OR "MDRD") AND ("accuracy" OR "race-free" OR "cystatin" OR "clinical use")',
    maxResults: 1500,
  },
  {
    name: 'eGFR cardiovascular outcomes',
    biomarkerTag: 'eGFR',
    query: '("eGFR" OR "glomerular filtration rate") AND ("cardiovascular" OR "mortality" OR "outcomes")',
    maxResults: 1500,
  },

  // ===================================================================
  // HORMONES
  // ===================================================================

  // LH
  {
    name: 'LH reproductive clinical',
    biomarkerTag: 'LH',
    query: '("Luteinizing Hormone"[Mesh] OR "LH") AND ("ovulation" OR "hypogonadism" OR "PCOS" OR "fertility")',
    maxResults: 1500,
  },
  {
    name: 'LH testosterone regulation',
    biomarkerTag: 'LH',
    query: '("luteinizing hormone" OR "LH") AND ("testosterone" OR "Leydig" OR "pituitary" OR "gonadotropin")',
    maxResults: 1000,
  },

  // Growth Hormone / IGF
  {
    name: 'Growth hormone clinical',
    biomarkerTag: 'Growth Hormone',
    query: '("Human Growth Hormone"[Mesh] OR "growth hormone" OR "HGH" OR "somatotropin") AND ("deficiency" OR "replacement" OR "aging")',
    maxResults: 2000,
  },
  {
    name: 'IGF-1 growth hormone axis',
    biomarkerTag: 'Growth Hormone',
    query: '("IGF-1" OR "insulin-like growth factor") AND ("growth hormone" OR "GH axis" OR "acromegaly" OR "deficiency")',
    maxResults: 1500,
  },
  {
    name: 'Growth hormone longevity',
    biomarkerTag: 'Growth Hormone',
    query: '("growth hormone" OR "IGF-1") AND ("longevity" OR "mortality" OR "aging" OR "sarcopenia")',
    maxResults: 1000,
  },

  // ===================================================================
  // COAGULATION
  // ===================================================================

  // Fibrinogen
  {
    name: 'Fibrinogen cardiovascular',
    biomarkerTag: 'Fibrinogen',
    query: '("Fibrinogen"[Mesh] OR "fibrinogen") AND ("cardiovascular" OR "thrombosis" OR "stroke")',
    maxResults: 2000,
  },
  {
    name: 'Fibrinogen inflammation marker',
    biomarkerTag: 'Fibrinogen',
    query: '("fibrinogen") AND ("inflammation" OR "acute phase" OR "coagulation" OR "risk factor")',
    maxResults: 1500,
  },

  // ===================================================================
  // IRON METABOLISM
  // ===================================================================

  // Transferrin Saturation
  {
    name: 'Transferrin saturation iron status',
    biomarkerTag: 'Transferrin Saturation',
    query: '("Transferrin"[Mesh] OR "transferrin saturation" OR "TSAT") AND ("iron deficiency" OR "iron overload" OR "hemochromatosis")',
    maxResults: 1500,
  },
  {
    name: 'TSAT clinical interpretation',
    biomarkerTag: 'Transferrin Saturation',
    query: '("transferrin saturation") AND ("anemia" OR "clinical" OR "CKD" OR "heart failure")',
    maxResults: 1000,
  },

  // ===================================================================
  // VITAMINS & MICRONUTRIENTS
  // ===================================================================

  // Vitamin A
  {
    name: 'Vitamin A retinol clinical',
    biomarkerTag: 'Vitamin A',
    query: '("Vitamin A"[Mesh] OR "retinol") AND ("deficiency" OR "toxicity" OR "immune" OR "vision")',
    maxResults: 1500,
  },
  {
    name: 'Vitamin A supplementation outcomes',
    biomarkerTag: 'Vitamin A',
    query: '("vitamin A" OR "retinol") AND ("supplementation" OR "clinical trial" OR "outcomes")',
    maxResults: 1000,
  },

  // Vitamin E
  {
    name: 'Vitamin E tocopherol clinical',
    biomarkerTag: 'Vitamin E',
    query: '("Vitamin E"[Mesh] OR "alpha-tocopherol" OR "tocopherol") AND ("antioxidant" OR "deficiency" OR "supplementation")',
    maxResults: 1500,
  },
  {
    name: 'Vitamin E cardiovascular outcomes',
    biomarkerTag: 'Vitamin E',
    query: '("vitamin E" OR "tocopherol") AND ("cardiovascular" OR "mortality" OR "cancer" OR "clinical trial")',
    maxResults: 1000,
  },

  // Vitamin K
  {
    name: 'Vitamin K clinical significance',
    biomarkerTag: 'Vitamin K',
    query: '("Vitamin K"[Mesh] OR "vitamin K" OR "menaquinone" OR "phylloquinone") AND ("coagulation" OR "bone" OR "vascular calcification")',
    maxResults: 1500,
  },
  {
    name: 'Vitamin K2 supplementation',
    biomarkerTag: 'Vitamin K',
    query: '("vitamin K2" OR "menaquinone" OR "MK-7") AND ("supplementation" OR "cardiovascular" OR "osteoporosis")',
    maxResults: 1000,
  },
  {
    name: 'Vitamin K warfarin status',
    biomarkerTag: 'Vitamin K',
    query: '("vitamin K") AND ("deficiency" OR "warfarin" OR "INR" OR "status")',
    maxResults: 800,
  },

  // Copper / Ceruloplasmin
  {
    name: 'Copper clinical significance',
    biomarkerTag: 'Copper',
    query: '("Copper"[Mesh] OR "serum copper") AND ("deficiency" OR "Wilson disease" OR "ceruloplasmin")',
    maxResults: 1500,
  },
  {
    name: 'Copper zinc ratio health',
    biomarkerTag: 'Copper',
    query: '("copper" OR "ceruloplasmin") AND ("zinc" OR "inflammation" OR "oxidative stress" OR "Alzheimer")',
    maxResults: 1000,
  },

  // Omega-3 Index (specific)
  {
    name: 'Omega-3 index cardiovascular',
    biomarkerTag: 'Omega-3 Index',
    query: '("omega-3 index") AND ("cardiovascular" OR "mortality" OR "sudden cardiac death")',
    maxResults: 1000,
  },
  {
    name: 'EPA DHA ratio supplementation',
    biomarkerTag: 'Omega-3 Index',
    query: '("EPA" AND "DHA") AND ("ratio" OR "supplementation" OR "blood levels" OR "red blood cell")',
    maxResults: 1500,
  },
  {
    name: 'Omega-3 index optimal levels',
    biomarkerTag: 'Omega-3 Index',
    query: '("omega-3 index" OR "omega-3 fatty acid") AND ("optimal" OR "target" OR "8 percent" OR "risk reduction")',
    maxResults: 800,
  },

  // ===================================================================
  // CARDIAC BIOMARKER
  // ===================================================================

  // NT-proBNP
  {
    name: 'NT-proBNP heart failure',
    biomarkerTag: 'NT-proBNP',
    query: '("Natriuretic Peptide, Brain"[Mesh] OR "NT-proBNP" OR "N-terminal pro-brain natriuretic peptide") AND ("heart failure" OR "diagnosis" OR "prognosis")',
    maxResults: 2000,
  },
  {
    name: 'NT-proBNP screening asymptomatic',
    biomarkerTag: 'NT-proBNP',
    query: '("NT-proBNP" OR "BNP") AND ("screening" OR "asymptomatic" OR "risk stratification" OR "cardiovascular")',
    maxResults: 1500,
  },
  {
    name: 'NT-proBNP age cutoffs',
    biomarkerTag: 'NT-proBNP',
    query: '("NT-proBNP") AND ("age" OR "cutoff" OR "reference range" OR "interpretation")',
    maxResults: 1000,
  },

  // ===================================================================
  // BROADER PANEL QUERIES — cross-cutting
  // ===================================================================

  {
    name: 'CBC clinical interpretation',
    biomarkerTag: 'CBC',
    query: '"complete blood count" AND ("clinical interpretation" OR "differential diagnosis" OR "systematic approach")',
    maxResults: 1500,
  },
  {
    name: 'Basic metabolic panel clinical',
    biomarkerTag: 'BMP',
    query: '("basic metabolic panel" OR "comprehensive metabolic panel") AND ("clinical significance" OR "interpretation" OR "electrolyte")',
    maxResults: 1000,
  },
  {
    name: 'Liver function tests interpretation',
    biomarkerTag: 'Liver Panel',
    query: '("liver function tests" OR "hepatic panel") AND ("clinical interpretation" OR "elevated" OR "pattern recognition")',
    maxResults: 1500,
  },
  {
    name: 'Electrolyte imbalance outcomes',
    biomarkerTag: 'Electrolytes',
    query: '("electrolyte imbalance" OR "electrolyte disturbance") AND ("health outcomes" OR "mortality" OR "hospitalization")',
    maxResults: 1000,
  },
  {
    name: 'Cardiac biomarkers clinical use',
    biomarkerTag: 'Cardiac Biomarkers',
    query: '("cardiac biomarkers" OR "troponin" OR "BNP") AND ("clinical use" OR "screening" OR "risk stratification")',
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
  console.log('LIVING RESEARCH™ EXPANDED INGESTION — GAP FILLING');
  console.log('='.repeat(60));
  console.log(`Total queries: ${QUERIES.length}`);
  console.log(`Target studies: ${QUERIES.reduce((sum, q) => sum + q.maxResults, 0)}`);
  console.log(`Expected time: ~${Math.ceil(QUERIES.reduce((sum, q) => sum + q.maxResults, 0) / 5000)} hours`);
  console.log();
  console.log('Markers covered in this run:');
  const uniqueTags = [...new Set(QUERIES.map(q => q.biomarkerTag))];
  uniqueTags.forEach(tag => console.log(`  - ${tag}`));
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
  console.log('EXPANDED INGESTION COMPLETE');
  console.log('='.repeat(60));
  console.log(`Total studies ingested: ${totalIngested}`);
  console.log(`Elapsed time: ${elapsedMinutes} minutes`);
  console.log();
  console.log('Next step: Check Supabase dashboard to verify research_studies table.');
  console.log('Then re-run the citation gap analysis to confirm coverage.');
}

main().catch(console.error);

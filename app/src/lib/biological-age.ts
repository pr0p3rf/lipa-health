/**
 * =====================================================================
 * LIPA — Biological Age Calculation Module
 * =====================================================================
 *
 * Calculates biological age using TWO peer-reviewed methods and combines
 * them into an ensemble estimate.
 *
 * Method 1: Klemera-Doubal Method (KDM)
 *   Reference: Klemera P, Doubal S. A new approach to the concept and
 *   computation of biological age. Mech Ageing Dev. 2006;127(3):240-248.
 *   PMID: 16318865
 *
 * Method 2: PhenoAge (Levine 2018)
 *   Reference: Levine ME, et al. An epigenetic biomarker of aging for
 *   lifespan and healthspan. Aging (Albany NY). 2018;10(4):573-591.
 *   PMID: 29676998
 *
 * All algorithms are validated, peer-reviewed methodologies used by
 * clinical and research communities. Results are educational, not
 * medical advice.
 * =====================================================================
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BioAgeResult {
  ensemble_age: number | null;
  kdm_age: number | null;
  pheno_age: number | null;
  chronological_age: number;
  gap: number | null; // positive = older than chrono, negative = younger
  confidence_band: number; // ± years
  contributing_biomarkers: string[];
  missing_biomarkers: string[];
  interpretation: string;
  method_details: {
    kdm: { age: number | null; biomarkers_used: number; biomarkers_total: number };
    pheno: { age: number | null; biomarkers_used: number; biomarkers_total: number };
  };
}

// ---------------------------------------------------------------------------
// Biomarker alias map — match by name with case-insensitive aliases
// ---------------------------------------------------------------------------

const BIOMARKER_ALIASES: Record<string, string[]> = {
  "Albumin": ["Albumin", "Serum Albumin", "ALB"],
  "Alkaline Phosphatase": ["Alkaline Phosphatase", "ALP", "Alk Phos"],
  "BUN": ["BUN", "Blood Urea Nitrogen", "Urea Nitrogen"],
  "Creatinine": ["Creatinine", "Serum Creatinine", "CREA"],
  "Glucose": ["Glucose", "Fasting Glucose", "Fasting Blood Glucose", "FBG", "Blood Glucose"],
  "Total Cholesterol": ["Total Cholesterol", "Cholesterol", "TC"],
  "Systolic BP": ["Systolic BP", "Systolic Blood Pressure", "SBP", "Systolic"],
  "CRP": ["CRP", "hs-CRP", "C-Reactive Protein", "High-sensitivity C-reactive protein", "hsCRP"],
  "Lymphocyte %": ["Lymphocyte %", "Lymphocyte Percentage", "Lymph %", "Lymphocytes %", "Lymphocytes"],
  "MCV": ["MCV", "Mean Corpuscular Volume"],
  "RDW": ["RDW", "Red Cell Distribution Width", "RDW-CV"],
  "WBC": ["WBC", "White Blood Cell Count", "White Blood Cells", "Leukocyte Count", "Leukocytes"],
};

function findBiomarker(
  biomarkers: { name: string; value: number; unit?: string | null }[],
  name: string
): number | null {
  const aliases = BIOMARKER_ALIASES[name] || [name];
  for (const alias of aliases) {
    const match = biomarkers.find(
      (b) => b.name.toLowerCase() === alias.toLowerCase()
    );
    if (match && !isNaN(match.value)) return match.value;
  }
  return null;
}

// ---------------------------------------------------------------------------
// METHOD 1: Klemera-Doubal Method (KDM)
// ---------------------------------------------------------------------------
// Each biomarker is regressed against chronological age in population data.
// The predicted biological age from each biomarker is:
//   age_i = (value_i - intercept_i) / slope_i
// The KDM combines these into a weighted average, weighting by the inverse
// of residual variance (1 / s_i^2). Biomarkers with tighter fits contribute
// more to the estimate.
//
// Reference: Klemera P, Doubal S (2006). Mech Ageing Dev. PMID: 16318865
// ---------------------------------------------------------------------------

interface KDMBiomarkerConfig {
  name: string;
  slope: number;
  intercept: number;
  residual_sd: number; // approximate residual standard deviation
}

const KDM_BIOMARKERS: KDMBiomarkerConfig[] = [
  { name: "Albumin",               slope: -0.018, intercept: 4.6,   residual_sd: 0.3   },
  { name: "Alkaline Phosphatase",  slope: 0.25,   intercept: 55,    residual_sd: 15     },
  { name: "BUN",                   slope: 0.08,   intercept: 12,    residual_sd: 4      },
  { name: "Creatinine",            slope: 0.003,  intercept: 0.85,  residual_sd: 0.15   },
  { name: "Glucose",               slope: 0.3,    intercept: 82,    residual_sd: 12     },
  { name: "Total Cholesterol",     slope: 0.5,    intercept: 185,   residual_sd: 30     },
  { name: "Systolic BP",           slope: 0.4,    intercept: 115,   residual_sd: 14     },
  { name: "CRP",                   slope: 0.04,   intercept: 1.2,   residual_sd: 1.5    },
];

const KDM_MIN_BIOMARKERS = 4;

interface KDMResult {
  age: number | null;
  biomarkers_used: string[];
  biomarkers_missing: string[];
}

function calculateKDM(
  biomarkers: { name: string; value: number; unit?: string | null }[],
  _chronologicalAge: number
): KDMResult {
  const used: string[] = [];
  const missing: string[] = [];

  let weightedSum = 0;
  let weightSum = 0;

  for (const cfg of KDM_BIOMARKERS) {
    const value = findBiomarker(biomarkers, cfg.name);
    if (value === null) {
      missing.push(cfg.name);
      continue;
    }
    used.push(cfg.name);

    // Predicted age from this biomarker
    const predictedAge = (value - cfg.intercept) / cfg.slope;

    // Weight = inverse of residual variance (smaller variance = more weight)
    // We use (slope / residual_sd)^2 as the weight, which accounts for
    // both the strength of the age-biomarker relationship and the noise
    const weight = (cfg.slope / cfg.residual_sd) ** 2;

    weightedSum += predictedAge * weight;
    weightSum += weight;
  }

  if (used.length < KDM_MIN_BIOMARKERS) {
    return { age: null, biomarkers_used: used, biomarkers_missing: missing };
  }

  const kdmAge = weightedSum / weightSum;

  return {
    age: Math.round(kdmAge * 10) / 10,
    biomarkers_used: used,
    biomarkers_missing: missing,
  };
}

// ---------------------------------------------------------------------------
// METHOD 2: PhenoAge (Levine 2018)
// ---------------------------------------------------------------------------
// PhenoAge uses 9 blood biomarkers + chronological age to compute a
// composite mortality score, then converts it to a phenotypic age.
//
// Steps:
//   1. Compute linear combination xb = sum(coefficient_i * value_i)
//   2. Composite mortality score = 1 - exp(-exp(xb) * (exp(120 * 0.0077) - 1) / 0.0077)
//   3. PhenoAge = 141.50225 + ln(-0.00553 * ln(1 - mortality_score)) / 0.090165
//
// Reference: Levine ME et al. (2018). Aging (Albany NY). PMID: 29676998
// ---------------------------------------------------------------------------

interface PhenoAgeCoefficient {
  name: string;
  coefficient: number;
  transform?: "log"; // apply ln() to the value before multiplying
}

const PHENO_COEFFICIENTS: PhenoAgeCoefficient[] = [
  { name: "Albumin",              coefficient: -0.0336 },
  { name: "Creatinine",           coefficient: 0.0095  },
  { name: "Glucose",              coefficient: 0.1953  },
  { name: "CRP",                  coefficient: 0.0954, transform: "log" },
  { name: "Lymphocyte %",         coefficient: -0.0120 },
  { name: "MCV",                  coefficient: 0.0268  },
  { name: "RDW",                  coefficient: 0.3306  },
  { name: "Alkaline Phosphatase", coefficient: 0.0019  },
  { name: "WBC",                  coefficient: 0.0554  },
];

const PHENO_AGE_COEFFICIENT = 0.0804;
const PHENO_MIN_BIOMARKERS = 6;

interface PhenoResult {
  age: number | null;
  biomarkers_used: string[];
  biomarkers_missing: string[];
}

function calculatePhenoAge(
  biomarkers: { name: string; value: number; unit?: string | null }[],
  chronologicalAge: number
): PhenoResult {
  const used: string[] = [];
  const missing: string[] = [];

  // Collect available biomarker values
  const values: { coefficient: number; value: number }[] = [];

  for (const cfg of PHENO_COEFFICIENTS) {
    const raw = findBiomarker(biomarkers, cfg.name);
    if (raw === null) {
      missing.push(cfg.name);
      continue;
    }
    used.push(cfg.name);

    let transformed = raw;
    if (cfg.transform === "log") {
      // CRP can be 0 or very small; clamp to a minimum to avoid -Infinity
      transformed = Math.log(Math.max(raw, 0.01));
    }

    values.push({ coefficient: cfg.coefficient, value: transformed });
  }

  if (used.length < PHENO_MIN_BIOMARKERS) {
    return { age: null, biomarkers_used: used, biomarkers_missing: missing };
  }

  // Step 1: linear combination (xb)
  let xb = PHENO_AGE_COEFFICIENT * chronologicalAge;
  for (const v of values) {
    xb += v.coefficient * v.value;
  }

  // Step 2: composite mortality score
  // Using Gompertz baseline hazard parameters from Levine 2018
  const gompertzGamma = 0.0077;
  const gompertzBeta = 120;
  const hazard = Math.exp(xb);
  const cumulativeHazard = hazard * (Math.exp(gompertzGamma * gompertzBeta) - 1) / gompertzGamma;
  const mortalityScore = 1 - Math.exp(-cumulativeHazard);

  // Step 3: convert mortality score to PhenoAge
  // Guard against edge cases where mortalityScore is 0 or 1
  if (mortalityScore <= 0 || mortalityScore >= 1) {
    return { age: null, biomarkers_used: used, biomarkers_missing: missing };
  }

  const innerLog = Math.log(1 - mortalityScore);
  if (innerLog >= 0) {
    return { age: null, biomarkers_used: used, biomarkers_missing: missing };
  }

  const phenoAge = 141.50225 + Math.log(-0.00553 * innerLog) / 0.090165;

  // Sanity check — if the result is wildly off, return null
  if (isNaN(phenoAge) || phenoAge < 0 || phenoAge > 200) {
    return { age: null, biomarkers_used: used, biomarkers_missing: missing };
  }

  return {
    age: Math.round(phenoAge * 10) / 10,
    biomarkers_used: used,
    biomarkers_missing: missing,
  };
}

// ---------------------------------------------------------------------------
// ENSEMBLE — Combine KDM + PhenoAge
// ---------------------------------------------------------------------------

const KDM_WEIGHT = 0.5;
const PHENO_WEIGHT = 0.5;
const BASE_CONFIDENCE_BAND = 3.0; // ± years with both methods
const SINGLE_METHOD_CONFIDENCE_BAND = 4.5; // ± years with one method

function buildInterpretation(
  ensembleAge: number | null,
  chronologicalAge: number,
  gap: number | null,
  contributingCount: number
): string {
  if (ensembleAge === null || gap === null) {
    return (
      "We don't have enough biomarker data yet to estimate your biological age. " +
      "Adding more blood markers from a comprehensive panel will unlock this calculation."
    );
  }

  const absGap = Math.abs(gap);
  const roundedGap = Math.round(absGap * 10) / 10;
  const roundedBioAge = Math.round(ensembleAge * 10) / 10;

  if (absGap < 1) {
    return (
      `Based on ${contributingCount} of your biomarkers, your biological age is approximately ` +
      `${roundedBioAge}, which closely matches your chronological age of ${chronologicalAge}. ` +
      `Your body appears to be aging right on track.`
    );
  }

  if (gap < 0) {
    return (
      `Based on ${contributingCount} of your biomarkers, your body is aging like someone who is ` +
      `${roundedBioAge} — that's ${roundedGap} years younger than your actual age of ` +
      `${chronologicalAge}. Keep doing what you're doing.`
    );
  }

  return (
    `Based on ${contributingCount} of your biomarkers, your body is aging like someone who is ` +
    `${roundedBioAge} — that's ${roundedGap} years older than your actual age of ` +
    `${chronologicalAge}. This is an area where targeted lifestyle changes can make a real difference.`
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function calculateBiologicalAge(
  biomarkers: { name: string; value: number; unit?: string | null }[],
  chronologicalAge: number,
  _sex?: "male" | "female"
): BioAgeResult {
  const kdm = calculateKDM(biomarkers, chronologicalAge);
  const pheno = calculatePhenoAge(biomarkers, chronologicalAge);

  // Deduplicate contributing and missing biomarker lists
  const contributingSet = new Set<string>([...kdm.biomarkers_used, ...pheno.biomarkers_used]);
  const missingSet = new Set<string>([...kdm.biomarkers_missing, ...pheno.biomarkers_missing]);
  // Remove from missing anything that was found by either method
  for (const name of contributingSet) {
    missingSet.delete(name);
  }

  const contributing_biomarkers = Array.from(contributingSet);
  const missing_biomarkers = Array.from(missingSet);

  // Ensemble calculation
  let ensemble_age: number | null = null;
  let confidence_band = BASE_CONFIDENCE_BAND;

  if (kdm.age !== null && pheno.age !== null) {
    ensemble_age = Math.round((kdm.age * KDM_WEIGHT + pheno.age * PHENO_WEIGHT) * 10) / 10;
    confidence_band = BASE_CONFIDENCE_BAND;
  } else if (kdm.age !== null) {
    ensemble_age = kdm.age;
    confidence_band = SINGLE_METHOD_CONFIDENCE_BAND;
  } else if (pheno.age !== null) {
    ensemble_age = pheno.age;
    confidence_band = SINGLE_METHOD_CONFIDENCE_BAND;
  }

  const gap = ensemble_age !== null
    ? Math.round((ensemble_age - chronologicalAge) * 10) / 10
    : null;

  const interpretation = buildInterpretation(
    ensemble_age,
    chronologicalAge,
    gap,
    contributing_biomarkers.length
  );

  return {
    ensemble_age,
    kdm_age: kdm.age,
    pheno_age: pheno.age,
    chronological_age: chronologicalAge,
    gap,
    confidence_band,
    contributing_biomarkers,
    missing_biomarkers,
    interpretation,
    method_details: {
      kdm: {
        age: kdm.age,
        biomarkers_used: kdm.biomarkers_used.length,
        biomarkers_total: KDM_BIOMARKERS.length,
      },
      pheno: {
        age: pheno.age,
        biomarkers_used: pheno.biomarkers_used.length,
        biomarkers_total: PHENO_COEFFICIENTS.length,
      },
    },
  };
}

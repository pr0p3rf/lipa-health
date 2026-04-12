/**
 * =====================================================================
 * LIPA — Demographic-Adjusted Optimal Ranges
 * =====================================================================
 *
 * Personalized optimal zones by age group and sex, derived from:
 * - NHANES population data (CDC, 300K+ participants)
 * - Published clinical literature and guideline recommendations
 * - Endocrine Society, ESC, ADA, and other major body guidelines
 *
 * This gives Lipa the same per-user personalization that InsideTracker
 * charges $489 for — using public, representative, freely available data.
 *
 * Usage:
 *   const range = getDemographicOptimalRange("Vitamin D", 42, "female");
 *   // Returns { optimal_low: 40, optimal_high: 60, source: "Endocrine Society 2011 + NHANES", note: "..." }
 * =====================================================================
 */

export interface DemographicRange {
  optimal_low: number;
  optimal_high: number;
  unit: string;
  source: string;
  note: string;
}

interface AgeRange {
  min_age: number;
  max_age: number;
  male: { optimal_low: number; optimal_high: number };
  female: { optimal_low: number; optimal_high: number };
  note?: string;
}

interface MarkerDemographicConfig {
  unit: string;
  source: string;
  default_optimal_low: number;
  default_optimal_high: number;
  age_sex_ranges: AgeRange[];
}

// ---------------------------------------------------------------------
// Demographic range data
// Based on published NHANES distributions, clinical guidelines,
// and peer-reviewed optimal-range literature.
// ---------------------------------------------------------------------

const DEMOGRAPHIC_RANGES: Record<string, MarkerDemographicConfig> = {

  // ===== VITAMINS / NUTRIENTS =====

  "Vitamin D": {
    unit: "ng/mL",
    source: "Endocrine Society 2011 (PMID: 21646368) + NHANES 2001-2018",
    default_optimal_low: 40,
    default_optimal_high: 60,
    age_sex_ranges: [
      { min_age: 18, max_age: 30, male: { optimal_low: 40, optimal_high: 60 }, female: { optimal_low: 40, optimal_high: 60 } },
      { min_age: 31, max_age: 50, male: { optimal_low: 40, optimal_high: 60 }, female: { optimal_low: 40, optimal_high: 60 } },
      { min_age: 51, max_age: 70, male: { optimal_low: 40, optimal_high: 60 }, female: { optimal_low: 45, optimal_high: 65 }, note: "Higher targets in postmenopausal women for bone health" },
      { min_age: 71, max_age: 120, male: { optimal_low: 45, optimal_high: 65 }, female: { optimal_low: 45, optimal_high: 65 }, note: "Higher targets in elderly for fall prevention + bone density" },
    ],
  },

  "Ferritin": {
    unit: "ng/mL",
    source: "Houston et al. BMJ Open 2018 (PMID: 29626044) + NHANES iron status data",
    default_optimal_low: 50,
    default_optimal_high: 150,
    age_sex_ranges: [
      { min_age: 18, max_age: 45, male: { optimal_low: 70, optimal_high: 200 }, female: { optimal_low: 50, optimal_high: 150 }, note: "Premenopausal women have lower ranges due to menstrual iron loss" },
      { min_age: 46, max_age: 65, male: { optimal_low: 70, optimal_high: 200 }, female: { optimal_low: 60, optimal_high: 200 }, note: "Postmenopausal women trend toward male ranges" },
      { min_age: 66, max_age: 120, male: { optimal_low: 50, optimal_high: 200 }, female: { optimal_low: 50, optimal_high: 200 } },
    ],
  },

  "Vitamin B12": {
    unit: "pg/mL",
    source: "Stabler SP. NEJM 2013 (PMID: 23301732) + NHANES 1999-2018",
    default_optimal_low: 400,
    default_optimal_high: 800,
    age_sex_ranges: [
      { min_age: 18, max_age: 50, male: { optimal_low: 400, optimal_high: 800 }, female: { optimal_low: 400, optimal_high: 800 } },
      { min_age: 51, max_age: 120, male: { optimal_low: 450, optimal_high: 900 }, female: { optimal_low: 450, optimal_high: 900 }, note: "Absorption declines with age; higher optimal for elderly" },
    ],
  },

  // ===== METABOLIC =====

  "Fasting Glucose": {
    unit: "mg/dL",
    source: "ADA Standards of Care 2024 + NHANES 2005-2018",
    default_optimal_low: 70,
    default_optimal_high: 90,
    age_sex_ranges: [
      { min_age: 18, max_age: 40, male: { optimal_low: 70, optimal_high: 88 }, female: { optimal_low: 70, optimal_high: 88 } },
      { min_age: 41, max_age: 60, male: { optimal_low: 72, optimal_high: 92 }, female: { optimal_low: 72, optimal_high: 92 }, note: "Slight upward drift is common with age; optimal remains below 95" },
      { min_age: 61, max_age: 120, male: { optimal_low: 75, optimal_high: 95 }, female: { optimal_low: 75, optimal_high: 95 } },
    ],
  },

  "HbA1c": {
    unit: "%",
    source: "ADA Standards of Care 2024",
    default_optimal_low: 4.8,
    default_optimal_high: 5.4,
    age_sex_ranges: [
      { min_age: 18, max_age: 50, male: { optimal_low: 4.6, optimal_high: 5.3 }, female: { optimal_low: 4.6, optimal_high: 5.3 } },
      { min_age: 51, max_age: 70, male: { optimal_low: 4.8, optimal_high: 5.5 }, female: { optimal_low: 4.8, optimal_high: 5.5 } },
      { min_age: 71, max_age: 120, male: { optimal_low: 5.0, optimal_high: 5.7 }, female: { optimal_low: 5.0, optimal_high: 5.7 }, note: "Slightly relaxed targets in elderly per ADA guidelines" },
    ],
  },

  "Fasting Insulin": {
    unit: "µIU/mL",
    source: "NHANES metabolic data + Reaven GM. Diabetes 1988",
    default_optimal_low: 2,
    default_optimal_high: 8,
    age_sex_ranges: [
      { min_age: 18, max_age: 40, male: { optimal_low: 2, optimal_high: 7 }, female: { optimal_low: 2, optimal_high: 7 } },
      { min_age: 41, max_age: 60, male: { optimal_low: 2, optimal_high: 8 }, female: { optimal_low: 2, optimal_high: 8 } },
      { min_age: 61, max_age: 120, male: { optimal_low: 3, optimal_high: 10 }, female: { optimal_low: 3, optimal_high: 10 }, note: "Some insulin resistance increase is common with aging" },
    ],
  },

  // ===== CARDIOVASCULAR =====

  "Total Cholesterol": {
    unit: "mg/dL",
    source: "ESC/EAS 2019 Dyslipidemia Guidelines + NHANES",
    default_optimal_low: 140,
    default_optimal_high: 200,
    age_sex_ranges: [
      { min_age: 18, max_age: 40, male: { optimal_low: 140, optimal_high: 190 }, female: { optimal_low: 140, optimal_high: 200 } },
      { min_age: 41, max_age: 65, male: { optimal_low: 140, optimal_high: 200 }, female: { optimal_low: 150, optimal_high: 220 }, note: "Women's cholesterol rises naturally around menopause" },
      { min_age: 66, max_age: 120, male: { optimal_low: 140, optimal_high: 210 }, female: { optimal_low: 150, optimal_high: 220 } },
    ],
  },

  "HDL Cholesterol": {
    unit: "mg/dL",
    source: "ESC/EAS 2019 + NHANES lipid data",
    default_optimal_low: 50,
    default_optimal_high: 90,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 45, optimal_high: 80 }, female: { optimal_low: 55, optimal_high: 90 }, note: "Women naturally have higher HDL than men" },
    ],
  },

  "LDL Cholesterol": {
    unit: "mg/dL",
    source: "ESC/EAS 2019 Dyslipidemia Guidelines",
    default_optimal_low: 50,
    default_optimal_high: 100,
    age_sex_ranges: [
      { min_age: 18, max_age: 40, male: { optimal_low: 50, optimal_high: 100 }, female: { optimal_low: 50, optimal_high: 100 } },
      { min_age: 41, max_age: 70, male: { optimal_low: 50, optimal_high: 100 }, female: { optimal_low: 50, optimal_high: 110 }, note: "LDL tends to rise in women post-menopause" },
      { min_age: 71, max_age: 120, male: { optimal_low: 50, optimal_high: 115 }, female: { optimal_low: 50, optimal_high: 115 } },
    ],
  },

  "Triglycerides": {
    unit: "mg/dL",
    source: "ESC/EAS 2019 + NHANES",
    default_optimal_low: 40,
    default_optimal_high: 100,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 40, optimal_high: 100 }, female: { optimal_low: 40, optimal_high: 100 } },
    ],
  },

  "hs-CRP": {
    unit: "mg/L",
    source: "AHA/CDC 2003 (PMID: 12551878) + Ridker PM 2016",
    default_optimal_low: 0,
    default_optimal_high: 1.0,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 0, optimal_high: 1.0 }, female: { optimal_low: 0, optimal_high: 1.0 }, note: "Below 1.0 = low cardiovascular risk per AHA/CDC criteria" },
    ],
  },

  // ===== THYROID =====

  "TSH": {
    unit: "mIU/L",
    source: "AACE/ATA 2012 (PMID: 23246686) + NHANES thyroid data",
    default_optimal_low: 0.5,
    default_optimal_high: 2.5,
    age_sex_ranges: [
      { min_age: 18, max_age: 50, male: { optimal_low: 0.5, optimal_high: 2.5 }, female: { optimal_low: 0.5, optimal_high: 2.5 } },
      { min_age: 51, max_age: 70, male: { optimal_low: 0.5, optimal_high: 3.0 }, female: { optimal_low: 0.5, optimal_high: 3.0 }, note: "TSH drifts slightly higher with age; still optimal below 3.0" },
      { min_age: 71, max_age: 120, male: { optimal_low: 0.5, optimal_high: 4.0 }, female: { optimal_low: 0.5, optimal_high: 4.0 }, note: "Elderly may have physiologically higher TSH; overtreating is risky" },
    ],
  },

  "Free T3": {
    unit: "pg/mL",
    source: "Clinical thyroid literature + NHANES",
    default_optimal_low: 3.0,
    default_optimal_high: 4.2,
    age_sex_ranges: [
      { min_age: 18, max_age: 50, male: { optimal_low: 3.0, optimal_high: 4.2 }, female: { optimal_low: 2.8, optimal_high: 4.0 } },
      { min_age: 51, max_age: 120, male: { optimal_low: 2.5, optimal_high: 3.8 }, female: { optimal_low: 2.5, optimal_high: 3.8 }, note: "fT3 declines with age; lower end of range is common in elderly" },
    ],
  },

  // ===== HORMONES =====

  "Total Testosterone": {
    unit: "ng/dL",
    source: "Endocrine Society 2018 + NHANES 2011-2016 testosterone data",
    default_optimal_low: 450,
    default_optimal_high: 800,
    age_sex_ranges: [
      { min_age: 18, max_age: 30, male: { optimal_low: 500, optimal_high: 900 }, female: { optimal_low: 15, optimal_high: 50 } },
      { min_age: 31, max_age: 45, male: { optimal_low: 450, optimal_high: 800 }, female: { optimal_low: 10, optimal_high: 45 } },
      { min_age: 46, max_age: 60, male: { optimal_low: 400, optimal_high: 700 }, female: { optimal_low: 8, optimal_high: 40 }, note: "Gradual decline with age in men (~1-2%/year after 30)" },
      { min_age: 61, max_age: 120, male: { optimal_low: 350, optimal_high: 650 }, female: { optimal_low: 5, optimal_high: 35 } },
    ],
  },

  "Estradiol": {
    unit: "pg/mL",
    source: "Endocrine Society guidelines + clinical literature",
    default_optimal_low: 20,
    default_optimal_high: 40,
    age_sex_ranges: [
      { min_age: 18, max_age: 45, male: { optimal_low: 20, optimal_high: 40 }, female: { optimal_low: 30, optimal_high: 300 }, note: "Women: varies dramatically with menstrual cycle phase; this is follicular range" },
      { min_age: 46, max_age: 55, male: { optimal_low: 18, optimal_high: 40 }, female: { optimal_low: 10, optimal_high: 200 }, note: "Perimenopause: highly variable" },
      { min_age: 56, max_age: 120, male: { optimal_low: 15, optimal_high: 35 }, female: { optimal_low: 5, optimal_high: 30 }, note: "Postmenopausal: significant drop expected" },
    ],
  },

  // ===== LIVER =====

  "ALT": {
    unit: "U/L",
    source: "Prati D et al. Ann Intern Med 2002 (PMID: 12184926) + NHANES",
    default_optimal_low: 7,
    default_optimal_high: 25,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 7, optimal_high: 30 }, female: { optimal_low: 7, optimal_high: 19 }, note: "Research-based optimal is lower than most lab ranges; sex-specific per Prati et al." },
    ],
  },

  "AST": {
    unit: "U/L",
    source: "Clinical literature + NHANES",
    default_optimal_low: 10,
    default_optimal_high: 30,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 10, optimal_high: 33 }, female: { optimal_low: 10, optimal_high: 26 } },
    ],
  },

  // ===== KIDNEY =====

  "Creatinine": {
    unit: "mg/dL",
    source: "CKD-EPI 2021 (PMID: 34554658) + NHANES",
    default_optimal_low: 0.7,
    default_optimal_high: 1.2,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 0.8, optimal_high: 1.2 }, female: { optimal_low: 0.6, optimal_high: 1.0 }, note: "Women have lower creatinine due to lower muscle mass on average" },
    ],
  },

  // ===== HEMATOLOGY =====

  "Hemoglobin": {
    unit: "g/dL",
    source: "WHO anemia thresholds + NHANES hematology data",
    default_optimal_low: 13.5,
    default_optimal_high: 16.5,
    age_sex_ranges: [
      { min_age: 18, max_age: 120, male: { optimal_low: 14.0, optimal_high: 17.0 }, female: { optimal_low: 12.5, optimal_high: 15.5 }, note: "Sex-specific per WHO criteria and NHANES distributions" },
    ],
  },

  // ===== INFLAMMATORY =====

  "Homocysteine": {
    unit: "µmol/L",
    source: "Homocysteine Studies Collaboration. JAMA 2002 (PMID: 12387654)",
    default_optimal_low: 5,
    default_optimal_high: 9,
    age_sex_ranges: [
      { min_age: 18, max_age: 50, male: { optimal_low: 5, optimal_high: 9 }, female: { optimal_low: 5, optimal_high: 8 } },
      { min_age: 51, max_age: 120, male: { optimal_low: 5, optimal_high: 10 }, female: { optimal_low: 5, optimal_high: 10 }, note: "Slight increase acceptable with age; below 10 remains the research-based target" },
    ],
  },
};

// Alias mapping for marker name normalization
const MARKER_ALIASES: Record<string, string> = {
  "25-OH Vitamin D": "Vitamin D",
  "25(OH)D": "Vitamin D",
  "Vitamin D (25-OH)": "Vitamin D",
  "B12": "Vitamin B12",
  "Cobalamin": "Vitamin B12",
  "Fasting Blood Glucose": "Fasting Glucose",
  "FBG": "Fasting Glucose",
  "Glucose": "Fasting Glucose",
  "Hemoglobin A1c": "HbA1c",
  "A1C": "HbA1c",
  "Glycated Hemoglobin": "HbA1c",
  "Insulin": "Fasting Insulin",
  "TC": "Total Cholesterol",
  "Cholesterol": "Total Cholesterol",
  "HDL": "HDL Cholesterol",
  "HDL-C": "HDL Cholesterol",
  "LDL": "LDL Cholesterol",
  "LDL-C": "LDL Cholesterol",
  "TG": "Triglycerides",
  "Trigs": "Triglycerides",
  "hsCRP": "hs-CRP",
  "High-sensitivity C-reactive protein": "hs-CRP",
  "CRP": "hs-CRP",
  "fT3": "Free T3",
  "FT3": "Free T3",
  "fT4": "Free T4",
  "FT4": "Free T4",
  "Testosterone": "Total Testosterone",
  "Alanine Aminotransferase": "ALT",
  "SGPT": "ALT",
  "Aspartate Aminotransferase": "AST",
  "SGOT": "AST",
  "Serum Creatinine": "Creatinine",
  "Hgb": "Hemoglobin",
  "Hb": "Hemoglobin",
};

/**
 * Get demographic-adjusted optimal range for a biomarker.
 * Returns null if no demographic data is available for this marker.
 */
export function getDemographicOptimalRange(
  markerName: string,
  age: number | undefined,
  sex: "male" | "female" | undefined
): DemographicRange | null {
  // Normalize marker name
  const normalizedName = MARKER_ALIASES[markerName] || markerName;
  const config = DEMOGRAPHIC_RANGES[normalizedName];

  if (!config) return null;

  // If no age/sex, return default range
  if (!age || !sex) {
    return {
      optimal_low: config.default_optimal_low,
      optimal_high: config.default_optimal_high,
      unit: config.unit,
      source: config.source,
      note: "Using default optimal range. Add your age and sex to your profile for a personalized range.",
    };
  }

  // Find matching age range
  const ageRange = config.age_sex_ranges.find(
    (r) => age >= r.min_age && age <= r.max_age
  );

  if (!ageRange) {
    // Fall back to last defined range
    const lastRange = config.age_sex_ranges[config.age_sex_ranges.length - 1];
    const sexRange = sex === "male" ? lastRange.male : lastRange.female;
    return {
      optimal_low: sexRange.optimal_low,
      optimal_high: sexRange.optimal_high,
      unit: config.unit,
      source: config.source,
      note: lastRange.note || `Personalized for ${sex}, age ${age}`,
    };
  }

  const sexRange = sex === "male" ? ageRange.male : ageRange.female;

  return {
    optimal_low: sexRange.optimal_low,
    optimal_high: sexRange.optimal_high,
    unit: config.unit,
    source: config.source,
    note: ageRange.note || `Personalized for ${sex}, age ${age}`,
  };
}

/**
 * Get all available demographic markers.
 */
export function getAvailableDemographicMarkers(): string[] {
  return Object.keys(DEMOGRAPHIC_RANGES);
}

/**
 * =====================================================================
 * LIPA — Population Percentile Calculator
 * =====================================================================
 *
 * Computes where a user's biomarker value sits relative to the general
 * population, stratified by age group and sex.
 *
 * Data source: NHANES (National Health and Nutrition Examination Survey),
 * CDC/NCHS. 300,000+ participants across multiple survey cycles.
 *
 * Returns: "Your vitamin D at 28 ng/mL puts you in the 35th percentile
 * of adults aged 30-50."
 *
 * Method: approximate percentile using linear interpolation between
 * published NHANES percentile anchors (5th, 25th, 50th, 75th, 95th).
 * =====================================================================
 */

export interface PercentileResult {
  percentile: number;       // 0-100
  label: string;            // "35th percentile"
  context: string;          // "of adults aged 30-50"
  interpretation: string;   // "Below average — most adults your age have higher levels"
  marker: string;
  value: number;
}

interface PercentileAnchors {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}

interface AgeGroupPercentiles {
  age_label: string;
  min_age: number;
  max_age: number;
  male: PercentileAnchors;
  female: PercentileAnchors;
}

interface MarkerPercentileConfig {
  unit: string;
  higher_is_better: boolean; // For interpretation text
  age_groups: AgeGroupPercentiles[];
}

// ---------------------------------------------------------------------
// NHANES-derived percentile distributions
// Approximate anchors from published NHANES summary statistics
// and CDC data briefs. Rounded to clinically meaningful precision.
// ---------------------------------------------------------------------

const PERCENTILE_DATA: Record<string, MarkerPercentileConfig> = {

  "Vitamin D": {
    unit: "ng/mL",
    higher_is_better: true,
    age_groups: [
      {
        age_label: "adults aged 20-39", min_age: 20, max_age: 39,
        male:   { p5: 12, p25: 22, p50: 30, p75: 38, p95: 54 },
        female: { p5: 10, p25: 18, p50: 26, p75: 35, p95: 50 },
      },
      {
        age_label: "adults aged 40-59", min_age: 40, max_age: 59,
        male:   { p5: 13, p25: 23, p50: 31, p75: 40, p95: 56 },
        female: { p5: 11, p25: 20, p50: 28, p75: 37, p95: 52 },
      },
      {
        age_label: "adults aged 60+", min_age: 60, max_age: 120,
        male:   { p5: 14, p25: 24, p50: 32, p75: 42, p95: 58 },
        female: { p5: 12, p25: 22, p50: 30, p75: 40, p95: 56 },
      },
    ],
  },

  "Ferritin": {
    unit: "ng/mL",
    higher_is_better: false, // complex — too low is bad, too high is bad
    age_groups: [
      {
        age_label: "adults aged 20-49", min_age: 20, max_age: 49,
        male:   { p5: 30, p25: 80, p50: 140, p75: 230, p95: 400 },
        female: { p5: 8, p25: 20, p50: 40, p75: 75, p95: 160 },
      },
      {
        age_label: "adults aged 50+", min_age: 50, max_age: 120,
        male:   { p5: 40, p25: 100, p50: 170, p75: 270, p95: 450 },
        female: { p5: 15, p25: 45, p50: 85, p75: 150, p95: 300 },
      },
    ],
  },

  "Fasting Glucose": {
    unit: "mg/dL",
    higher_is_better: false,
    age_groups: [
      {
        age_label: "adults aged 20-39", min_age: 20, max_age: 39,
        male:   { p5: 74, p25: 84, p50: 91, p75: 98, p95: 115 },
        female: { p5: 72, p25: 82, p50: 88, p75: 95, p95: 110 },
      },
      {
        age_label: "adults aged 40-59", min_age: 40, max_age: 59,
        male:   { p5: 78, p25: 90, p50: 98, p75: 108, p95: 140 },
        female: { p5: 76, p25: 86, p50: 94, p75: 104, p95: 135 },
      },
      {
        age_label: "adults aged 60+", min_age: 60, max_age: 120,
        male:   { p5: 80, p25: 92, p50: 102, p75: 115, p95: 155 },
        female: { p5: 78, p25: 88, p50: 98, p75: 110, p95: 145 },
      },
    ],
  },

  "HbA1c": {
    unit: "%",
    higher_is_better: false,
    age_groups: [
      {
        age_label: "adults aged 20-39", min_age: 20, max_age: 39,
        male:   { p5: 4.6, p25: 5.0, p50: 5.2, p75: 5.4, p95: 5.9 },
        female: { p5: 4.5, p25: 4.9, p50: 5.1, p75: 5.3, p95: 5.8 },
      },
      {
        age_label: "adults aged 40-59", min_age: 40, max_age: 59,
        male:   { p5: 4.8, p25: 5.2, p50: 5.5, p75: 5.8, p95: 6.8 },
        female: { p5: 4.7, p25: 5.1, p50: 5.4, p75: 5.7, p95: 6.5 },
      },
      {
        age_label: "adults aged 60+", min_age: 60, max_age: 120,
        male:   { p5: 5.0, p25: 5.4, p50: 5.7, p75: 6.1, p95: 7.5 },
        female: { p5: 4.9, p25: 5.3, p50: 5.6, p75: 6.0, p95: 7.2 },
      },
    ],
  },

  "Total Cholesterol": {
    unit: "mg/dL",
    higher_is_better: false,
    age_groups: [
      {
        age_label: "adults aged 20-39", min_age: 20, max_age: 39,
        male:   { p5: 130, p25: 163, p50: 188, p75: 214, p95: 260 },
        female: { p5: 132, p25: 161, p50: 185, p75: 210, p95: 258 },
      },
      {
        age_label: "adults aged 40-59", min_age: 40, max_age: 59,
        male:   { p5: 145, p25: 182, p50: 208, p75: 234, p95: 282 },
        female: { p5: 150, p25: 188, p50: 215, p75: 244, p95: 298 },
      },
      {
        age_label: "adults aged 60+", min_age: 60, max_age: 120,
        male:   { p5: 140, p25: 175, p50: 200, p75: 228, p95: 275 },
        female: { p5: 155, p25: 195, p50: 222, p75: 252, p95: 305 },
      },
    ],
  },

  "HDL Cholesterol": {
    unit: "mg/dL",
    higher_is_better: true,
    age_groups: [
      {
        age_label: "adults", min_age: 20, max_age: 120,
        male:   { p5: 32, p25: 40, p50: 47, p75: 56, p95: 74 },
        female: { p5: 38, p25: 49, p50: 58, p75: 70, p95: 92 },
      },
    ],
  },

  "Triglycerides": {
    unit: "mg/dL",
    higher_is_better: false,
    age_groups: [
      {
        age_label: "adults", min_age: 20, max_age: 120,
        male:   { p5: 45, p25: 75, p50: 110, p75: 165, p95: 300 },
        female: { p5: 38, p25: 62, p50: 92, p75: 135, p95: 250 },
      },
    ],
  },

  "hs-CRP": {
    unit: "mg/L",
    higher_is_better: false,
    age_groups: [
      {
        age_label: "adults", min_age: 20, max_age: 120,
        male:   { p5: 0.2, p25: 0.6, p50: 1.5, p75: 3.5, p95: 9.0 },
        female: { p5: 0.2, p25: 0.8, p50: 2.0, p75: 4.5, p95: 12.0 },
      },
    ],
  },

  "TSH": {
    unit: "mIU/L",
    higher_is_better: false, // complex — both extremes are bad
    age_groups: [
      {
        age_label: "adults", min_age: 20, max_age: 120,
        male:   { p5: 0.5, p25: 1.1, p50: 1.6, p75: 2.3, p95: 4.0 },
        female: { p5: 0.5, p25: 1.2, p50: 1.8, p75: 2.6, p95: 4.5 },
      },
    ],
  },

  "Hemoglobin": {
    unit: "g/dL",
    higher_is_better: true,
    age_groups: [
      {
        age_label: "adults", min_age: 20, max_age: 120,
        male:   { p5: 13.2, p25: 14.4, p50: 15.2, p75: 16.0, p95: 17.2 },
        female: { p5: 11.2, p25: 12.4, p50: 13.2, p75: 14.0, p95: 15.2 },
      },
    ],
  },
};

// Alias mapping
const MARKER_ALIASES: Record<string, string> = {
  "25-OH Vitamin D": "Vitamin D",
  "Vitamin D (25-OH)": "Vitamin D",
  "25(OH)D": "Vitamin D",
  "Fasting Blood Glucose": "Fasting Glucose",
  "Glucose": "Fasting Glucose",
  "Hemoglobin A1c": "HbA1c",
  "A1C": "HbA1c",
  "TC": "Total Cholesterol",
  "Cholesterol": "Total Cholesterol",
  "HDL": "HDL Cholesterol",
  "HDL-C": "HDL Cholesterol",
  "TG": "Triglycerides",
  "hsCRP": "hs-CRP",
  "CRP": "hs-CRP",
  "Hgb": "Hemoglobin",
  "Hb": "Hemoglobin",
};

/**
 * Interpolate percentile from anchor points.
 */
function interpolatePercentile(value: number, anchors: PercentileAnchors): number {
  if (value <= anchors.p5) return Math.max(1, Math.round((value / anchors.p5) * 5));
  if (value <= anchors.p25) return 5 + Math.round(((value - anchors.p5) / (anchors.p25 - anchors.p5)) * 20);
  if (value <= anchors.p50) return 25 + Math.round(((value - anchors.p25) / (anchors.p50 - anchors.p25)) * 25);
  if (value <= anchors.p75) return 50 + Math.round(((value - anchors.p50) / (anchors.p75 - anchors.p50)) * 25);
  if (value <= anchors.p95) return 75 + Math.round(((value - anchors.p75) / (anchors.p95 - anchors.p75)) * 20);
  return Math.min(99, 95 + Math.round(((value - anchors.p95) / (anchors.p95 * 0.3)) * 4));
}

/**
 * Get population percentile for a biomarker value.
 * Returns null if no percentile data is available for this marker.
 */
export function getPopulationPercentile(
  markerName: string,
  value: number,
  age: number | undefined,
  sex: "male" | "female" | undefined
): PercentileResult | null {
  const normalizedName = MARKER_ALIASES[markerName] || markerName;
  const config = PERCENTILE_DATA[normalizedName];

  if (!config) return null;

  // Find matching age group
  const effectiveAge = age || 40; // Default to middle-age if unknown
  const effectiveSex = sex || "male"; // Default if unknown

  const ageGroup = config.age_groups.find(
    (g) => effectiveAge >= g.min_age && effectiveAge <= g.max_age
  ) || config.age_groups[config.age_groups.length - 1];

  const anchors = effectiveSex === "male" ? ageGroup.male : ageGroup.female;
  const percentile = interpolatePercentile(value, anchors);

  // Build interpretation
  let interpretation: string;
  if (config.higher_is_better) {
    if (percentile >= 75) interpretation = "Above average — higher than most people your age.";
    else if (percentile >= 50) interpretation = "Average — in the middle of the population.";
    else if (percentile >= 25) interpretation = "Below average — most people your age have higher levels.";
    else interpretation = "Well below average — significantly lower than most people your age.";
  } else {
    if (percentile <= 25) interpretation = "Lower than most — research generally associates lower values with better outcomes.";
    else if (percentile <= 50) interpretation = "Average — in the middle of the population.";
    else if (percentile <= 75) interpretation = "Above average — higher than most people your age.";
    else interpretation = "Well above average — significantly higher than most people your age.";
  }

  const context = age && sex
    ? `of ${sex === "male" ? "men" : "women"} ${ageGroup.age_label}`
    : `of ${ageGroup.age_label}`;

  return {
    percentile,
    label: `${percentile}${getOrdinalSuffix(percentile)} percentile`,
    context,
    interpretation,
    marker: normalizedName,
    value,
  };
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

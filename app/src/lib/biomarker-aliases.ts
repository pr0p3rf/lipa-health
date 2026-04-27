/**
 * =====================================================================
 * LIPA — Global Biomarker Alias Resolver
 * =====================================================================
 *
 * Single source of truth for biomarker name matching. All labs name
 * markers differently — this map ensures we recognize every variant.
 *
 * Used by: biological-age.ts, risk-calculations.ts, pattern-detection.ts
 *
 * When adding new aliases: check production data first:
 *   SELECT DISTINCT biomarker FROM biomarker_results ORDER BY biomarker;
 * =====================================================================
 */

// Canonical name → all known aliases (case-insensitive matching)
const GLOBAL_ALIASES: Record<string, string[]> = {
  // --- Lipids ---
  "Total Cholesterol": ["Total Cholesterol", "Cholesterol", "TC"],
  "HDL Cholesterol": ["HDL Cholesterol", "HDL", "HDL-C", "High-Density Lipoprotein"],
  "LDL Cholesterol": ["LDL Cholesterol", "LDL", "LDL-C", "Low-Density Lipoprotein", "LDL Cholesterol (Direct)", "LDL Chol Calc (NIH)"],
  "Triglycerides": ["Triglycerides", "TG", "Trigs", "Fasting Triglycerides"],
  "Non-HDL Cholesterol": ["Non-HDL Cholesterol", "Non-HDL", "Non-HDL-C"],
  "VLDL Cholesterol": ["VLDL Cholesterol", "VLDL", "VLDL Cholesterol Cal"],
  "Apolipoprotein B": ["Apolipoprotein B", "ApoB", "Apo B"],
  "Lipoprotein(a)": ["Lipoprotein(a)", "Lp(a)", "Lipoprotein a", "Lp(a) Mass", "Lpa"],

  // --- Metabolic ---
  "Fasting Glucose": ["Fasting Glucose", "Glucose", "Fasting Blood Glucose", "FBG", "Blood Glucose", "Glucose (Fasting)", "Glucose Fasting"],
  "Fasting Insulin": ["Fasting Insulin", "Insulin"],
  "HbA1c": ["HbA1c", "Hemoglobin A1c", "A1C", "Glycated Hemoglobin", "HbA1c (IFCC)", "HbA1c (NGSP)", "HbA1c IFCC"],
  "C-Peptide": ["C-Peptide", "C-Peptide, Serum"],
  "Uric Acid": ["Uric Acid", "Urate", "Serum Uric Acid"],

  // --- Inflammatory ---
  "hs-CRP": ["hs-CRP", "CRP", "C-Reactive Protein", "High-sensitivity C-reactive protein", "hsCRP", "High Sensitivity CRP", "C-Reactive Protein, High Sensitivity", "C-Reactive Protein (High Sensitivity)", "C-Reactive Protein (hsCRP)", "High Sensitivity C-Reactive Protein", "HS CRP", "CRP, High Sensitivity", "Ultra-Sensitive CRP", "Cardio CRP", "C-Reactive Protein, Cardiac"],
  "ESR": ["ESR", "Erythrocyte Sedimentation Rate", "Sed Rate"],
  "Homocysteine": ["Homocysteine"],
  "Fibrinogen": ["Fibrinogen"],
  "Interleukin-6": ["Interleukin-6", "IL-6"],
  "TNF-alpha": ["TNF-alpha", "TNF-α", "Tumor Necrosis Factor Alpha"],

  // --- Liver ---
  "ALT": ["ALT", "Alanine Aminotransferase", "SGPT", "ALT (GPT)", "ALT (SGPT)", "Alanine Transaminase"],
  "AST": ["AST", "Aspartate Aminotransferase", "SGOT", "AST (GOT)", "AST (SGOT)", "Aspartate Transaminase"],
  "GGT": ["GGT", "Gamma-GT", "Gamma-Glutamyl Transferase", "Gamma GT", "γ-GT"],
  "Alkaline Phosphatase": ["Alkaline Phosphatase", "ALP", "Alk Phos", "Alkaline Phosphatase (ALP)"],
  "Albumin": ["Albumin", "Serum Albumin", "ALB"],
  "Total Bilirubin": ["Total Bilirubin", "Bilirubin (Total)", "Bilirubin, Total"],
  "Direct Bilirubin": ["Direct Bilirubin"],
  "Total Protein": ["Total Protein"],

  // --- Kidney ---
  "Creatinine": ["Creatinine", "Serum Creatinine", "CREA"],
  "BUN": ["BUN", "Blood Urea Nitrogen", "Urea Nitrogen", "Urea", "Urea (BUN)"],
  "eGFR": ["eGFR", "eGFR (CKD-EPI)", "eGFR CKD-EPI", "Estimated GFR", "GFR", "Glomerular Filtration Rate"],
  "Cystatin C": ["Cystatin C"],

  // --- Hematology ---
  "Hemoglobin": ["Hemoglobin", "Hgb", "Hb", "HGB", "Hemoglobin (HGB)"],
  "Hematocrit": ["Hematocrit", "HCT", "Hematocrit (HCT)"],
  "Red Blood Cells": ["Red Blood Cells", "RBC", "Red Blood Cell Count", "Red Blood Cells (RBC)"],
  "White Blood Cells": ["White Blood Cells", "WBC", "White Blood Cell Count", "Leukocyte Count", "Leukocytes", "White Blood Cells (WBC)"],
  "Platelets": ["Platelets", "Platelet Count", "PLT", "Thrombocytes", "Platelets (PLT)"],
  "MCV": ["MCV", "Mean Corpuscular Volume"],
  "MCH": ["MCH", "Mean Corpuscular Hemoglobin"],
  "MCHC": ["MCHC", "Mean Corpuscular Hemoglobin Concentration"],
  "RDW": ["RDW", "Red Cell Distribution Width", "RDW-CV"],
  "MPV": ["MPV", "Mean Platelet Volume"],

  // --- WBC Differential ---
  "Neutrophils": ["Neutrophils", "Neutrophils %", "Neutrophils (%)", "Neutrophils (Absolute)", "Neutrophils Absolute", "Absolute Neutrophils"],
  "Lymphocytes": ["Lymphocytes", "Lymphocytes %", "Lymphocytes (%)", "Lymphocytes (Absolute)", "Lymphocytes Absolute", "Absolute Lymphocytes", "Lymphs", "Lymphs (Absolute)", "Lymphocyte Count"],
  "Monocytes": ["Monocytes", "Monocytes %", "Monocytes (%)", "Monocytes (Absolute)", "Monocytes Absolute", "Absolute Monocytes"],
  "Eosinophils": ["Eosinophils", "Eosinophils %", "Eosinophils (%)", "Eosinophils (Absolute)", "Eosinophils Absolute", "Absolute Eosinophils", "Eos", "Eos (Absolute)"],
  "Basophils": ["Basophils", "Basophils %", "Basophils (%)", "Basophils (Absolute)", "Basophils Absolute", "Baso (Absolute)", "Basos"],

  // --- Thyroid ---
  "TSH": ["TSH"],
  "Free T3": ["Free T3", "fT3", "FT3", "Free T3 (Triiodothyronine)"],
  "Free T4": ["Free T4", "fT4", "FT4", "Free T4 (FT4)", "Free T4 (Thyroxine)"],
  "Reverse T3": ["Reverse T3", "Reverse T3, Serum", "rT3"],
  "Anti-TPO Antibodies": ["Anti-TPO Antibodies", "TPO", "Anti-TPO", "Thyroid Peroxidase Antibodies", "TPOAb", "Thyroid Peroxidase (TPO) Ab"],
  "Anti-Thyroglobulin Antibodies": ["Anti-Thyroglobulin Antibodies", "Thyroglobulin Antibodies", "TgAb"],

  // --- Hormonal ---
  "Total Testosterone": ["Total Testosterone", "Testosterone", "Testosterone (Total)", "Testosterone, Total", "Serum Testosterone"],
  "Free Testosterone": ["Free Testosterone", "Free Testosterone (Direct)", "Testosterone, Free", "Free Testosterone Index"],
  "SHBG": ["SHBG", "Sex Hormone Binding Globulin", "Sex Hormone-Binding Globulin", "SHBG (Sex Hormone Binding Globulin)", "Sex Horm Binding Glob, Serum", "Sex Horm Binding Glob"],
  "Estradiol": ["Estradiol", "E2", "Estradiol (E2)", "Estradiol-17beta", "Oestradiol", "Estradiol, Serum"],
  "Progesterone": ["Progesterone", "Serum Progesterone", "P4"],
  "DHEA-S": ["DHEA-S", "DHEA Sulfate", "DHEA-Sulfate", "DHEAS", "Dehydroepiandrosterone Sulfate"],
  "Cortisol": ["Cortisol", "Cortisol (morning)", "Cortisol, Total", "Morning Cortisol", "Serum Cortisol", "AM Cortisol"],
  "FSH": ["FSH"],
  "LH": ["LH"],
  "Prolactin": ["Prolactin"],
  "IGF-1": ["IGF-1"],
  "Growth Hormone": ["Growth Hormone"],

  // --- Iron ---
  "Ferritin": ["Ferritin"],
  "Serum Iron": ["Serum Iron", "Iron", "Iron, Total"],
  "Transferrin Saturation": ["Transferrin Saturation", "TSAT", "Transferrin Sat", "Iron Saturation", "% Transferrin Saturation"],
  "TIBC": ["TIBC", "Iron Bind.Cap.(TIBC)", "Iron Binding Capacity", "Total Iron Binding Capacity"],
  "UIBC": ["UIBC"],
  "Transferrin": ["Transferrin"],

  // --- Vitamins & Minerals ---
  "Vitamin D": ["Vitamin D", "Vitamin D (25-OH)", "25-Hydroxy Vitamin D", "Vitamin D3", "25-OH Vitamin D", "25(OH)D", "Vitamin D, 25-Hydroxy", "25-Hydroxyvitamin D"],
  "Vitamin B12": ["Vitamin B12", "B12", "Cobalamin", "Vitamin B12 (Active)", "Vitamin B12 (Holo-Tc)", "Vitamin B12 Active"],
  "Folate": ["Folate", "Folic Acid (Vitamin B9)"],
  "Vitamin B6": ["Vitamin B6", "Vitamin B6 (Pyridoxal-5'-Phosphate)"],
  "Vitamin A": ["Vitamin A"],
  "Vitamin E": ["Vitamin E"],
  "Vitamin K": ["Vitamin K"],
  "Magnesium": ["Magnesium", "Mg", "Serum Magnesium", "Magnesium, RBC", "Erythrocyte Magnesium"],
  "Calcium": ["Calcium", "Serum Calcium", "Total Calcium", "Ca", "Calcium (Total)", "Calcium (Corrected)", "Calcium Corrected", "Calcium (albumin corrected)"],
  "Zinc": ["Zinc"],
  "Copper": ["Copper"],
  "Selenium": ["Selenium"],
  "Iodine": ["Iodine"],
  "Phosphorus": ["Phosphorus"],
  "Sodium": ["Sodium"],
  "Potassium": ["Potassium"],
  "Chloride": ["Chloride"],
  "Bicarbonate": ["Bicarbonate", "Carbon Dioxide", "Carbon Dioxide, Total", "CO2"],

  // --- Omega Fatty Acids ---
  "Omega-3 Index": ["Omega-3 Index", "Omega 3 Index", "O3 Index", "EPA+DHA Index"],

  // --- Coagulation ---
  "D-Dimer": ["D-Dimer"],
  "INR": ["INR"],
  "PT": ["PT", "PT (Quick)", "Prothrombin Time (Quick)"],

  // --- Cardiac ---
  "NT-proBNP": ["NT-proBNP"],
  "Troponin I": ["Troponin I"],
  "Troponin T": ["Troponin T"],
  "CPK": ["CPK", "Creatine Kinase (Total)"],
  "LDH": ["LDH", "Lactate Dehydrogenase"],

  // --- Other ---
  "Lipase": ["Lipase", "Serum Lipase"],
  "Amylase": ["Amylase", "Alpha-Amylase", "Pancreatic Amylase", "Serum Amylase"],
  "Ceruloplasmin": ["Ceruloplasmin"],
  "Coenzyme Q10": ["Coenzyme Q10"],
  "PSA": ["PSA", "PSA Total", "PSA, Total"],
};

// Build reverse lookup: lowercased alias → canonical name
const REVERSE_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(GLOBAL_ALIASES)) {
  for (const alias of aliases) {
    REVERSE_LOOKUP.set(alias.toLowerCase(), canonical);
  }
}

/**
 * Resolve any biomarker name to its canonical form.
 * Returns the canonical name, or the original name if no match.
 */
export function resolveCanonicalName(name: string): string {
  return REVERSE_LOOKUP.get(name.toLowerCase()) || name;
}

/**
 * Get all known aliases for a canonical biomarker name.
 */
export function getAliases(canonicalName: string): string[] {
  return GLOBAL_ALIASES[canonicalName] || [canonicalName];
}

/**
 * Find a biomarker value by canonical name from a list of results.
 * Searches through all known aliases (case-insensitive).
 */
export function findBiomarkerValue(
  biomarkers: Array<{ name: string; value: number; unit?: string | null }>,
  canonicalName: string
): { name: string; value: number; unit?: string | null } | null {
  const aliases = GLOBAL_ALIASES[canonicalName] || [canonicalName];
  for (const alias of aliases) {
    const match = biomarkers.find(
      (b) => b.name.toLowerCase() === alias.toLowerCase()
    );
    if (match && !isNaN(match.value)) return match;
  }
  return null;
}

/**
 * Unit conversion to standardize international lab results.
 * Converts to the unit expected by our algorithms (typically US units).
 */
export function convertToStandardUnit(canonicalName: string, value: number, unit?: string | null): number {
  const u = (unit || "").toLowerCase().replace(/\s+/g, "");

  switch (canonicalName) {
    // Glucose: mmol/L → mg/dL (×18.018)
    case "Fasting Glucose":
      if (u.includes("mmol") || u === "mmol/l") return value * 18.018;
      break;

    // Cholesterol: mmol/L → mg/dL (×38.67)
    case "Total Cholesterol":
    case "HDL Cholesterol":
    case "LDL Cholesterol":
    case "Non-HDL Cholesterol":
    case "VLDL Cholesterol":
      if (u.includes("mmol") || u === "mmol/l") return value * 38.67;
      break;

    // Triglycerides: mmol/L → mg/dL (×88.57)
    case "Triglycerides":
      if (u.includes("mmol") || u === "mmol/l") return value * 88.57;
      break;

    // Albumin: g/L → g/dL (÷10)
    case "Albumin":
      if (u === "g/l") return value / 10;
      break;

    // Creatinine: µmol/L → mg/dL (÷88.42)
    case "Creatinine":
      if (u.includes("µmol") || u.includes("umol") || u === "µmol/l" || u === "umol/l") return value / 88.42;
      break;

    // BUN/Urea: mmol/L → mg/dL (×2.801)
    case "BUN":
      if (u.includes("mmol") || u === "mmol/l") return value * 2.801;
      break;

    // HbA1c: IFCC mmol/mol → NGSP % ((mmol/mol × 0.0915) + 2.15)
    case "HbA1c":
      if (u.includes("mmol/mol") || u === "mmol/mol") return (value * 0.0915) + 2.15;
      // If value > 20, likely IFCC without unit label
      if (value > 20) return (value * 0.0915) + 2.15;
      break;

    // Iron: µmol/L → µg/dL (×5.585)
    case "Serum Iron":
      if (u.includes("µmol") || u.includes("umol")) return value * 5.585;
      break;

    // CRP: mg/L stays as mg/L (same unit used in algorithms)
    // No conversion needed

    // Homocysteine: stays as µmol/L (universal)
    // No conversion needed
  }

  return value;
}

// Export the raw map for direct access if needed
export { GLOBAL_ALIASES };

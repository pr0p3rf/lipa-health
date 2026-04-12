/**
 * =====================================================================
 * LIPA — "What to test next" suggestions
 * =====================================================================
 *
 * For borderline or out-of-range markers, suggest additional tests
 * that would clarify the picture. Pre-built mapping per marker.
 *
 * Each suggestion includes the test name, why it matters, and what
 * it would add to the analysis.
 * =====================================================================
 */

export interface NextTestSuggestion {
  test_name: string;
  why: string;
}

const NEXT_TESTS: Record<string, NextTestSuggestion[]> = {
  // Thyroid
  "TSH": [
    { test_name: "Free T3 (fT3)", why: "Active thyroid hormone — TSH alone misses cases where conversion from T4 to T3 is impaired." },
    { test_name: "Free T4 (fT4)", why: "Measures available thyroid hormone. Together with TSH, clarifies whether thyroid output is adequate." },
    { test_name: "TPO Antibodies", why: "Thyroid peroxidase antibodies — the most common marker for autoimmune thyroid disease (Hashimoto's)." },
    { test_name: "Thyroglobulin Antibodies (TgAb)", why: "Second autoimmune thyroid marker. Some patients are TPO-negative but TgAb-positive." },
  ],
  "Free T3": [
    { test_name: "Reverse T3 (rT3)", why: "Elevated rT3 can block free T3 at the receptor level, producing hypothyroid symptoms even with normal T3." },
    { test_name: "TPO Antibodies", why: "If free T3 is low-normal, autoimmune thyroid should be ruled out." },
    { test_name: "Iron panel (ferritin, serum iron, TIBC)", why: "Iron deficiency impairs T4-to-T3 conversion. Low ferritin is a common overlooked cause of low T3." },
  ],
  "Free T4": [
    { test_name: "Free T3 (fT3)", why: "T4 is the storage form; T3 is the active form. Normal T4 with low T3 suggests a conversion problem." },
    { test_name: "TPO Antibodies", why: "Autoimmune thyroid disease affects T4 production directly." },
  ],

  // Iron / ferritin
  "Ferritin": [
    { test_name: "Serum iron", why: "Ferritin is a storage marker — serum iron shows how much is circulating and available right now." },
    { test_name: "TIBC (Total Iron Binding Capacity)", why: "High TIBC with low ferritin confirms iron deficiency even before anemia develops." },
    { test_name: "Transferrin saturation", why: "Calculated from iron and TIBC — the most accurate non-invasive measure of iron availability." },
    { test_name: "Reticulocyte hemoglobin (CHr)", why: "Measures iron available for new red blood cell production — catches functional iron deficiency early." },
    { test_name: "Complete blood count (CBC)", why: "MCV, MCH, and RDW changes can reveal iron deficiency before hemoglobin drops." },
  ],

  // Metabolic
  "Fasting Glucose": [
    { test_name: "Fasting insulin", why: "Insulin can rise years before glucose shifts. HOMA-IR from fasting insulin + glucose reveals insulin resistance early." },
    { test_name: "HbA1c", why: "3-month average glucose — catches patterns that a single fasting glucose misses." },
    { test_name: "C-peptide", why: "Measures insulin production directly. Useful if you're on insulin or if type 1 vs type 2 needs clarification." },
    { test_name: "Oral glucose tolerance test (OGTT)", why: "Gold standard for glucose handling — shows how your body processes sugar over 2 hours." },
  ],
  "HbA1c": [
    { test_name: "Fasting insulin", why: "HbA1c reflects glucose but not insulin resistance directly. Fasting insulin reveals the compensatory insulin response." },
    { test_name: "Fasting glucose", why: "Spot-check for current glucose status. Useful alongside the 3-month average from HbA1c." },
  ],
  "Fasting Insulin": [
    { test_name: "Fasting glucose", why: "Needed to calculate HOMA-IR — the standard surrogate for insulin resistance." },
    { test_name: "HbA1c", why: "3-month glucose average — if fasting insulin is high but glucose is normal, HbA1c shows where you're heading." },
    { test_name: "Triglycerides", why: "The TyG Index (triglycerides + glucose) is a validated alternative insulin resistance proxy." },
  ],

  // Cardiovascular / inflammation
  "hs-CRP": [
    { test_name: "ApoB", why: "hs-CRP measures inflammation; ApoB measures atherogenic particles. Together they give the full cardiovascular risk picture." },
    { test_name: "Lp(a)", why: "Largely genetic, independent cardiovascular risk factor. Should be tested at least once — especially if hs-CRP is elevated." },
    { test_name: "Fasting insulin", why: "Insulin resistance drives inflammation. If hs-CRP is elevated, checking insulin resistance clarifies the metabolic picture." },
    { test_name: "Homocysteine", why: "Another independent cardiovascular risk marker. Elevated homocysteine + elevated hs-CRP = higher compound risk." },
    { test_name: "Fibrinogen", why: "Acute-phase protein that rises with inflammation and increases clotting risk. Additional context for elevated hs-CRP." },
  ],
  "Total Cholesterol": [
    { test_name: "ApoB", why: "Total cholesterol is a rough measure. ApoB counts the actual atherogenic particles — more predictive of cardiovascular risk." },
    { test_name: "Lp(a)", why: "Genetic lipoprotein that carries independent risk. Standard lipid panels don't include it." },
    { test_name: "hs-CRP", why: "Adds the inflammation dimension to the lipid picture. Elevated cholesterol + elevated hs-CRP = higher compound risk." },
  ],
  "LDL Cholesterol": [
    { test_name: "ApoB", why: "LDL-C can be normal while ApoB is elevated — meaning more small dense particles. ApoB is increasingly viewed as the more accurate measure." },
    { test_name: "Lp(a)", why: "Independent genetic risk factor that standard LDL-C doesn't capture." },
  ],
  "HDL Cholesterol": [
    { test_name: "ApoA1", why: "ApoA1 is the protein on HDL particles. Low ApoA1 with low HDL confirms reduced cardioprotective capacity." },
    { test_name: "Triglycerides", why: "High triglycerides + low HDL is a strong metabolic syndrome indicator. The TG/HDL ratio is a useful composite." },
  ],
  "Triglycerides": [
    { test_name: "Fasting insulin", why: "Elevated triglycerides often indicate insulin resistance. Fasting insulin confirms or rules this out." },
    { test_name: "HDL Cholesterol", why: "The TG/HDL ratio is a validated surrogate for insulin resistance and cardiovascular risk." },
    { test_name: "ApoB", why: "High triglycerides shift LDL toward smaller, denser particles. ApoB captures this shift." },
  ],

  // Liver
  "ALT": [
    { test_name: "AST", why: "The AST/ALT ratio helps distinguish different types of liver stress (viral, alcohol-related, metabolic)." },
    { test_name: "GGT", why: "GGT rises with bile duct stress and alcohol exposure. Adds specificity to elevated ALT." },
    { test_name: "Hepatitis panel", why: "If ALT is persistently elevated, viral hepatitis (B and C) should be screened." },
    { test_name: "Liver ultrasound", why: "If ALT is elevated, imaging can reveal fatty liver (NAFLD) or other structural issues." },
    { test_name: "Fasting insulin", why: "NAFLD is strongly associated with insulin resistance. Fasting insulin clarifies the metabolic contribution." },
  ],
  "AST": [
    { test_name: "ALT", why: "AST/ALT ratio helps determine the type of liver involvement." },
    { test_name: "CK (Creatine Kinase)", why: "AST also rises with muscle damage. If AST is elevated but ALT is normal, muscle injury should be considered." },
  ],

  // Kidney
  "Creatinine": [
    { test_name: "Cystatin C", why: "Cystatin C is a second kidney filtration marker less affected by muscle mass than creatinine. Confirms eGFR accuracy." },
    { test_name: "Urine albumin-creatinine ratio (uACR)", why: "Detects early kidney damage (microalbuminuria) before creatinine or eGFR change." },
    { test_name: "BUN (Blood Urea Nitrogen)", why: "BUN/creatinine ratio helps distinguish kidney causes from dehydration or dietary protein effects." },
  ],

  // Nutritional
  "Vitamin D": [
    { test_name: "Calcium", why: "Vitamin D regulates calcium absorption. Low D with abnormal calcium needs investigation." },
    { test_name: "PTH (Parathyroid Hormone)", why: "PTH rises to compensate for low vitamin D. Elevated PTH with low D confirms functional deficiency." },
    { test_name: "Magnesium", why: "Magnesium is a cofactor for vitamin D metabolism. Low magnesium can prevent vitamin D supplementation from working." },
  ],
  "Vitamin B12": [
    { test_name: "Methylmalonic acid (MMA)", why: "MMA is the most sensitive marker of functional B12 deficiency — rises before serum B12 drops below reference range." },
    { test_name: "Homocysteine", why: "Homocysteine rises when B12 or folate is functionally low. If B12 is low-normal and homocysteine is high, supplementation is likely warranted." },
    { test_name: "Folate", why: "B12 and folate work together in methylation. Deficiency in either produces similar symptoms." },
  ],

  // Hormonal
  "Total Testosterone": [
    { test_name: "Free testosterone", why: "Total T can be normal while free T (the biologically active portion) is low, especially if SHBG is elevated." },
    { test_name: "SHBG", why: "Sex Hormone Binding Globulin binds testosterone. High SHBG = lower free T despite normal total T." },
    { test_name: "Estradiol (E2)", why: "Testosterone converts to estradiol via aromatase. Important to monitor, especially on TRT." },
    { test_name: "LH and FSH", why: "Distinguish between primary (testicular) and secondary (pituitary) causes of low testosterone." },
    { test_name: "Prolactin", why: "Elevated prolactin can suppress testosterone production. Should be checked if testosterone is low without clear cause." },
  ],
  "Estradiol": [
    { test_name: "Total + Free Testosterone", why: "Estradiol-to-testosterone ratio matters for symptom correlation." },
    { test_name: "SHBG", why: "SHBG affects both estrogen and testosterone availability." },
    { test_name: "Progesterone", why: "Estradiol-progesterone balance is critical in perimenopause and menstrual irregularity." },
  ],

  // Hematology
  "Hemoglobin": [
    { test_name: "Ferritin", why: "If hemoglobin is low, ferritin confirms whether iron deficiency is the cause." },
    { test_name: "Reticulocyte count", why: "Shows whether your bone marrow is responding appropriately to low hemoglobin." },
    { test_name: "Vitamin B12 + Folate", why: "Macrocytic anemia (high MCV + low hemoglobin) suggests B12 or folate deficiency." },
  ],
  "WBC": [
    { test_name: "Differential (neutrophils, lymphocytes, monocytes, eosinophils, basophils)", why: "Total WBC alone doesn't tell you which cell type is elevated or low. The differential is essential." },
    { test_name: "hs-CRP", why: "If WBC is elevated, hs-CRP adds context about whether systemic inflammation is present." },
  ],
};

/**
 * Get "what to test next" suggestions for a given biomarker.
 * Returns suggestions only if the marker is borderline or out of range.
 */
export function getNextTestSuggestions(
  biomarkerName: string,
  status: string
): NextTestSuggestion[] {
  if (status !== "borderline" && status !== "out_of_range") {
    return [];
  }

  // Try exact match first
  if (NEXT_TESTS[biomarkerName]) {
    return NEXT_TESTS[biomarkerName];
  }

  // Try case-insensitive match
  const key = Object.keys(NEXT_TESTS).find(
    (k) => k.toLowerCase() === biomarkerName.toLowerCase()
  );

  if (key) {
    return NEXT_TESTS[key];
  }

  return [];
}

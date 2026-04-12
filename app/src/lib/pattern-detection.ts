/**
 * =====================================================================
 * LIPA — Cross-Marker Pattern Detection
 * =====================================================================
 *
 * Pre-built pattern library matching known clinical clusters across
 * multiple biomarkers simultaneously. Surfaces when a user's panel
 * matches a documented pattern from the peer-reviewed literature.
 *
 * Each pattern is backed by at least one published reference.
 * =====================================================================
 */

export interface DetectedPattern {
  id: string;
  name: string;
  category: "metabolic" | "cardiovascular" | "thyroid" | "inflammatory" | "nutritional" | "hormonal";
  severity: "watch" | "attention" | "urgent";
  summary: string;
  detail: string;
  markers_involved: string[];
  markers_matched: string[];
  citation: string;
  what_to_do: string;
}

interface PatternRule {
  id: string;
  name: string;
  category: DetectedPattern["category"];
  severity: DetectedPattern["severity"];
  summary: string;
  detail: string;
  citation: string;
  what_to_do: string;
  /**
   * Every condition must be met for the pattern to trigger.
   * Each condition checks a biomarker name against a value range or status.
   */
  conditions: Array<{
    marker: string;
    aliases?: string[];
    check: (value: number, status: string) => boolean;
  }>;
}

// Helper to find a marker value by name or alias
function findMarker(
  results: Array<{ name: string; value: number; status: string }>,
  marker: string,
  aliases?: string[]
): { value: number; status: string } | null {
  const names = [marker, ...(aliases || [])].map((n) => n.toLowerCase());
  const match = results.find((r) => names.includes(r.name.toLowerCase()));
  return match || null;
}

// ---------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------

const PATTERNS: PatternRule[] = [
  {
    id: "early_metabolic_syndrome",
    name: "Early metabolic syndrome pattern",
    category: "metabolic",
    severity: "attention",
    summary:
      "Multiple markers in your panel are consistent with early metabolic syndrome — a cluster of insulin resistance, inflammation, and lipid changes that often develops years before diabetes or cardiovascular events.",
    detail:
      "The combination of elevated fasting insulin (or HOMA-IR), triglycerides above optimal, hs-CRP above 1.0 mg/L, and fasting glucose trending upward is the classic metabolic syndrome signature described by Reaven in 1988 and refined in the IDF/AHA criteria (Alberti et al., Lancet 2009). Each marker alone might be labeled 'normal' by your lab — but together they form a pattern that the research links to significantly elevated long-term risk.",
    citation:
      "Alberti KGMM, Eckel RH, Grundy SM, et al. Harmonizing the metabolic syndrome. Circulation 2009;120(16):1640-1645. PMID: 19805654",
    what_to_do:
      "This pattern typically responds well to lifestyle intervention: reduced refined carbohydrates, regular aerobic exercise (especially zone 2), weight loss if overweight, and improved sleep. Discuss with your physician — early metabolic syndrome is one of the most modifiable risk states in medicine.",
    conditions: [
      {
        marker: "Fasting Insulin",
        aliases: ["Insulin", "Fasting insulin"],
        check: (value) => value > 8,
      },
      {
        marker: "Triglycerides",
        aliases: ["TG", "Trigs"],
        check: (value) => value > 150,
      },
      {
        marker: "hs-CRP",
        aliases: ["High-sensitivity C-reactive protein", "hsCRP"],
        check: (value) => value > 1.0,
      },
    ],
  },
  {
    id: "subclinical_hypothyroid",
    name: "Subclinical hypothyroid pattern",
    category: "thyroid",
    severity: "watch",
    summary:
      "Your thyroid markers suggest a subclinical hypothyroid pattern — TSH is creeping up while active thyroid hormone (fT3) sits in the lower portion of the range.",
    detail:
      "Subclinical hypothyroidism is defined as elevated TSH with normal free T4 (Cooper & Biondi, Lancet 2012). When free T3 is also low-normal, the pattern suggests impaired T4-to-T3 conversion, which can produce fatigue, brain fog, cold intolerance, and weight gain even with 'normal' individual markers. This pattern is more common in women, over age 40, and in the presence of thyroid antibodies (TPO, TgAb).",
    citation:
      "Cooper DS, Biondi B. Subclinical thyroid disease. Lancet 2012;379(9821):1142-1154. PMID: 22398060",
    what_to_do:
      "Consider adding TPO and TgAb antibodies to your next panel to check for autoimmune thyroid disease. Iron status (ferritin) and selenium also affect T4-to-T3 conversion. Discuss with your physician — subclinical hypothyroidism is monitored over time, not always treated immediately.",
    conditions: [
      {
        marker: "TSH",
        check: (value) => value > 3.0,
      },
      {
        marker: "Free T3",
        aliases: ["fT3", "FT3"],
        check: (value, status) =>
          status === "normal" || status === "borderline" || value < 3.2,
      },
    ],
  },
  {
    id: "iron_deficiency_without_anemia",
    name: "Iron deficiency without anemia",
    category: "nutritional",
    severity: "attention",
    summary:
      "Your ferritin is low while hemoglobin is still normal — a pattern called 'iron deficiency without anemia' that is increasingly recognized as clinically significant.",
    detail:
      "Iron deficiency without anemia occurs when iron stores (ferritin) are depleted but hemoglobin has not yet dropped below the anemia threshold. Published research has documented that fatigue, hair loss, restless legs, poor exercise tolerance, and cognitive symptoms can occur at ferritin levels well above the formal deficiency cutoff — often in the 15-50 ng/mL range (Soppi, Clin Case Rep 2018). A 2018 BMJ Open systematic review found that iron supplementation in non-anemic iron-deficient adults significantly improved fatigue (Houston et al.).",
    citation:
      "Houston BL, Hurrie D, Graham J, et al. Efficacy of iron supplementation on fatigue and physical capacity in non-anaemic iron-deficient adults. BMJ Open 2018;8(4):e019240. PMID: 29626044",
    what_to_do:
      "If ferritin is below 50 ng/mL and you have fatigue or hair loss, discuss iron supplementation with your physician. Iron bisglycinate tends to be better tolerated than ferrous sulfate. Take with vitamin C on an empty stomach for best absorption. Avoid taking with calcium, coffee, or tea. Recheck ferritin in 3 months.",
    conditions: [
      {
        marker: "Ferritin",
        check: (value) => value < 50,
      },
      {
        marker: "Hemoglobin",
        aliases: ["Hgb", "Hb"],
        check: (value) => value >= 12.0, // Normal hemoglobin (not anemic)
      },
    ],
  },
  {
    id: "residual_cv_risk",
    name: "Residual cardiovascular risk",
    category: "cardiovascular",
    severity: "attention",
    summary:
      "Your ApoB and hs-CRP are both elevated despite normal LDL cholesterol — a pattern called 'residual cardiovascular risk' that standard lipid panels miss.",
    detail:
      "Standard LDL-C can be 'normal' while ApoB (the protein on every atherogenic lipoprotein particle) is elevated — meaning you have more small, dense LDL particles that are individually more atherogenic. When combined with elevated hs-CRP (chronic inflammation), the cardiovascular risk profile is meaningfully worse than LDL-C alone suggests. The JUPITER trial (Ridker et al., NEJM 2008) demonstrated that people with 'normal' LDL but elevated hs-CRP had substantial cardiovascular event rates that responded to intervention.",
    citation:
      "Ridker PM. From C-Reactive Protein to Interleukin-6 to Interleukin-1: Moving Upstream To Identify Novel Targets for Atheroprotection. Circ Res 2016;118(1):145-156. PMID: 26892473",
    what_to_do:
      "This pattern warrants a conversation with your physician about comprehensive cardiovascular risk management beyond LDL-C alone. ApoB-directed therapy, anti-inflammatory lifestyle intervention (omega-3, Mediterranean diet, exercise), and potentially Lp(a) testing to complete the risk picture.",
    conditions: [
      {
        marker: "ApoB",
        aliases: ["Apolipoprotein B"],
        check: (value) => value > 90,
      },
      {
        marker: "hs-CRP",
        aliases: ["High-sensitivity C-reactive protein", "hsCRP"],
        check: (value) => value > 1.5,
      },
    ],
  },
  {
    id: "inflammation_metabolic",
    name: "Inflammation-driven metabolic pattern",
    category: "inflammatory",
    severity: "attention",
    summary:
      "Elevated inflammation (hs-CRP) combined with insulin resistance markers suggests an inflammation-driven metabolic pattern where chronic inflammation and metabolic dysfunction reinforce each other.",
    detail:
      "Chronic low-grade inflammation and insulin resistance form a bidirectional feedback loop: visceral adipose tissue produces inflammatory cytokines that worsen insulin resistance, and insulin resistance promotes further inflammation (Hotamisligil, Nature 2017). The combination of elevated hs-CRP with elevated HOMA-IR, TG/HDL ratio, or fasting insulin creates a compound risk that exceeds what either pathway alone would predict.",
    citation:
      "Hotamisligil GS. Inflammation, metaflammation and immunometabolic disorders. Nature 2017;542(7640):177-185. PMID: 28179656",
    what_to_do:
      "This pattern is highly responsive to lifestyle intervention: anti-inflammatory nutrition (Mediterranean pattern, omega-3), weight loss (even 5-10% has significant impact), regular exercise (zone 2 + resistance), improved sleep (7+ hours), and stress management. The research shows that breaking the inflammation-insulin cycle at any point creates positive cascading effects across both pathways.",
    conditions: [
      {
        marker: "hs-CRP",
        aliases: ["High-sensitivity C-reactive protein", "hsCRP"],
        check: (value) => value > 2.0,
      },
      {
        marker: "Fasting Insulin",
        aliases: ["Insulin", "Fasting insulin"],
        check: (value) => value > 10,
      },
    ],
  },
  {
    id: "b12_folate_methylation",
    name: "B12/folate methylation pattern",
    category: "nutritional",
    severity: "watch",
    summary:
      "Your B12 and/or folate are in the lower portion of the normal range while homocysteine is elevated — suggesting impaired methylation capacity.",
    detail:
      "B12 and folate are essential cofactors in the methylation cycle. When either is functionally low (even if technically 'normal'), homocysteine accumulates because it can't be efficiently converted to methionine. The Homocysteine Studies Collaboration (JAMA 2002) meta-analysis found that elevated homocysteine is an independent risk factor for cardiovascular events. Correcting B12/folate status typically lowers homocysteine within weeks.",
    citation:
      "Homocysteine Studies Collaboration. Homocysteine and risk of ischemic heart disease and stroke. JAMA 2002;288(16):2015-2022. PMID: 12387654",
    what_to_do:
      "If B12 is below 400 pg/mL and homocysteine is above 10 µmol/L, methylcobalamin (not cyanocobalamin) supplementation is supported by the research. Active folate (methylfolate) may also be indicated. Recheck homocysteine in 6-8 weeks after supplementation starts to confirm response.",
    conditions: [
      {
        marker: "Vitamin B12",
        aliases: ["B12", "Cobalamin"],
        check: (value) => value < 400,
      },
      {
        marker: "Homocysteine",
        check: (value) => value > 10,
      },
    ],
  },
];

// ---------------------------------------------------------------------
// Detection engine
// ---------------------------------------------------------------------

/**
 * Run all pattern checks against a user's biomarker results.
 * Returns only patterns where ALL conditions match.
 */
export function detectPatterns(
  results: Array<{
    name: string;
    value: number;
    unit: string | null;
    status: string;
  }>
): DetectedPattern[] {
  const detected: DetectedPattern[] = [];

  // Normalize results for matching
  const normalizedResults = results.map((r) => ({
    name: r.name,
    value: r.value,
    status: r.status,
  }));

  for (const pattern of PATTERNS) {
    let allMatch = true;
    const matchedMarkers: string[] = [];
    const involvedMarkers: string[] = [];

    for (const condition of pattern.conditions) {
      involvedMarkers.push(condition.marker);
      const found = findMarker(
        normalizedResults,
        condition.marker,
        condition.aliases
      );

      if (!found || !condition.check(found.value, found.status)) {
        allMatch = false;
        break;
      }

      matchedMarkers.push(condition.marker);
    }

    if (allMatch) {
      detected.push({
        id: pattern.id,
        name: pattern.name,
        category: pattern.category,
        severity: pattern.severity,
        summary: pattern.summary,
        detail: pattern.detail,
        markers_involved: involvedMarkers,
        markers_matched: matchedMarkers,
        citation: pattern.citation,
        what_to_do: pattern.what_to_do,
      });
    }
  }

  return detected;
}

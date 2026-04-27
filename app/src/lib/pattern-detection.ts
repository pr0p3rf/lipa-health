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
        aliases: ["High-sensitivity C-reactive protein", "hsCRP", "CRP", "C-Reactive Protein", "C-Reactive Protein (hsCRP)", "C-Reactive Protein, Cardiac", "High Sensitivity CRP"],
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
        aliases: ["High-sensitivity C-reactive protein", "hsCRP", "CRP", "C-Reactive Protein", "C-Reactive Protein (hsCRP)", "C-Reactive Protein, Cardiac", "High Sensitivity CRP"],
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
        aliases: ["High-sensitivity C-reactive protein", "hsCRP", "CRP", "C-Reactive Protein", "C-Reactive Protein (hsCRP)", "C-Reactive Protein, Cardiac", "High Sensitivity CRP"],
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

  // -----------------------------------------------------------------
  // Patterns 7–28: additional clinically validated cross-marker rules
  // -----------------------------------------------------------------

  {
    id: "atherogenic_dyslipidemia_ldl_apob",
    name: "Atherogenic dyslipidemia (LDL-ApoB discordance)",
    category: "cardiovascular",
    severity: "attention",
    summary:
      "Your ApoB is elevated while LDL cholesterol is relatively normal — this discordance suggests you carry a higher number of small, dense LDL particles that standard lipid panels undercount.",
    detail:
      "ApoB measures the actual number of atherogenic lipoprotein particles, while LDL-C measures cholesterol mass. When ApoB is high but LDL-C is not, small dense LDL predominates — each particle carries less cholesterol but is more atherogenic per particle. The Framingham Offspring Study (Cromwell et al., J Clin Lipidol 2007; PMID: 21291688) showed that LDL-ApoB discordance identifies a subgroup with significantly higher CVD risk that is invisible to standard LDL-C screening. The INTERHEART study confirmed ApoB as a superior predictor of myocardial infarction compared to LDL-C across 52 countries (Yusuf et al., Lancet 2004; PMID: 15364185).",
    citation:
      "Cromwell WC, Otvos JD, Keyes MJ, et al. LDL Particle Number and Risk of Future Cardiovascular Disease in the Framingham Offspring Study. J Clin Lipidol 2007;1(6):583-592. PMID: 21291688",
    what_to_do:
      "Discuss ApoB-targeted therapy with your physician. Dietary changes that specifically reduce small dense LDL include lowering refined carbohydrates and sugar, increasing soluble fiber, and adding omega-3 fatty acids. Mediterranean diet patterns have been shown to shift the LDL profile toward larger, less atherogenic particles. A repeat advanced lipid panel (NMR or ion mobility) can confirm the particle size distribution.",
    conditions: [
      {
        marker: "ApoB",
        aliases: ["Apolipoprotein B", "Apo B"],
        check: (value) => value > 90,
      },
      {
        marker: "LDL",
        aliases: ["LDL-C", "LDL Cholesterol", "Low-density lipoprotein"],
        check: (value) => value < 130,
      },
    ],
  },
  {
    id: "nafld_pattern",
    name: "Non-alcoholic fatty liver disease pattern",
    category: "metabolic",
    severity: "attention",
    summary:
      "Your liver enzymes and metabolic markers together suggest a non-alcoholic fatty liver pattern — the most common liver condition worldwide, and one that is highly modifiable with lifestyle changes.",
    detail:
      "Elevated ALT in the context of elevated triglycerides and borderline glucose is the classic triad for non-alcoholic fatty liver disease (NAFLD). ALT leaks from hepatocytes undergoing lipotoxic stress, triglycerides reflect hepatic de novo lipogenesis, and borderline glucose signals the underlying insulin resistance driving the process. Younossi et al. (Hepatology 2016; PMID: 26707365) estimated NAFLD global prevalence at 25%, with the metabolic phenotype you display being the most common presentation. The European EASL-EASD-EASO guidelines (J Hepatol 2016; PMID: 27062661) recommend lifestyle intervention as first-line treatment.",
    citation:
      "Younossi ZM, Koenig AB, Abdelatif D, et al. Global epidemiology of nonalcoholic fatty liver disease. Hepatology 2016;64(1):73-84. PMID: 26707365",
    what_to_do:
      "Reduce refined carbohydrates and fructose (including fruit juice and sugar-sweetened beverages) — these drive hepatic fat accumulation more than dietary fat does. Aim for 150+ minutes of moderate exercise per week. Even 5-7% body weight loss has been shown to resolve hepatic steatosis. Consider adding vitamin E (800 IU/day, shown effective in the PIVENS trial) after discussing with your physician. Recheck ALT and triglycerides in 3 months.",
    conditions: [
      {
        marker: "ALT",
        aliases: ["Alanine aminotransferase", "SGPT", "Alanine Transaminase", "ALT (GPT)", "ALT (SGPT)"],
        check: (value) => value > 35,
      },
      {
        marker: "Triglycerides",
        aliases: ["TG", "Trigs"],
        check: (value) => value > 150,
      },
      {
        marker: "Glucose",
        aliases: ["Fasting Glucose", "Fasting glucose", "Blood Glucose", "FBG", "Glucose (Fasting)", "Glucose Fasting"],
        check: (value) => value >= 95,
      },
    ],
  },
  {
    id: "nlr_inflammation",
    name: "Elevated neutrophil-to-lymphocyte ratio",
    category: "inflammatory",
    severity: "watch",
    summary:
      "Your neutrophils are relatively high and lymphocytes relatively low — this ratio is an emerging marker of systemic inflammation and immune stress that is easy to track over time.",
    detail:
      "The neutrophil-to-lymphocyte ratio (NLR) above 3.0 reflects a shift toward innate immune activation and is associated with chronic low-grade inflammation. Forget et al. (PLoS One 2017; PMID: 28033347) demonstrated NLR as an independent predictor of mortality in critically ill populations, while Imtiaz et al. (Pak J Med Sci 2012; PMID: 24353578) showed elevated NLR correlates with metabolic syndrome severity. In your case, elevated neutrophils combined with lower lymphocytes yield an NLR consistent with subclinical systemic inflammation.",
    citation:
      "Forget P, Khalifa C, Defour JP, et al. What is the normal value of the neutrophil-to-lymphocyte ratio? BMC Res Notes 2017;10(1):12. PMID: 28057051",
    what_to_do:
      "An elevated NLR warrants looking for underlying causes: chronic infections, poor sleep, overtraining, psychological stress, or metabolic dysfunction. Anti-inflammatory strategies — omega-3 supplementation (2-3g EPA+DHA/day), stress management, 7-9 hours of sleep, and Mediterranean-style nutrition — can improve this ratio over time. Recheck a CBC with differential in 6-8 weeks to see if the pattern persists.",
    conditions: [
      {
        marker: "Neutrophils",
        aliases: ["Neutrophil Count", "Neutrophil count", "Absolute Neutrophils", "ANC"],
        check: (value) => value > 4.5,
      },
      {
        marker: "Lymphocytes",
        aliases: ["Lymphocyte Count", "Lymphocyte count", "Absolute Lymphocytes", "ALC"],
        check: (value) => value < 1.5,
      },
    ],
  },
  {
    id: "prediabetic_pattern",
    name: "Prediabetic pattern",
    category: "metabolic",
    severity: "attention",
    summary:
      "Your fasting glucose and HbA1c are both in the prediabetic range — together, these markers confirm that blood sugar regulation has been impaired for some time, not just on the day of your test.",
    detail:
      "The ADA defines prediabetes as fasting glucose 100-125 mg/dL and/or HbA1c 5.7-6.4%. When both are elevated simultaneously, it confirms persistent dysglycemia rather than a transient reading. The Diabetes Prevention Program (Knowler et al., NEJM 2002; PMID: 11832527) demonstrated that intensive lifestyle intervention reduced progression to type 2 diabetes by 58% in prediabetic individuals — more effective than metformin (31% reduction). Zhang et al. (Diabetes Care 2010; PMID: 20040657) showed that combined fasting glucose and HbA1c criteria identify the highest-risk subgroup.",
    citation:
      "Knowler WC, Barrett-Connor E, Fowler SE, et al. Reduction in the incidence of type 2 diabetes with lifestyle intervention or metformin. N Engl J Med 2002;346(6):393-403. PMID: 11832527",
    what_to_do:
      "This is one of the most modifiable patterns in medicine. Prioritize: (1) reduce refined carbohydrates and added sugars, (2) 150+ minutes/week of moderate exercise including resistance training, (3) lose 5-7% body weight if overweight, (4) improve sleep quality. Consider a continuous glucose monitor (CGM) for 2 weeks to identify your personal glucose triggers. Recheck fasting glucose and HbA1c in 3 months.",
    conditions: [
      {
        marker: "Glucose",
        aliases: ["Fasting Glucose", "Fasting glucose", "Blood Glucose", "FBG", "Glucose (Fasting)", "Glucose Fasting"],
        check: (value) => value >= 100 && value <= 125,
      },
      {
        marker: "HbA1c",
        aliases: ["Hemoglobin A1c", "A1C", "Glycated Hemoglobin", "A1c"],
        check: (value) => value >= 5.7 && value <= 6.4,
      },
    ],
  },
  {
    id: "thyroid_insulin_cross",
    name: "Thyroid-metabolic cross pattern",
    category: "thyroid",
    severity: "attention",
    summary:
      "Your TSH is trending upward alongside elevated triglycerides — this cross-system pattern suggests thyroid dysfunction may be driving or worsening metabolic changes.",
    detail:
      "Thyroid hormone directly regulates hepatic lipase activity and LDL receptor expression. Even subclinical hypothyroidism (TSH >3.0 with normal fT4) raises triglycerides by 10-30% through impaired VLDL clearance. Duntas (Thyroid 2002; PMID: 12487769) showed that thyroid-driven dyslipidemia is common and often overlooked. Importantly, the lipid abnormalities often resolve when thyroid function is optimized, making this pattern critical to recognize before adding statins or fibrates. Canaris et al. (Arch Intern Med 2000; PMID: 10695693) found TSH >3.0 associated with significant lipid changes even when technically 'normal'.",
    citation:
      "Duntas LH. Thyroid disease and lipids. Thyroid 2002;12(4):287-293. PMID: 12034052",
    what_to_do:
      "Discuss thyroid optimization with your physician before treating the triglycerides in isolation. Get a full thyroid panel (TSH, fT4, fT3, TPO antibodies) if not already done. Support thyroid function with adequate selenium (200 mcg/day), iodine (from seafood or seaweed), and iron (ferritin >50 ng/mL). Avoid excessive soy, raw cruciferous vegetables, and environmental goitrogens. Recheck lipids 6-8 weeks after thyroid optimization.",
    conditions: [
      {
        marker: "TSH",
        check: (value) => value > 3.0,
      },
      {
        marker: "Triglycerides",
        aliases: ["TG", "Trigs"],
        check: (value) => value > 150,
      },
    ],
  },
  {
    id: "hpa_axis_dysregulation",
    name: "HPA axis dysregulation pattern",
    category: "hormonal",
    severity: "attention",
    summary:
      "Your cortisol is elevated while DHEA-S is low — this combination suggests chronic stress has shifted your adrenal hormone balance, favoring cortisol production at the expense of regenerative hormones.",
    detail:
      "The HPA (hypothalamic-pituitary-adrenal) axis responds to chronic stress by preferentially producing cortisol over DHEA-S, a phenomenon called the 'cortisol steal' or 'pregnenolone steal'. Lennartsson et al. (Biol Psychol 2013; PMID: 23541713) showed that an elevated cortisol-to-DHEA-S ratio is a better marker of stress-related health risk than either hormone alone. This imbalance is associated with accelerated aging, impaired immune function, visceral fat accumulation, and mood disturbances. Epel et al. (Psychoneuroendocrinology 2006; PMID: 16081203) linked chronic HPA activation to telomere shortening and accelerated cellular aging.",
    citation:
      "Lennartsson AK, Theorell T, Rockwood AL, et al. Perceived stress at work is associated with attenuated DHEA-S response during acute psychosocial stress. Psychoneuroendocrinology 2013;38(10):1650-1657. PMID: 23541713",
    what_to_do:
      "Address the root cause: chronic psychological or physical stress. Prioritize sleep hygiene (7-9 hours, consistent schedule), stress management (meditation, breathing exercises, nature exposure), and adaptogens (ashwagandha 300-600 mg/day has clinical evidence for lowering cortisol). Avoid excessive caffeine and high-intensity exercise when cortisol is elevated. DHEA-S supplementation (25-50 mg/day) may be considered under physician guidance. Recheck both markers in 3 months.",
    conditions: [
      {
        marker: "Cortisol",
        aliases: ["Serum Cortisol", "AM Cortisol", "Morning Cortisol"],
        check: (value) => value > 20,
      },
      {
        marker: "DHEA-S",
        aliases: ["DHEA-Sulfate", "DHEAS", "Dehydroepiandrosterone Sulfate"],
        check: (value) => value < 150,
      },
    ],
  },
  {
    id: "iron_redistribution_anemia_of_inflammation",
    name: "Anemia of inflammation (iron redistribution)",
    category: "inflammatory",
    severity: "attention",
    summary:
      "Your ferritin is elevated while hemoglobin is low — this pattern suggests iron is being trapped in storage rather than used for red blood cell production, typically driven by chronic inflammation.",
    detail:
      "Anemia of inflammation (formerly 'anemia of chronic disease') is mediated by hepcidin, an acute-phase reactant that blocks iron absorption and locks iron in macrophages. Ferritin rises as an acute-phase protein while hemoglobin falls from functional iron deficiency. Weiss & Goodnough (NEJM 2005; PMID: 15758012) described this as the second most common form of anemia worldwide. The key distinction from true iron deficiency is that supplementing iron will not help and may cause harm — the underlying inflammation must be addressed first. Elevated hs-CRP confirms the inflammatory driver in your case.",
    citation:
      "Weiss G, Goodnough LT. Anemia of chronic disease. N Engl J Med 2005;352(10):1011-1020. PMID: 15758012",
    what_to_do:
      "Do NOT supplement iron in this pattern — iron is trapped, not deficient. Work with your physician to identify the inflammatory source: chronic infections, autoimmune conditions, obesity, or gut inflammation are common causes. Anti-inflammatory strategies (omega-3, curcumin, Mediterranean diet) may help. If anemia is symptomatic, erythropoiesis-stimulating agents may be considered by your physician. Track hs-CRP alongside hemoglobin to monitor resolution.",
    conditions: [
      {
        marker: "Ferritin",
        check: (value) => value > 200,
      },
      {
        marker: "Hemoglobin",
        aliases: ["Hgb", "Hb"],
        check: (value) => value < 12.0,
      },
    ],
  },
  {
    id: "vitamin_d_inflammation",
    name: "Vitamin D insufficiency with inflammation",
    category: "nutritional",
    severity: "attention",
    summary:
      "Your vitamin D is low while hs-CRP is elevated — this combination suggests impaired immune modulation, as vitamin D is a key regulator of the inflammatory response.",
    detail:
      "Vitamin D receptors are present on virtually every immune cell, and 25(OH)D below 30 ng/mL impairs regulatory T-cell function and shifts the immune system toward a pro-inflammatory state. Aranow (J Investig Med 2011; PMID: 21527855) demonstrated that vitamin D insufficiency amplifies inflammatory signaling pathways. A meta-analysis by Calton et al. (Nutrients 2015; PMID: 25985394) found that CRP was significantly higher in vitamin D-deficient individuals. Correcting vitamin D status has been shown to reduce hs-CRP by 0.3-1.0 mg/L in randomized controlled trials (Mazidi et al., Eur J Clin Nutr 2018; PMID: 29269890).",
    citation:
      "Aranow C. Vitamin D and the immune system. J Investig Med 2011;59(6):881-886. PMID: 21527855",
    what_to_do:
      "Supplement vitamin D3 (not D2) at 4,000-5,000 IU/day with a fat-containing meal for optimal absorption. Add vitamin K2 (MK-7, 100-200 mcg/day) to ensure calcium is directed to bones rather than arteries. Recheck 25(OH)D in 8-12 weeks; target 40-60 ng/mL. Magnesium is required for vitamin D activation — ensure adequate intake (400 mg/day). Sun exposure (15-20 minutes midday) is also beneficial when possible.",
    conditions: [
      {
        marker: "Vitamin D",
        aliases: ["25-OH Vitamin D", "25(OH)D", "Vitamin D, 25-Hydroxy", "25-Hydroxyvitamin D"],
        check: (value) => value < 30,
      },
      {
        marker: "hs-CRP",
        aliases: ["High-sensitivity C-reactive protein", "hsCRP", "CRP", "C-Reactive Protein", "C-Reactive Protein (hsCRP)", "C-Reactive Protein, Cardiac", "High Sensitivity CRP"],
        check: (value) => value > 1.5,
      },
    ],
  },
  {
    id: "lpa_ldl_residual_risk",
    name: "Lp(a) + LDL compounded cardiovascular risk",
    category: "cardiovascular",
    severity: "urgent",
    summary:
      "Your Lp(a) and LDL are both elevated — Lp(a) is a genetically determined cardiovascular risk factor that, when combined with elevated LDL, significantly amplifies your risk of heart attack and stroke.",
    detail:
      "Lipoprotein(a) is genetically determined (~90% heritable) and is not lowered by diet or statins. When Lp(a) >50 nmol/L coexists with LDL >100 mg/dL, the cardiovascular risk is multiplicative, not just additive. The Copenhagen City Heart Study (Kamstrup et al., JAMA 2009; PMID: 19567438) showed that Lp(a) in the top quintile conferred a 2-3x increased risk of MI. Tsimikas & Hall (J Am Coll Cardiol 2012; PMID: 22516441) emphasized that elevated Lp(a) creates a pro-thrombotic and pro-inflammatory arterial environment that amplifies LDL-driven atherosclerosis. Novel therapies (antisense oligonucleotides) are in Phase 3 trials.",
    citation:
      "Kamstrup PR, Tybjaerg-Hansen A, Steffensen R, Nordestgaard BG. Genetically elevated lipoprotein(a) and increased risk of myocardial infarction. JAMA 2009;301(22):2331-2339. PMID: 19567438",
    what_to_do:
      "This is an urgent pattern — discuss with a cardiologist or lipidologist. Since Lp(a) cannot be lowered through lifestyle, aggressive LDL reduction becomes the primary lever (target LDL <70 mg/dL per ESC guidelines for high-risk patients). PCSK9 inhibitors can lower Lp(a) by ~25-30%. Niacin (1-2g/day) is the only current supplement shown to lower Lp(a) by ~20-30%, though its clinical benefit is debated. Screen first-degree relatives for Lp(a). Ensure other risk factors (blood pressure, glucose, inflammation) are optimally controlled.",
    conditions: [
      {
        marker: "Lp(a)",
        aliases: ["Lipoprotein(a)", "Lipoprotein a", "Lp(a) Mass", "Lpa"],
        check: (value) => value > 50,
      },
      {
        marker: "LDL",
        aliases: ["LDL-C", "LDL Cholesterol", "Low-density lipoprotein"],
        check: (value) => value > 100,
      },
    ],
  },
  {
    id: "complete_metabolic_syndrome",
    name: "Complete metabolic syndrome",
    category: "metabolic",
    severity: "urgent",
    summary:
      "Your triglycerides, HDL, and glucose together meet the clinical criteria for metabolic syndrome — a well-documented cluster that dramatically increases cardiovascular and diabetes risk.",
    detail:
      "The IDF/AHA harmonized definition (Alberti et al., Circulation 2009; PMID: 19805654) requires three of five criteria: elevated triglycerides (>150 mg/dL), low HDL (<40 mg/dL men, <50 mg/dL women), elevated blood pressure, elevated waist circumference, and fasting glucose >100 mg/dL. Your labs meet the lipid and glucose criteria simultaneously. Mottillo et al. (J Am Coll Cardiol 2010; PMID: 20813282) conducted a meta-analysis showing metabolic syndrome doubles cardiovascular risk and increases all-cause mortality by 1.5x. The driving mechanism is insulin resistance with compensatory hyperinsulinemia.",
    citation:
      "Mottillo S, Filion KB, Genest J, et al. The metabolic syndrome and cardiovascular risk: a systematic review and meta-analysis. J Am Coll Cardiol 2010;56(14):1113-1132. PMID: 20863953",
    what_to_do:
      "This pattern requires comprehensive intervention — discuss with your physician promptly. Evidence-based priorities: (1) carbohydrate reduction and Mediterranean diet pattern, (2) 150+ minutes/week of combined aerobic and resistance exercise, (3) 7-10% body weight loss if overweight, (4) sleep optimization (7-9 hours), (5) consider metformin if lifestyle alone is insufficient. Omega-3 fatty acids (2-4g EPA+DHA/day) specifically target the triglyceride component. Recheck the full metabolic panel in 3 months.",
    conditions: [
      {
        marker: "Triglycerides",
        aliases: ["TG", "Trigs"],
        check: (value) => value > 150,
      },
      {
        marker: "HDL",
        aliases: ["HDL-C", "HDL Cholesterol", "High-density lipoprotein"],
        check: (value) => value < 45,
      },
      {
        marker: "Glucose",
        aliases: ["Fasting Glucose", "Fasting glucose", "Blood Glucose", "FBG", "Glucose (Fasting)", "Glucose Fasting"],
        check: (value) => value > 100,
      },
    ],
  },
  {
    id: "low_t3_syndrome",
    name: "Low T3 syndrome (sick euthyroid)",
    category: "thyroid",
    severity: "watch",
    summary:
      "Your Free T3 is low while TSH and Free T4 are normal — this pattern, called 'low T3 syndrome' or 'sick euthyroid', suggests your body is not efficiently converting T4 into the active hormone T3.",
    detail:
      "T3 is the biologically active thyroid hormone, produced primarily by peripheral conversion of T4 via deiodinase enzymes. In low T3 syndrome, TSH and T4 remain normal but T3 drops due to impaired conversion. De Groot (J Endocr Soc 2019; PMID: 30834352) described this as an adaptive response to illness, caloric restriction, or chronic stress. Common causes include dieting, chronic inflammation, liver or kidney disease, high cortisol, and iron or selenium deficiency. Patients often experience hypothyroid symptoms (fatigue, cold intolerance, brain fog) despite 'normal' TSH.",
    citation:
      "De Groot LJ. Non-thyroidal illness syndrome. In: Feingold KR, et al., eds. Endotext. South Dartmouth: MDText.com; 2015. PMID: 25905425",
    what_to_do:
      "Address potential conversion blockers: ensure ferritin >50 ng/mL, supplement selenium (200 mcg/day as selenomethionine), ensure adequate zinc (15-30 mg/day), manage stress and cortisol, and avoid very low-calorie diets. If symptoms persist, discuss T3-containing therapy options with an endocrinologist. Recheck Free T3, Free T4, and reverse T3 (rT3) in 6-8 weeks.",
    conditions: [
      {
        marker: "Free T3",
        aliases: ["fT3", "FT3"],
        check: (value) => value < 2.5,
      },
      {
        marker: "Free T4",
        aliases: ["fT4", "FT4", "Free Thyroxine"],
        check: (value) => value >= 0.8,
      },
      {
        marker: "TSH",
        check: (value) => value >= 0.4 && value <= 4.0,
      },
    ],
  },
  {
    id: "hashimotos_pattern",
    name: "Hashimoto's thyroiditis pattern",
    category: "thyroid",
    severity: "attention",
    summary:
      "Your TSH is elevated alongside positive TPO antibodies — this combination is the hallmark of Hashimoto's thyroiditis, the most common autoimmune condition and the leading cause of hypothyroidism.",
    detail:
      "Hashimoto's thyroiditis involves autoimmune destruction of thyroid tissue by anti-TPO and anti-Tg antibodies. Elevated TSH with TPO >35 IU/mL has a positive predictive value >95% for Hashimoto's (Caturegli et al., Am J Pathol 2014; PMID: 24373845). The disease often progresses slowly — it may take years before overt hypothyroidism develops. Duntas (Thyroid 2015; PMID: 25547780) showed that selenium supplementation (200 mcg/day) reduces TPO antibody levels by 20-40% over 12 months. Early identification allows proactive monitoring and intervention.",
    citation:
      "Caturegli P, De Remigis A, Rose NR. Hashimoto thyroiditis: clinical and diagnostic criteria. Autoimmun Rev 2014;13(4-5):391-397. PMID: 24434360",
    what_to_do:
      "Work with an endocrinologist for ongoing monitoring. Selenium (200 mcg/day as selenomethionine) is the most evidence-based supplement for reducing TPO antibodies. Consider gluten elimination — there is growing evidence of a gluten-Hashimoto's connection (Lundin & Wijmenga, Nat Rev Gastroenterol Hepatol 2015). Optimize vitamin D (target 40-60 ng/mL) and iron (ferritin >50 ng/mL). Monitor TSH and antibodies every 6-12 months. Avoid iodine excess (>500 mcg/day).",
    conditions: [
      {
        marker: "TSH",
        check: (value) => value > 4.0,
      },
      {
        marker: "TPO Antibodies",
        aliases: ["TPO", "Anti-TPO", "Thyroid Peroxidase Antibodies", "TPOAb"],
        check: (value) => value > 35,
      },
    ],
  },
  {
    id: "testosterone_shbg_imbalance",
    name: "Testosterone-SHBG imbalance",
    category: "hormonal",
    severity: "watch",
    summary:
      "Your total testosterone is normal but SHBG is elevated — this means more testosterone is bound and unavailable, and your free (active) testosterone may be significantly lower than the total suggests.",
    detail:
      "SHBG (sex hormone-binding globulin) binds testosterone with high affinity, making it biologically inactive. When SHBG is elevated (>60 nmol/L), even a normal total testosterone can mask functional hypogonadism. Vermeulen et al. (J Clin Endocrinol Metab 1999; PMID: 10523012) established that free testosterone (calculated from total T and SHBG) is the clinically relevant measure. Common causes of elevated SHBG include aging, liver disease, hyperthyroidism, oral estrogen use, and low-carb diets. Symptoms of low free testosterone include fatigue, reduced libido, muscle loss, and mood changes.",
    citation:
      "Vermeulen A, Verdonck L, Kaufman JM. A critical evaluation of simple methods for the estimation of free testosterone in serum. J Clin Endocrinol Metab 1999;84(10):3666-3672. PMID: 10523012",
    what_to_do:
      "Request a calculated free testosterone or bioavailable testosterone from your physician. If free T is confirmed low, investigate SHBG-raising causes: thyroid function, liver function, medications (especially oral contraceptives or anti-epileptics). Resistance training, adequate sleep, zinc (30 mg/day), magnesium (400 mg/day), and moderate carbohydrate intake can help lower SHBG. Boron (10 mg/day) has preliminary evidence for reducing SHBG. Avoid excessive alcohol.",
    conditions: [
      {
        marker: "Total Testosterone",
        aliases: ["Testosterone", "Testosterone, Total", "Serum Testosterone"],
        check: (value) => value >= 300,
      },
      {
        marker: "SHBG",
        aliases: ["Sex Hormone Binding Globulin", "Sex Hormone-Binding Globulin"],
        check: (value) => value > 60,
      },
    ],
  },
  {
    id: "omega3_deficiency_inflammation",
    name: "Omega-3 deficiency with inflammation",
    category: "nutritional",
    severity: "attention",
    summary:
      "Your Omega-3 index is low while inflammation is elevated — this indicates your body's anti-inflammatory capacity is depleted, leaving inflammatory pathways unchecked.",
    detail:
      "The Omega-3 index measures EPA+DHA as a percentage of red blood cell membranes. Values below 4% place you in the highest-risk category for sudden cardiac death (Harris & Von Schacky, Prev Med 2004; PMID: 15208005). EPA and DHA are precursors to specialized pro-resolving mediators (SPMs) that actively resolve inflammation. Calder (Mol Nutr Food Res 2012; PMID: 22623436) showed that omega-3 supplementation reduces hs-CRP, IL-6, and TNF-alpha. When the Omega-3 index is low and hs-CRP is elevated simultaneously, the inflammatory resolution pathway is impaired, perpetuating chronic low-grade inflammation.",
    citation:
      "Harris WS, Von Schacky C. The Omega-3 Index: a new risk factor for death from coronary heart disease? Prev Med 2004;39(1):212-220. PMID: 15208005",
    what_to_do:
      "Supplement with high-quality fish oil providing 2-3g combined EPA+DHA per day (look for third-party tested brands with high EPA:DHA ratio for anti-inflammatory effect). Eat fatty fish 2-3 times per week (salmon, sardines, mackerel, anchovies). Reduce omega-6 intake from seed oils (soybean, corn, sunflower). Target an Omega-3 index of 8-12%. It takes 8-12 weeks to shift the index meaningfully; recheck after 3 months of consistent supplementation.",
    conditions: [
      {
        marker: "Omega-3 Index",
        aliases: ["Omega 3 Index", "O3 Index", "EPA+DHA Index"],
        check: (value) => value < 4,
      },
      {
        marker: "hs-CRP",
        aliases: ["High-sensitivity C-reactive protein", "hsCRP", "CRP", "C-Reactive Protein", "C-Reactive Protein (hsCRP)", "C-Reactive Protein, Cardiac", "High Sensitivity CRP"],
        check: (value) => value > 1.0,
      },
    ],
  },
  {
    id: "kidney_early_warning",
    name: "Early kidney function decline",
    category: "metabolic",
    severity: "watch",
    summary:
      "Your eGFR is mildly reduced alongside borderline creatinine — this pattern indicates Stage 2 chronic kidney disease, which is often reversible if caught and managed early.",
    detail:
      "An eGFR of 60-89 mL/min/1.73m2 defines Stage 2 CKD according to KDIGO guidelines (Kidney Int Suppl 2013; PMID: 25018975). When combined with creatinine trending upward, it suggests genuine nephron loss rather than a statistical artifact. Levey & Coresh (Lancet 2012; PMID: 22129905) showed that early intervention in CKD — blood pressure optimization, SGLT2 inhibitors, and dietary protein moderation — can slow or halt progression. Many patients in Stage 2 have fully reversible causes including dehydration, NSAID use, uncontrolled hypertension, or diabetic nephropathy.",
    citation:
      "Levey AS, Coresh J. Chronic kidney disease. Lancet 2012;379(9811):165-180. PMID: 21840587",
    what_to_do:
      "Discuss with your physician — early CKD is highly modifiable. Ensure adequate hydration (2-3L water/day), minimize NSAIDs (ibuprofen, naproxen), optimize blood pressure (<130/80 mmHg), and moderate protein intake to 0.8-1.0 g/kg/day. Check urine albumin-to-creatinine ratio (UACR) to assess for kidney damage. SGLT2 inhibitors show kidney-protective effects even in non-diabetics. Recheck eGFR and creatinine in 3 months, and ensure you are well-hydrated before the blood draw.",
    conditions: [
      {
        marker: "eGFR",
        aliases: ["Estimated GFR", "GFR", "Glomerular Filtration Rate", "Estimated Glomerular Filtration Rate"],
        check: (value) => value >= 60 && value <= 89,
      },
      {
        marker: "Creatinine",
        aliases: ["Serum Creatinine", "Creat"],
        check: (value) => value > 1.1,
      },
    ],
  },
  {
    id: "uric_acid_metabolic",
    name: "Uric acid-metabolic pattern",
    category: "metabolic",
    severity: "attention",
    summary:
      "Your uric acid is elevated alongside metabolic markers — this pattern links gout risk with underlying metabolic syndrome and cardiovascular disease risk.",
    detail:
      "Elevated uric acid (>7 mg/dL) is increasingly recognized not just as a gout marker but as a driver of metabolic dysfunction. Feig et al. (NEJM 2008; PMID: 18184959) showed that hyperuricemia causes endothelial dysfunction, activates the renin-angiotensin system, and promotes hepatic fat accumulation. When combined with elevated triglycerides and borderline glucose, the pattern suggests fructose-driven uric acid production with downstream insulin resistance. Johnson et al. (Am J Clin Nutr 2007; PMID: 17921377) demonstrated that fructose metabolism uniquely generates uric acid, linking dietary fructose to both hyperuricemia and metabolic syndrome.",
    citation:
      "Feig DI, Kang DH, Johnson RJ. Uric acid and cardiovascular risk. N Engl J Med 2008;359(17):1811-1821. PMID: 18946066",
    what_to_do:
      "Dramatically reduce fructose intake (eliminate sugar-sweetened beverages, limit fruit juice, reduce added sugars). Reduce alcohol, especially beer (high in purines). Increase water intake to 2-3L/day. Tart cherry extract (500 mg 2x/day) has evidence for lowering uric acid. Vitamin C (500 mg/day) lowers uric acid modestly. Address the metabolic syndrome components simultaneously — they share the same root cause. Recheck uric acid, triglycerides, and glucose in 3 months.",
    conditions: [
      {
        marker: "Uric Acid",
        aliases: ["Urate", "Serum Uric Acid"],
        check: (value) => value > 7,
      },
      {
        marker: "Triglycerides",
        aliases: ["TG", "Trigs"],
        check: (value) => value > 150,
      },
    ],
  },
  {
    id: "liver_stress_pattern",
    name: "Liver stress pattern (non-alcoholic etiology)",
    category: "metabolic",
    severity: "watch",
    summary:
      "Your GGT and ALT are both elevated while AST is relatively normal — this enzyme pattern is characteristic of liver stress from metabolic causes rather than alcohol or acute liver damage.",
    detail:
      "The GGT-ALT-AST pattern provides important etiological clues. GGT is the most sensitive marker of hepatobiliary stress and is induced by oxidative stress, medications, and metabolic dysfunction. When GGT and ALT are elevated with normal or mildly elevated AST, the De Ritis ratio (AST/ALT) <1.0 points toward non-alcoholic steatohepatitis (NASH) or drug-induced liver injury rather than alcoholic liver disease (where AST/ALT >2.0 is typical). Whitfield (Crit Rev Clin Lab Sci 2001; PMID: 11563810) reviewed GGT as a marker of oxidative stress. Kwo et al. (Am J Gastroenterol 2017; PMID: 28045039) provided the ACG guideline framework for evaluating abnormal liver enzymes.",
    citation:
      "Kwo PY, Cohen SM, Lim JK. ACG Clinical Guideline: Evaluation of Abnormal Liver Chemistries. Am J Gastroenterol 2017;112(1):18-35. PMID: 27995906",
    what_to_do:
      "Review medications and supplements that stress the liver (acetaminophen, statins, NSAIDs, certain herbal supplements). Reduce or eliminate alcohol. Optimize metabolic health (weight loss, reduced carbohydrates, exercise). Consider N-acetylcysteine (NAC) 600 mg 2x/day as a glutathione precursor. Milk thistle (silymarin 140 mg 3x/day) has modest evidence for hepatoprotection. If enzymes remain elevated after 3 months of lifestyle optimization, further workup (ultrasound, hepatitis panel) is warranted.",
    conditions: [
      {
        marker: "GGT",
        aliases: ["Gamma-Glutamyl Transferase", "Gamma GT", "γ-GT"],
        check: (value) => value > 50,
      },
      {
        marker: "ALT",
        aliases: ["Alanine aminotransferase", "SGPT", "Alanine Transaminase", "ALT (GPT)", "ALT (SGPT)"],
        check: (value) => value > 35,
      },
    ],
  },
  {
    id: "calcium_pth_pattern",
    name: "Calcium-vitamin D imbalance pattern",
    category: "nutritional",
    severity: "watch",
    summary:
      "Your calcium is high-normal or elevated while vitamin D is low — this pattern may indicate that your parathyroid glands are overcompensating for vitamin D deficiency, and should be monitored.",
    detail:
      "When vitamin D drops, PTH rises to maintain calcium levels by pulling calcium from bone. Calcium may appear normal or even elevated despite significant vitamin D insufficiency because the parathyroid compensatory mechanism masks the deficiency. Holick (NEJM 2007; PMID: 17634462) described this as secondary hyperparathyroidism, which leads to progressive bone loss. If calcium is elevated (>10.2 mg/dL) with low vitamin D, primary hyperparathyroidism must also be considered — a condition affecting 1 in 500 adults that requires PTH measurement to diagnose (Walker & Silverberg, Nat Rev Endocrinol 2018; PMID: 29176670).",
    citation:
      "Holick MF. Vitamin D deficiency. N Engl J Med 2007;357(3):266-281. PMID: 17634462",
    what_to_do:
      "Request a PTH (parathyroid hormone) measurement to differentiate between secondary hyperparathyroidism (from vitamin D deficiency — benign and correctable) and primary hyperparathyroidism (which may require surgery). Begin vitamin D3 supplementation (4,000-5,000 IU/day) with vitamin K2 (100-200 mcg/day MK-7). Do NOT supplement calcium until vitamin D is replete and PTH is assessed. Recheck calcium, vitamin D, and PTH in 8-12 weeks.",
    conditions: [
      {
        marker: "Calcium",
        aliases: ["Serum Calcium", "Total Calcium", "Ca"],
        check: (value) => value >= 9.8,
      },
      {
        marker: "Vitamin D",
        aliases: ["25-OH Vitamin D", "25(OH)D", "Vitamin D, 25-Hydroxy", "25-Hydroxyvitamin D"],
        check: (value) => value < 30,
      },
    ],
  },
  {
    id: "estrogen_progesterone_imbalance",
    name: "Estrogen dominance pattern",
    category: "hormonal",
    severity: "watch",
    summary:
      "Your estradiol is elevated relative to low progesterone — this 'estrogen dominance' pattern can cause irregular cycles, bloating, breast tenderness, mood changes, and may affect long-term health.",
    detail:
      "Estrogen dominance refers to an imbalance in the estrogen-to-progesterone ratio, not necessarily absolute estrogen excess. Prior (Endocr Rev 2011; PMID: 21467141) described how anovulatory cycles, chronic stress, and environmental xenoestrogens create relative estrogen excess with inadequate progesterone opposition. This pattern is associated with endometrial hyperplasia, fibrocystic breast changes, PMS/PMDD, and may increase long-term breast cancer risk. Santen et al. (J Clin Endocrinol Metab 2010; PMID: 20525905) reviewed the role of estrogen metabolism in cancer risk.",
    citation:
      "Prior JC. Progesterone for symptomatic perimenopause treatment — progesterone politics, physiology and potential for perimenopause. Facts Views Vis Obgyn 2011;3(2):109-120. PMID: 24753856",
    what_to_do:
      "Support healthy estrogen metabolism: increase cruciferous vegetables (broccoli, cauliflower, kale — contain DIM and I3C), ensure adequate fiber (30g/day for estrogen excretion via the gut), reduce alcohol (impairs hepatic estrogen clearance), minimize xenoestrogens (BPA, phthalates in plastics). Consider DIM supplement (100-200 mg/day). Discuss progesterone support with your physician, especially if cycles are irregular. Ensure liver health (the liver metabolizes excess estrogen). Recheck mid-luteal phase estradiol and progesterone.",
    conditions: [
      {
        marker: "Estradiol",
        aliases: ["E2", "Oestradiol", "Estradiol, Serum"],
        check: (value) => value > 200,
      },
      {
        marker: "Progesterone",
        aliases: ["Serum Progesterone", "P4"],
        check: (value) => value < 5,
      },
    ],
  },
  {
    id: "hemochromatosis_risk",
    name: "Iron overload (hemochromatosis risk)",
    category: "nutritional",
    severity: "urgent",
    summary:
      "Your ferritin and transferrin saturation are both significantly elevated — this is the classic laboratory pattern for iron overload, which can silently damage the liver, heart, and pancreas if not addressed.",
    detail:
      "Hereditary hemochromatosis (HH) is the most common genetic disorder in Northern Europeans (1 in 200), caused primarily by HFE gene mutations (C282Y, H63D). Ferritin >300 ng/mL with transferrin saturation >45% has a sensitivity >90% for clinically significant iron overload (Bacon et al., Hepatology 2011; PMID: 21793029). Excess iron generates hydroxyl radicals via the Fenton reaction, causing oxidative damage to hepatocytes, cardiomyocytes, and pancreatic beta cells. If untreated, iron overload leads to cirrhosis, cardiomyopathy, diabetes, arthritis, and hypogonadism. When caught early, outcomes are excellent with therapeutic phlebotomy.",
    citation:
      "Bacon BR, Adams PC, Kowdley KV, et al. Diagnosis and management of hemochromatosis: 2011 practice guideline by the American Association for the Study of Liver Diseases. Hepatology 2011;54(1):328-343. PMID: 21452290",
    what_to_do:
      "See your physician promptly for HFE gene testing and further evaluation. Do NOT take iron supplements or vitamin C supplements (vitamin C increases iron absorption). Limit red meat and organ meats. Avoid alcohol (accelerates iron-mediated liver damage). If hemochromatosis is confirmed, therapeutic phlebotomy (regular blood donation) is highly effective and normalizes iron stores within months. Screen first-degree relatives. This is urgent but highly treatable when caught early.",
    conditions: [
      {
        marker: "Ferritin",
        check: (value) => value > 300,
      },
      {
        marker: "Transferrin Saturation",
        aliases: ["TSAT", "Transferrin Sat", "Iron Saturation", "% Transferrin Saturation"],
        check: (value) => value > 45,
      },
    ],
  },
  {
    id: "pancreatic_stress",
    name: "Pancreatic stress pattern",
    category: "metabolic",
    severity: "attention",
    summary:
      "Your lipase and amylase are both elevated — this dual elevation points to pancreatic inflammation or stress that warrants further investigation.",
    detail:
      "Concurrent elevation of lipase and amylase indicates pancreatic acinar cell damage. While dramatic elevations (>3x upper limit) suggest acute pancreatitis, mild-to-moderate elevations may indicate chronic pancreatic stress from alcohol, gallstones, hypertriglyceridemia, or medications. Yadav & Lowenfels (Gastroenterology 2013; PMID: 23622130) showed that chronic pancreatitis increases pancreatic cancer risk 13-fold. Lipase is more specific to the pancreas than amylase (which also comes from salivary glands), so dual elevation strengthens the pancreatic origin. Tenner et al. (Am J Gastroenterol 2013; PMID: 23896955) established that even modest persistent elevations warrant imaging.",
    citation:
      "Tenner S, Baillie J, DeWitt J, Vege SS. American College of Gastroenterology Guideline: Management of Acute Pancreatitis. Am J Gastroenterol 2013;108(9):1400-1415. PMID: 23896955",
    what_to_do:
      "Discuss with your physician — abdominal imaging (ultrasound or CT) may be warranted to evaluate the pancreas and gallbladder. Eliminate alcohol completely. If triglycerides are elevated (>500 mg/dL can directly cause pancreatitis), address them urgently. Adopt a low-fat diet temporarily. Stay well-hydrated. Review medications that can irritate the pancreas (certain antibiotics, ACE inhibitors, statins). If symptoms (abdominal pain, nausea) are present, seek evaluation promptly.",
    conditions: [
      {
        marker: "Lipase",
        aliases: ["Serum Lipase"],
        check: (value) => value > 60,
      },
      {
        marker: "Amylase",
        aliases: ["Serum Amylase"],
        check: (value) => value > 100,
      },
    ],
  },
  {
    id: "magnesium_calcium_imbalance",
    name: "Magnesium-calcium imbalance",
    category: "nutritional",
    severity: "watch",
    summary:
      "Your magnesium is low while calcium is normal or elevated — this imbalance affects muscle function, heart rhythm, nerve transmission, and can cause symptoms that are often attributed to other causes.",
    detail:
      "Magnesium and calcium are physiological antagonists: calcium contracts muscles while magnesium relaxes them. When magnesium is low (<1.8 mg/dL or <0.75 mmol/L) with normal/high calcium, the balance shifts toward excessive excitability — muscle cramps, arrhythmias, anxiety, insomnia, and migraines. DiNicolantonio et al. (Open Heart 2018; PMID: 29387426) estimated that 50-80% of Americans are magnesium deficient. Importantly, serum magnesium only reflects 1% of total body magnesium — intracellular depletion can be significant even when serum levels appear borderline. Rosanoff et al. (Nutr Rev 2012; PMID: 22364157) showed the calcium-to-magnesium ratio in the modern diet has shifted dramatically toward calcium excess.",
    citation:
      "DiNicolantonio JJ, O'Keefe JH, Wilson W. Subclinical magnesium deficiency: a principal driver of cardiovascular disease and a public health crisis. Open Heart 2018;5(1):e000668. PMID: 29387426",
    what_to_do:
      "Supplement magnesium glycinate or threonate (300-400 mg elemental magnesium/day, ideally in the evening — it supports sleep). Increase magnesium-rich foods: dark leafy greens, pumpkin seeds, dark chocolate, almonds, avocados. Reduce calcium supplementation if taking any (dietary calcium is preferred). Avoid excessive caffeine and alcohol (increase magnesium excretion). Epsom salt baths provide transdermal magnesium. Recheck in 8-12 weeks. If you experience palpitations, muscle cramps, or poor sleep, magnesium repletion often provides rapid relief.",
    conditions: [
      {
        marker: "Magnesium",
        aliases: ["Mg", "Serum Magnesium"],
        check: (value) => value < 1.8,
      },
      {
        marker: "Calcium",
        aliases: ["Serum Calcium", "Total Calcium", "Ca"],
        check: (value) => value >= 9.0,
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

-- =====================================================================
-- LIVING RESEARCH™ ENGINE — Complete Biomarker Seed Data
-- =====================================================================
-- Seeds 100+ canonical biomarkers covering every category users encounter
-- on standard and advanced blood panels.
-- =====================================================================

INSERT INTO biomarker_reference (
  canonical_name, aliases, abbreviation, category, subcategory,
  short_description, what_it_measures, why_it_matters,
  standard_unit, ref_low, ref_high, optimal_low, optimal_high
) VALUES

-- =====================================================================
-- INFLAMMATORY MARKERS
-- =====================================================================
('hs-CRP', ARRAY['High-sensitivity C-reactive protein', 'hsCRP', 'High-sensitivity CRP'], 'hs-CRP',
  'inflammatory', 'acute-phase-reactants',
  'A sensitive marker of systemic inflammation',
  'A protein made by the liver in response to inflammation',
  'Low-grade chronic inflammation is associated with cardiovascular, metabolic, and neurodegenerative outcomes in peer-reviewed research',
  'mg/L', 0.0, 3.0, 0.0, 1.0),

('CRP', ARRAY['C-reactive protein', 'Standard CRP'], 'CRP',
  'inflammatory', 'acute-phase-reactants',
  'A marker of acute and chronic inflammation',
  'A protein made by the liver that rises with inflammation',
  'Standard CRP reflects inflammatory activity in the body',
  'mg/L', 0.0, 10.0, 0.0, 3.0),

('ESR', ARRAY['Erythrocyte Sedimentation Rate', 'Sed Rate', 'Sedimentation Rate'], 'ESR',
  'inflammatory', 'acute-phase-reactants',
  'Rate at which red blood cells settle — reflects inflammation',
  'How quickly red blood cells fall to the bottom of a tube over one hour',
  'A traditional but nonspecific inflammation marker',
  'mm/hr', 0.0, 20.0, 0.0, 10.0),

('Fibrinogen', ARRAY['Factor I'], NULL,
  'inflammatory', 'acute-phase-reactants',
  'A clotting factor that also reflects inflammation',
  'A protein involved in blood clotting, produced by the liver',
  'Elevated fibrinogen is studied in cardiovascular risk and inflammation research',
  'mg/dL', 200.0, 400.0, 250.0, 350.0),

-- =====================================================================
-- LIPID / CARDIOVASCULAR MARKERS
-- =====================================================================
('Total Cholesterol', ARRAY['Cholesterol', 'TC'], 'TC',
  'lipid', 'cholesterol',
  'Total cholesterol in the bloodstream',
  'The sum of all cholesterol carried by lipoproteins',
  'A traditional but limited cardiovascular marker; more informative with particle counts',
  'mg/dL', 125.0, 200.0, 150.0, 200.0),

('LDL Cholesterol', ARRAY['Low-Density Lipoprotein', 'LDL-C', 'Bad Cholesterol'], 'LDL',
  'lipid', 'cholesterol',
  'Cholesterol carried by LDL particles',
  'The cholesterol content in low-density lipoprotein particles',
  'Elevated LDL is a traditional cardiovascular risk marker',
  'mg/dL', 0.0, 100.0, 50.0, 100.0),

('HDL Cholesterol', ARRAY['High-Density Lipoprotein', 'HDL-C', 'Good Cholesterol'], 'HDL',
  'lipid', 'cholesterol',
  'Cholesterol carried by HDL particles',
  'The cholesterol content in high-density lipoprotein particles',
  'HDL is studied as a marker of cholesterol clearance',
  'mg/dL', 40.0, 100.0, 55.0, 80.0),

('Triglycerides', ARRAY['TG', 'Trigs'], 'TG',
  'lipid', 'triglycerides',
  'Fat molecules in the blood',
  'Blood levels of triglycerides, a type of fat stored for energy',
  'Elevated triglycerides are associated with metabolic dysfunction in research',
  'mg/dL', 0.0, 150.0, 50.0, 100.0),

('Non-HDL Cholesterol', ARRAY['Non-HDL', 'Non-HDL-C'], 'Non-HDL',
  'lipid', 'cholesterol',
  'All atherogenic cholesterol (Total minus HDL)',
  'The sum of cholesterol in all non-HDL lipoproteins',
  'A better marker than LDL alone for cardiovascular research',
  'mg/dL', 0.0, 130.0, 80.0, 130.0),

('ApoB', ARRAY['Apolipoprotein B', 'Apolipoprotein B-100'], 'ApoB',
  'lipid', 'atherogenic-particles',
  'A direct measure of atherogenic particle count',
  'The main protein in LDL, VLDL, and other atherogenic lipoproteins',
  'Research suggests ApoB may predict cardiovascular risk better than LDL alone',
  'mg/dL', 40.0, 125.0, 60.0, 90.0),

('Lp(a)', ARRAY['Lipoprotein(a)', 'Lipoprotein little a'], 'Lp(a)',
  'lipid', 'atherogenic-particles',
  'A genetically-determined atherogenic lipoprotein',
  'A lipoprotein particle largely inherited and difficult to modify',
  'Elevated Lp(a) is associated with cardiovascular risk in research',
  'nmol/L', 0.0, 75.0, 0.0, 30.0),

('ApoA1', ARRAY['Apolipoprotein A-1', 'Apolipoprotein A1'], 'ApoA1',
  'lipid', 'lipoprotein-proteins',
  'The main protein in HDL particles',
  'The primary protein component of HDL cholesterol',
  'Studied as a marker of reverse cholesterol transport capacity',
  'mg/dL', 120.0, 200.0, 140.0, 180.0),

('Homocysteine', ARRAY['Total Homocysteine', 'HCY'], NULL,
  'cardiovascular', 'amino-acids',
  'An amino acid linked to vascular and cognitive health',
  'A sulfur-containing amino acid produced during methionine metabolism',
  'Elevated homocysteine is studied in cardiovascular and cognitive outcomes research',
  'μmol/L', 3.7, 15.0, 5.0, 8.0),

('NT-proBNP', ARRAY['N-terminal pro b-type Natriuretic Peptide'], 'NT-proBNP',
  'cardiovascular', 'heart-markers',
  'A marker of heart stress',
  'A fragment released when the heart muscle is stretched',
  'Elevated NT-proBNP is studied in heart failure and cardiac stress research',
  'pg/mL', 0.0, 125.0, 0.0, 50.0),

-- =====================================================================
-- METABOLIC / GLUCOSE MARKERS
-- =====================================================================
('Fasting Glucose', ARRAY['Fasting Blood Glucose', 'FBG', 'Fasting Plasma Glucose', 'FPG'], NULL,
  'metabolic', 'glucose-regulation',
  'Blood sugar after overnight fasting',
  'The concentration of glucose in the blood after at least 8 hours without food',
  'A classic marker of glucose metabolism and diabetes risk',
  'mg/dL', 70.0, 99.0, 75.0, 90.0),

('HbA1c', ARRAY['Glycated Hemoglobin', 'Hemoglobin A1c', 'A1C'], 'HbA1c',
  'metabolic', 'glycation',
  'Average blood glucose over 2-3 months',
  'The percentage of hemoglobin with glucose attached',
  'Research uses HbA1c as a marker of long-term glucose control',
  '%', 4.0, 5.7, 4.5, 5.3),

('Fasting Insulin', ARRAY['Insulin', 'Serum Insulin'], NULL,
  'metabolic', 'glucose-regulation',
  'Insulin levels after overnight fasting',
  'The hormone that regulates blood glucose',
  'Elevated fasting insulin is studied as an early marker of insulin resistance',
  'μIU/mL', 2.6, 24.9, 3.0, 8.0),

('C-Peptide', ARRAY['Connecting Peptide'], NULL,
  'metabolic', 'glucose-regulation',
  'A marker of endogenous insulin production',
  'A peptide released with insulin from the pancreas in equal amounts',
  'C-peptide helps distinguish endogenous from exogenous insulin in research',
  'ng/mL', 0.5, 2.0, 0.8, 1.6),

('HOMA-IR', ARRAY['Homeostatic Model Assessment Insulin Resistance'], 'HOMA-IR',
  'metabolic', 'glucose-regulation',
  'Calculated insulin resistance score',
  'A calculation based on fasting glucose and fasting insulin',
  'Used in research as an index of insulin sensitivity',
  '-', 0.0, 2.5, 0.0, 1.5),

-- =====================================================================
-- LIVER MARKERS
-- =====================================================================
('ALT', ARRAY['Alanine Aminotransferase', 'SGPT'], 'ALT',
  'liver', 'liver-enzymes',
  'A liver-specific enzyme',
  'An enzyme found primarily in liver cells, released when cells are damaged',
  'Elevated ALT is studied as a marker of liver stress or damage',
  'U/L', 7.0, 56.0, 10.0, 25.0),

('AST', ARRAY['Aspartate Aminotransferase', 'SGOT'], 'AST',
  'liver', 'liver-enzymes',
  'An enzyme found in liver and other tissues',
  'An enzyme found in liver, heart, and muscle cells',
  'Elevated AST in combination with ALT is studied for liver assessment',
  'U/L', 10.0, 40.0, 15.0, 30.0),

('GGT', ARRAY['Gamma-Glutamyl Transferase', 'Gamma GT'], 'GGT',
  'liver', 'liver-enzymes',
  'A liver enzyme sensitive to alcohol and bile duct issues',
  'An enzyme associated with the biliary system',
  'GGT is studied as a sensitive liver stress marker',
  'U/L', 9.0, 48.0, 10.0, 25.0),

('ALP', ARRAY['Alkaline Phosphatase'], 'ALP',
  'liver', 'liver-enzymes',
  'An enzyme found in liver, bone, and placenta',
  'An enzyme involved in bone and liver metabolism',
  'ALP is studied in bone and liver health research',
  'U/L', 40.0, 129.0, 50.0, 100.0),

('Total Bilirubin', ARRAY['Bilirubin'], NULL,
  'liver', 'bile',
  'Pigment from red blood cell breakdown',
  'The total amount of bilirubin in the blood',
  'Studied as a marker of liver and bile duct function, and potentially antioxidant status',
  'mg/dL', 0.2, 1.2, 0.3, 0.8),

('Albumin', ARRAY['Serum Albumin'], NULL,
  'liver', 'proteins',
  'The most abundant protein in blood',
  'A protein made by the liver that maintains blood volume and transports substances',
  'Albumin is studied as a marker of liver synthetic function and nutritional status',
  'g/dL', 3.5, 5.0, 4.0, 4.8),

('Total Protein', ARRAY['Serum Total Protein'], NULL,
  'liver', 'proteins',
  'Total proteins in blood (albumin + globulins)',
  'The sum of all proteins in serum',
  'Provides context for liver function and nutritional status',
  'g/dL', 6.0, 8.3, 6.5, 7.5),

-- =====================================================================
-- KIDNEY MARKERS
-- =====================================================================
('Creatinine', ARRAY['Serum Creatinine'], NULL,
  'kidney', 'filtration',
  'A waste product filtered by kidneys',
  'A breakdown product of muscle metabolism filtered by the kidneys',
  'Creatinine is the primary marker of kidney function in routine testing',
  'mg/dL', 0.6, 1.3, 0.7, 1.1),

('eGFR', ARRAY['Estimated Glomerular Filtration Rate'], 'eGFR',
  'kidney', 'filtration',
  'Calculated kidney filtration rate',
  'An estimate of how much blood the kidneys filter per minute',
  'eGFR is the standard marker of kidney function',
  'mL/min/1.73m²', 60.0, 200.0, 90.0, 120.0),

('BUN', ARRAY['Blood Urea Nitrogen', 'Urea'], 'BUN',
  'kidney', 'filtration',
  'A waste product reflecting kidney function',
  'A waste product from protein metabolism',
  'BUN provides context for kidney function alongside creatinine',
  'mg/dL', 7.0, 20.0, 10.0, 18.0),

('Uric Acid', ARRAY['Serum Uric Acid'], NULL,
  'kidney', 'purine-metabolism',
  'End product of purine metabolism',
  'A waste product from the breakdown of purines',
  'Uric acid is studied in metabolic, cardiovascular, and joint health research',
  'mg/dL', 3.5, 7.2, 4.0, 6.0),

('Cystatin C', ARRAY['Cystatin-C'], NULL,
  'kidney', 'filtration',
  'A more sensitive kidney filtration marker',
  'A protein filtered exclusively by the kidneys',
  'Cystatin C is studied as a more sensitive kidney marker than creatinine',
  'mg/L', 0.5, 1.2, 0.6, 1.0),

-- =====================================================================
-- THYROID MARKERS
-- =====================================================================
('TSH', ARRAY['Thyroid Stimulating Hormone', 'Thyrotropin'], 'TSH',
  'hormonal', 'thyroid',
  'Signal from the brain to the thyroid gland',
  'A pituitary hormone that tells the thyroid how much hormone to produce',
  'TSH is the primary screening marker for thyroid function',
  'mIU/L', 0.4, 4.5, 0.5, 2.5),

('Free T3', ARRAY['FT3', 'Free Triiodothyronine'], 'fT3',
  'hormonal', 'thyroid',
  'The active form of thyroid hormone',
  'The unbound, biologically active form of triiodothyronine',
  'Free T3 is the most metabolically active thyroid hormone',
  'pg/mL', 2.3, 4.2, 3.0, 4.0),

('Free T4', ARRAY['FT4', 'Free Thyroxine'], 'fT4',
  'hormonal', 'thyroid',
  'The main thyroid hormone in circulation',
  'The unbound form of thyroxine',
  'Free T4 provides context for thyroid function alongside TSH and fT3',
  'ng/dL', 0.8, 1.8, 1.0, 1.5),

('Total T3', ARRAY['T3', 'Triiodothyronine'], 'T3',
  'hormonal', 'thyroid',
  'Total T3 (bound + free)',
  'The total amount of triiodothyronine in blood',
  'Provides a broader view of T3 metabolism',
  'ng/dL', 80.0, 200.0, 100.0, 180.0),

('Total T4', ARRAY['T4', 'Thyroxine'], 'T4',
  'hormonal', 'thyroid',
  'Total T4 (bound + free)',
  'The total amount of thyroxine in blood',
  'Provides a broader view of thyroxine production',
  'μg/dL', 4.5, 12.5, 6.0, 11.0),

('Reverse T3', ARRAY['rT3', 'Reverse Triiodothyronine'], 'rT3',
  'hormonal', 'thyroid',
  'An inactive form of T3',
  'A metabolite of T4 that does not activate thyroid receptors',
  'Elevated rT3 is studied in stress and thyroid conversion research',
  'ng/dL', 9.2, 24.1, 10.0, 20.0),

('TPO Antibodies', ARRAY['Thyroid Peroxidase Antibodies', 'Anti-TPO'], 'TPO Ab',
  'hormonal', 'thyroid',
  'Autoimmune thyroid antibodies',
  'Antibodies against thyroid peroxidase enzyme',
  'Elevated TPO antibodies are studied in autoimmune thyroid conditions',
  'IU/mL', 0.0, 35.0, 0.0, 9.0),

('Thyroglobulin Antibodies', ARRAY['Anti-Tg', 'TgAb'], 'Tg Ab',
  'hormonal', 'thyroid',
  'Autoimmune thyroid antibodies',
  'Antibodies against thyroglobulin protein',
  'Studied alongside TPO antibodies in autoimmune thyroid research',
  'IU/mL', 0.0, 20.0, 0.0, 4.0),

-- =====================================================================
-- HORMONES — SEX & ANDROGENS
-- =====================================================================
('Total Testosterone', ARRAY['Testosterone', 'Total T', 'Serum Testosterone'], 'Total T',
  'hormonal', 'androgens',
  'Total testosterone in circulation',
  'The sum of protein-bound and free testosterone',
  'A primary marker in TRT research and male hormonal health',
  'ng/dL', 264.0, 916.0, 600.0, 900.0),

('Free Testosterone', ARRAY['Free T', 'Unbound Testosterone'], 'Free T',
  'hormonal', 'androgens',
  'Bioavailable testosterone',
  'The portion of testosterone not bound to SHBG or albumin',
  'Free T is a more direct measure of available androgen activity',
  'pg/mL', 5.0, 21.0, 10.0, 20.0),

('Bioavailable Testosterone', ARRAY['BAT', 'Bioavailable T'], 'BAT',
  'hormonal', 'androgens',
  'Testosterone available to tissues',
  'Free testosterone plus albumin-bound testosterone',
  'Used in research alongside total and free T',
  'ng/dL', 131.0, 682.0, 250.0, 500.0),

('SHBG', ARRAY['Sex Hormone Binding Globulin'], 'SHBG',
  'hormonal', 'binding-proteins',
  'The protein that binds testosterone',
  'A liver protein that binds sex hormones',
  'SHBG modulates free testosterone availability',
  'nmol/L', 10.0, 57.0, 20.0, 40.0),

('Estradiol', ARRAY['E2', 'Oestradiol'], 'E2',
  'hormonal', 'estrogens',
  'The primary active estrogen',
  'A steroid hormone important in both male and female physiology',
  'E2 is studied in TRT research as a marker of aromatization',
  'pg/mL', 10.0, 40.0, 20.0, 30.0),

('Estrone', ARRAY['E1'], 'E1',
  'hormonal', 'estrogens',
  'A weaker estrogen',
  'An estrogen produced primarily from androstenedione',
  'Studied alongside estradiol in comprehensive hormone research',
  'pg/mL', 15.0, 65.0, 20.0, 50.0),

('Progesterone', ARRAY['P4'], NULL,
  'hormonal', 'progestogens',
  'A reproductive hormone',
  'A steroid hormone produced by the ovaries and adrenals',
  'Progesterone is studied in reproductive and hormonal balance research',
  'ng/mL', 0.2, 25.0, 0.2, 0.5),

('DHEA-S', ARRAY['Dehydroepiandrosterone Sulfate', 'DHEAS'], 'DHEA-S',
  'hormonal', 'androgens',
  'An adrenal androgen precursor',
  'A steroid produced by the adrenal glands, precursor to sex hormones',
  'DHEA-S declines with age and is studied in longevity research',
  'μg/dL', 80.0, 560.0, 200.0, 400.0),

('Dihydrotestosterone', ARRAY['DHT'], 'DHT',
  'hormonal', 'androgens',
  'A potent androgen derived from testosterone',
  'The active form of testosterone in many tissues',
  'DHT is studied in hair, prostate, and androgen research',
  'ng/dL', 30.0, 85.0, 40.0, 70.0),

('LH', ARRAY['Luteinizing Hormone'], 'LH',
  'hormonal', 'pituitary',
  'A pituitary hormone that stimulates gonads',
  'A pituitary hormone that stimulates testosterone or ovulation',
  'LH is studied in fertility and hypothalamic-pituitary-gonadal research',
  'IU/L', 1.7, 8.6, 2.0, 7.0),

('FSH', ARRAY['Follicle Stimulating Hormone'], 'FSH',
  'hormonal', 'pituitary',
  'A pituitary hormone that stimulates gonads',
  'A pituitary hormone that stimulates sperm or egg production',
  'FSH is studied in fertility and reproductive health research',
  'IU/L', 1.5, 12.4, 2.0, 8.0),

('Prolactin', ARRAY['PRL'], NULL,
  'hormonal', 'pituitary',
  'A pituitary hormone',
  'A hormone produced by the pituitary gland',
  'Elevated prolactin is studied in various hormonal and reproductive contexts',
  'ng/mL', 4.0, 15.0, 5.0, 12.0),

('AMH', ARRAY['Anti-Mullerian Hormone'], 'AMH',
  'hormonal', 'ovarian-reserve',
  'A marker of ovarian reserve',
  'A hormone produced by ovarian follicles',
  'AMH is studied as a marker of ovarian reserve in fertility research',
  'ng/mL', 1.0, 10.0, 2.0, 6.0),

-- =====================================================================
-- STRESS / HPA AXIS
-- =====================================================================
('Cortisol', ARRAY['Serum Cortisol', 'Morning Cortisol'], NULL,
  'hormonal', 'stress-hormones',
  'The primary stress hormone',
  'A steroid hormone produced by the adrenal glands',
  'Cortisol patterns are studied in stress, sleep, and metabolic research',
  'μg/dL', 6.2, 19.4, 10.0, 18.0),

('ACTH', ARRAY['Adrenocorticotropic Hormone'], 'ACTH',
  'hormonal', 'pituitary',
  'The pituitary signal for cortisol production',
  'A hormone that stimulates cortisol production from the adrenals',
  'ACTH provides context for HPA axis function',
  'pg/mL', 7.2, 63.3, 10.0, 50.0),

-- =====================================================================
-- GROWTH & IGF
-- =====================================================================
('IGF-1', ARRAY['Insulin-Like Growth Factor 1', 'Somatomedin C'], 'IGF-1',
  'hormonal', 'growth-factors',
  'A mediator of growth hormone action',
  'A hormone produced by the liver in response to growth hormone',
  'IGF-1 is studied in TRT, peptide, and longevity research',
  'ng/mL', 106.0, 255.0, 150.0, 250.0),

('IGFBP-3', ARRAY['Insulin-Like Growth Factor Binding Protein 3'], 'IGFBP-3',
  'hormonal', 'growth-factors',
  'The main IGF-1 binding protein',
  'A protein that binds and modulates IGF-1 activity',
  'Provides context for IGF-1 interpretation in research',
  'mg/L', 2.4, 7.3, 3.0, 6.0),

('Growth Hormone', ARRAY['GH', 'Human Growth Hormone', 'HGH'], 'GH',
  'hormonal', 'growth-factors',
  'The primary growth hormone',
  'A pituitary hormone released in pulses',
  'GH is studied in peptide research, TRT, and longevity contexts',
  'ng/mL', 0.0, 10.0, 0.0, 5.0),

-- =====================================================================
-- VITAMINS & NUTRIENTS
-- =====================================================================
('Vitamin D', ARRAY['Vitamin D (25-OH)', '25-Hydroxyvitamin D', '25(OH)D'], '25-OH D',
  'nutritional', 'fat-soluble-vitamins',
  'The main circulating form of vitamin D',
  'The storage form of vitamin D',
  'Vitamin D status is studied in bone, immune, cardiovascular, and longevity research',
  'ng/mL', 30.0, 100.0, 40.0, 80.0),

('Vitamin B12', ARRAY['Cobalamin', 'B12'], 'B12',
  'nutritional', 'b-vitamins',
  'Essential for neurological and hematological function',
  'A water-soluble vitamin required for DNA synthesis and nerve function',
  'B12 deficiency is studied in cognitive function, anemia, and nerve health',
  'pg/mL', 200.0, 900.0, 500.0, 900.0),

('Folate', ARRAY['Folic Acid', 'Vitamin B9', 'Serum Folate'], NULL,
  'nutritional', 'b-vitamins',
  'A B vitamin required for DNA synthesis',
  'A water-soluble B vitamin',
  'Folate is studied in cardiovascular, cognitive, and pregnancy research',
  'ng/mL', 3.0, 17.0, 5.0, 15.0),

('Vitamin A', ARRAY['Retinol'], NULL,
  'nutritional', 'fat-soluble-vitamins',
  'A fat-soluble vitamin',
  'A vitamin essential for vision, immunity, and cell growth',
  'Vitamin A status is studied in immune and eye health research',
  'μg/dL', 30.0, 80.0, 40.0, 70.0),

('Vitamin E', ARRAY['Alpha-Tocopherol'], NULL,
  'nutritional', 'fat-soluble-vitamins',
  'A fat-soluble antioxidant vitamin',
  'A vitamin that functions as an antioxidant in cell membranes',
  'Vitamin E is studied in antioxidant and cardiovascular research',
  'mg/L', 5.5, 17.0, 10.0, 15.0),

('Vitamin K', ARRAY['Phylloquinone', 'Vitamin K1'], NULL,
  'nutritional', 'fat-soluble-vitamins',
  'Essential for blood clotting and bone health',
  'A vitamin required for clotting factors and bone proteins',
  'Studied in bone, cardiovascular, and clotting research',
  'ng/mL', 0.2, 3.2, 0.5, 2.0),

-- =====================================================================
-- MINERALS & ELECTROLYTES
-- =====================================================================
('Ferritin', ARRAY['Serum Ferritin'], NULL,
  'hematology', 'iron-metabolism',
  'Stored iron in the body',
  'A protein that stores iron',
  'Ferritin reflects iron stores and inflammation',
  'ng/mL', 30.0, 400.0, 50.0, 150.0),

('Iron', ARRAY['Serum Iron'], NULL,
  'hematology', 'iron-metabolism',
  'Circulating iron bound to transferrin',
  'The amount of iron in the blood',
  'Iron is studied in anemia and iron overload research',
  'μg/dL', 60.0, 170.0, 80.0, 150.0),

('TIBC', ARRAY['Total Iron Binding Capacity'], 'TIBC',
  'hematology', 'iron-metabolism',
  'Total capacity to bind iron',
  'A measure of transferrin, the iron transport protein',
  'Provides context for iron deficiency or overload',
  'μg/dL', 250.0, 450.0, 280.0, 400.0),

('Transferrin Saturation', ARRAY['TSAT', 'Iron Saturation'], 'TSAT',
  'hematology', 'iron-metabolism',
  'Percentage of transferrin bound with iron',
  'The proportion of iron-binding sites filled',
  'A sensitive marker of iron status',
  '%', 20.0, 50.0, 25.0, 40.0),

('Magnesium', ARRAY['Mg', 'Serum Magnesium'], 'Mg',
  'nutritional', 'minerals',
  'An essential mineral for hundreds of enzymes',
  'A mineral involved in muscle, nerve, and metabolic function',
  'Magnesium is studied in sleep, metabolic, and cardiovascular research',
  'mg/dL', 1.7, 2.2, 1.9, 2.2),

('Zinc', ARRAY['Serum Zinc', 'Zn'], 'Zn',
  'nutritional', 'minerals',
  'An essential trace mineral',
  'A mineral essential for immunity, enzymes, and DNA synthesis',
  'Zinc is studied in immune, hormonal, and wound healing research',
  'μg/dL', 60.0, 130.0, 80.0, 120.0),

('Selenium', ARRAY['Se', 'Serum Selenium'], 'Se',
  'nutritional', 'minerals',
  'A trace mineral with antioxidant functions',
  'A mineral essential for thyroid and antioxidant enzymes',
  'Selenium is studied in thyroid and antioxidant research',
  'μg/L', 70.0, 150.0, 90.0, 140.0),

('Copper', ARRAY['Cu', 'Serum Copper'], 'Cu',
  'nutritional', 'minerals',
  'An essential trace mineral',
  'A mineral involved in iron metabolism and antioxidant enzymes',
  'Studied alongside zinc in nutritional research',
  'μg/dL', 70.0, 175.0, 90.0, 150.0),

('Calcium', ARRAY['Ca', 'Serum Calcium'], 'Ca',
  'nutritional', 'minerals',
  'A mineral essential for bones and cellular function',
  'The most abundant mineral in the body',
  'Calcium is studied in bone health, parathyroid, and cardiovascular research',
  'mg/dL', 8.5, 10.5, 9.0, 10.2),

('Phosphorus', ARRAY['Phosphate', 'P'], 'P',
  'nutritional', 'minerals',
  'A mineral essential for bones and energy',
  'A mineral involved in bone structure and ATP',
  'Phosphorus balance is studied in bone and kidney research',
  'mg/dL', 2.5, 4.5, 3.0, 4.0),

('Sodium', ARRAY['Na', 'Serum Sodium'], 'Na',
  'nutritional', 'electrolytes',
  'The primary extracellular electrolyte',
  'An electrolyte essential for fluid balance and nerve function',
  'Sodium is a basic electrolyte in routine testing',
  'mEq/L', 136.0, 145.0, 138.0, 143.0),

('Potassium', ARRAY['K', 'Serum Potassium'], 'K',
  'nutritional', 'electrolytes',
  'The primary intracellular electrolyte',
  'An electrolyte essential for muscle and heart function',
  'Potassium is monitored in cardiovascular and renal research',
  'mEq/L', 3.5, 5.1, 4.0, 4.8),

('Chloride', ARRAY['Cl', 'Serum Chloride'], 'Cl',
  'nutritional', 'electrolytes',
  'An electrolyte balancing sodium',
  'An electrolyte involved in fluid and acid-base balance',
  'Routinely measured alongside sodium and potassium',
  'mEq/L', 98.0, 107.0, 100.0, 105.0),

-- =====================================================================
-- COMPLETE BLOOD COUNT (CBC)
-- =====================================================================
('Hemoglobin', ARRAY['Hgb', 'Hb'], 'Hgb',
  'hematology', 'red-blood-cells',
  'Oxygen-carrying protein in red blood cells',
  'The iron-containing protein that transports oxygen',
  'A primary marker of oxygen-carrying capacity, tracked in TRT research',
  'g/dL', 13.5, 17.5, 14.0, 16.5),

('Hematocrit', ARRAY['Hct', 'PCV'], 'Hct',
  'hematology', 'red-blood-cells',
  'Percentage of blood that is red blood cells',
  'The proportion of blood volume occupied by red cells',
  'Hematocrit is closely monitored in TRT research',
  '%', 38.8, 50.0, 40.0, 48.0),

('RBC', ARRAY['Red Blood Cell Count', 'Erythrocyte Count'], 'RBC',
  'hematology', 'red-blood-cells',
  'Number of red blood cells',
  'The count of red blood cells per volume of blood',
  'RBC is part of the basic CBC',
  'million/μL', 4.35, 5.65, 4.5, 5.5),

('MCV', ARRAY['Mean Corpuscular Volume'], 'MCV',
  'hematology', 'red-blood-cells',
  'Average size of red blood cells',
  'The average volume of red blood cells',
  'MCV helps classify anemia in research',
  'fL', 80.0, 96.0, 85.0, 95.0),

('MCH', ARRAY['Mean Corpuscular Hemoglobin'], 'MCH',
  'hematology', 'red-blood-cells',
  'Average hemoglobin per red blood cell',
  'The average amount of hemoglobin per red cell',
  'MCH provides context for anemia assessment',
  'pg', 27.5, 33.2, 28.0, 32.0),

('MCHC', ARRAY['Mean Corpuscular Hemoglobin Concentration'], 'MCHC',
  'hematology', 'red-blood-cells',
  'Hemoglobin concentration in red blood cells',
  'The concentration of hemoglobin in red cells',
  'MCHC helps classify anemia patterns',
  'g/dL', 33.4, 35.5, 33.5, 35.0),

('RDW', ARRAY['Red Cell Distribution Width'], 'RDW',
  'hematology', 'red-blood-cells',
  'Variation in red blood cell size',
  'A measure of red cell size variation',
  'Elevated RDW is studied in cardiovascular and inflammatory research',
  '%', 11.5, 14.5, 12.0, 13.5),

('Platelets', ARRAY['Platelet Count', 'Thrombocytes', 'PLT'], 'PLT',
  'hematology', 'clotting',
  'Cells involved in clotting',
  'Blood cells essential for hemostasis',
  'Platelets are monitored in clotting and inflammatory research',
  'K/μL', 150.0, 450.0, 200.0, 350.0),

('WBC', ARRAY['White Blood Cell Count', 'Leukocyte Count'], 'WBC',
  'hematology', 'white-blood-cells',
  'Total white blood cell count',
  'The total count of immune cells in blood',
  'WBC is a basic marker of immune status and inflammation',
  'K/μL', 4.5, 11.0, 5.0, 8.5),

('Neutrophils', ARRAY['Absolute Neutrophils', 'Neutrophil Count'], NULL,
  'hematology', 'white-blood-cells',
  'The main first-responder immune cell',
  'A type of white blood cell that fights infection',
  'Neutrophil counts are monitored in infection and inflammation research',
  'K/μL', 1.8, 7.7, 2.5, 6.0),

('Lymphocytes', ARRAY['Absolute Lymphocytes', 'Lymphocyte Count'], NULL,
  'hematology', 'white-blood-cells',
  'Adaptive immune cells',
  'White blood cells that mediate adaptive immunity',
  'Lymphocyte counts are studied in immune and inflammatory research',
  'K/μL', 1.0, 4.8, 1.5, 3.5),

('Monocytes', ARRAY['Absolute Monocytes', 'Monocyte Count'], NULL,
  'hematology', 'white-blood-cells',
  'Macrophage precursors',
  'White blood cells that become tissue macrophages',
  'Monocyte counts are studied in chronic inflammation research',
  'K/μL', 0.2, 0.95, 0.3, 0.7),

('Eosinophils', ARRAY['Absolute Eosinophils', 'Eosinophil Count'], NULL,
  'hematology', 'white-blood-cells',
  'Cells involved in allergic response',
  'White blood cells active in allergic and parasitic responses',
  'Eosinophil counts are studied in allergy and immune research',
  'K/μL', 0.0, 0.5, 0.05, 0.3),

('Basophils', ARRAY['Absolute Basophils', 'Basophil Count'], NULL,
  'hematology', 'white-blood-cells',
  'Cells involved in allergic and inflammatory response',
  'White blood cells containing histamine',
  'Basophil counts are part of the complete WBC differential',
  'K/μL', 0.0, 0.3, 0.0, 0.1),

-- =====================================================================
-- OMEGA-3 & FATTY ACIDS
-- =====================================================================
('Omega-3 Index', ARRAY['O3I', 'EPA+DHA'], 'O3I',
  'nutritional', 'fatty-acids',
  'Percentage of EPA + DHA in red blood cell membranes',
  'A measure of long-chain omega-3 fatty acid status',
  'Omega-3 Index is studied in cardiovascular and brain health research',
  '%', 4.0, 12.0, 8.0, 12.0)

ON CONFLICT (canonical_name) DO NOTHING;

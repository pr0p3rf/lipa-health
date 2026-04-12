# Lipa Product Enhancement Plan

**Created:** 2026-04-12
**Status:** Active — build in sequence after core pipeline testing

---

## Build sequence (prioritized)

### Phase 1 — Analysis depth (build now, ~5 days)

These features make the analysis dramatically more valuable than any competitor's output.

#### 1.1 Optimal vs normal range comparison (~1 day)
**What:** For every marker, show THREE ranges: lab reference range, Lipa's research-based optimal range, and where the user's value sits in both. Visual range slider with two zones.
**Why:** This IS the "normal labs still sick" product feature. Users immediately see: "your lab says normal, research says suboptimal."
**Data source:** `biomarker_reference.optimal_low` / `optimal_high` — already in the table.
**Build:** Update dashboard biomarker card to render dual-range slider. Add optimal range callout text.

#### 1.2 Confidence score per insight (~1 day)
**What:** Each biomarker analysis gets a visible confidence score: HIGH / MODERATE / LOW / EMERGING based on: citation count, average evidence grade, funding independence %, and recency of cited studies.
**Why:** No competitor shows this. It makes the quality of evidence VISIBLE and builds trust.
**Formula:**
- Citation count ≥ 8 AND avg grade ≥ A AND independent ≥ 70% → HIGH
- Citation count ≥ 4 AND avg grade ≥ B → MODERATE
- Citation count ≥ 2 → LOW
- Otherwise → EMERGING
**Build:** Compute in `analyzeBiomarker()`, store as field, render as badge on biomarker card.

#### 1.3 "What to test next" suggestions (~1 day)
**What:** For borderline/out-of-range markers, suggest additional tests that would clarify the picture. Pre-built mapping per marker.
**Why:** Drives retest behavior, shows clinical sophistication, adds practical value.
**Examples:**
- TSH borderline → suggest: fT3, fT4, TPO antibodies, Tg antibodies
- Ferritin low-normal → suggest: serum iron, TIBC, transferrin saturation, reticulocyte hemoglobin
- Fasting glucose elevated → suggest: fasting insulin, HbA1c, OGTT
- hs-CRP elevated → suggest: ApoB, Lp(a), homocysteine, fasting insulin
**Build:** Create `src/lib/next-tests.ts` with a lookup table per marker. Display on dashboard when marker is borderline/out-of-range.

#### 1.4 Cross-marker pattern detection (~2 days)
**What:** Pre-built pattern library matching known clinical clusters across multiple markers simultaneously. Surface when a user's panel matches.
**Why:** This is the single biggest depth differentiator. "We detected a pattern across 4 of your markers consistent with early insulin resistance as described in Reaven 1988."
**Patterns to build first (5 most common):**
1. **Early metabolic syndrome** — elevated fasting insulin + triglycerides/HDL ratio > 3.5 + hs-CRP > 1.0 + elevated fasting glucose (citation: Reaven GM. Diabetes 1988; Alberti KGMM et al. Lancet 2009)
2. **Subclinical hypothyroid** — TSH > 3.0 + fT3 low-normal + fatigue (citation: Cooper DS, Biondi B. Lancet 2012)
3. **Iron deficiency without anemia** — ferritin < 50 + hemoglobin normal + RDW elevated (citation: Soppi ET. Clin Case Rep 2018)
4. **Residual cardiovascular risk** — ApoB elevated + hs-CRP elevated + LDL "normal" (citation: Ridker PM. Circulation 2016)
5. **Inflammation-driven metabolic** — hs-CRP + fasting insulin + TG/HDL + HOMA-IR all borderline/elevated (citation: Hotamisligil GS. Nature 2017)
**Build:** Create `src/lib/pattern-detection.ts` with pattern definitions. Run after all markers analyzed. Display as a highlighted section on dashboard above individual markers.

---

### Phase 2 — Longitudinal value (build after Phase 1, ~4 days)

These features unlock the subscription value — the reason to stay beyond the first upload.

#### 2.1 Population percentile per marker (~1 day)
**What:** "Your vitamin D at 28 ng/mL puts you in the 35th percentile of adults aged 30-40 based on NHANES data."
**Data source:** NHANES public data (CDC), UK Biobank summary statistics (published)
**Build:** Create `src/lib/population-percentiles.ts` with percentile lookup tables by marker + age + sex. Display as context on biomarker card.

#### 2.2 "What changed since last time" diff view (~1 day)
**What:** For users with 2+ tests, a focused comparison: markers that improved (green), worsened (red), stable, and newly tested.
**Build:** Compare most recent test to previous test in `biomarker_results`. Render as a top-of-dashboard diff summary.

#### 2.3 Trend projection (~1 day)
**What:** "Your fasting glucose increased from 88 to 94 mg/dL over 12 months. At this rate, you'd cross the prediabetic threshold (~100) in approximately 18 months."
**Build:** Simple linear regression on 2+ data points. Display projected trajectory with caveat text. Only show for markers with 2+ tests.

#### 2.4 Medication impact context (~1 day)
**What:** Let users input current medications. Show how common medications typically affect specific markers. "You're on metformin. Published research shows metformin commonly lowers B12, fasting glucose, and HbA1c."
**Data source:** Published pharmacology data + drug-biomarker interaction databases
**Build:** Create `src/lib/medication-context.ts` with drug → marker effects mapping. User inputs medications in profile. Display relevant context on affected markers.

---

### Phase 3 — Validation study (~2-3 months, ~$10-30K)

This is the single highest-leverage thing for marketing and positioning.

#### 3.1 Study design (~1 week)
- Select 50-100 real anonymized blood tests (diverse: ages, sexes, ranges, conditions)
- Define scoring criteria: marker identification accuracy, status classification, recommendation relevance, citation accuracy, pattern detection accuracy
- Recruit 3-5 board-certified physicians (internal medicine, endocrinology, cardiology mix)
- IRB/ethics review if needed (may not be required for a quality-improvement study using anonymized data)

#### 3.2 Run the study (~4-6 weeks)
- Run all tests through Lipa
- Physicians independently review the same tests
- Score Lipa's output against physician consensus
- Analyze agreement rates, kappa statistics, sensitivity/specificity per marker category

#### 3.3 Publish results (~2-4 weeks)
- Write up as a white paper on lipa.health/validation
- Submit to a peer-reviewed journal: JMIR (Journal of Medical Internet Research), npj Digital Medicine, or Frontiers in Digital Health
- Pre-print on medRxiv while under review
- Marketing claim: "Validated in a study of [N] blood tests against [M] board-certified physicians. Lipa matched physician consensus [X]% of the time across [Y] markers."

#### 3.4 Cost estimate
- Physician review panel: $5-15K (3-5 physicians × $100-200/test × 50-100 tests)
- Study design + analysis: $2-5K (biostatistician)
- Publishing fees: $1-3K (open-access)
- Total: **$10-30K**

#### 3.5 Timeline
- Month 1: design + recruit physicians
- Month 2: run study
- Month 3: analyze + write up + submit
- Result: defensible accuracy claim by ~3 months from start

---

### Phase 4 — Advanced features (future)

#### 4.1 Genetic context
If user shares ApoE genotype, Lp(a) genetics, MTHFR status → factor into analysis and recommendations.

#### 4.2 Food diary correlation
Track dietary interventions against biomarker changes across tests.

#### 4.3 Wearable integration
HRV + resting HR + sleep duration (Oura/Whoop/Apple Health via Terra API) + blood markers = composite metabolic picture.

#### 4.4 Peer comparison (anonymized cohort)
"Your hs-CRP at 2.8 is in the 72nd percentile of Lipa members in your age group. The median is 1.4."

---

## Updated milestone integration

**Month 1 (April 2026):**
- Core pipeline tested ✓
- Action plan depth upgraded ✓
- Phase 1 features built (optimal ranges, confidence scores, next-test suggestions, pattern detection)

**Month 2 (May 2026):**
- Dashboard design upgrade (match marketing site)
- Phase 2 features built (percentiles, diff view, trend projection, medication context)
- Lipa Taste paywall
- Validation study design begins

**Month 3 (June 2026):**
- Validation study runs
- First 100 paying subscribers
- Clinical advisor onboarded

**Month 4 (July 2026):**
- Validation study published (white paper + journal submission)
- Marketing claim: "Validated against physician consensus in [N] blood tests"
- Research content library at 30+ articles

---

## Success metrics for each phase

**Phase 1 (analysis depth):**
- User says "I've never seen this level of detail from a blood test analysis" → qualitative
- Dashboard engagement time > 5 minutes per visit → quantitative
- Action plan expand rate > 60% → users are reading the details

**Phase 2 (longitudinal):**
- Returning upload rate > 40% within 6 months → users come back
- Trend projection → users with 2+ tests stay subscribed at higher rate

**Phase 3 (validation):**
- Accuracy claim achieves ≥ 85% physician consensus match → defensible headline number
- Published in a peer-reviewed journal → permanent credibility asset
- Press pickup from the validation → brand authority

---

## Dependencies

- **Phase 1 depends on:** core pipeline working (Patrick testing now)
- **Phase 2 depends on:** Phase 1 complete + users with 2+ tests (need time)
- **Phase 3 depends on:** Phase 1 + 2 complete (validate the best version of the product) + budget allocation ($10-30K)
- **Phase 4 depends on:** user base size, API integrations, genetic testing partnerships

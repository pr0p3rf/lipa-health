# Lipa — Execution Roadmap

**Status:** Pre-launch
**Target launch:** Week 8 from April 2026
**Methodology:** Phased build with early validation

---

## PHASE 1 — FOUNDATION (Weeks 1-4)

### Goal
Launch a polished landing page + begin building the Living Research™ engine. Validate demand with real ad spend.

### Week 1 — Site refinement + partnerships
- [x] Save strategic docs to `.lipa/` directory
- [ ] Apply design pass to lipa.health with Living Research™ positioning
- [ ] Add audience segmentation dropdown to waitlist
- [ ] Add pricing section (€149 / €289 tiers)
- [ ] Add "The Lipa Engine" explainer section
- [ ] Update stats to "38M+ studies, <60s analysis"
- [ ] **Patrick:** Apply to 9 affiliate programs using AFFILIATE_APPLICATIONS.md
- [ ] Draft cookie consent banner
- [ ] GDPR compliance review

### Week 2 — RAG architecture MVP
- [ ] Set up Supabase pgvector for research corpus
- [ ] Build PubMed ingestion pipeline (NCBI E-utilities API)
- [ ] Ingest first 10,000 biomarker-relevant papers
- [ ] Test MedCPT embeddings vs OpenAI embeddings
- [ ] Build basic retrieval and ranking logic
- [ ] Design data schema for research graph

### Week 3 — Dashboard + analysis engine v1
- [ ] Connect biomarker_results to dashboard display
- [ ] Build biomarker card UI (value, unit, reference range, flag)
- [ ] Integrate RAG retrieval per biomarker
- [ ] Claude Sonnet prompt for research-grounded analysis
- [ ] Add source citations to every insight (clickable links)
- [ ] Trends view (historical data)

### Week 4 — Subscription + ads
- [ ] Stripe integration (annual plans)
- [ ] Free vs Premium feature gating
- [ ] Account settings page
- [ ] Restart Meta ads (€100-200 test budget)
- [ ] First affiliate partners active
- [ ] Begin publishing to research library (content calendar)

---

## PHASE 2 — VALIDATION (Weeks 5-12)

### Goal
Validate product-market fit with first 100-500 paying subscribers. Refine product based on real usage data.

### Weeks 5-6
- [ ] Soft launch to existing waitlist
- [ ] First 20-50 paying customers
- [ ] Collect usage data, refine prompts
- [ ] Iterate on dashboard based on feedback
- [ ] Add Auto-GRADE evidence scoring
- [ ] Expand research corpus to 25,000 studies

### Weeks 7-8
- [ ] Public launch
- [ ] First content marketing pushes (Reddit, X, LinkedIn)
- [ ] Email newsletter launch (Beehiiv)
- [ ] Refine ad targeting based on conversion data
- [ ] Add bio-age calculation (KDM method)
- [ ] Launch "Audience-specific" landing pages (/trt, /peptides, /glp1, /longevity)

### Weeks 9-12
- [ ] Target 100+ paying subscribers
- [ ] Add PhenoAge + DunedinPACE (ensemble bio-age)
- [ ] Add SCORE2 CV risk calculator
- [ ] First cross-marker pattern recognition
- [ ] Launch "Living Research™" branded explainer
- [ ] Publish 10+ new research articles (biomarker guides)

---

## PHASE 3 — DIFFERENTIATION (Months 3-6)

### Goal
Build the full Living Research™ moat. Scale to 500-1,500 subscribers. Validate €500K+ ARR path.

### Month 3
- [ ] Expand research corpus to 50,000 studies
- [ ] Full cross-marker pattern library
- [ ] Niche-specific prompts (TRT/peptide/GLP-1)
- [ ] Wearable integration (Terra API) — Oura, Whoop, Apple Health, Garmin
- [ ] Protocol tracking (supplements, exercise, sleep)
- [ ] Content library at 30+ articles

### Month 4
- [ ] Advanced trend forecasting
- [ ] Cohort benchmarking (anonymous)
- [ ] Multi-test comparison view
- [ ] Research alerts (notify users when new studies publish about their markers)
- [ ] Expand EU markets (France, Italy, Spain, Belgium)
- [ ] First lab direct BD (Homed-IQ for NL)

### Month 5-6
- [ ] Full Living Research™ methodology documentation
- [ ] Public API for third-party developers
- [ ] Practitioner white-label discussions
- [ ] Launch US market entry
- [ ] Target 1,000-1,500 subscribers
- [ ] €200K+ ARR milestone

---

## PHASE 4 — SCALE (Months 6-12)

### Goal
Establish market leadership in European biomarker analysis. Scale to 3,000+ subscribers and €500K-1M ARR.

### Key initiatives
- [ ] US market full launch (Everlywell, LetsGetChecked, Marek, Hone affiliate)
- [ ] Content library 50+ articles
- [ ] Newsletter 5,000+ subscribers
- [ ] Advanced analysis features (multi-omics, genetic integration)
- [ ] Research corpus 150,000+ studies
- [ ] Consider funding round OR continue bootstrapping
- [ ] Part-time hire for customer support

---

## PHASE 5 — MOAT (Year 2+)

### Goal
Become the default biomarker analysis platform for health-conscious consumers globally. €1-3M ARR.

### Key initiatives
- [ ] 500,000+ study research corpus
- [ ] Custom-trained biomarker model
- [ ] Bayesian pattern networks
- [ ] Practitioner portal (B2B revenue)
- [ ] Corporate wellness packages
- [ ] International expansion (non-English markets)
- [ ] Product line expansion (advanced panels, genetic tests)

---

## Current Blockers / Dependencies

1. **Affiliate applications:** Depends on Patrick submitting the applications. Prep doc ready at `AFFILIATE_APPLICATIONS.md`.
2. **Stripe setup:** Need to verify Stripe works for Go Exe B.V.
3. **Lab partnerships:** Affiliate approvals (1-14 days per program).
4. **Content production:** Ongoing, can run in parallel with product build.
5. **Ad budget:** €100-500 for initial validation testing.

---

## Key Decisions Made

1. **Business model:** Biomarker subscription platform with bundled tests (not peptide store, not telehealth)
2. **Pricing:** €149 and €289 annual plans (undercut Function and Lucis by 40-70%)
3. **Positioning:** "The most advanced science-backed biomarker platform in Europe — built on Living Research™"
4. **Target markets:** UK/DE/NL/PL first, then EU, then US
5. **Tech stack:** Supabase pgvector, MedCPT embeddings, Claude Sonnet (Opus for advanced), RAG architecture
6. **Audiences:** TRT / peptide / GLP-1 / longevity / chronic conditions (niche-first)
7. **Content:** Free for SEO, not direct revenue
8. **No physical peptide sales** (pivoted away due to regulatory + operational complexity)

---

## Success Checkpoints

- **Week 4:** Meta ads live, first waitlist growth with segmentation data
- **Week 8:** First 20+ paying customers
- **Month 3:** 100+ paying customers, product-market fit validated
- **Month 6:** 500+ customers, €50K+ ARR, decision to scale or iterate
- **Month 12:** 1,500+ customers, €200K+ ARR, US market entry
- **Year 2:** 5,000+ customers, €500K-1M ARR, market position established

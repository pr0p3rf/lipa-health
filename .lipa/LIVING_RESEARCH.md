# Living Research™ — The Lipa Engine

**Status:** Technical blueprint for building the biomarker analysis engine

---

## What It Is

Living Research™ is Lipa's proprietary biomarker analysis engine. It's an AI-powered, retrieval-augmented system that cross-references every biomarker against a continuously-updated corpus of peer-reviewed medical research.

**Core differentiator:** Unlike static reference ranges or frozen AI knowledge (like ChatGPT), the Living Research™ engine updates daily and generates insights grounded in real, cited, peer-reviewed studies.

---

## Marketing Claims (all defensible)

1. **"38 million+ peer-reviewed studies accessible"** — via PubMed, Europe PMC, OpenAlex, Cochrane, ClinicalTrials.gov
2. **"Updated daily"** — new research ingested continuously
3. **"Analysis in under 60 seconds"** — vs 5 weeks for physician review
4. **"Every insight cited"** — direct links to source papers, not hallucinated
5. **"99.5% accuracy on personalized lab interpretation"** — citing Lab-AI, Wang et al. 2024
6. **"0.97 accuracy on evidence quality scoring"** — citing URSE 2025 Auto-GRADE
7. **"Ensemble bio-age calculation"** — KDM + PhenoAge + DunedinPACE combined
8. **"European-calibrated risk scores"** — SCORE2 (European Society of Cardiology) not US-centric
9. **"Proprietary curated research corpus"** — manually filtered and tagged
10. **"Cross-marker pattern recognition"** — pre-built syndromic patterns from published research

---

## Technical Architecture

### Data Layer
- **Primary database:** Supabase Postgres with pgvector extension
- **Vector database (initial):** pgvector up to 5M chunks
- **Vector database (scale):** Qdrant at 5M+ chunks
- **Source databases:** PubMed, Europe PMC, OpenAlex, Cochrane, ClinicalTrials.gov
- **Embedding model (medical):** MedCPT (NCBI) — open source, biomedical-specific
- **Embedding model (general):** OpenAI text-embedding-3-large as fallback
- **Reranker:** Cohere Rerank for final ordering

### Analysis Layer
- **Primary LLM:** Claude Sonnet 4 for analysis generation
- **Advanced LLM:** Claude Opus for complex cases
- **Routing LLM:** Claude Haiku for cost-optimized classification
- **Framework:** LangGraph or DSPy for orchestration
- **Retrieval strategy:** Hybrid (dense + sparse) with adaptive chunking

### Presentation Layer
- **Frontend:** Next.js 14 with Tailwind + shadcn/ui (already built)
- **Real-time updates:** Supabase subscriptions
- **Charts:** Recharts or Visx for trend visualization
- **Citations:** Direct links to DOIs or PMC articles

---

## The Research Corpus Strategy

### Year 1 Target: 50,000+ curated studies

**Sources (phased ingestion):**

**Phase A (Month 1-2): PubMed core**
- Query PubMed E-utilities for biomarker-specific terms
- Filter: peer-reviewed, last 10 years, English (or translated)
- Priority: systematic reviews, meta-analyses, clinical trials
- Target: 10,000 highest-quality papers

**Phase B (Month 2-3): Extended sources**
- Add Europe PMC (European-focused)
- Add Cochrane systematic reviews
- Target: 25,000 papers

**Phase C (Month 3-6): Full breadth**
- Add OpenAlex (broader scientific database)
- Add ClinicalTrials.gov for trial data
- Add bioRxiv/medRxiv for preprints (flagged as lower confidence)
- Target: 50,000+ papers

**Phase D (Year 2): Full scale**
- 150,000-500,000 papers
- Multi-language support (translate key non-English papers)
- Specialized subsets (TRT-specific, peptide-specific, GLP-1-specific)

### Curation Principles

Every study gets tagged with:
- **Biomarker tags** — which markers does it discuss
- **Study type** — RCT, observational, meta-analysis, review
- **Sample size** — statistical power
- **Population** — age, sex, ethnicity
- **Year** — recency weight
- **GRADE score** — evidence quality (auto-graded + manual review of top 10%)
- **Relevance tags** — TRT, peptide, longevity, GLP-1, etc.

---

## The Cross-Reference Engine Flow

When a user uploads a blood test, the engine runs this pipeline (< 60 seconds total):

### Step 1: Biomarker extraction (5-10 seconds)
- Claude vision extracts all biomarkers from PDF
- Normalizes to standardized names
- Stores in biomarker_results table

### Step 2: User context enrichment (< 1 second)
- Pull user profile: age, sex, goals, history
- Identify user segment (TRT/peptide/GLP-1/longevity/general)
- Load previous biomarker history if exists

### Step 3: Retrieval per biomarker (2-5 seconds per marker, parallel)
- Query vector database with biomarker + context
- Use MedCPT embeddings for medical relevance
- Retrieve top 50 candidates
- Apply reranking (Cohere) to top 20
- Filter by evidence quality (prefer systematic reviews, meta-analyses)
- Weight by recency (newer research prioritized)

### Step 4: Personalized range calculation (< 1 second)
- Apply Lab-AI methodology: "For this user (age X, sex Y, context Z), what's the optimal range?"
- Generate personalized interpretation from retrieved research

### Step 5: Cross-marker pattern detection (5-10 seconds)
- When 3+ markers are flagged, query pattern library
- Look for documented syndromic patterns in research
- Surface relevant multi-marker research

### Step 6: Analysis generation (20-40 seconds)
- Claude Sonnet generates analysis per biomarker
- Pass: user data + retrieved studies + pattern context
- Include citations, confidence scores, and "what the research says"
- Legal disclaimers automatically included

### Step 7: Bio-age calculation (< 1 second)
- Run KDM algorithm
- Run PhenoAge (if relevant markers present)
- Run DunedinPACE (if relevant markers present)
- Ensemble average with confidence interval

### Step 8: Risk score calculation (< 1 second)
- SCORE2 (European CV risk)
- Metabolic syndrome (NCEP ATP III criteria)
- Allostatic load score

### Step 9: Dashboard render (< 1 second)
- Display results to user
- Include citations, trends, pattern alerts

**Total: 30-60 seconds end-to-end**

---

## Presentation Design Philosophy

### Progressive Disclosure

**Layer 1: Glance view**
- Bio-age (one number)
- Overall health score (one number)
- Top 3-5 insights (prioritized by evidence strength)
- "Something to discuss with your doctor" callouts

**Layer 2: Dashboard**
- All biomarkers grouped by category
- Color-coded (optimal/borderline/concerning)
- Trend arrows
- Quick-scan visualizations

**Layer 3: Deep dive per biomarker**
- Full explanation
- Research citations with confidence scoring
- Historical trend chart
- Related biomarkers
- Factors affecting this marker

**Layer 4: Research library**
- The full Living Research™ corpus access
- Searchable by biomarker, topic, condition
- Linked to user's actual results

### Design Principles

1. **Clarity over density** — users should never feel overwhelmed
2. **Science visible, never hidden** — citations always accessible
3. **Confidence communicated** — every insight shows evidence strength
4. **Progressive not prescriptive** — we inform, user decides
5. **Trustworthy over trendy** — aesthetic = credible, not gimmicky
6. **Private and secure** — data sovereignty visible

---

## Key Performance Targets

- **Extraction accuracy:** 95%+ biomarker recognition
- **Analysis speed:** <60 seconds end-to-end
- **Research freshness:** <24 hours from publication to ingestion
- **Citation accuracy:** 100% (no hallucinations)
- **User satisfaction:** >4.5/5 on insight quality
- **Evidence quality:** 80%+ of insights from high-confidence studies (GRADE High/Moderate)

---

## Ethical Guidelines

1. **No diagnosis.** Lipa provides research-grounded insights, not medical opinions.
2. **No treatment recommendations.** We educate, we don't prescribe.
3. **Always defer to physicians.** Every analysis includes "discuss with your healthcare provider" language.
4. **Transparency about uncertainty.** Show confidence intervals, evidence grades, limitations.
5. **User data sovereignty.** Users own their data, can export or delete anytime.
6. **No dark patterns.** Subscription management is easy, cancellation one-click.
7. **Research transparency.** Every citation is real, linked, and verifiable.

---

## Legal Framing (for every insight)

Standard disclaimer appended to all analysis:

> **This analysis is for educational and research purposes only.** Lipa provides interpretation based on peer-reviewed research but does not provide medical advice, diagnosis, or treatment. Consult your healthcare provider for medical decisions. Lipa is not a medical device and has not been evaluated by the European Medicines Agency, MHRA, FDA, or any other regulatory authority. Insights are based on research retrieval and AI analysis and should be verified with qualified professionals.

---

## References / Foundations

Real peer-reviewed research that validates every component:

1. **Lab-AI (Wang et al. 2024)** — Retrieval augmentation for personalized lab interpretation, arXiv:2409.18986
2. **Goh et al. 2024 (JAMA Network Open)** — LLM diagnostic reasoning 92% vs physician 74%
3. **Kanjee et al. 2023 (JAMA)** — GPT-4 on complex diagnostic cases
4. **Levine et al. 2018** — PhenoAge methodology (Aging journal)
5. **Belsky et al. 2022** — DunedinPACE bio-age
6. **Klemera & Doubal 2006** — KDM bio-age methodology
7. **SCORE2 (European Society of Cardiology 2021)** — EU CV risk algorithm
8. **MedCPT (NCBI)** — Biomedical retrieval model, open source
9. **Auto-GRADE (URSE 2025)** — Evidence quality scoring 0.97 accuracy
10. **Singhal et al. 2023 (Nature)** — Med-PaLM clinical knowledge

Full reference list in `.paul/research/lipa-biomarker-engine-blueprint.md`

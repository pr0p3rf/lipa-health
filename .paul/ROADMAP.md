# Roadmap: Lipa Health

## Current Milestone
**v0.1 — Validate + MVP**

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | Landing Page + Validation | In Progress |
| 1 | Auth + Core App Shell | Not started |
| 2 | Lab PDF Parsing + Biomarker Extraction | Not started |
| 3 | Interpretation Engine | Not started |
| 4 | Dashboard + Data Visualization | Not started |
| 5 | Protocol Generation + Affiliate Links | Not started |
| 6 | Retest + Longitudinal Tracking | Not started |
| 7 | Wearable Integration | Not started |
| 8 | Lab Partnership + Second Market | Not started |

## Phase Details

### Phase 0: Landing Page + Validation
**Goal:** Validate demand before building anything. 200+ waitlist signups = green light.
- Landing page (done — lipa.health)
- Email capture to Supabase
- EUR 100 in Meta ads
- Reddit/community posts
- Call Diagnostyka partnership team
- Kill criteria: <50 signups after EUR 100 spend

### Phase 1: Auth + Core App Shell
**Goal:** Users can sign up, log in, and see an empty dashboard.
- Supabase auth (email + Google)
- Basic app layout with navigation (Overview, Biomarkers, Protocol, Trends)
- User profile + settings
- Stripe subscription setup

### Phase 2: Lab PDF Parsing + Biomarker Extraction
**Goal:** User uploads a lab PDF, system extracts all biomarker values accurately.
- Claude vision API reads lab PDFs
- Structured extraction: biomarker name, value, unit, reference range
- Support Diagnostyka, ALAB, Synevo formats minimum
- Phone camera photo upload
- Validation UI: user confirms extracted values

### Phase 3: Interpretation Engine
**Goal:** AI analyzes biomarkers and generates meaningful health insights.
- Optimal range database (not just lab reference ranges)
- Cross-marker pattern recognition
- Risk scoring (cardiovascular, metabolic, inflammation, hormonal)
- Biological age estimation from blood markers
- Research-backed citations with confidence scores
- Prompt architecture: system prompt + RAG over medical literature

### Phase 4: Dashboard + Data Visualization
**Goal:** Beautiful, premium dashboard that makes people screenshot and share.
- Lipa Score (composite health score)
- Three-zone biomarker bars (InsideTracker-style)
- System scores (Heart, Metabolic, Hormones, Inflammation, Nutrients, Thyroid)
- Biological age display
- Sparkline trends
- Priority ordering (concerning markers first)

### Phase 5: Protocol Generation + Affiliate Links
**Goal:** Every result comes with actionable, research-backed recommendations.
- Supplement recommendations with dosing
- Peptide protocol suggestions (with appropriate framing)
- Lifestyle/nutrition recommendations
- Affiliate links to vetted vendors
- Research citations inline with confidence scores
- One-click to buy

### Phase 6: Retest + Longitudinal Tracking
**Goal:** Users retest quarterly and see their health trajectory.
- Before/after comparison
- Trend charts per biomarker
- Protocol effectiveness tracking ("hs-CRP dropped 40% since starting Omega-3")
- Lipa Score change over time
- Biological age trajectory

### Phase 7: Wearable Integration
**Goal:** Correlate continuous wearable data with periodic blood markers.
- Terra API integration (Oura, Garmin, Whoop, Withings, Fitbit)
- HRV + sleep + activity data correlated with blood panels
- Resting HR trends mapped to thyroid/cardiac markers
- Unified health timeline

### Phase 8: Lab Partnership + Second Market
**Goal:** Direct lab ordering and expansion beyond Poland.
- Diagnostyka B2B partnership (order tests directly through Lipa)
- Electronic results integration (no more PDF upload)
- Medical advisor onboarded
- Launch in Germany or Spain
- Localization

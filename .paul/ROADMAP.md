# Roadmap: Lipa Health

## Current Milestone
**v0.1 — Validate + MVP**

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 0 | Landing Page + Validation | Built, validation gate skipped |
| 1 | Auth + Core App Shell | ✓ Complete |
| 2 | Lab PDF Parsing + Biomarker Extraction | ✓ Complete |
| 3 | Interpretation Engine | ✓ Complete — Stabilization plan 03-01 in PLAN |
| 4 | Dashboard + Data Visualization | ✓ Complete |
| 5 | Protocol Generation + Affiliate Links | Partial (protocols ✓, affiliate marketplace ○) |
| 6 | Retest + Longitudinal Tracking | Not started |
| 7 | Wearable Integration | Not started |
| 8 | Living Protocol + Marketplace Alerts | Not started |
| 8.5 | Peptide Intelligence Directory | Not started — added per PROJECT.md |
| 9 | Health Intelligence Engine | Not started |
| 10 | Lab Partnership + Second Market | Not started |

## Phase Details

### Phase 0: Landing Page + Validation — BUILT, GATE SKIPPED
**Original goal:** Validate demand before building. 200+ signups = green light.
**What happened:** Landing built, ads/Reddit/Diagnostyka outreach not run, signup count never measured. Team went straight to product build.
**Status:** Landing live (lipa.health, 7 languages, GA + Meta Pixel). Newsletter capture ("The Draw") shipped. Kill criteria (<50 signups) never tested.
**Open question:** Was the gate intentionally skipped, or does it still apply retroactively before launch push?

### Phase 1: Auth + Core App Shell — ✓ COMPLETE
- Supabase auth (email + Google + password reset)
- Anonymous-auth upload flow (convert after seeing value)
- Stripe subscription (Free / One / Life tiers)
- Post-payment receipt emails
- Vault with tier-aware upgrade prompts

### Phase 2: Lab PDF Parsing + Biomarker Extraction — ✓ COMPLETE
- Claude vision PDF extraction
- 286 biomarker aliases matched (multi-lab: Diagnostyka, ALAB, Synevo, Stephanie's lab format)
- Outlier clamping + unit conversion
- No-PII extraction prompt + PDF retention disabled by default
- Re-analysis API for re-extracting against improved prompts

### Phase 3: Interpretation Engine — ✓ COMPLETE (reliability issues)
- Two-pass Claude Opus analysis (batched: 4 batch calls + 1 summary)
- Inngest background pipeline (no client-side timeouts)
- 28 cross-marker clinical patterns + RAG-based pattern discovery
- Reynolds Risk Score, contradiction warnings, bio-age calculation
- 250K+ studies indexed, 180+ markers, ~95% citation coverage target
- Ask Lipa chat: persistent history, patterns, protocols, trends (3 free Q's, paywalled)
- **Concern:** Summary-step Inngest route hits 524 timeouts under load — last 8 commits are reactive patches without root cause

### Phase 4: Dashboard + Data Visualization — ✓ COMPLETE
- Apple Health-style hybrid dashboard
- Demo/sample page (public, no auth) — sells the product
- Marker cards with root causes + "What to do" + research citations
- Executive summary (teaser free, full paid)
- Pattern paywall, severity-ranked findings
- Shareable Lipa Health Report Card

### Phase 5: Protocol Generation + Affiliate Links — PARTIAL
**Done:**
- Protocol surfacing in Ask Lipa and marker cards
- Research-backed recommendations with confidence

**Not done:**
- Supplement affiliate marketplace
- Price comparison across vendors
- One-click buy
- Vetted vendor list

### Phase 6: Retest + Longitudinal Tracking
- Re-analysis API exists (Phase 2) but no trends UI
- Per-marker history, before/after comparison, protocol effectiveness chart, bio-age trajectory

### Phase 7: Wearable Integration
- Terra API (Oura, Garmin, Whoop, Withings, Fitbit)
- HRV/sleep/activity correlated with blood panels

### Phase 8: Living Protocol + Marketplace Alerts
- Push/email alerts on research changes, price drops, new products
- Vendor aggregator with price comparison
- AI summarizes new research with confidence scoring

### Phase 8.5: Peptide Intelligence Directory — NEW (added from PROJECT.md)
**Why this is a separate phase:** PROJECT.md (2026-04-08) defines this as a distinct revenue layer with explicit "no peptide affiliate" rule — different commercial model from supplement affiliate (Phase 5).
- Peptide research directory
- Purity data: Janoshik COAs, vendor-submitted COAs, community-submitted, mystery shopper
- Vendor ratings tied to verified test results
- Subscription-only — no checkout links, no affiliate commissions
- Legal positioning as journalism/research publisher

### Phase 9: Health Intelligence Engine
- Knowledge graph: biomarker → condition → substance → research → product → vendor → price
- Continuous PubMed/Examine.com/clinical trial ingestion
- YouTube/podcast claim extraction (Huberman, Attia, Rhonda Patrick) matched to papers
- Phase 3 and Phase 5 query this graph

### Phase 10: Lab Partnership + Second Market
- Diagnostyka B2B (direct test ordering through Lipa)
- Electronic results integration (kill PDF upload as primary path)
- Medical advisor onboarded
- Second market launch (Netherlands, Spain, or Poland-deepening)

---
*Reconciled 2026-04-28 from git evidence. Phase numbering preserved; 8.5 added to address PROJECT.md gap.*

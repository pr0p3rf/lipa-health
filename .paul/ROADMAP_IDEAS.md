# Roadmap Ideas

Captured during 2026-04-29 strategy session. Not promises, not plan items — things to revisit when prioritizing the next milestone or when distribution traction warrants the work.

---

## Product depth (engineering)

### Streaming insights — fix time-to-first-value (TTFV)
Today: user uploads → 17 min wait → all-or-nothing dashboard reveal.
Future: stream batch results as they complete, so first insight lands at 30-60 sec, full action plan at ~17 min.

**Concrete changes:**
- Sort biomarkers by status (out_of_range > borderline > normal > optimal) BEFORE batching, so batch 0 hits highest-priority markers
- Frontend dashboard subscribes to `user_analyses` table via Supabase Realtime, filtered by user_id; renders sections progressively
- Sticky "still analyzing remaining markers" banner with progress (5/20 batches)
- Action plan section: "generating your action plan..." until t9 fires; then animates in
- (v2) Stream the executive_summary itself via `anthropic.messages.stream` — show sentences as they generate (premium feel)

**Effort:** ~1-2 days focused work.
**Why later, not now:** conversion isn't the bottleneck if traffic is empty. Build when daily uploads ≥100 so the data is loud enough to measure impact.

### Pattern coverage — 30 → 60 rules
Current: 30 hand-coded clinical patterns in `pattern-detection.ts`.
Add: PCOS, NASH-specific (beyond NAFLD), CKD + insulin resistance, early dementia risk (homocysteine + B12 + lipids), perimenopause specific, post-viral fatigue patterns, hemochromatosis variants, etc.
Each rule: ~30 min with research-backed thresholds.

### Better RAG queries
Currently grouped by body system. Add:
- Per-pattern queries (already done at the rule-pattern level)
- Per-symptom queries (new) — surfaces studies by user-reported symptom
- Age/sex-stratified queries (new)
- Genetic-context queries when 23andMe data is added

### Inline fallback canonicalization (~30 min)
When `unmatched_biomarkers` insert fires, optionally do an inline cheap Haiku call to canonicalize that ONE marker before storing. ~20ms latency, ~$0.0001 per marker. Most extractions hit the dictionary directly; only fires on misses.

### Weekly Haiku canonicalization cron (~2h)
Scheduled function (Inngest cron, CRON_SECRET already in env):
- Read distinct `unmatched_biomarkers` rows
- Send list to Haiku with one-shot prompt: "Map these to canonical English biomarker names from this list of 140 canonicals"
- Auto-extend `biomarker-aliases.ts` with new mappings
- Output: PR-ready diff for review/merge

This is the "self-aware coverage" loop — dictionary grows organically based on real misses, not preloaded for markets we don't have.

---

## Vault — long-term moat

The Vault is the substrate for an agent that gets smarter about YOU specifically over time. Don't position around the Vault directly ("your health vault" sounds like Apple Health). Position around what it enables: "your AI health coach who remembers everything."

### Five Vault features that compound retention

1. **Personal baselines** — "Your normal TSH is 1.8, not the population mean of 2.5. Today's 3.1 is elevated FOR YOU." Single feature, undefended in market, changes value prop from "interpret my labs" to "Lipa knows my body better than I do."

2. **Trend alerts** — "Your ferritin has dropped for 8 months. At this rate you'll be deficient by August. Retest now or supplement preemptively." Pull → push, conversion engine on retest reminders. Already in Phase 6 of roadmap.

3. **Biological age trajectory** — "You aged 1.2 calendar years in 2025. Reversed by 0.4 years in Q1 2026 after starting omega-3." Visceral. Shareable. Talk-worthy. Bio-age algorithm exists; just needs more time-series data.

4. **AI memory (chat with deep history)** — "Why am I tired today?" → agent pulls TSH from 6mo ago + recent ferritin trend + voice memo about poor sleep + last week's panel. ChatGPT can't do this. Apple Health can't. Function Health can't.

5. **Export-to-doctor PDF** — Vault produces a longitudinal report no doctor could assemble in 5 minutes. Patients walk in armed. Reverse-positioning: turn doctors into Lipa allies, not threats.

### Pricing implication

Vault depth justifies subscription levels:
- Free: 1 panel, 6-month memory, basic interpretation
- $9.99/mo: unlimited panels, infinite memory, baselines + trends
- $19.99/mo: + voice memos, photo OCR, predictive alerts, family sharing

Year-1 ARPU = whatever they pay for first analysis. Year-3 ARPU is $20/mo because they can't conceivably switch. LTV/CAC inverts in your favor as cohorts age.

### Don't do yet
- Don't position around Vault directly
- Don't ship Vault features as the lead product story
- Phase 6 of roadmap (retest UI / longitudinal trends) is the natural entry point

### Constraint to preserve now
- Make sure data architecture supports baseline calculations (storing time-series biomarker_results — ✓ already)
- Don't delete data anywhere — every row is future moat

---

## Distribution

### Niche-by-condition (vs generic wellness positioning)
Stop targeting "wellness curious." Target specific condition cohorts where bloodwork interpretation is a chronic, retest-driven need. Same product, repositioned, 3-5× better conversion in-niche.

**Top condition wedges (research pending — see agent task on 2026-04-29):**
- Hashimoto's / hypothyroidism — high retest frequency, doctor-dismissal pain, large communities
- PCOS — underdiagnosed, similar marker depth as thyroid
- Perimenopause — fastest-growing audience, willingness to pay
- TRT / men's hormone optimization — affluent, optimization-driven, $100/mo readily
- Long COVID / post-viral — desperate population, doctors dismissive

### Trigger-driven content (vs generic SEO)
Content tied to the moments people MOST search for lab interpretation:
- "TSH normal but still feel terrible"
- Just got prescribed Euthyrox/Letrox/Synthroid — what now?
- T3 conversion problems
- Postpartum thyroid changes
- Pregnancy + Hashimoto monitoring
- Side effects from a drug → trying to understand

These are SEO goldmines. 5K+ monthly searches per query in major markets. Multilingual.

### At-home finger-prick partnership
The current funnel requires a draw-center visit (2-3 weeks turnaround). Partner with at-home finger-prick providers for 3-5 day turnaround:
- Medichecks (UK) — public API, mature affiliate program
- LetsGetChecked (US)
- Thorne (US)
- ALAB / Diagnostyka (PL — likely needs direct deal, no public API)

Booking flow: user answers 5 questions → curated panel ("Lipa Foundational" — 25 markers) → Stripe checkout for $99 → kit ships → user pricks finger → result auto-imports → Lipa analysis → upsell to subscription.

**Effort:** 2-3 weeks dev + 1-2 weeks partnership negotiation per market.
**Don't ship until:** validated demand. Build storefront after distribution proves people will buy bloodwork through Lipa.

### Lead-niche launch sequence (90-day commitment, no early pivots)
1. Week 1-2: niche-specific landing page + 5 SEO posts
2. Week 3-4: scale to 20 SEO posts + community presence in 3 biggest groups
3. Week 5-8: influencer outreach to one credible niche personality (free Lipa Life + commission)
4. Week 9-12: measure traction, decide next niche

---

## Holistic protocols (deeper action plans)

Today: 6 domains, 2-4 recs each, single-snapshot.
Future direction: protocols that span weeks and connect across markers.

### Protocol depth ideas
- **Multi-week sequenced protocols** — "Week 1: do A, Week 2: add B, Week 4: assess C, Week 8: retest"
- **Root-cause-driven stacks** — "your low ferritin + low B12 + high homocysteine suggests methylation issues — here's a 12-week methylation support protocol"
- **Drug-supplement interaction warnings** — already partially covered in pattern-detection; expand
- **Cyclical protocols** — perimenopause hormone cycling, female athletes seasonal training, follicular vs luteal supplementation
- **Peptide protocols** — BPC-157, semaglutide, NAD+, CJC-1295 (Lucis competitor weakness)
- **Marker-tracked progress** — protocol explicitly identifies which marker to retest at which week to confirm intervention worked

### Functional medicine integration
- Gut healing protocols (4R, GAPS, Low-FODMAP)
- Methylation support (B-complex variants, MTHFR-aware)
- Mitochondrial support (CoQ10, PQQ, NAD+, NAC, ALA)
- HPA axis recovery (adaptogens, sleep, light exposure)

These protocols are differentiated content, defensible because they require depth + research backing that generic AI tools don't have. Lipa already has the 250K-study substrate.

---

## Pricing surface

### €29 vs €39 inconsistency (small fix, do soon)
The "Lipa One" tier has stale €29 references that don't match the €39 displayed everywhere else:
- `app/src/lib/stripe.ts:35` — comment "€29 one-time"
- `app/src/app/account/page.tsx:19` — `price: "€29"`
- vs. €39 in: `pricing/page.tsx`, `dashboard/page.tsx`, `api/chat/route.ts:89`

Verify what STRIPE_PRICE_ONE is actually configured at in Stripe Dashboard. If Stripe is at €29, checkout may charge less than displayed price (refunds + brand risk). If Stripe is at €39, just fix the two stale strings.

### Orphaned pricing tiers in account/page.tsx
Lines 22-23 reference tiers that aren't surfaced in checkout:
- `essential` / "Lipa Annual" / €149/year
- `complete` / "Lipa Bi-Annual" / €289/year

Either revive (premium tiers above Life?) or delete. Having them visible in account-status copy could confuse users.

### Geo-adaptive currency display
Two-layer approach:
- **Stripe Adaptive Pricing** for checkout — flip a flag in Stripe Dashboard → Products → settings. Auto-converts to user's local currency at checkout using Stripe FX. Zero code changes, set-and-forget.
- **UI display** uses Vercel geo headers (`x-vercel-ip-country`) + a `formatPrice(country, basePriceEur)` helper to render localized strings on `pricing/page.tsx`, `dashboard/page.tsx`, chat error messages, vault paywalls, email copy.

Currency mapping: PL → "169 zł", GB → "£34", US → "$42", EU → "€39", fallback → "€39".

Effort: ~3-4 hours total. Side benefit: makes any future country-specific marketing trivial.

### Cheaper entry tier — "Lipa Insight" (€9-12)
Top 3 priority findings + 1 Ask Lipa question. No full summary, no 6-domain action plan. Hard ceiling on depth.

Why: turns the cold paywall from a 1-step (€39 cold) into a 3-step ladder (€9 → €39 → €89/year). Each step has lower friction than the last. €39 becomes the obvious upgrade ("you saw the priorities — pay €30 more for the full plan"). Don't ship until distribution is real; this only matters if you have traffic to convert.

Don't kill recurring revenue (Vault thesis dies). Don't drop One below €19 (kills margin).

---

## Strategic notes (not actionable, just frame)

### "Is Lipa a company?" — answer: depends on scale targeted
- 1K paying users × $200/yr = $200K — lifestyle business
- 10K × $200 = $2M — small but real company
- 100K × $200 = $20M — venture-scale outcome
- 1M × $200 = $200M — Function Health territory

Function Health hit 200K members in 3 years. Credible target: 10-100K in 18-24 months IF distribution + at-home kits + niche play execute.

### Don't kill bloodwork as the core
The defensible moat is the 250K-study RAG corpus + 30 clinical pattern rules + biomarker-deep analysis. Diluting that for a "personal health agent" pivot would be re-fighting bigger players (Apple, Google, ChatGPT) without the moat.

### Don't optimize an empty funnel
Conversion work (streaming UX, paywall placement, pricing tests) needs traffic to measure against. Build distribution first; iterate conversion when daily uploads ≥100.

### 90-day commitment minimum on niche bets
Niche plays compound over 60-90 days. Don't pivot at day 21 — that's how startups die. Set the test, run it, measure at the end.

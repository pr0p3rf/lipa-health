# Project State

## Current Position
Milestone: v0.1 — Validate + MVP
Phase: 3 of 10 (Interpretation Engine — Stabilization) — Planning
Plan: 03-01 created, awaiting approval
Status: PLAN created, ready for APPLY
Phases 1–4: shipped (built outside PAUL loop)
Phase 5 (Protocol + Affiliates): partial — protocol surfacing live, affiliate marketplace not built
Active concern: analysis pipeline reliability (summary-step 524 timeouts on Inngest)
Last activity: 2026-04-28 — Created .paul/phases/03-interpretation-engine/03-01-PLAN.md

Progress:
- Milestone: [████░░░░░░] ~40% (Phases 1–4 shipped, Phase 5 partial, stabilization in flight)
- Phase 3 stabilization: [█░░░░░░░░░] 10% (plan drafted)

## Loop Position
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ○        ○     [Plan 03-01 created, awaiting approval]
```

## What's Actually Shipped (reconstructed from git, 312 commits since 2026-04-06)

**Phase 0 — Landing + Validation:** built but validation gate never measured
- Landing live, lipa.health domain, 7 languages, GA + Meta Pixel + Vercel analytics
- "The Draw" newsletter capture, dual hero CTAs
- Validation gate from ROADMAP (200 signups → green light) was skipped — went straight to product build

**Phase 1 — Auth + Shell:** ✓
- Supabase auth, Google + email + password reset
- Anonymous-auth no-signup upload (convert after value)
- Stripe with post-payment receipts, free/One/Life tiers
- Vault with upgrade prompts

**Phase 2 — Lab PDF Parsing:** ✓
- Claude vision extraction, 286 biomarker aliases matched, multi-lab format support (Diagnostyka, ALAB, Synevo, Stephanie's lab)
- Outlier clamping, unit conversion, no-PII privacy prompt
- Privacy: PDFs not retained; re-analysis re-enabled selectively

**Phase 3 — Interpretation Engine:** ✓ (with reliability issues, see below)
- Two-pass Opus analysis, batched Opus, Inngest background pipeline
- 28 cross-marker clinical patterns, RAG-based pattern discovery
- Reynolds Risk Score, contradiction warnings, bio-age calc, severity ranking
- 250K+ studies, 180+ markers, citation matching ~95% coverage target
- Ask Lipa chat: history, patterns, protocols, trends, paywalled at 3 free questions

**Phase 4 — Dashboard:** ✓
- Apple Health-style hybrid dashboard
- Demo/sample page (public, no auth)
- Marker cards with "What to do" green box, root causes, research, protocols
- Executive summary (teaser free, full paid), pattern paywall
- Shareable Lipa Health Report Card

**Phase 5 — Protocol + Affiliates:** PARTIAL
- Protocols surface in Ask Lipa and marker cards
- Supplement affiliate marketplace + price comparison: NOT BUILT
- Peptide intelligence directory + purity data (per PROJECT.md): NOT BUILT
- One-click buy: NOT BUILT

**Phases 6–10:** Not started
- Retest/longitudinal trends UI
- Terra wearable integration
- Living protocol / marketplace alerts
- Knowledge graph engine
- Diagnostyka partnership / second market

## Active Concerns

**Analysis pipeline reliability (last 24h, 8 reactive commits)**
Summary step on Inngest hits 524 timeouts. Recent fix attempts:
- Reduced summary prompt size (multiple times)
- Skipped pattern RAG in summary
- Switched Sonnet → Haiku → back to Sonnet
- Added maxDuration=300, batch fallback flip-flopped
- Latest commit (2026-04-28 08:16) restores Sonnet + maxDuration=300

**Pattern:** reactive patching, no root-cause analysis. Pipeline is fragile under real load.

## PROJECT.md vs ROADMAP.md drift
PROJECT.md (updated 2026-04-08) defines two business layers:
- Layer 1: Blood + supplement affiliate (built partially)
- Layer 2: Peptide intelligence directory, purity data, NO peptide affiliate (not in ROADMAP, not built)

ROADMAP.md doesn't include peptide intelligence as a phase. Either ROADMAP needs to add Phase 8.5 (or similar) for peptide directory, or PROJECT.md scope should be deferred.

## Session Continuity
Last session: 2026-04-28
Stopped at: Plan 03-01 created (analysis pipeline stabilization)
Next action: Review and approve plan, then run `/paul:apply .paul/phases/03-interpretation-engine/03-01-PLAN.md`
Resume file: .paul/phases/03-interpretation-engine/03-01-PLAN.md

---
*Reconciled 2026-04-28 from git history (312 commits). No formal PAUL plans exist; this is a retroactive sync.*

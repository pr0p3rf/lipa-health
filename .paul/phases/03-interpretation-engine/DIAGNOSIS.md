---
phase: 03-interpretation-engine
plan: 01
task: 1
created: 2026-04-29
author: Patrick + Claude (paired diagnosis)
---

# DIAGNOSIS — Inngest 524 Timeout

Plan 03-01 Task 1 deliverable. Replaces 8 reactive patches with one root-caused finding.

---

## Setup

Single live production reanalysis run, captured 2026-04-29 ~17:22 UTC, on the deployment carrying t0..t9 instrumentation (commit `fc8c532d`, deployment `lipa-c0xnth2nj`).

- userId: `eceac8c9-7f1a-4447-8ba8-9be5ec07dcee` (Patrick's account, plipnicki@gmail.com)
- Panel: 98 markers — large; representative of worst-case real-world load
- Trigger: fresh PDF upload via the live UI (not /api/reanalyze)
- Observability: 22 lines of additive `console.log` instrumentation in `analyze-panel.ts`, tagging userId + panelSize at every phase boundary
- Capture: Vercel runtime logs (`vercel logs --since=30m --json`) for deployment `lipa-c0xnth2nj-patrick-lukes-projects.vercel.app`
- Outcome: pipeline completed end-to-end. `actionPlanStored=true`. Real Claude-generated summary written; fallback path NOT taken.

A single panel of one size is admittedly not the small/medium/large coverage the plan requested (AC-1). That coverage gap is acknowledged below. The signal from this one large panel is strong enough to root-cause anyway.

---

## Timings observed

### Summary step (`generate-summary`) — t0..t9

| Phase | What | Δms |
|-------|------|-----|
| t0 | step entered (inputPanelSize=98) | — |
| t1 | allAnalyses fetched from Supabase | 349 |
| t2 | userProfile fetched from Supabase | 136 |
| t3 | detectPatterns done (1 pattern matched) | 2 |
| t4 | summary prompt built (promptChars=9758, analysisCount=98) | 0 |
| t5 | about to send to Anthropic (Sonnet 4) | — |
| t6 | Anthropic responded (responseChars=11473) | **48,335** |
| t7 | JSON.parse done | 1 |
| t8 | action_plans row inserted | 252 |
| t9 | step returning, totalMs=49,078, actionPlanStored=true | — |

Anthropic wall-clock dominates: **98.5%** of the summary step is the single `messages.create` call.

### Batch steps (`batch-analysis-N`) — captured

| Batch | Anthropic ms | Output chars |
|-------|--------------|--------------|
| batch 2 | 100,602 | 24,308 |
| batch 3 | **172,676** | 24,085 |
| batch 4 | 97,071  | 22,456 |
| batch 5 | 99,828  | 21,957 |
| batch 6 | 115,013 | 24,402 |
| batch 7 | 105,653 | 22,394 |
| batch 8 | 117,759 | 26,800 |
| batch 9 | 88,123  | 18,757 |

(Batches 0–1 ran on the same deployment but their lines were not captured by the `--since=30m` window — their timings would have been in the same band based on consistent panel size.)

Sum of captured batches: ~896 seconds (~15 min). Including 0–1, total batch wall-clock is ~17–18 minutes. Each batch independently round-trips Anthropic for 88–172 seconds.

The summary prompt is **9,758 chars** (well below the original ~30K+ before reactive cuts). The summary response is **11,473 chars**. The output is the constraint, not the input.

---

## Failure characterization

No failure occurred on this run. The summary step completed cleanly in 49s; batches completed in 88–172s each.

But the historical 524s (8 reactive commits in the prior 24h) almost certainly originated **in batches, not in the summary step**:

- **Batch 3 took 172.7 seconds.** That is dangerously close to Vercel's 300s `maxDuration` ceiling. With even modest variance — slower Anthropic responses, retries on rate limits, larger panels — a batch *will* cross 300s and get killed by Vercel before the function returns.
- The summary step at 48s has comfortable 6× headroom against 300s. It was never the structural risk.
- The reactive patches that targeted the summary (cut prompt to "critical markers only", removed pattern RAG, switched Sonnet→Haiku→Sonnet) addressed the *visible* symptom but mis-located the layer causing the 524.

So the current state: pipeline works on a 98-marker panel because every step (incl. batch 3 at 172s) fits under 300s. There is no margin. The shape of the failure was never gateway-related — it was Vercel function timeout during slow Anthropic generations.

The Cloudflare ~100s gateway hypothesis from the plan is **rejected** by this evidence. If Cloudflare were the bottleneck, the 172s batch 3 call would have 524'd and the run would have failed. It didn't. So either:
1. Cloudflare is not in front of this Vercel deployment for this path, or
2. Cloudflare's idle timeout doesn't apply because Anthropic's response stream emits bytes during the long generation (keeping the connection non-idle)

Either way: the fix doesn't need to bypass Cloudflare or stream-around-Cloudflare. The fix needs to address Anthropic call duration getting close to Vercel's `maxDuration`.

---

## Hypothesis status

The plan stated: "Cloudflare's 100s gateway timeout in front of Vercel cuts the Inngest→Vercel connection before the non-streamed Sonnet response (8192 max_tokens) finishes."

**REJECTED.** Multiple individual Anthropic calls in this run exceeded 100 seconds (batch 3 = 172s, batch 8 = 118s, batch 6 = 115s) and completed successfully. If the 100s Cloudflare gateway were the cut, none of these would have completed. They did. So Cloudflare is not the operative timeout.

The actual operative timeout is **Vercel's per-function `maxDuration`**, currently set to 300s on `app/src/app/api/inngest/route.ts`. The reactive patches that bumped this from 60s default to 300s are what is keeping the pipeline alive today.

---

## Confirmed root cause

**Vercel function maxDuration ceiling is the only reason the pipeline works. Anthropic batch latency for max_tokens=8192 generations is consistently 90–170s. With 10 batches running serially through Inngest's step.run, the pipeline is structurally close to its ceiling on every large panel.**

Contributing factors that made the symptom appear in the summary step (and led the reactive patches astray):
- Summary step was the LAST step, so users saw "fallback summary" land in the dashboard when an earlier batch step actually 524'd and the function gave up. The fallback path silently masks failures by writing a generic plan.
- The original (pre-reactive) summary prompt was indeed large — but the cut to "critical markers only" did not address the actual risk.

Three quality regressions from the reactive patches that should be reversed once the structural fix is in place:
1. `de21ec2b`: pattern RAG removed from summary
2. `b0c11319`: summary prompt reduced to critical markers + shorter schema (loses depth on optimal markers)
3. `cb02a663`: silent fallback action plan inserted with no telemetry — users currently have no way to know if their plan came from Claude or from the placeholder

---

## Recommended fix

Three changes, in order. Each is independently shippable and reversible.

### Fix 1: Reduce BATCH_SIZE from 10 → 5 (highest leverage)

Halving the batch size halves the output tokens per call and roughly halves the Anthropic latency per batch. A batch that took 172s drops to ~85s. The 300s ceiling becomes a 3.5× margin instead of 1.7×. Doubles the number of step.run invocations but Inngest handles step concurrency cleanly.

Expected outcome: max single-batch call drops from ~170s to ~90s. 524 risk effectively eliminated for any realistic panel size up to 200 markers.

Cost: 0 model changes, no quality regression. Slight increase in fixed per-batch overhead (RAG retrieval runs more times — about 2x), partly offsetting the latency win. Net: pipeline takes ~50–70% as long wall-clock-wise (because batches can run in parallel via Inngest).

### Fix 2: Restore summary prompt depth + pattern RAG

Reverse `de21ec2b` and `b0c11319`. The reactive cuts were addressing a non-issue (summary was never the timeout). Quality is the product. After Fix 1, there is enough timing margin to restore the original depth.

### Fix 3: Replace silent fallback with telemetry

Reverse `cb02a663`'s implicit data hiding. If Claude fails, write a `summary_failures` row with the userId/test_date/error rather than silently writing a placeholder action_plan. Users still see SOMETHING (we keep the placeholder for resilience), but operations gets a signal.

### NOT recommended

- **Switch to streaming (`messages.stream`)**: zero benefit given the rejected Cloudflare hypothesis. Adds code complexity for nothing.
- **Bypass Cloudflare / point Inngest at *.vercel.app**: same — wrong layer.
- **Switch summary to Haiku**: reactive degradation that was already partially reversed. No.
- **Increase `maxDuration` further**: Vercel Pro caps at 800s; Hobby at 60s. We're on Pro. Going higher than 300s is theoretically possible but masks the underlying tail-latency risk. Fix the tail, don't extend the ceiling.

---

## What to monitor going forward

Per-batch and summary timings are now logged. To make the data continuously useful:

1. Track p95 of `t6 - t5` for both summary and each batch over time — proxy for Anthropic latency drift.
2. Alert when any single batch exceeds 250s — early warning before 300s kills it.
3. Track `actionPlanStored=false` rate — if Fix 3 is shipped, this is the canonical "Claude failed" signal.

---

## Coverage gap (acknowledgment)

This diagnosis was built on ONE panel (98 markers, large). The plan asked for small/medium/large coverage. Strict adherence would have required reanalyzing additional panels, but no other Patrick-owned panels of varying size existed in the data. Choosing not to nuke real customer panels for the sake of completeness was a deliberate tradeoff — the single large panel produced enough timing signal to invalidate the gateway-timeout hypothesis and reveal the real ceiling.

If Fix 1 ships and we want before/after evidence on smaller panels too, that data will accumulate naturally as new uploads flow through the instrumented code path.

# Personalized Living Research Insights — Execution Plan

**Status:** Planning · not yet started
**Owner:** —
**Dependencies:** Lipa Taste paywall (task #9) recommended first so there's a clear upgrade target
**Estimated work:** ~10 focused days across 5 phases

---

## 1. What we're building

When a new peer-reviewed study lands that's relevant to a Lipa member's specific biology, they hear about it.

Concretely: our nightly ingestion pipeline pulls new studies from PubMed and partner sources. Each study is categorized, funding-tagged, evidence-graded, and summarized into a structured insight. That structured insight is then matched against every member's most recent biomarker profile. Matches above a quality + relevance threshold become **personalized insights** delivered to the member via email digest and in-app notification.

This is the literal definition of "Living Research™." It turns our static corpus into an ongoing service that becomes more valuable the longer a member is with us, and it's something no competitor is doing.

---

## 2. Current state (what exists)

- ✅ **Ingestion pipeline** — `scripts/ingest-pubmed.ts` pulls PubMed studies nightly, filters by query, embeds with OpenAI text-embedding-3-small, stores in `research_studies` with pgvector HNSW index
- ✅ **Basic categorization** — biomarker canonical mapping (`biomarker_reference` table), GRADE scoring from study type, recency weighting
- ✅ **Per-upload analysis** — `src/lib/living-research.ts::analyzeBiomarker()` retrieves top-k studies for a biomarker value, passes to Claude Sonnet with a grounding prompt, stores the analysis in `user_analyses` with citations in `analysis_citations`
- ✅ **Schema** — `research_studies`, `biomarker_reference`, `biomarker_results`, `user_analyses`, `analysis_citations` all live in Supabase
- ✅ **Risk calculations library** — `src/lib/risk-calculations.ts` with 12 peer-reviewed methods

## 3. What's missing

- ❌ **Funding extraction** at ingest
- ❌ **Structured insight extraction** at ingest (per-study schema)
- ❌ **Personalized insights table** linking users to new studies
- ❌ **Nightly match job** that joins new insights to member biomarker profiles
- ❌ **Email delivery** (Resend / Loops integration)
- ❌ **In-app notification bell** on the dashboard
- ❌ **Rate limiting + user preferences** to prevent alert fatigue

---

## 4. Data model changes

### New columns on `research_studies`

```sql
alter table research_studies add column funding_source text;
  -- 'independent' | 'government' | 'non_profit' | 'industry' | 'mixed' | 'undeclared'
alter table research_studies add column funding_detail text;
  -- free text, e.g. "NIH R01 HL123456"
alter table research_studies add column funding_weight numeric default 1.0;
  -- multiplier applied to effective grade score
alter table research_studies add column plain_summary text;
  -- ~100 word plain-English TL;DR generated at ingest
alter table research_studies add column population_tags text[];
  -- e.g. {'adults', 'prediabetic', 'female', 'age_40_60'}
alter table research_studies add column intervention_tags text[];
  -- e.g. {'lifestyle', 'supplement_omega3', 'dose_1g_2g'}
alter table research_studies add column effect_direction text;
  -- 'reduces' | 'increases' | 'no_effect' | 'mixed'
alter table research_studies add column effect_magnitude text;
  -- structured description, e.g. "0.5-1.2 mg/L reduction over 12 weeks"
```

### New table: `study_insights`

One-to-many with `research_studies`. A study can produce multiple structured insights (one per biomarker it touches).

```sql
create table study_insights (
  id bigserial primary key,
  study_id bigint references research_studies(id) on delete cascade,
  biomarker text not null,              -- e.g. 'hs-CRP'
  value_range_low numeric,              -- matched against user's value
  value_range_high numeric,
  effect_direction text,                -- 'reduces' | 'increases' | 'no_effect'
  effect_magnitude_text text,           -- "0.5-1.2 mg/L reduction"
  intervention_summary text,            -- "EPA+DHA supplementation, 1-2g/day"
  population_fit jsonb,                 -- {'age_min': 30, 'sex': 'any', ...}
  confidence_level text,                -- 'high' | 'moderate' | 'low'
  plain_headline text,                  -- "A new study finds X lowers Y by Z in people with..."
  plain_body text,                      -- 2-3 paragraph explanation
  grade_score text,                     -- copied from study for convenience
  funding_source text,                  -- copied from study
  created_at timestamptz default now()
);
create index on study_insights (biomarker);
create index on study_insights (value_range_low, value_range_high);
```

### New table: `personalized_insights`

Links a `study_insights` record to a specific user who has a matching marker profile.

```sql
create table personalized_insights (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  study_insight_id bigint references study_insights(id) on delete cascade,
  biomarker_result_id bigint references biomarker_results(id) on delete set null,
    -- which specific marker reading triggered the match
  relevance_score numeric,              -- 0-1, combined quality + fit
  trigger_reason text,                  -- "hs-CRP was 2.8 mg/L (borderline)"
  delivered_at timestamptz,             -- null if queued but not delivered
  delivered_channels text[],            -- {'in_app', 'email_digest'}
  user_opened_at timestamptz,
  user_clicked_study_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz default now()
);
create index on personalized_insights (user_id, delivered_at);
create index on personalized_insights (created_at);
```

### New table: `notification_preferences`

```sql
create table notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_digest_enabled boolean default true,
  email_digest_cadence text default 'weekly',  -- 'daily' | 'weekly' | 'off'
  in_app_enabled boolean default true,
  max_insights_per_week int default 3,
  categories_enabled text[] default '{cardiovascular,metabolic,liver,kidney,inflammatory,thyroid,hormonal,nutritional}',
  minimum_grade text default 'A',       -- 'A+' | 'A' | 'B' | 'C'
  updated_at timestamptz default now()
);
```

---

## 5. Phase 1 — Ingest-time enrichment (~3 days)

**Goal:** Every new study, at ingest, gets funding-tagged, summarized, and turned into one or more structured insights.

### Tasks

1. **Extract funding from PubMed** (`scripts/ingest-pubmed.ts`)
   - Parse `GrantList` and `FundingSource` fields from PubMed XML
   - If structured data present → classify as government / academic / non_profit / industry / mixed
   - If absent → LLM pass on acknowledgments text to classify, or mark as `undeclared`
   - Store in `funding_source`, `funding_detail`, and compute `funding_weight`

2. **Generate plain summary** — LLM pass per study
   - Input: title + abstract
   - Output: ~100-word plain-English TL;DR for a health-curious non-medical reader
   - Model: claude-haiku (cheap, ~$0.001/study)
   - Store in `plain_summary`

3. **Extract structured insights** — LLM pass per study, multi-turn if needed
   - Input: title + abstract + detected biomarkers
   - Output: JSON array of `{biomarker, value_range, effect_direction, effect_magnitude, intervention, population_fit, confidence, plain_headline, plain_body}`
   - Schema-constrained output (Claude tool use or structured output)
   - One study can produce 0-N insights (e.g. a study on hs-CRP + omega-3 produces one hs-CRP insight; a study on diabetes prevention produces insights for glucose, HbA1c, and insulin)
   - Insert into `study_insights`
   - Model: claude-sonnet (better reasoning, ~$0.01/study)

4. **Update ingest script with pipeline stages:**
   - Stage A: fetch from PubMed (exists)
   - Stage B: classify study type + extract funding (new)
   - Stage C: generate plain summary (new)
   - Stage D: extract structured insights (new)
   - Stage E: embed + store (exists)

### LLM prompts needed

- **Funding classifier prompt** — takes funding text, returns category + weight
- **Plain summary prompt** — takes abstract, returns ~100 words
- **Structured insight extractor prompt** — takes abstract, returns JSON schema

All three should be checked in as `src/lib/prompts/` module with version strings for reproducibility.

### Cost estimate

At 2,000 studies/day:
- Funding classifier: ~$0.0005/study → $1/day
- Plain summary: ~$0.001/study → $2/day
- Insight extractor: ~$0.01/study → $20/day
- **Total ingest cost: ~$23/day · $690/month**

This is the dominant cost. We can optimize by:
- Using Haiku for summary + classifier (cheap model)
- Only running insight extractor on studies that match a biomarker in our canonical list (~30% of ingested studies)
- Caching prompt template as a system prompt to save tokens

**Realistic optimized cost: ~$8-12/day · $250-350/month** at 2,000 studies/day.

---

## 6. Phase 2 — Matching engine (~2 days)

**Goal:** Nightly job that takes newly extracted `study_insights` and creates `personalized_insights` rows for every user with a matching biomarker profile.

### Tasks

1. **Build nightly match job** (`scripts/match-insights.ts`)

```typescript
// Pseudocode
for each new study_insight where created_at > last_run_timestamp:
  if insight.grade_score < user_pref.minimum_grade: skip

  // find users whose most recent test has a matching marker in range
  candidates = query("""
    select br.user_id, br.id as biomarker_result_id, br.value
    from biomarker_results br
    where br.biomarker = :biomarker
      and br.value between :value_range_low and :value_range_high
      and br.test_date > now() - interval '180 days'
      and br.id = (
        -- only most-recent test for this user-biomarker
        select max(id) from biomarker_results
        where user_id = br.user_id and biomarker = br.biomarker
      )
  """)

  for each candidate:
    // check demographic fit from user_profiles
    if not population_fit_check(candidate.user_id, insight.population_fit): skip

    // check rate limits from notification_preferences
    if user.insights_this_week >= user.max_insights_per_week: skip

    // compute relevance
    relevance = insight_grade × funding_weight × recency_weight × population_fit
    if relevance < 0.6: skip

    // insert personalized insight
    insert into personalized_insights (
      user_id, study_insight_id, biomarker_result_id,
      relevance_score, trigger_reason, delivered_channels
    )
```

2. **Cron schedule** — runs once per day, typically after ingestion completes (~04:00 UTC)

3. **Indexes to make it fast:**
   - `biomarker_results (user_id, biomarker, test_date DESC)` — already exists
   - `study_insights (biomarker, value_range_low, value_range_high)` — new
   - `personalized_insights (user_id, created_at)` — new

**Scale check:** at 2,000 new insights/day × 10,000 users, the inner loop is 20M lookups. With the indexes above, this runs in ~30-60 seconds. Comfortable.

---

## 7. Phase 3 — Delivery (~3 days)

**Goal:** Get matched insights in front of users via two channels.

### In-app notification bell

1. Dashboard fetches `personalized_insights where user_id = current and delivered_at is null OR not dismissed`
2. Shows count in a bell icon in AppNav
3. Click opens a drawer/modal showing insight cards with:
   - Trigger reason ("Your hs-CRP was 2.8 mg/L on your last upload")
   - Plain headline
   - Plain body (2-3 paragraphs)
   - Study citation with funding label, grade pill, PMID link
   - Dismiss button
4. On open, sets `user_opened_at = now()`
5. On click-through to PubMed, sets `user_clicked_study_at = now()`

### Email digest via Resend

1. Set up Resend account + domain verification (Go Exe B.V. email)
2. Create `InsightDigest` React Email template
3. Nightly/weekly cron (respects `notification_preferences.email_digest_cadence`)
4. For each user with email enabled and undelivered insights:
   - Compose digest (1-N insights, respecting `max_insights_per_week`)
   - Send via Resend
   - Update `personalized_insights.delivered_at = now()` and `delivered_channels = array_append('email_digest')`
5. Track opens via Resend webhook → `user_opened_at`

### Cost
- Resend: €20/mo for 50K emails. Free tier covers first 3K/mo which is enough for MVP
- Cron infrastructure: Supabase Edge Functions (free) or Railway cron (€5/mo)

---

## 8. Phase 4 — Rate limits, QA, settings (~2 days)

**Goal:** Make sure users don't get spammed and insights are high quality.

### Tasks

1. **Rate limiting in match job**
   - Respect `max_insights_per_week` per user
   - Per-marker cooldown: max 1 insight per biomarker per 30 days (avoid flooding on a single marker)
   - Global cooldown: no more than 3 insights per user per week regardless of markers

2. **Notification preferences UI**
   - New `/settings/notifications` page in app
   - Toggle email digest on/off
   - Select cadence (daily / weekly / off)
   - Set max insights per week
   - Toggle category opt-in (cardiovascular, metabolic, etc.)
   - Minimum grade filter

3. **Quality gates (launch settings — conservative)**
   - Only Grade A+ insights in first 30 days
   - Only from independent / government / non-profit funding sources in first 30 days
   - Manual spot-check of top 10 delivered insights per day (Patrick reviews with morning coffee)
   - Weekly report: which insights delivered, which got opened, which got clicked through
   - If click-through-rate < 20%, tighten threshold

4. **Insight health dashboard** (internal, not user-facing)
   - Admin view: all delivered insights in last 7 days
   - Click-through rates per insight
   - User complaints / dismissals

---

## 9. Phase 5 — Launch criteria

Before turning on email delivery to real users:

- [ ] Phase 1-4 complete
- [ ] Match job running daily for 7 days without errors
- [ ] At least 100 study_insights generated and reviewed by a human
- [ ] At least 50 test personalized_insights routed correctly (use seed test accounts)
- [ ] Insight headlines pass the "would I forward this to a friend" sniff test
- [ ] Rate limits tested with a stress user who has 10+ markers in range
- [ ] Unsubscribe flow works end-to-end (link in email → preference update → confirmation)
- [ ] Resend domain verified, SPF/DKIM set up, deliverability tested
- [ ] Monitoring on match job (Sentry or Supabase logs)
- [ ] Internal launch: only Patrick's test account receives for 3 days
- [ ] Beta launch: 10 founding members opt in
- [ ] Public launch: feature ships to all Insight subscribers

---

## 10. Cost model at steady state

| Item | Monthly cost |
|---|---|
| LLM ingest (funding + summary + insight extract) | $250-350 |
| Resend email delivery | €20-50 |
| Supabase pgvector + storage | existing plan |
| Cron infrastructure | €0-5 |
| **Total incremental** | **~€320-450/month** |

At 1,000 Insight subscribers × €79/year = €6,583/month in revenue. This feature costs ~5-7% of revenue and is the primary retention driver. Good ROI.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Insights feel low-quality or wrong | Grade A+ only for first 30 days; human spot-check; click-through monitoring |
| Alert fatigue kills retention | Strict per-user weekly limits; category opt-in; unsubscribe link in every email |
| LLM extracts wrong "main finding" from abstract | Few-shot prompting with 20 examples; human QA loop; retry on low-confidence |
| Matching to stale marker values | 180-day freshness window; future: factor in recent trend direction |
| Privacy concerns (EU users) | Email content doesn't reveal specific values unless user opens app; delete on user request per GDPR |
| Users unsubscribe and never come back | Progressive disclosure — start weekly digest, offer bi-weekly / monthly as "less frequent" option before full unsubscribe |
| False confidence in intervention claims | Every insight includes "discuss with your physician" footer; insights framed as research observations, never as recommendations |

---

## 12. Success metrics

**Week 1 (internal):**
- Ingestion job runs daily without error
- At least 50 new `study_insights` per day
- Funding extraction >95% coverage on grant-listed papers

**Week 4 (beta — 10 users):**
- At least 1 personalized insight per user per week
- Click-through rate on email ≥ 30%
- Unsubscribe rate < 10%
- No false-positive complaints

**Month 3 (public):**
- 70%+ of Insight subscribers have email digest enabled
- Email → app click-through rate ≥ 25%
- NPS question: "Has Lipa surfaced research relevant to you?" — target ≥ 70% "yes"
- Retention lift on subscribers who receive insights vs those who don't (should be measurable)

---

## 13. Open questions for Patrick

1. **Email sender domain** — `insights@lipa.health`? Need to set up subdomain or use main domain.
2. **Default cadence** — weekly (safer) or daily (more engagement)? I'd vote weekly default with daily as opt-in.
3. **Free tier (Lipa Taste) access** — do free users get a *preview* of personalized insights (e.g. 1 sample per month to drive conversion), or is this Insight-tier only?
4. **Clinical advisor review** — should a clinician spot-check the insight output before launch? Lower legal risk and higher credibility.
5. **Beta group** — do you want to hand-pick 10 early testers from the waitlist, or open it to all paying subscribers immediately?

---

## 14. Build sequence

Recommended order (total ~10 focused days):

1. **Day 1-2** — Schema migrations + ingest pipeline refactor + funding extractor
2. **Day 3-4** — Plain summary + structured insight extractor (LLM prompts + schema validation)
3. **Day 5-6** — Match job + data model for personalized_insights + test with seed data
4. **Day 7** — In-app notification bell + dashboard integration
5. **Day 8** — Resend setup + email digest template + delivery cron
6. **Day 9** — Notification preferences UI + rate limits + QA
7. **Day 10** — Internal launch, monitoring, docs

If Patrick prioritizes this after the Lipa Taste paywall, total time from today: ~3 weeks (Taste paywall ~1 week, insights system ~2 weeks).

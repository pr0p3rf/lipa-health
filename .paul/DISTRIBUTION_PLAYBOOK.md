# Lipa Distribution Playbook

Created 2026-04-29. Living document — update as work ships.

This is the **execution plan** for getting Lipa's existing 55-article research library + niche landing pages in front of real users with high purchase intent. Every item has a clear owner (Patrick or Claude), an estimated effort, and a status field.

---

## Status legend
- 🔴 **Not started**
- 🟡 **In progress**
- 🟢 **Shipped**
- ⏸️ **Blocked / waiting**
- ❌ **Killed / not doing**

---

## 1. Audit findings — existing research library

Audited a representative sample (research-hashimotos-thyroid.html, research-pcos-blood-tests.html, research-trt-blood-monitoring.html). 55 articles total.

### What's strong (don't touch)
- ✅ Substantial content depth (500-700 lines per article)
- ✅ Proper SEO meta + canonical URLs
- ✅ JSON-LD MedicalWebPage schema
- ✅ FAQPage schema with 6-7 detailed Q&A per article
- ✅ Inline citations with PubMed PMIDs and evidence grades (GRADE-style)
- ✅ Premium visual design (Inter + Fraunces fonts, consistent palette)
- ✅ research.html index page
- ✅ sitemap.xml exists

### What's weak (fixable)
1. **In-article CTA target inconsistency.** The `.lipa-cta-box` inside articles links to `/#join` (homepage section) and `.btn-primary` in the article CTA section also links to `/#join`. The nav CTA correctly links to `https://my.lipa.health/upload`. **Fix:** every CTA on a research article should go directly to `/upload` (or `/pricing` for the high-intent footer CTA). One-click to action.

2. **Cross-linking between research articles is sparse.** A reader on `research-hashimotos-thyroid.html` should naturally flow to `research-iron-deficiency-without-anemia.html`, `research-vitamin-d-optimization.html`, `research-b12-deficiency.html`, etc. The "Related research" sections (`<section class="related">`) appear empty/placeholder in many articles. **Fix:** for each article, hand-curate 4-6 related articles in the related grid. ~10 min per article.

3. **No condition-specific aggregator landing pages** (until tonight's `hashimoto.html`). Research articles are written like medical content. Aggregator pages convert visitors who searched a high-intent query like "Hashimoto's blood test interpretation" by showing a sample analysis + multiple CTAs + condition-specific value prop.

4. **Email capture missing on most articles.** A visitor who reads but doesn't upload is lost. Add a "Get the [condition] cheat sheet" lead magnet to each high-traffic article.

5. **Internal trust signals could be louder.** "250,000+ peer-reviewed studies", "30+ clinical patterns", "180+ markers" — these appear inconsistently. Standardize a stats strip across articles.

6. **Search Console / Analytics integrity unknown.** Need to verify:
   - Are these pages indexed by Google?
   - Which queries are they ranking for?
   - What's the click-through rate from impression?
   - What's the bounce rate / time on page?
   These answers determine whether to write more or fix what's there. **TODO Patrick: connect Google Search Console + share read access for an audit.**

### Specific high-priority articles to fix CTAs on
Articles likely to drive most traffic per their topics — fix CTA targets first:
1. `research-hashimotos-thyroid.html` — high search volume condition
2. `research-pcos-blood-tests.html` — 197k Reddit
3. `research-trt-blood-monitoring.html` — 208k Reddit
4. `research-perimenopause-blood-tests.html` — fastest growing audience
5. `research-normal-labs-still-sick.html` — universal pain point
6. `research-cholesterol-apoB.html` — universal CV risk
7. `research-thyroid-complete-guide.html` — high search
8. `research-iron-deficiency-without-anemia.html` — millions affected
9. `research-semaglutide-blood-monitoring.html` — fastest-growing audience
10. `research-tirzepatide-blood-monitoring.html` — same

**Effort:** ~5 min per article × 10 = 50 min total.

---

## 2. Niche aggregator landing pages

Aggregator pages target high-intent search queries and convert via sample analysis + multiple CTAs. Different from research articles — these are conversion pages.

| Page | URL | Status | Owner | Effort | Notes |
|------|-----|--------|-------|--------|-------|
| Hashimoto's | `/hashimoto.html` | 🟢 SHIPPED 2026-04-29 | Claude | 60 min | Built tonight. Premium design, sample anonymized analysis, 6 Lipa-catches cards, complete panel table, related research links, Stripe-aware pricing. Added to sitemap. |
| PCOS | `/pcos.html` | 🔴 Not started | TBD | ~90 min | Same template as `/hashimoto.html`. Pull from `research-pcos-blood-tests.html`. Sample case: 28F, irregular cycles, low AMH, high free T, low SHBG, fasting insulin elevated. |
| Perimenopause | `/perimenopause.html` | 🔴 Not started | TBD | ~90 min | Same template. Pull from `research-perimenopause-blood-tests.html`. Sample case: 47F, sleep disruption, FSH 22, estradiol fluctuating, low DHEA-S, vitamin D 24. Lead with "doctors say testing is unnecessary — they're wrong" angle. |
| TRT | `/trt.html` | 🔴 Not started | TBD | ~90 min | Same template. Pull from `research-trt-blood-monitoring.html` + `research-testosterone-optimization.html`. Sample case: 38M on TRT 200mg/wk, hematocrit 53, E2 sensitive 38, SHBG 16, low free T despite total T 1100. |
| Long COVID | `/long-covid.html` | 🔴 Not started | TBD | ~120 min | NEW article needed first (no existing research page). Sample case: post-viral fatigue, elevated inflammatory markers, low cortisol, vitamin D deficiency, dysautonomia panel. |

**Pattern locked-in by `/hashimoto.html`:** if/when a future template change is needed, edit one and propagate. Treat `hashimoto.html` as the canonical conversion-page template.

---

## 3. Missing condition articles

Research articles that don't yet exist in the library, prioritized by audience size + WTP:

| Article | URL | Status | Priority | Effort | Notes |
|---------|-----|--------|----------|--------|-------|
| Long COVID / ME-CFS | `research-long-covid-blood-markers.html` | 🔴 Not started | High | 4-5h | 17M+ US adults, 1.25M UK. New 2025 epigenetic test 96% accurate. Inflammation + cortisol + autonomic markers + viral persistence. |
| AMH / Fertility tracking | `research-amh-fertility-tracking.html` | 🔴 Not started | High | 3-4h | $1.2B → $2.5B AMH testing market by 2035. IVF prep, egg freezing decision, ovarian reserve. |
| Lp(a) cardiovascular early warning | `research-lipoprotein-a.html` | 🔴 Not started | Medium-High | 3-4h | 20% of adults have elevated Lp(a). AHA March 2026 guidelines now recommend universal screening. Set at birth, single test. |
| Perimenopause HRT decision | `research-perimenopause-hrt-decision.html` | 🔴 Not started | Medium | 4-5h | Specifically the "should I start HRT" decision via blood markers + symptoms. Mary Claire Haver audience. |

**Don't write these in a rush.** Each must match the quality bar of existing research articles (500+ lines, full schema markup, FAQ schema, evidence-graded citations). Mediocre articles hurt SEO and brand.

**Recommended sequence:** Long COVID first (largest underserved audience); Lp(a) second (universal CV story); AMH third; HRT-decision fourth.

---

## 4. Affiliate program applications

Patrick already drafted `AFFILIATE_APPLICATIONS.md` with universal copy + 9 programs queued. **Tonight's task is to add status tracking + prioritize which to actually submit this week.**

### Priority rationale

Submitting all 9 in one week is fine — affiliate networks each take 2-7 days for approval. But focus your time on high-conversion programs first.

| Priority | Program | Network | Status | Approval ETA | Commission | Notes |
|----------|---------|---------|--------|--------------|------------|-------|
| 🥇 1 | **Medichecks** | Awin | 🔴 Not submitted | 2-7 days | 10% rev share | UK at-home finger-prick. EXACTLY the booking flow we want. Apply tonight. |
| 🥇 2 | **LetsGetChecked** | Impact | 🔴 Not submitted | 1-7 days | 10-15% | US at-home, large catalog. Apply tonight. |
| 🥇 3 | **Thorne** | Impact | 🔴 Not submitted | 1-7 days | 10-20% | Premium supplements. Universal recommendation surface for action plans. Apply tonight. |
| 🥈 4 | **Pure Encapsulations** | direct or Awin | 🔴 Not submitted | 7-14 days | 10-15% | Pharmacist-tier supplement brand. Quality match for Lipa audience. |
| 🥈 5 | **Forth** | direct | 🔴 Not submitted | 7-14 days | TBD | UK at-home backup if Medichecks gets stricter. |
| 🥈 6 | **Randox Health** | Tradedoubler | 🔴 Not submitted | 7-14 days | TBD | UK lab provider. |
| 🥉 7 | **iHerb** | direct + Impact | 🔴 Not submitted | 1-7 days | 5-10% | Mass market supplements. Lower margin but global reach. |
| 🥉 8 | **Nordic Naturals** | direct or Awin | 🔴 Not submitted | 7-14 days | 10-15% | Specifically for omega-3 recommendations (universal in action plans). |
| 🥉 9 | **Quest Direct** | partners.questhealth.com | 🔴 Not submitted | 14-30 days | TBD | US lab provider. Slower approval; lower priority because of US regulatory friction. |

### Tracking columns to add to AFFILIATE_APPLICATIONS.md
For each program, track:
- Submission date
- Application ID / reference
- Approval status (pending / approved / rejected / no response)
- Tracking URL once approved
- Commission rate confirmed
- First sale date
- Cumulative revenue
- Notes (rejection reason, follow-up needed, etc.)

### Tonight: submit programs 1, 2, 3
Patrick's job (Claude can't): the actual form submission requires Patrick to log in / enter banking info / verify identity. ~60 min total.

Claude can: pre-fill answers using the existing universal copy in AFFILIATE_APPLICATIONS.md.

---

## 5. Distribution channels (after affiliate approvals land)

Once affiliate links are live, here's where to share content:

### Reddit (free, high-leverage, requires Patrick)
- r/Hashimotos (~33k members)
- r/Hypothyroidism (~150k+)
- r/PCOS (197k members)
- r/Menopause (98k members)
- r/Testosterone (208k members)
- r/Perimenopause (~90k)
- r/longhauler (~65k)
- r/IronDeficiency (~10k)

**Approach:** answer real questions deeply (not promotional). Drop Lipa link only when naturally relevant ("you can upload your panel here for the full breakdown"). Founder-voice required — bots get banned. Patrick posts; Claude can draft.

### Facebook groups (free, requires Patrick)
- "Hashimoto's 411" (large English Hashimoto group)
- "Hashimoto's Disease Healing" (large)
- "PCOS Awareness Association"
- "Menopause Chicks"
- Polish Hashimoto + PCOS groups (50k+ members each)

### Influencer outreach (paid + free)
- Mary Claire Haver (perimenopause, 3M+ Instagram)
- Lara Briden (functional gynecology)
- Izabella Wentz (Hashimoto specifically)
- Ben Greenfield (biohacker)
- More Plates More Dates (TRT, 2M+)
- Polish thyroid YouTube channels
- ~$50-200 per influencer mention or revshare deal

### Newsletter swap / guest content
- Once Lipa has email list, swap with similar-niche newsletters
- Guest post on functional medicine blogs (Mark Hyman, IFM, Parsley)

### Long-term: paid acquisition
Don't start until organic distribution is generating consistent leads. Then test Meta + Google Ads against high-intent queries.

---

## 6. Backlog (do after tonight, before next sprint)

### Quick wins (1-2 hours each)
- [ ] Fix CTA targets on top 10 research articles (`/#join` → `/upload`)
- [ ] Add curated "Related research" 4-6 links to top 10 articles
- [ ] Add Lipa stats strip standardized across articles (250K+ studies, 30+ patterns, 180+ markers)
- [ ] Connect Google Search Console + share read access (Patrick)
- [ ] Submit affiliate programs 1-3 (Patrick)
- [ ] Email Lipa stats strip to newsletter subscribers

### Medium wins (4-8 hours each)
- [ ] Build `/pcos.html` aggregator landing page
- [ ] Build `/perimenopause.html` aggregator landing page
- [ ] Build `/trt.html` aggregator landing page
- [ ] Write `research-long-covid-blood-markers.html`
- [ ] Write `research-lipoprotein-a.html`
- [ ] Submit affiliate programs 4-6

### Larger initiatives (per ROADMAP_IDEAS.md)
- [ ] Streaming insights UX (kill 17-min wait)
- [ ] BATCH_SIZE refinement after BATCH_SIZE=5 production data
- [ ] Vault retention features (personal baselines, trend alerts)
- [ ] At-home finger-prick partnership (Medichecks first)

---

## 7. Success metrics (track weekly)

Once distribution work is shipped, measure:

- **Organic traffic** to research pages (Search Console)
- **Aggregator landing page conversion rate** (visitors → uploads)
- **Free → Paid conversion rate** (uploads → Lipa One / Lipa Life)
- **Affiliate clicks → bookings → revenue**
- **Email list growth rate**
- **Reddit/Facebook reach** (post views, upvotes, click-throughs)

Set 30-day baseline before iterating. Don't over-optimize early.

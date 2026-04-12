# Lipa Health Revenue Projection Model

**Prepared:** April 2026
**Author:** Patrick (Founder, Go Exe B.V.)
**Purpose:** Internal planning and fundraising reference
**Last updated:** 2026-04-12

---

## Table of Contents

1. [Market Context & Sizing](#1-market-context--sizing)
2. [Competitive Landscape & Revenue Benchmarks](#2-competitive-landscape--revenue-benchmarks)
3. [Conversion & Retention Benchmarks](#3-conversion--retention-benchmarks)
4. [Traffic & Acquisition Assumptions](#4-traffic--acquisition-assumptions)
5. [Pricing Architecture](#5-pricing-architecture)
6. [Cost Structure](#6-cost-structure)
7. [Year 1 Scenarios](#7-year-1-scenarios)
8. [Year 2-3 Projections](#8-year-2-3-projections)
9. [Lifetime Value Analysis](#9-lifetime-value-analysis)
10. [Future Revenue Streams](#10-future-revenue-streams)
11. [Key Metrics Dashboard](#11-key-metrics-dashboard)
12. [Sensitivity Analysis](#12-sensitivity-analysis)
13. [Sources](#13-sources)

---

## 1. Market Context & Sizing

### Global Blood Testing Market

| Metric | Value | Source |
|--------|-------|--------|
| Global market size (2025) | $97-110 billion | Mordor Intelligence, SkyQuest |
| Projected size (2030) | $135-198 billion | Multiple sources |
| CAGR | 6.9-8.8% | Mordor Intelligence, Grand View Research |

### Direct-to-Consumer Lab Testing Market

| Metric | Value | Source |
|--------|-------|--------|
| DTC market size (2025) | $3.75 billion | Precedence Research |
| DTC market size (2026) | $4.12 billion | Towards Healthcare |
| Projected (2034-2035) | $8.2-8.7 billion | Multiple sources |
| CAGR | 8.8-8.9% | Precedence Research, Towards Healthcare |

### Health & Wellness App Market

| Metric | Value | Source |
|--------|-------|--------|
| Wellness apps market (2025) | $11.3-26.0 billion | Grand View Research, Precedence Research |
| CAGR | 12.0-14.9% | Multiple sources |
| North America share | 44.5% | Precedence Research |

### Blood Test Volume (Annual)

| Country/Region | Annual Tests | Notes |
|----------------|-------------|-------|
| United States | 4-14 billion tests/year | ACLA, varies by methodology |
| England & Wales | ~14 tests per person/year | Royal College of Pathologists |
| Europe | Significant and growing | Driven by chronic disease, aging |

### Adjacent Market: Protocol Users (TRT, GLP-1, Peptides)

This is Lipa's highest-value niche. These users need regular blood monitoring and are underserved.

| Market | Size (2025-2026) | Users |
|--------|-----------------|-------|
| GLP-1 receptor agonists | $63-73 billion | ~10M Americans on GLP-1s (2025), 25M projected by 2030 |
| Semaglutide alone | $28-32 billion | 52.8% of GLP-1 market |
| TRT market | $2.1 billion (2026) | Growing at 3.9% CAGR |

**Key insight:** 10 million GLP-1 users in the US alone need quarterly blood monitoring. Even capturing 0.01% of these users represents 1,000 highly engaged customers who test 3-4x per year.

---

## 2. Competitive Landscape & Revenue Benchmarks

### Direct Competitors

| Company | Pricing | Revenue/ARR | Members/Users | Funding | Valuation |
|---------|---------|------------|---------------|---------|-----------|
| **Function Health** | $365/yr | ~$100M run rate (Feb 2025) | 200,000+ members (May 2025) | $298M Series B | $2.5B (Nov 2025) |
| **InsideTracker** | $489+/yr | Not disclosed | Not disclosed | $17.5M total (Series B, Sep 2022) | Not disclosed |
| **Lucis** | Similar to Function | Not disclosed | 3,000 customers, 30,000+ community | $8.5M seed (Dec 2025) | Not disclosed |

### Adjacent Health Tech (Benchmarks for Scale)

| Company | Revenue | Subscribers | Valuation | Model |
|---------|---------|------------|-----------|-------|
| **Oura** | Projected $1B+ (2025), $1.5B (2026) | 5.5M rings sold, ~2M subscribers | $11B (Series E, Oct 2025) | Hardware + $6/mo subscription |
| **Whoop** | $260M (mid-2025), $600M+ ARR projected (2026) | 2.5M+ members | $10.1B (Series G, Mar 2026) | $20-30/mo subscription |

### What This Tells Us

- **Function Health** proves the market: 200K members at $365/yr in 2 years. But they force their own lab network (no BYOT) and are US-only.
- **Lucis** validates the European opportunity: $8.5M seed with just 3,000 customers. But they don't do BYOT either.
- **Oura/Whoop** show health subscription scale: millions of users willing to pay $6-30/mo for health data insights.
- **Lipa's positioning:** BYOT + research depth + European-first + dramatically lower price point ($29 one-time or $89/yr vs $365-489/yr).

---

## 3. Conversion & Retention Benchmarks

### Free-to-Paid Conversion Rates

| Benchmark | Rate | Source |
|-----------|------|--------|
| Healthcare SaaS trial-to-paid | 21.5% | First Page Sage, 2025 |
| Healthcare visitor-to-trial | 12.3% | First Page Sage, 2025 |
| SaaS average trial-to-paid | 25% | Industry average |
| Freemium (no card required) | 2-5% | ProductLed Benchmarks |
| Freemium with strong value demo | 5-10% | ProductLed Benchmarks |

**Lipa-specific assumption:** Lipa's free preview shows immediate value (biomarker analysis of a real test) but gates depth. This is closer to a "value demo" freemium model. We model **8-12% free-to-paid conversion** depending on scenario.

### One-Time to Subscription Upgrade Rates

| Benchmark | Rate | Source |
|-----------|------|--------|
| One-time to subscription (general) | 10-20% | Industry benchmarks |
| Health apps with demonstrated value | 15-25% | RevenueCat State of Subscriptions 2025 |

**Lipa-specific assumption:** Users who buy Lipa One (one-time analysis) and return with a second test are prime upgrade candidates. We model **15-20% of Lipa One buyers upgrading to Lipa Life within 12 months.**

### Churn & Retention

| Metric | Rate | Source |
|--------|------|--------|
| Annual subscription renewal (health apps) | 33% retain | RevenueCat 2025 |
| Annual subscription first-year churn | 30% cancel in month 1 | RevenueCat 2025 |
| Monthly subscription retention | 17% | RevenueCat 2025 |
| Fitness app churn (improving) | 7.2% monthly | Industry 2025 |

**Lipa-specific assumption:** Lipa Life is annual-only and inherently linked to repeat blood tests (1-4x/year). Users who test regularly have higher retention. We model:
- **Year 1 annual renewal rate:** 45% (above average due to test-linked value)
- **Year 2+ renewal rate:** 55% (retained users are more engaged)
- **Lipa One repeat purchase rate:** 30% (users who buy another one-time analysis within 12 months)

---

## 4. Traffic & Acquisition Assumptions

### Search Volume Estimates (Monthly)

Based on industry data and keyword research tools, estimated monthly global English search volumes:

| Keyword Cluster | Est. Monthly Searches | Competition |
|----------------|----------------------|-------------|
| "blood test results explained" / "understand blood test" | 100,000-200,000 | Medium-High |
| "blood test interpretation" / "lab results meaning" | 50,000-100,000 | Medium |
| "TRT blood work" / "testosterone blood monitoring" | 20,000-40,000 | Medium |
| "semaglutide blood work" / "GLP-1 blood monitoring" | 15,000-30,000 | Low-Medium |
| "peptide blood work" / "BPC-157 blood tests" | 5,000-15,000 | Low |
| "longevity blood tests" / "healthspan biomarkers" | 10,000-20,000 | Medium |
| "HOMA-IR calculator" / "bio age calculator" | 10,000-25,000 | Low-Medium |

**Total addressable search volume:** ~210,000-430,000 monthly searches across relevant clusters.

### Organic CTR Assumptions (2025-2026 Reality)

Google AI Overviews have compressed organic CTR significantly:

| Position | CTR (2026) | Source |
|----------|-----------|--------|
| Position 1 | 19-28% (general), 7-11% (health) | GrowthSrc, Backlinko |
| Position 2-3 | 8-13% | GrowthSrc |
| Position 4-10 | 2-5% | Industry data |
| Health content average top-3 | 7-11% | Backlinko |

**Lipa advantage:** Lipa already has 40+ research articles published (research-*.html pages), giving it a strong content footprint for long-tail health queries.

### Paid Acquisition Costs

| Metric | Value | Source |
|--------|-------|--------|
| Healthcare CPC average | $5.64 | LocaliQ 2025 |
| General health/wellness CPC | $3-8 | WebFX, Multiple |
| Blood test keywords (estimated) | $2-5 | Lower competition niche |
| Health & wellness CPM | $19.69 | Industry 2025 |

**Lipa-specific CPC assumption:** $3-5 for blood test interpretation keywords (lower competition than clinical/practice keywords). At a 5% landing page conversion rate, **cost per signup = $60-100.**

---

## 5. Pricing Architecture

| Tier | Price | What's Included | Target |
|------|-------|----------------|--------|
| **Free Preview** | $0 | Basic biomarker overview, limited analysis, no action plan | Everyone who uploads |
| **Lipa One** | EUR 29 (one-time) | Full analysis, action plan, calculations, research citations for ONE test | Try-before-you-subscribe |
| **Lipa Life** | EUR 89/year | Unlimited analyses, vault, trending, living research, all calculations | Regular testers (2-4x/year) |

### Revenue Per User Math

| Segment | Revenue/Year | Notes |
|---------|-------------|-------|
| Free user | EUR 0 | May convert later; generates word-of-mouth |
| Lipa One (single purchase) | EUR 29 | One-time |
| Lipa One (repeat buyer, 2x/yr) | EUR 58 | 30% of One buyers repeat |
| Lipa Life subscriber | EUR 89 | Annual recurring |
| Lipa Life + supplements affiliate | EUR 89 + ~EUR 15 | Conservative affiliate estimate |

---

## 6. Cost Structure

### Variable Costs (Per Analysis)

| Cost Component | Cost Per Analysis | Notes |
|----------------|------------------|-------|
| AI API costs (LLM inference) | EUR 1.00-1.75 | ~2,000-3,000 tokens in, ~4,000-8,000 tokens out per analysis. Using Sonnet 4.6 at $3/$15 per M tokens. With prompt caching: ~EUR 0.50-0.80. Blended estimate: EUR 1.25 |
| PDF parsing / OCR | EUR 0.05-0.10 | Cloud Vision or similar |
| Research matching engine | EUR 0.10-0.20 | Vector DB queries, PubMed API |
| Email / notifications | EUR 0.01 | Transactional email |
| **Total variable cost per analysis** | **EUR 1.40-2.05** | **Blended: EUR 1.75** |

### Fixed Costs (Monthly)

| Cost Component | Monthly Cost | Notes |
|----------------|-------------|-------|
| Hosting (Vercel/similar) | EUR 50-100 | Static site + serverless functions |
| Database (Supabase/similar) | EUR 25-75 | Scales with users |
| Domain & DNS | EUR 5 | Multiple domains |
| Email service | EUR 20-50 | Transactional + marketing |
| Monitoring & analytics | EUR 20-50 | PostHog, Sentry, etc. |
| Research corpus maintenance | EUR 50-100 | PubMed API, storage |
| Stripe fees | 1.5% + EUR 0.25/txn | European cards |
| **Total fixed (early stage)** | **EUR 200-400/mo** | |
| **Total fixed (scaled, 5K+ users)** | **EUR 500-1,000/mo** | |

### Marketing Spend Assumptions

| Scenario | Monthly Ad Spend | Monthly Content Cost | Total Monthly Marketing |
|----------|-----------------|---------------------|------------------------|
| Conservative | EUR 200 | EUR 0 (founder-written) | EUR 200 |
| Moderate | EUR 1,000 | EUR 300 | EUR 1,300 |
| Aggressive | EUR 3,000 | EUR 500 + PR EUR 1,000 | EUR 4,500 |

---

## 7. Year 1 Scenarios

### Scenario A: Conservative

**Assumptions:** Organic traffic only + EUR 200/mo ad spend. Founder writes content. SEO ramp takes 6 months. Minimal social media presence.

#### Monthly Funnel (Month-by-Month)

| Month | Site Visitors | Signups | Free Users (Cum.) | Lipa One Purchases | Lipa Life Conversions | Monthly Revenue |
|-------|-------------|---------|-------------------|--------------------|-----------------------|----------------|
| 1 | 500 | 30 | 30 | 2 | 0 | EUR 58 |
| 2 | 700 | 42 | 72 | 3 | 0 | EUR 87 |
| 3 | 1,000 | 60 | 132 | 5 | 1 | EUR 234 |
| 4 | 1,400 | 84 | 216 | 7 | 1 | EUR 292 |
| 5 | 1,800 | 108 | 324 | 9 | 2 | EUR 439 |
| 6 | 2,500 | 150 | 474 | 12 | 2 | EUR 526 |
| 7 | 3,200 | 192 | 666 | 15 | 3 | EUR 702 |
| 8 | 4,000 | 240 | 906 | 19 | 3 | EUR 818 |
| 9 | 4,500 | 270 | 1,176 | 22 | 4 | EUR 905 |
| 10 | 5,000 | 300 | 1,476 | 24 | 4 | EUR 1,052 |
| 11 | 5,500 | 330 | 1,806 | 26 | 5 | EUR 1,199 |
| 12 | 6,000 | 360 | 2,166 | 29 | 5 | EUR 1,286 |

**Conversion assumptions:**
- Visitor-to-signup: 6% (health content with clear CTA)
- Free-to-Lipa One: 8% of cumulative free users (purchased to date)
- Lipa One-to-Life: 15% of Lipa One buyers upgrade within the year

#### Year 1 Conservative Summary

| Metric | Value |
|--------|-------|
| **Total site visitors** | 36,100 |
| **Total signups (registered users)** | 2,166 |
| **Total Lipa One purchases** | 173 |
| **Total Lipa Life subscribers** | 30 |
| **Total revenue** | **EUR 7,598** |
| Lipa One revenue | EUR 5,017 (173 x EUR 29) |
| Lipa Life revenue | EUR 2,670 (30 x EUR 89) |
| **Blended ARPU (paying users)** | **EUR 37.44** |
| **Blended ARPU (all registered)** | **EUR 3.51** |
| Total variable costs (203 analyses) | EUR 355 |
| Total fixed costs | EUR 3,600 |
| Total marketing spend | EUR 2,400 |
| **Total costs** | **EUR 6,355** |
| **Net profit / (loss)** | **EUR 1,243** |
| **Gross margin (revenue - variable)** | **95.3%** |
| **Operating margin** | **16.4%** |

**Break-even month:** Month 6-7 (on a monthly basis)

---

### Scenario B: Moderate

**Assumptions:** SEO content strategy + EUR 1,000/mo ads + social media + content marketing. Partnerships with 2-3 TRT/peptide communities. Content writer assistance.

#### Monthly Funnel (Month-by-Month)

| Month | Site Visitors | Signups | Free Users (Cum.) | Lipa One Purchases | Lipa Life Conversions | Monthly Revenue |
|-------|-------------|---------|-------------------|--------------------|-----------------------|----------------|
| 1 | 1,500 | 105 | 105 | 8 | 0 | EUR 232 |
| 2 | 2,200 | 154 | 259 | 13 | 1 | EUR 466 |
| 3 | 3,500 | 245 | 504 | 20 | 2 | EUR 758 |
| 4 | 5,000 | 350 | 854 | 28 | 4 | EUR 1,168 |
| 5 | 7,000 | 490 | 1,344 | 39 | 5 | EUR 1,576 |
| 6 | 9,000 | 630 | 1,974 | 50 | 7 | EUR 2,073 |
| 7 | 11,000 | 770 | 2,744 | 62 | 9 | EUR 2,599 |
| 8 | 13,000 | 910 | 3,654 | 73 | 11 | EUR 3,096 |
| 9 | 14,500 | 1,015 | 4,669 | 81 | 13 | EUR 3,506 |
| 10 | 16,000 | 1,120 | 5,789 | 90 | 14 | EUR 3,856 |
| 11 | 17,000 | 1,190 | 6,979 | 95 | 16 | EUR 4,179 |
| 12 | 18,000 | 1,260 | 8,239 | 101 | 17 | EUR 4,442 |

**Conversion assumptions:**
- Visitor-to-signup: 7% (optimized landing pages, community referrals)
- Free-to-Lipa One: 10% of new monthly signups
- Lipa One-to-Life: 18% of Lipa One buyers upgrade

#### Year 1 Moderate Summary

| Metric | Value |
|--------|-------|
| **Total site visitors** | 117,700 |
| **Total signups (registered users)** | 8,239 |
| **Total Lipa One purchases** | 660 |
| **Total Lipa Life subscribers** | 99 |
| **Total revenue** | **EUR 27,951** |
| Lipa One revenue | EUR 19,140 (660 x EUR 29) |
| Lipa Life revenue | EUR 8,811 (99 x EUR 89) |
| **Blended ARPU (paying users)** | **EUR 36.83** |
| **Blended ARPU (all registered)** | **EUR 3.39** |
| Total variable costs (759 analyses) | EUR 1,328 |
| Total fixed costs | EUR 6,000 |
| Total marketing spend | EUR 15,600 |
| **Total costs** | **EUR 22,928** |
| **Net profit / (loss)** | **EUR 5,023** |
| **Gross margin (revenue - variable)** | **95.2%** |
| **Operating margin** | **18.0%** |

**Break-even month:** Month 5 (on a monthly basis, covering that month's costs)

---

### Scenario C: Aggressive

**Assumptions:** Full marketing push. Dedicated SEO + paid ads (EUR 3,000/mo) + PR campaign + influencer partnerships with health/longevity creators + TRT clinic partnerships + GLP-1 community integrations + Product Hunt launch.

#### Monthly Funnel (Month-by-Month)

| Month | Site Visitors | Signups | Free Users (Cum.) | Lipa One Purchases | Lipa Life Conversions | Monthly Revenue |
|-------|-------------|---------|-------------------|--------------------|-----------------------|----------------|
| 1 | 5,000 | 400 | 400 | 32 | 2 | EUR 1,106 |
| 2 | 8,000 | 640 | 1,040 | 51 | 5 | EUR 1,924 |
| 3 | 12,000 | 960 | 2,000 | 77 | 10 | EUR 3,123 |
| 4 | 16,000 | 1,280 | 3,280 | 102 | 15 | EUR 4,293 |
| 5 | 20,000 | 1,600 | 4,880 | 128 | 20 | EUR 5,492 |
| 6 | 25,000 | 2,000 | 6,880 | 160 | 25 | EUR 6,885 |
| 7 | 30,000 | 2,400 | 9,280 | 192 | 30 | EUR 8,238 |
| 8 | 33,000 | 2,640 | 11,920 | 211 | 35 | EUR 9,235 |
| 9 | 36,000 | 2,880 | 14,800 | 230 | 40 | EUR 10,230 |
| 10 | 38,000 | 3,040 | 17,840 | 243 | 45 | EUR 11,054 |
| 11 | 40,000 | 3,200 | 21,040 | 256 | 50 | EUR 11,874 |
| 12 | 42,000 | 3,360 | 24,400 | 269 | 55 | EUR 12,695 |

**Conversion assumptions:**
- Visitor-to-signup: 8% (highly optimized funnels, retargeting, social proof)
- Free-to-Lipa One: 12% of new monthly signups (strong value demonstration)
- Lipa One-to-Life: 20% of Lipa One buyers upgrade

#### Year 1 Aggressive Summary

| Metric | Value |
|--------|-------|
| **Total site visitors** | 305,000 |
| **Total signups (registered users)** | 24,400 |
| **Total Lipa One purchases** | 1,951 |
| **Total Lipa Life subscribers** | 332 |
| **Total revenue** | **EUR 86,127** |
| Lipa One revenue | EUR 56,579 (1,951 x EUR 29) |
| Lipa Life revenue | EUR 29,548 (332 x EUR 89) |
| **Blended ARPU (paying users)** | **EUR 37.72** |
| **Blended ARPU (all registered)** | **EUR 3.53** |
| Total variable costs (2,283 analyses) | EUR 3,995 |
| Total fixed costs | EUR 9,600 |
| Total marketing spend | EUR 54,000 |
| **Total costs** | **EUR 67,595** |
| **Net profit / (loss)** | **EUR 18,532** |
| **Gross margin (revenue - variable)** | **95.4%** |
| **Operating margin** | **21.5%** |

**Break-even month:** Month 4 (on a monthly basis)

---

### Year 1 Comparison Table

| Metric | Conservative | Moderate | Aggressive |
|--------|-------------|----------|-----------|
| Registered users | 2,166 | 8,239 | 24,400 |
| Paying customers | 203 | 759 | 2,283 |
| Lipa One purchases | 173 | 660 | 1,951 |
| Lipa Life subscribers | 30 | 99 | 332 |
| **Annual revenue** | **EUR 7,598** | **EUR 27,951** | **EUR 86,127** |
| Annual costs | EUR 6,355 | EUR 22,928 | EUR 67,595 |
| **Net income** | **EUR 1,243** | **EUR 5,023** | **EUR 18,532** |
| Gross margin | 95.3% | 95.2% | 95.4% |
| Operating margin | 16.4% | 18.0% | 21.5% |
| CAC (paid only) | EUR 11.82 | EUR 20.55 | EUR 23.66 |
| Paying conversion rate | 9.4% | 9.2% | 9.4% |

---

## 8. Year 2-3 Projections

### Growth Assumptions

| Factor | Year 2 | Year 3 |
|--------|--------|--------|
| Organic traffic growth | 2.5x (SEO compounds) | 2x |
| Paid efficiency improvement | 20% better CAC | 15% better CAC |
| Conversion rate improvement | +1-2pp (product iteration) | +0.5-1pp |
| Lipa Life renewal rate | 45% Y1 cohort, 55% Y2 cohort | 55% all cohorts |
| Lipa One repeat rate | 30% buy again within 12 months | 30% |
| New revenue streams | Lab affiliates + supplement affiliates launch | Practitioner referrals launch |

### Year 2 Projections (Moderate Scenario Baseline)

| Metric | Value | Growth |
|--------|-------|--------|
| Registered users (cumulative) | 28,000 | +19,761 new |
| New Lipa One purchases | 2,200 | 3.3x Y1 |
| New Lipa Life subscribers | 400 | 4x Y1 |
| Retained Lipa Life from Y1 | 45 (45% of 99) | |
| **Total active Lipa Life subs** | **445** | |
| Lipa One revenue | EUR 63,800 | |
| Lipa Life revenue | EUR 39,605 | |
| Lab affiliate revenue | EUR 4,000 (400 referrals x EUR 10) | |
| Supplement affiliate revenue | EUR 3,500 | |
| **Total Year 2 revenue** | **EUR 110,905** | **3.97x Y1** |
| Total costs | EUR 52,000 | |
| **Net income** | **EUR 58,905** | |
| **Operating margin** | **53.1%** | |

### Year 3 Projections (Moderate Scenario Baseline)

| Metric | Value | Growth |
|--------|-------|--------|
| Registered users (cumulative) | 68,000 | +40,000 new |
| New Lipa One purchases | 5,500 | 2.5x Y2 |
| New Lipa Life subscribers | 1,100 | 2.75x Y2 |
| Retained Lipa Life from Y1+Y2 | 225 (55% of Y2 active base) | |
| **Total active Lipa Life subs** | **1,325** | |
| Lipa One revenue | EUR 159,500 | |
| Lipa Life revenue | EUR 117,925 | |
| Lab affiliate revenue | EUR 15,000 | |
| Supplement affiliate revenue | EUR 12,000 | |
| Practitioner referral revenue | EUR 5,000 | |
| **Total Year 3 revenue** | **EUR 309,425** | **2.79x Y2** |
| Total costs | EUR 95,000 | |
| **Net income** | **EUR 214,425** | |
| **Operating margin** | **69.3%** | |

### 3-Year Revenue Trajectory (Moderate)

```
Year 1:  EUR    27,951  ████
Year 2:  EUR   110,905  ████████████████
Year 3:  EUR   309,425  ████████████████████████████████████████████
```

### 3-Year Revenue Trajectory (Aggressive)

| Year | Revenue | Net Income | Operating Margin |
|------|---------|-----------|-----------------|
| Year 1 | EUR 86,127 | EUR 18,532 | 21.5% |
| Year 2 | EUR 340,000 | EUR 195,000 | 57.4% |
| Year 3 | EUR 950,000 | EUR 665,000 | 70.0% |

---

## 9. Lifetime Value Analysis

### LTV by Customer Segment

#### Free User

| Metric | Value |
|--------|-------|
| Direct revenue | EUR 0 |
| Probability of converting to paid (lifetime) | 12% |
| Expected LTV | EUR 0.12 x EUR 37 = **EUR 4.44** |

#### Lipa One (Single Purchase)

| Metric | Value |
|--------|-------|
| Initial purchase | EUR 29 |
| Repeat purchase probability (within 12 months) | 30% |
| Upgrade to Life probability | 18% |
| Expected additional revenue | EUR 29 x 0.30 + EUR 89 x 0.18 = EUR 24.72 |
| **Expected LTV** | **EUR 53.72** |

#### Lipa One (Repeat Buyer)

| Metric | Value |
|--------|-------|
| Purchases per year | 2.2 (average) |
| Annual spend | EUR 63.80 |
| Average lifespan | 2.5 years |
| Upgrade probability | 35% (higher than single buyers) |
| **Expected LTV** | **EUR 128** |

#### Lipa Life Subscriber

| Metric | Value |
|--------|-------|
| Annual subscription | EUR 89 |
| Year 1 retention | 45% |
| Year 2+ retention | 55% |
| Average subscriber lifespan | 2.1 years |
| Subscription LTV | EUR 89 x 2.1 = EUR 186.90 |
| Supplement affiliate revenue (lifetime) | EUR 25 |
| Lab affiliate revenue (lifetime) | EUR 15 |
| **Expected LTV** | **EUR 227** |

#### Lipa Life "Power User" (Protocol Monitoring: TRT/GLP-1)

| Metric | Value |
|--------|-------|
| Annual subscription | EUR 89 |
| Tests per year | 3-4 |
| Retention rate | 65% (higher — they need monitoring) |
| Average lifespan | 3.5 years |
| Subscription LTV | EUR 89 x 3.5 = EUR 311.50 |
| Supplement affiliate revenue | EUR 50 |
| Lab affiliate revenue | EUR 35 |
| **Expected LTV** | **EUR 397** |

### Blended LTV Calculation

| Segment | % of Paying Users | LTV | Weighted LTV |
|---------|-------------------|-----|-------------|
| Lipa One (single) | 55% | EUR 53.72 | EUR 29.55 |
| Lipa One (repeat) | 15% | EUR 128 | EUR 19.20 |
| Lipa Life (standard) | 20% | EUR 227 | EUR 45.40 |
| Lipa Life (power user) | 10% | EUR 397 | EUR 39.70 |
| **Blended LTV** | | | **EUR 133.85** |

---

## 10. Future Revenue Streams

### Stream 1: Lab Affiliate Referrals (Launch: Month 6-8)

Partner with blood testing labs (Medichecks, Thriva, LifeExtension, Forth, etc.) to earn referral fees when Lipa users book tests through the platform.

| Metric | Assumption |
|--------|-----------|
| Referral fee per booking | EUR 10-15 |
| % of users who book through Lipa | 10-15% of Lipa Life subscribers |
| Average bookings per referred user/year | 2 |
| **Year 2 estimate** | EUR 4,000-8,000 |
| **Year 3 estimate** | EUR 15,000-30,000 |

### Stream 2: Supplement Affiliate Revenue (Launch: Month 4-6)

Recommend specific supplements in action plans with affiliate links to trusted brands.

| Metric | Assumption |
|--------|-----------|
| Average supplement order value | EUR 60-80 |
| Commission rate | 10-15% (industry average for health supplements) |
| Revenue per referred purchase | EUR 6-12 |
| % of Lipa One/Life users who purchase | 8-12% |
| Repeat supplement purchases per year | 3-4 |
| **Year 2 estimate** | EUR 3,500-7,000 |
| **Year 3 estimate** | EUR 12,000-25,000 |

### Stream 3: Practitioner Referral Network (Launch: Year 2-3)

Connect users with functional medicine practitioners, TRT clinics, or endocrinologists. Earn referral fees.

| Metric | Assumption |
|--------|-----------|
| Referral fee | EUR 25-50 per consultation booked |
| % of users seeking practitioner | 3-5% |
| **Year 3 estimate** | EUR 5,000-15,000 |

### Stream 4: B2B / Clinic Licensing (Launch: Year 3+)

White-label Lipa's analysis engine to clinics, telehealth platforms, or corporate wellness programs.

| Metric | Assumption |
|--------|-----------|
| License fee per clinic | EUR 200-500/month |
| Target clinics Year 3 | 5-15 |
| **Year 3 estimate** | EUR 12,000-90,000 |

### Future Revenue Mix (Year 3, Moderate Scenario)

| Stream | Revenue | % of Total |
|--------|---------|-----------|
| Lipa One (one-time) | EUR 159,500 | 51.5% |
| Lipa Life (subscriptions) | EUR 117,925 | 38.1% |
| Lab affiliates | EUR 15,000 | 4.8% |
| Supplement affiliates | EUR 12,000 | 3.9% |
| Practitioner referrals | EUR 5,000 | 1.6% |
| **Total** | **EUR 309,425** | **100%** |

**Note:** By Year 3, subscription revenue (Lipa Life) should approach and then overtake one-time revenue (Lipa One) as the install base grows and renewal cohorts compound. This is the healthy trajectory.

---

## 11. Key Metrics Dashboard

### Metrics to Track Weekly

| Metric | Target (Month 6) | Target (Month 12) | Why It Matters |
|--------|------------------|-------------------|---------------|
| Weekly site visitors | 600+ | 1,200+ | Top of funnel health |
| Weekly signups | 40+ | 80+ | Funnel intake |
| Free-to-One conversion (trailing 30d) | 8%+ | 10%+ | Value demonstration effectiveness |
| One-to-Life conversion (trailing 90d) | 15%+ | 18%+ | Subscription business health |

### Metrics to Track Monthly

| Metric | Formula | Target |
|--------|---------|--------|
| **CAC** | Total marketing spend / new paying customers | < EUR 25 |
| **LTV** | See segment calculations above | > EUR 130 blended |
| **LTV:CAC ratio** | LTV / CAC | > 5:1 (excellent for capital-light) |
| **Payback period** | CAC / monthly ARPU | < 2 months |
| **Monthly churn (Life)** | Cancellations / active subscribers | < 5% monthly |
| **Annual retention (Life)** | Renewed / up for renewal | > 45% Y1, > 55% Y2+ |
| **Gross margin** | (Revenue - variable costs) / revenue | > 93% |
| **NPS** | Net Promoter Score survey | > 50 |
| **Analyses per user** | Total analyses / active users | > 1.5/year (Life) |

### Unit Economics Health Check

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| LTV:CAC | > 5:1 | 3-5:1 | < 3:1 |
| CAC payback | < 2 months | 2-4 months | > 4 months |
| Gross margin | > 90% | 80-90% | < 80% |
| Monthly churn (Life) | < 4% | 4-7% | > 7% |
| Free-to-paid conversion | > 8% | 5-8% | < 5% |

---

## 12. Sensitivity Analysis

### What Happens If Conversion Rates Differ

Moderate scenario baseline, Year 1, varying free-to-paid conversion:

| Free-to-Paid Rate | Lipa One Purchases | Revenue | Net Income |
|--------------------|-------------------|---------|-----------|
| 5% (pessimistic) | 412 | EUR 16,900 | EUR (6,028) |
| 8% (conservative) | 659 | EUR 27,000 | EUR 4,072 |
| **10% (baseline)** | **660** | **EUR 27,951** | **EUR 5,023** |
| 12% (optimistic) | 989 | EUR 40,500 | EUR 17,572 |
| 15% (best case) | 1,236 | EUR 50,600 | EUR 27,672 |

### What Happens If Traffic Differs

Moderate scenario baseline, Year 1, varying total visitors:

| Annual Visitors | Signups | Revenue | Net Income |
|----------------|---------|---------|-----------|
| 60,000 (half) | 4,200 | EUR 14,200 | EUR (8,728) |
| 90,000 | 6,300 | EUR 21,300 | EUR (1,628) |
| **117,700 (baseline)** | **8,239** | **EUR 27,951** | **EUR 5,023** |
| 150,000 | 10,500 | EUR 35,600 | EUR 12,672 |
| 200,000 | 14,000 | EUR 47,500 | EUR 24,572 |

### What Happens If Pricing Changes

Year 1 moderate scenario, varying Lipa One price:

| Lipa One Price | Conversion Impact | Revenue | Net Income |
|----------------|------------------|---------|-----------|
| EUR 19 | +20% volume | EUR 21,300 | EUR (1,628) |
| EUR 24 | +10% volume | EUR 24,500 | EUR 1,572 |
| **EUR 29 (baseline)** | **baseline** | **EUR 27,951** | **EUR 5,023** |
| EUR 39 | -15% volume | EUR 31,200 | EUR 8,272 |
| EUR 49 | -30% volume | EUR 31,900 | EUR 8,972 |

**Insight:** There may be room to test EUR 39 for Lipa One. The higher price point with 15% volume loss still produces better revenue and margin. Worth A/B testing once there is sufficient volume.

### Critical Risk Scenarios

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Google AI Overviews eat organic CTR | -30-50% organic traffic | Diversify to social, community, partnerships |
| API costs increase significantly | Variable cost per analysis doubles | Optimize prompts, use caching aggressively, consider open-source models |
| Lucis enters BYOT market | Direct competitor with $8.5M funding | Move faster on features, deepen research corpus, build community moat |
| Regulatory concerns (medical device classification) | Forced to add disclaimers or restrict analysis depth | Already positioning as "educational" not "diagnostic" |
| Low repeat usage (users only test once) | LTV drops to EUR 29-53 | Push Living Research value (reasons to return between tests), build habit loops |

---

## 13. Sources

### Market Data
- [Mordor Intelligence - Blood Testing Market](https://www.mordorintelligence.com/industry-reports/blood-testing-market)
- [Grand View Research - Blood Testing Market to $160.5B by 2030](https://www.grandviewresearch.com/press-release/global-blood-testing-market)
- [Towards Healthcare - DTC Lab Testing Market to $8.16B by 2034](https://www.towardshealthcare.com/insights/direct-to-consumer-laboratory-testing-market-sizing)
- [Precedence Research - DTC Lab Testing to $8.69B by 2035](https://www.precedenceresearch.com/direct-to-consumer-laboratory-testing-market)
- [Grand View Research - Wellness Apps Market](https://www.grandviewresearch.com/industry-analysis/wellness-apps-market-report)

### Competitor Data
- [Sacra - Function Health at $100M/year](https://sacra.com/research/function-health-at-100m-year/)
- [MedCity News - Function Health $2.5B Valuation, $298M Series B](https://medcitynews.com/2025/11/function-health-startup-testing-imaging/)
- [Function Health Pricing](https://www.functionhealth.com/pricing)
- [Tech.eu - Lucis $8.5M Seed Round](https://tech.eu/2025/12/16/lucis-closes-85m-seed-round-for-preventive-healthcare-in-europe/)
- [Y Combinator - Lucis Profile](https://www.ycombinator.com/companies/lucis)
- [BusinessWire - Oura 5.5M Rings, $1B Revenue Projection](https://www.businesswire.com/news/home/20250922351288/en/URA-Surpasses-5.5-Million-Rings-Sold-and-Doubles-Revenue-for-the-Second-Year-in-a-Row-Empowering-Millions-to-Live-Better-Longer)
- [CNBC - Oura $11B Valuation](https://www.cnbc.com/2025/10/14/oura-ringmaker-valuation-fundraise.html)
- [Bloomberg - Whoop $10.1B Valuation, $575M Raise](https://www.bloomberg.com/news/articles/2026-03-31/whoop-raises-575-million-at-a-10-billion-valuation-on-its-way-to-an-ipo)
- [GetLatka - Whoop $260M Revenue](https://getlatka.com/companies/whoop.com)

### Conversion & Retention Benchmarks
- [First Page Sage - SaaS Free Trial Conversion Benchmarks](https://firstpagesage.com/seo-blog/saas-free-trial-conversion-rate-benchmarks/)
- [RevenueCat - State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025/)
- [ProductLed - Product-Led Growth Benchmarks](https://productled.com/blog/product-led-growth-benchmarks)
- [Business of Apps - Health & Fitness App Benchmarks 2026](https://www.businessofapps.com/data/health-fitness-app-benchmarks/)

### Traffic & Ad Benchmarks
- [LocaliQ - Healthcare Search Advertising Benchmarks](https://localiq.com/blog/healthcare-search-advertising-benchmarks/)
- [WordStream - Google Ads Benchmarks 2025](https://www.wordstream.com/blog/2025-google-ads-benchmarks)
- [GrowthSrc - Google Organic CTR 2025 Study](https://growthsrc.com/google-organic-ctr-study/)
- [Backlinko - Google CTR Stats](https://backlinko.com/google-ctr-stats)

### Adjacent Markets
- [Fortune Business Insights - GLP-1 Market](https://www.fortunebusinessinsights.com/glp-1-receptor-agonist-market-112827)
- [Mordor Intelligence - TRT Market](https://www.mordorintelligence.com/industry-reports/testosterone-replacement-therapy-market)

### API Pricing
- [Anthropic Claude Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [IntuitionLabs - AI API Pricing Comparison 2026](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)

---

## Appendix: Key Assumptions Summary

| Assumption | Value | Confidence | Notes |
|-----------|-------|-----------|-------|
| Visitor-to-signup rate | 6-8% | Medium | Health content with clear CTA |
| Free-to-Lipa One conversion | 8-12% | Medium | Strong value demo in free preview |
| Lipa One-to-Life upgrade | 15-20% | Low-Medium | Depends on repeat test behavior |
| Lipa Life Y1 renewal | 45% | Low | Above app average due to test-linked value |
| Lipa Life Y2+ renewal | 55% | Low | Retained cohort is more engaged |
| Variable cost per analysis | EUR 1.75 | High | Based on current API pricing + buffer |
| Fixed costs (early) | EUR 300/mo | High | Current infrastructure costs |
| Organic traffic ramp | 6-month delay | Medium | Standard SEO timeline |
| CPC for health keywords | EUR 3-5 | Medium | Based on healthcare benchmarks |
| Supplement affiliate commission | 10-15% | High | Industry standard range |
| Lab referral fee | EUR 10 | Medium | Depends on partnership terms |

---

*This model should be updated monthly with actual data once Lipa launches. Replace assumptions with real conversion rates, traffic data, and revenue figures as they become available. The model is deliberately conservative on conversion rates and optimistic on margin — the biggest risk is traffic acquisition, not unit economics.*

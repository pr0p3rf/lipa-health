# Lipa Health — Ad Strategy & Setup Guide

## Meta (Facebook/Instagram) Ads

### Step 1: Account Setup
- Go to Account Overview and fill in business details
- Business name: Lipa Health / Go Exe B.V.
- Country: Netherlands
- Currency: EUR
- Timezone: CET

### Step 2: Install Meta Pixel
1. Go to Events Manager → Connect Data Sources → Web → Meta Pixel
2. Name it "Lipa Health Pixel"
3. Choose "Install code manually"
4. Copy the pixel ID (looks like `123456789`)
5. Give the pixel ID to dev — it needs to be added to both lipa.health and my.lipa.health
6. Set up these conversion events:
   - `PageView` (automatic)
   - `Lead` — fires on account signup
   - `Purchase` — fires on Stripe checkout success (redirect to `/dashboard?subscription=success`)

### Step 3: Campaign Settings
- **Buying type:** Auction
- **Objective:** Traffic (switch to Conversions after pixel has 50+ events)
- **Campaign name:** `Lipa - Blood Test Analysis`
- **Budget:** Advantage campaign budget ON → €50/day to start
- **Schedule:** Start immediately, no end date

### Step 4: Ad Set — Audience

**Locations (go broad):** United States, United Kingdom, Canada, Australia, Netherlands, Germany, Sweden, Denmark, Norway, Finland, Poland, Spain, France, Italy, Ireland, Switzerland, Austria, Belgium, Portugal, UAE, Singapore, New Zealand, Israel

**Age:** 25-55

**Gender:** All

**Detailed targeting (add ALL of these):**
- Biohacking
- Blood test
- Testosterone
- Longevity
- Dietary supplements
- Functional medicine
- Peter Attia
- Andrew Huberman
- Bryan Johnson
- Peptides
- Health optimization
- Preventive medicine
- Vitamin D
- Omega-3 fatty acids
- Hormone replacement therapy

**Placements:** Advantage+ placements (let Meta optimize)

**Performance goal:** Maximize link clicks

### Step 5: Create 3 Ad Variations

All ads link to: `https://lipa.health`
CTA button: **Learn More**

---

**Ad 1 — "Doctor comparison"**

Primary text:
```
Your doctor spends 5 minutes on your blood test. We cross-reference every marker against 100,000+ peer-reviewed studies.

What your values mean. What's causing them. What to do — with specific doses, forms, and timing. All cited to real research.

Free preview available.
```

Headline: `Your biology, understood.`
Description: `Upload any blood test. See results in minutes.`

---

**Ad 2 — "Price comparison"**

Primary text:
```
InsideTracker charges $99. We charge €39. And we cite every insight to peer-reviewed research — 100,000+ studies from PubMed and Cochrane.

Upload your blood test PDF. Get root causes, supplement protocols with specific doses, cross-marker patterns, and a biological age estimate.

No subscription required.
```

Headline: `Research-grade blood test analysis. €39.`
Description: `Free preview. No credit card needed.`

---

**Ad 3 — "Curiosity hook"**

Primary text:
```
Uploaded my blood test to see what AI could find that my doctor missed.

It flagged an inflammatory pattern across 4 markers I'd never connected. Then gave me a specific supplement protocol — dosages, timing, and 12 cited studies backing each recommendation.

This is what blood work analysis should be.
```

Headline: `What your blood test is really telling you.`
Description: `100,000+ studies. Every marker analyzed.`

---

### Step 6: Images

Use screenshots of the actual product dashboard:
- Bio-age card (32.9) + summary + key findings
- An expanded body system with marker detail
- The full dashboard overview

### Image Direction for Designer

**Concept A — Product screenshot (highest priority)**
Take a clean screenshot of the paid dashboard (log in as plipnicki@gmail.com at my.lipa.health/dashboard). Capture:
- The bio-age card showing "32.9" with "-7.1 yrs"
- The summary card
- Key findings showing red/amber markers
- Body systems grid

Place the screenshot in a device mockup (laptop or phone). Use the Lipa cream background (#F8F5EF). No clutter — just the product speaking for itself. This is the most important image because it shows the actual product.

**Concept B — Before/after split**
Left side: A boring lab report PDF (blurry, clinical, hard to read)
Right side: The clean Lipa dashboard with colors and insights
Divider in the middle. Text at top: "Same blood test. Different understanding."

**Concept C — Stat callout (simple, bold)**
Clean cream or white background. Large text in Fraunces font:
- "100,000+ studies. One blood test. €39."
- Or: "Your doctor sees 5 minutes. We see 100,000 studies."
- Or: "€39. Not $99."
Lipa logo small in the corner.

**Concept D — Social proof / curiosity**
Screenshot of a single expanded marker card showing:
- The marker name + value + out of range status
- The "What to do" green box with specific supplement protocol
- The "What the research shows" section with cited studies
This shows the depth — people see actual research citations and think "this is real."

**Sizes needed:**
- 1080x1080 (square) — Meta feed
- 1080x1920 (vertical) — Meta/Instagram stories
- 1200x628 — Google Display / Meta link preview

**Brand assets:**
- Logo: SVG at `/icon.svg` in the repo
- Colors: cream #F8F5EF, green #1B6B4A, ink #0F1A15
- Fonts: Fraunces (headlines), Inter (body)
- Live site for reference: lipa.health (marketing), my.lipa.health (app)

**Do NOT use:**
- Stock photos of doctors/labs/blood vials — looks generic
- AI-generated people — looks fake
- Busy layouts with too much text — keep it clean

Crop clean. No text overlays needed — the product IS the ad. If you want text overlay, use:
- "Your biology, understood."
- "100,000+ studies. One blood test."
- "€39. Not $99."

Recommended size: 1080x1080 (square) for feed, 1080x1920 for stories.

### Step 7: Optimization Schedule

**After 24 hours:**
- Check impressions — all 3 ads should be delivering

**After 48 hours:**
- Check cost-per-click (CPC) for each ad
- Kill the worst performer
- Keep the top 2 running

**After 7 days (with 50+ clicks):**
- Switch campaign objective from Traffic → Conversions
- Set conversion event to `Purchase` or `Lead`
- Create lookalike audience from website visitors
- Scale budget on winning ad: €50 → €100/day

**After 14 days:**
- Test new ad copy variations based on what's working
- Add Google Ads (search intent: "blood test analysis", "understand blood test results")
- Add Reddit Ads targeting r/biohackers, r/supplements, r/longevity

---

## Google Ads (add after Meta is running)

### Campaign type: Search

**Keywords to bid on:**
- blood test analysis
- blood test results explained
- understand blood work
- blood test interpretation
- biomarker analysis
- biological age test
- blood panel analysis
- what do my blood test results mean
- blood test AI analysis
- comprehensive blood test analysis

**Negative keywords:**
- free blood test
- blood test near me
- blood draw
- blood donation
- blood type

**Ad copy:**

Headline 1: `Blood Test Analysis — €39`
Headline 2: `100,000+ Studies. Every Marker.`
Headline 3: `Free Preview Available`

Description 1: `Upload your blood test PDF. Get research-grade analysis with specific supplement protocols, root causes, and cited research. Results in minutes.`

Description 2: `Every marker cross-referenced against peer-reviewed studies. Biological age, cross-marker patterns, personalized action plan. Try free.`

**Landing page:** https://lipa.health

**Budget:** €30/day to start
**Bidding:** Maximize clicks (switch to target CPA after 30+ conversions)
**Locations:** US, UK, Australia, Netherlands, Germany

---

## Reddit Ads (add after week 1)

**Subreddits to target:**
- r/biohackers
- r/Supplements
- r/longevity
- r/Testosterone
- r/bloodwork
- r/Peptides

**Ad format:** Promoted post (looks native)

**Copy:** Use the Reddit post from `.lipa/LAUNCH_POSTS.md` — r/biohackers version works well as an ad

**Budget:** €20/day
**Objective:** Traffic

---

## Organic Posts (free, do immediately)

Ready-to-post content at `.lipa/LAUNCH_POSTS.md`:
- Reddit: r/biohackers, r/Supplements, r/longevity
- Hacker News: Show HN
- Twitter/X thread
- Product Hunt launch
- BetaList / Indie Hackers

**Post Reddit threads first** — highest density of target users who already have blood tests.

---

## Pricing for Reference

- **Free preview:** All markers with status, bio-age, key findings, body systems, patterns (no detail)
- **Lipa One:** €39 one-time — full analysis, action plan, 7-day Ask Lipa, PDF report
- **Lipa Life:** €89/year — everything in One + vault, trends, unlimited Ask Lipa, 12 uploads/year, research alerts

**Competitor pricing:**
- InsideTracker: $99+ (analysis only, no blood draw)
- Function Health: $499/year
- SelfDecode: $97/year (DNA focused, not blood)

---

## Key Metrics to Track

- **Cost per click (CPC):** Target under €1
- **Cost per signup:** Target under €5
- **Cost per purchase:** Target under €20
- **Signup → Upload rate:** How many signups actually upload a test
- **Upload → Purchase rate:** How many free users convert to paid
- **ROAS target:** 3x+ (spend €13 to acquire a €39 customer)

---

## Meta Pixel Events to Configure (dev task)

Once pixel ID is available, add to both domains:

1. `PageView` — all pages (automatic with pixel)
2. `Lead` — fire on `/dashboard` first load (user signed up + uploaded)
3. `Purchase` — fire on `/dashboard?subscription=success` with value €39 or €89
4. `ViewContent` — fire on `/upload` page (intent signal)

This enables Meta's algorithm to optimize for actual purchasers, not just clickers.

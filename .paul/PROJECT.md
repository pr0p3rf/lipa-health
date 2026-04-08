# Lipa Health

## Vision
The PCPartPicker for health — an intelligence layer + marketplace that connects biomarker data, peer-reviewed research, supplement pricing, and peptide purity testing in one platform. You track your blood, we show you the research and the trusted sources. You connect the dots.

## Core Value
Replace Reddit threads, scattered research, and guesswork with verified data. Users know: what their blood says, what the science recommends, which supplements are legit, which peptide vendors are pure, and whether their protocol is actually working.

## Business Model (Definitive — legally validated)

### Revenue Streams
1. **Subscription (EUR 19-29/mo):** Biomarker tracking + AI educational insights + peptide intelligence directory + purity database
2. **Supplement affiliate (EUR 5-15/user/mo):** OTC supplements only (vitamins, minerals, approved compounds) — affiliate links with price comparison
3. **Lab test markup (EUR 50-100/test):** When lab partnerships are live (Diagnostyka, Synlab)
4. **NO peptide affiliate. Ever.** Peptide revenue comes from subscription, not commissions.

### The Two Layers
**Layer 1 — Blood + Supplements (fully monetized via affiliate + subscription)**
- Upload blood tests, AI provides educational wellness insights
- Supplement marketplace with affiliate links and price comparison
- Track biomarkers over time, show trends and improvement

**Layer 2 — Peptide Intelligence (subscription-only, NO affiliate)**
- Best peptide research directory in Europe
- Aggregated purity testing data (Janoshik, vendor COAs, community-submitted, mystery shopper)
- Vendor ratings and reviews based on verified test results
- Educational content linking peer-reviewed research to biomarkers
- NO vendor checkout links. NO affiliate commissions on peptides.
- Users pay for the intelligence (which vendors are legit, what's pure, what's tested)

### Legal Framework
- Platform = educational wellness tool, NOT medical device
- AI outputs = educational insights, NOT diagnosis or prescriptions
- AI says "Research shows optimal Vitamin D is 50-70 ng/mL" NOT "Take 5,000 IU based on your level"
- Supplement affiliate links NOT tied programmatically to individual deficiencies
- Peptide directory = journalism/research publisher, NOT distributor
- Disclaimers: "Not medical advice, diagnosis, or treatment"
- Medical advisor reviews methodology (not individual users)

## Target Customer
Health-conscious Europeans, 35-50, who want more than "normal" from their doctor. Biohackers, longevity enthusiasts, anyone running supplement stacks or peptide protocols who wants verified data — not Reddit anecdotes.

## Markets (launch order)
1. Poland (home base, Diagnostyka, zero competition, lowest risk)
2. Netherlands (current location, low risk)
3. Spain (greenfield, low risk)
4. UK (add later, medium risk — MHRA scrutiny)
5. France — SKIP (criminal penalties for digital illegal practice of medicine)
6. Germany — SKIP (strict HWG advertising laws)

## Competitive Positioning
- vs Lucis/Function Health: We do peptide intelligence, they don't
- vs Polish tools (ZDROT, BloodLab): We're a premium product with marketplace + purity data
- vs Reddit/forums: We have verified purity data, not anecdotes
- vs Peptide vendors: We're the neutral auditor, not a seller

## Key Differentiators
1. Peptide purity directory with verified testing data (nobody has this)
2. Supplement price comparison marketplace
3. Cross-marker pattern recognition (AI-powered, not rule-based)
4. Research citations with confidence scores
5. Longitudinal tracking with protocol effectiveness proof
6. Wearable data integration

## Tech Stack
- Frontend: Next.js 14+ (App Router) + Tailwind CSS + shadcn/ui
- Database + Auth + Storage: Supabase
- AI: Claude API (interpretation + PDF vision parsing)
- Charts: Recharts or Nivo
- Payments: Stripe
- Wearables: Terra API
- Email: Resend
- Hosting: Vercel
- Domain: lipa.health

## Purity Data Sources
1. Janoshik Analytical (janoshik.com) — third-party testing gold standard
2. Vendor-submitted COAs — vendors submit to be listed
3. Community-submitted tests — users test and share, rewarded with free months
4. Mystery shopper — Lipa buys anonymously and tests periodically

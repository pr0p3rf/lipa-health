# Lipa Health — Dashboard Design Concepts

> 5 distinct approaches to presenting blood test results with Apple-quality UX.
> Each concept is opinionated, specific, and designed for health optimizers who want clarity, not clutter.

---

## Design Constraints & Principles (All Concepts)

**Data to display:**
- 98 biomarkers organized by body system
- Executive summary (overall health snapshot)
- Biological age estimate
- Body system groupings (cardiovascular, metabolic, hormonal, inflammatory, etc.)
- Action plan across 6 domains (nutrition, supplementation, lifestyle, exercise, testing, medical)
- Risk calculations (cardiovascular, metabolic syndrome, etc.)
- Cross-marker patterns (e.g., insulin + HbA1c + fasting glucose telling a story together)
- Per-marker "what to do" guidance
- Population percentiles
- Scientific citations

**Target users:** Health optimizers, TRT/GLP-1/peptide users, longevity-focused individuals, biohackers, and health-conscious consumers who got a blood panel and want to actually understand it.

**Core UX principles (non-negotiable across all concepts):**
1. **Calm clarity** — healthcare is stressful; the interface should reduce anxiety, not amplify it
2. **Progressive disclosure** — insight on the surface, data one tap behind it
3. **Actionability** — every screen answers "what do I do about this?"
4. **Premium feel** — generous whitespace, restrained color, confident typography
5. **Mobile-first** — most users will open results on their phone

**Color system (shared):**
- Optimal: muted teal/green (`#0D9488` range)
- Needs attention: warm amber (`#D97706` range)
- Out of range: muted coral/red (`#DC2626` range, never alarming fire-engine red)
- Neutral/informational: slate grey (`#64748B` range)
- Background: off-white (`#FAFAF9`) or very dark (`#0F172A` for dark mode)

---

## CONCEPT 1: "The Apple Health" — Minimalist Summary-First

### Philosophy
Lead with the answer. Hide the spreadsheet. The user opens their results and sees 3-5 key takeaways, not 98 rows of numbers. Everything else exists behind progressive disclosure — tap to expand, tap again for the science. Inspired by Apple Health's summary cards and the principle that most users want the headline, not the article.

### Layout
Single column, full-width on mobile. Max-width 640px centered on desktop (reading-column width, like a well-set book). No sidebar. No tabs in the traditional sense — vertical scroll is the primary navigation, with a sticky floating mini-nav (pill-shaped, frosted glass, bottom of screen) showing section dots.

### How the Summary is Presented

**Hero card — full viewport height on mobile, 60vh on desktop.**
- Background: subtle gradient from off-white to the faintest teal (if results are mostly good) or faintest amber (if attention needed). The gradient itself is emotional signaling.
- Center of the card: Biological age displayed as a large serif number (e.g., "34") with the label "Your Biological Age" in 14px caps-spaced tracking above it. Below: "Chronological age: 41 — you're aging 7 years slower" in 16px regular weight.
- Below that: a single 2-sentence executive summary in 18px serif. Example: "Your metabolic and cardiovascular markers are excellent. Your vitamin D and ferritin need attention — both are easily fixable."
- Bottom of hero card: a subtle downward chevron animation inviting scroll.

**Key Takeaways section — immediately below hero, no gap.**
- 3-5 cards, each 100% width, 80px tall, with a 4px left border in the status color (teal/amber/coral).
- Each card: icon (24px, line-weight style) on the left, one-line finding in 16px medium weight, one-line action in 14px regular grey. Example: [icon: droplet] "Ferritin is low at 22 ng/mL" / "Add iron-rich foods or consider supplementation →"
- Tapping a takeaway card smooth-scrolls to the relevant body system section below.

### How Individual Markers are Shown

**Body system sections — stacked below the takeaways.**
- Each system gets a section header: system name in 20px semibold, a one-line summary ("3 of 8 markers optimal"), and a horizontal bar showing the ratio of optimal/attention/out-of-range markers as colored segments (like a stacked progress bar, 6px tall, rounded corners).
- Below the header: markers are listed as collapsed rows. Each row shows: marker name (16px), current value + unit (16px mono), and a small inline range indicator (a 120px wide horizontal bar with a dot showing where the value falls). The dot color matches status.
- **Expanding a marker row** (tap) reveals: a 3-line plain-English explanation of what this marker means, the optimal range vs. standard range, population percentile as a single line ("Better than 73% of men your age"), one specific action, and a "See research →" link that opens citations in a bottom sheet.
- No more than one marker expanded at a time — tapping another collapses the previous. This enforces focus.

### How the Action Plan is Displayed

**Action plan — a distinct section after all body systems, introduced with a heading: "Your Action Plan".**
- 6 domain cards arranged as a vertical stack (not a grid — single column stays consistent).
- Each card: domain icon + name (e.g., "Nutrition"), count of actions ("4 actions"), and a collapsed list.
- Expanding a domain card reveals the actions as a checklist. Each action item: checkbox (non-functional in free tier, functional in paid — see below), the action text in 15px, and a subtle tag showing which marker(s) it addresses.
- Actions are sorted by impact (highest impact first, determined by how far the relevant marker is from optimal).

### How it Handles Free vs. Paid

**Free tier sees:**
- Full hero card with bio-age and executive summary
- All 5 key takeaways
- Body system headers with the colored ratio bars (you can see which systems need attention)
- First 3 markers per body system fully visible; remaining markers show name and status color but value and detail are blurred with a frosted-glass overlay
- Action plan domain cards visible but collapsed, with a lock icon — "Unlock your personalized action plan"

**Paywall moment:** When the user taps a blurred marker or a locked action plan domain, a bottom sheet slides up: "Get the full picture" — showing what they'll unlock, the price, and a CTA. No hard wall on initial load; the user gets enough value to feel informed but not enough to fully act.

**Paid tier adds:**
- All markers fully visible
- Full action plan with interactive checklists
- Cross-marker pattern insights (a section between body systems and action plan)
- PDF export
- "Ask Lipa" chat access for follow-up questions

### Mobile Experience
This IS the mobile experience. The single-column layout means zero adaptation needed. The sticky bottom pill nav shows: Summary (dot), Systems (dot), Actions (dot), Chat (dot). Swipe gestures are minimal — this is a scroll-and-tap interface. Cards have 16px horizontal padding, generous 24px vertical spacing between sections.

### What Makes it Feel Premium
- The restraint. There's nothing unnecessary on screen.
- Serif typography for the bio-age number and executive summary (e.g., Playfair Display or Instrument Serif) contrasted with sans-serif for data (Inter or SF Pro).
- Micro-animations: the bio-age number counts up from 0 on first load (600ms ease-out). Status dots on the range bars fade in sequentially (100ms stagger).
- The frosted-glass bottom nav and bottom sheets use backdrop-blur, matching iOS system feel.
- Generous whitespace — 40% of the screen is breathing room at any given scroll position.

### Pros
- Lowest cognitive load of all concepts — users get value in under 5 seconds
- Naturally guides attention from "what's the headline" to "give me the details"
- Excellent for users who just want the answer, not the data
- Very clean free/paid boundary that feels fair, not frustrating
- Easiest to build — single column, no complex grid layouts

### Cons
- Data-dense users (biohackers, doctors) may find it too slow to get to the numbers
- 98 markers in an accordion list can get long — scrolling fatigue after body system 4
- Cross-marker patterns are buried (only in paid tier, below body systems)
- The "one expanded marker at a time" rule may frustrate power users who want to compare
- Risk of feeling too simple for the longevity crowd who equate complexity with thoroughness

### Wireframe (Text-Based)

```
┌─────────────────────────────────┐
│                                 │
│       Your Biological Age       │  ← 14px caps, spaced tracking
│              34                 │  ← 72px serif, teal
│  Chronological: 41 · 7yr slower│  ← 16px grey
│                                 │
│  "Your metabolic and cardio     │  ← 18px serif, 2 lines
│   markers are excellent. Your   │
│   vitamin D and ferritin need   │
│   attention."                   │
│                                 │
│              ˅                  │  ← scroll chevron
└─────────────────────────────────┘

┃ ■ Ferritin is low at 22 ng/mL        │  ← amber left border
┃   Add iron-rich foods →               │
─────────────────────────────────────────
┃ ■ ApoB optimal at 72 mg/dL           │  ← teal left border
┃   Keep doing what you're doing →      │
─────────────────────────────────────────
┃ ■ Vitamin D low at 28 ng/mL          │  ← amber left border
┃   Supplement 4000 IU daily →          │
─────────────────────────────────────────

── Cardiovascular ──────────────────────
   5 of 7 markers optimal
   [████████████░░░░] ← teal/amber bar

   Total Cholesterol    195 mg/dL  [·──●──·]
   LDL-C                112 mg/dL  [·──●──·]
   ApoB                  72 mg/dL  [·●────·]
   ▸ Lp(a)               28 nmol/L [·───●─·]
   ▸ Triglycerides        89 mg/dL  [·─●───·]

── Metabolic ───────────────────────────
   7 of 8 markers optimal
   [████████████████░]
   ...

── Your Action Plan ────────────────────

   🔒 Nutrition (4 actions)        →
   🔒 Supplementation (6 actions)  →
   🔒 Lifestyle (3 actions)        →
   🔒 Exercise (2 actions)         →

─────────────────────────────────────────
      ●    ○    ○    ○     ← sticky bottom nav
   Summary Systems Actions Chat
```

---

## CONCEPT 2: "The Narrative" — Story-Based Flow

### Philosophy
Your blood test results are a story about your body, not a spreadsheet. This concept treats the dashboard like a long-form article: editorial typography, a single scrollable column, and a deliberate narrative arc — "Here's what we found. Here's what it means. Here's what to do." No grids, no tabs, no sidebar. Just a well-written, well-designed story. Inspired by Lucis, Stripe's documentation design, and long-form journalism layout.

### Layout
Single column, max-width 720px on desktop (wider than Concept 1 to accommodate longer paragraphs). Mobile is full-width with 20px padding. The entire dashboard is one continuous scroll — like reading a Substack post. Section transitions use generous whitespace (80-120px) rather than dividers or cards. A thin progress bar at the very top of the viewport (2px, teal) shows how far through the report the user has scrolled.

### How the Summary is Presented

**Opening section — "The Overview"**
- Date of analysis in small grey text: "Analysis of your blood panel from March 12, 2026"
- Below that, a 3-4 paragraph executive summary written in first person from Lipa's perspective, in 18px serif with 1.6 line height. This reads like a letter:

> "Overall, your results tell a strong story. Your cardiovascular system is performing well — your ApoB is in the optimal range, and your lipid ratios suggest low arterial risk. Your metabolic markers are solid, with fasting glucose and HbA1c both in the optimal zone.
>
> There are two areas that need your attention. Your ferritin is low at 22 ng/mL, which may explain any fatigue you've been experiencing. And your vitamin D at 28 ng/mL is below the threshold we'd like to see for immune function and bone health.
>
> The good news: both of these are straightforward to address. Read on for the full picture and your personalized action plan."

- After the text: a horizontal "report card" strip showing body system names with colored dots (teal/amber/coral) inline. This is the only visual summary — it's subordinate to the written narrative.
- Bio-age is woven into the narrative naturally: "Based on your biomarker profile, your estimated biological age is 34 — seven years younger than your chronological age of 41."

### How Individual Markers are Shown

**Body system sections — each introduced with a narrative subheading.**
- Section heading in 28px serif: "Your Cardiovascular System"
- Opening paragraph (2-3 sentences) summarizing the system's status in plain English. This is NOT a list — it's prose. Example: "Your heart and blood vessel markers paint a reassuring picture. ApoB, the single best predictor of arterial plaque risk, is well within optimal range. Your triglyceride-to-HDL ratio of 1.1 suggests strong insulin sensitivity from a cardiovascular perspective."
- After the paragraph: a compact data table styled as a quiet reference block (light grey background, 14px monospace). Columns: Marker | Your Value | Optimal Range | Status (colored dot). The table has no borders — just alternating subtle row shading.
- For markers that need attention, a "callout block" appears below the table: a full-width box with a 2px amber or coral left border, containing 2-3 sentences explaining the concern and the immediate action. This looks like a pull-quote in an article.
- Cross-marker patterns for this system are woven into the narrative paragraph, not in a separate section. Example: "We noticed that your elevated hs-CRP combined with low ferritin could suggest an inflammatory process affecting iron absorption."

### How the Action Plan is Displayed

**The action plan is the final "chapter" of the story.**
- Introduced with: "What to Do Next" in 32px serif.
- A 2-sentence framing paragraph: "Based on your results, here are the specific actions that will have the highest impact. We've organized them by domain and sorted by priority."
- Each domain is a subheading (20px semibold sans-serif) followed by numbered action items as body text. Each action is 1-2 sentences of specific guidance, with the relevant marker(s) mentioned in parentheses.
- Example:

> **Supplementation**
>
> 1. Start vitamin D3 supplementation at 4,000 IU daily with a fat-containing meal. Retest in 90 days to confirm levels have reached the 50-70 ng/mL range. *(Vitamin D: currently 28 ng/mL)*
> 2. Consider an iron bisglycinate supplement at 25mg every other day, taken with vitamin C to enhance absorption. Avoid taking with coffee or calcium. *(Ferritin: currently 22 ng/mL)*

- After the action plan: a "References" section styled like academic endnotes — small text, numbered, with PubMed links.

### How it Handles Free vs. Paid

**Free tier sees:**
- The full opening narrative (the "letter" from Lipa) — this is the hook. Users read the whole summary and feel understood.
- Body system sections: the narrative paragraph for each system is visible, but the data tables and callout blocks are replaced with a single line: "Upgrade to see your detailed marker data and specific recommendations for this system."
- The action plan heading and framing paragraph are visible, but the actual actions are behind a paywall.
- Bio-age is shown in the narrative.

**Paywall design:** A full-width banner between the free narrative and the locked details: soft gradient background, "See your complete analysis and action plan" with bullet points of what's included, and a CTA button. It appears naturally in the scroll flow — not a modal, not a popup. It feels like a "subscribe to continue reading" gate on a premium publication.

**Paid tier adds:**
- Full data tables for every system
- All callout blocks and cross-marker pattern insights
- Complete action plan with all 6 domains
- "Ask Lipa" chat access
- PDF/print-optimized export (the narrative format prints beautifully)

### Mobile Experience
This is the one concept that feels most natural on mobile, because a scrollable story is exactly how people consume content on phones. The 18px serif text with 1.6 line height is optimized for mobile reading. Data tables compress to a card-per-marker layout on screens below 480px: each marker becomes a small card showing name, value, range bar, and status.

The scroll progress bar at top provides location awareness. A floating "Back to top" button appears after scrolling past 50% of the page.

### What Makes it Feel Premium
- The editorial typography. Using a high-quality serif (e.g., Instrument Serif, Source Serif Pro) for narrative text with a clean sans-serif (Inter) for data creates a "medical journal meets lifestyle magazine" feel.
- The writing quality itself. The narrative is not generic — it references the user's specific values and connects dots. This feels like a personal letter from a doctor who actually read the results.
- Print-quality layout. Wide margins, careful typographic scale (14/16/18/20/28/32), consistent vertical rhythm.
- The progress bar and generous section spacing make it feel curated, not generated.
- No chrome, no buttons, no widgets. Just words and data. The absence of UI elements IS the design.

### Pros
- Highest perceived value — feels like a personal medical consultation
- The narrative naturally explains cross-marker patterns in context (no separate section needed)
- Excellent for users who don't know what markers mean — the story teaches them
- Prints and exports beautifully as a PDF
- The free tier gives real value (the narrative) while naturally gating the details
- Uniquely differentiating — no blood test product does this

### Cons
- Requires high-quality writing/AI generation for every report — mediocre prose would kill the concept
- Longer time-to-value for users who just want the numbers
- Not scannable — users can't quickly find a specific marker without scrolling through the story
- The narrative format may not age well for repeat users (second blood test, they want comparison, not another story)
- Hard to add interactive features (tracking, chat) without breaking the editorial feel
- Content generation cost is higher than structured templates

### Wireframe (Text-Based)

```
[═══════════════░░░░░░░░░░░░░░░░] ← 2px scroll progress bar

Analysis of your blood panel
March 12, 2026

───────────────────────────────────

Overall, your results tell a strong
story. Your cardiovascular system is
performing well — your ApoB is in
the optimal range, and your lipid
ratios suggest low arterial risk...

Your estimated biological age is 34
— seven years younger than your
chronological age of 41.

  ● Cardio  ● Metabolic  ◐ Hormonal
  ○ Immune  ● Liver      ● Kidney


                80px gap


Your Cardiovascular System
───────────────────────────────────

Your heart and blood vessel markers
paint a reassuring picture. ApoB,
the single best predictor of plaque
risk, is well within optimal...

  ┌─────────────────────────────┐
  │ Marker         Value  Status│
  │ Total Chol.    195    ●     │
  │ LDL-C          112    ●     │
  │ ApoB            72    ●     │
  │ HDL-C           62    ●     │
  │ Triglycerides    89    ●     │
  │ Lp(a)           28    ◐     │
  └─────────────────────────────┘

  ┃ Your Lp(a) at 28 nmol/L is  │ ← amber callout
  ┃ mildly elevated. While this  │
  ┃ is largely genetic, keeping  │
  ┃ ApoB optimally low is your   │
  ┃ best countermeasure.         │


                80px gap


What to Do Next
───────────────────────────────────

Based on your results, here are the
actions with the highest impact.

Supplementation

1. Start vitamin D3 at 4,000 IU
   daily with a fat-containing
   meal. (Vitamin D: 28 ng/mL)

2. Iron bisglycinate 25mg every
   other day with vitamin C.
   (Ferritin: 22 ng/mL)

Nutrition

1. Increase iron-rich foods:
   red meat 2x/week, lentils,
   spinach with lemon juice...


                40px gap


References
───────────────────────────────────
1. Sniderman AD, et al. Lancet.
   2019;393(10169):381-391.
2. ...
```

---

## CONCEPT 3: "The Command Center" — System Dashboard

### Philosophy
For the user who wants to see everything at a glance. Body systems are the primary organizing unit, each with a score and a visual gauge. The dashboard is data-dense but organized — like an Oura or WHOOP daily readiness screen, but for blood biomarkers. Color-coded, score-driven, drillable. This is for the user who opens the app, scans the grid, and knows exactly where to focus in under 3 seconds.

### Layout
**Desktop:** 12-column grid. Top section spans full width (summary strip). Below that: body system cards in a 2x3 or 3x2 grid (depending on number of systems). Each card is clickable and expands into a full detail view. Sidebar (280px, right side) shows the action plan as a persistent panel.

**Mobile:** Single column. Summary strip at top. Body system cards stack vertically as a scrollable list. Action plan moves to a bottom sheet accessible via a tab bar.

**Navigation:** A sticky top bar with the Lipa logo, the user's name, and a tab row: "Dashboard" (default), "Markers" (full list), "Actions", "Ask Lipa". The tabs change the main content area below.

### How the Summary is Presented

**Summary strip — full width, 160px tall on desktop, 200px on mobile.**
- Left third: Biological age as a circular gauge. The circle is an SVG ring (stroke-dasharray animation) — the circumference represents the age range (e.g., 20-80). A thick arc in the status color shows where the user's bio-age falls. The number is centered inside the ring in 48px bold. Below: "Bio Age: 34 | Chrono: 41" in 14px.
- Center third: A "System Status" row — 6 small circles (40px diameter each) arranged horizontally, each representing a body system. Each circle contains a score (0-100) and is filled with the status color. Below each circle: the system name in 11px. At a glance, you see six scores and six colors.
- Right third: 2-sentence executive summary text in 14px, left-aligned. Below it: "Last tested: March 12, 2026" and a small "Download PDF" link.

### How Individual Markers are Shown

**Body system cards — the core of the dashboard.**
- Each card is a 320px (desktop) or full-width (mobile) container with:
  - Card header: system name (18px semibold), system score (large, right-aligned), and a status color accent (8px colored bar at the top edge of the card).
  - A compact "gauge strip" showing all markers in this system as a row of small vertical bars (each 4px wide, 40px tall, colored by status, spaced 6px apart). This gives an instant visual fingerprint of the system — mostly green with a flash of amber is immediately readable.
  - Below the gauge strip: a list of markers with icons. Each marker row: colored dot (8px), marker name (14px), value + unit (14px mono, right-aligned). Only markers needing attention are expanded by default (showing a 1-line recommendation). Optimal markers are collapsed.
  - Card footer: "View all markers →" link.

**Marker detail view (clicking "View all markers" or a specific marker):**
- Slides in as a full-screen panel (mobile) or replaces the grid with a single-system detail view (desktop).
- Each marker gets a full-width row: name, value, a wide range bar (showing standard range, optimal range, and the user's dot), population percentile ("67th percentile for men 35-45"), a 2-sentence explanation, and the specific action.
- Cross-marker pattern cards appear at the top of the detail view if patterns exist for this system. Each pattern card: "Pattern: Insulin Resistance Risk" with a list of the contributing markers and a brief explanation.
- Citations are accessible via a small "i" icon next to each marker's explanation.

### How the Action Plan is Displayed

**Desktop: persistent right sidebar (280px).**
- Heading: "Action Plan" with a filter row (All | High Priority | By Domain).
- Actions listed as compact cards: colored priority dot (coral/amber/teal), action text in 13px, marker tag below in 11px grey. Cards are sorted by priority by default.
- Each card has a checkbox. Checking it strikes through the text and moves it to a "Completed" section at the bottom.
- Domain filters (Nutrition, Supplementation, etc.) are horizontal pills at the top.

**Mobile: dedicated "Actions" tab in the bottom navigation.**
- Same content as the sidebar, but full-screen. Actions are grouped by domain with collapsible headers.

### How it Handles Free vs. Paid

**Free tier sees:**
- Full summary strip including bio-age gauge and system scores
- All body system cards with the gauge strips (visual fingerprint) — you can see the color distribution
- Marker names and status colors visible, but actual values are replaced with "—" for all but 2 markers per system
- Action plan sidebar shows the count per domain ("6 nutrition actions") but individual actions are locked

**Paywall trigger:** Tapping a locked marker value or a locked action shows an inline expansion (not a modal): "Unlock all 98 markers and your personalized action plan — $X/report" with a CTA. The expansion pushes content down rather than overlaying it.

**Paid tier adds:**
- All marker values and details
- Full action plan with checkboxes
- Cross-marker pattern cards
- Historical comparison (if multiple tests)
- CSV export of raw data

### Mobile Experience
The grid collapses to a card stack. The summary strip becomes vertically stacked (bio-age gauge on top, system scores as a 3x2 grid of circles, summary text below). Body system cards scroll vertically. The bottom tab bar has 4 items: Dashboard, Markers, Actions, Chat. The tab bar uses SF-style icons with filled states for active tab.

The "Markers" tab provides a flat, searchable, filterable list of all 98 markers — useful for users who know exactly what they're looking for. Search bar at top, filter pills below (All, Needs Attention, Optimal, By System).

### What Makes it Feel Premium
- The gauge/score aesthetic borrows from performance dashboards (WHOOP, Tesla, Oura) that the target audience already associates with premium products.
- The system score circles on the summary strip create a memorable visual — users will screenshot this row and share it.
- Data density without clutter. The gauge strips inside body system cards pack a lot of information into a small space using only color and height.
- Smooth panel transitions: cards expand with a 300ms spring animation, detail views slide in from the right (mobile) or crossfade (desktop).
- Dark mode variant is particularly strong for this concept — the colored gauges and dots glow against a dark background.

### Pros
- Fastest time-to-signal — user identifies problem areas in under 3 seconds from the system score circles
- Satisfies data-hungry users who want to see everything
- The persistent action plan sidebar (desktop) means the user never loses sight of "what to do"
- Scales well to repeat users — they can compare system scores across tests
- The gauge strip visual fingerprint is unique and memorable

### Cons
- Highest design and engineering complexity of all concepts
- Can feel overwhelming on first use for non-technical users
- Scores can be reductive — a "72" for cardiovascular health needs context that a number alone doesn't provide
- The grid layout requires careful responsive breakpoint handling
- Risk of feeling "dashboard-y" rather than personal — users might feel like a patient, not a person
- Requires meaningful scoring algorithm — garbage scores would undermine the entire concept

### Wireframe (Text-Based)

```
┌──────────────────────────────────────────────────────────┐
│  Lipa                          Dashboard Markers Actions Chat │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ╭─────╮   (87)(92)(74)(95)(68)(91)   Your metabolic and │
│  │     │    CV Met Hor Imm Liv Kid    cardio markers are │
│  │ 34  │                              excellent. Vitamin │
│  │     │                              D and ferritin     │
│  ╰─────╯                              need attention.    │
│  Bio Age                              Mar 12, 2026 ↓PDF │
│                                                          │
├──────────────────────────────────────┬───────────────────┤
│                                      │ ACTION PLAN       │
│  ┌─────────────┐ ┌─────────────┐    │ All | Priority    │
│  │▔▔▔▔▔▔▔▔▔▔▔▔│ │▔▔▔▔▔▔▔▔▔▔▔▔│    │                   │
│  │Cardiovasc 87│ │Metabolic  92│    │ ● Take vitamin D  │
│  │█ █ █ █ ░ █ █│ │█ █ █ █ █ █ █ ░│  │   4,000 IU daily  │
│  │             │ │              │    │   (Vit D: 28)     │
│  │● Total Chol │ │● Glucose     │    │                   │
│  │● LDL-C      │ │● HbA1c      │    │ ● Iron bisglycin. │
│  │● ApoB       │ │● Insulin     │    │   25mg EOD        │
│  │◐ Lp(a)      │ │● HOMA-IR    │    │   (Ferritin: 22)  │
│  │● HDL-C      │ │● Uric Acid  │    │                   │
│  │View all →   │ │View all →   │    │ ○ Increase omega-3│
│  └─────────────┘ └─────────────┘    │   fatty fish 3x/wk│
│                                      │                   │
│  ┌─────────────┐ ┌─────────────┐    │ ○ Morning sunlight│
│  │▔▔▔▔▔▔▔▔▔▔▔▔│ │▔▔▔▔▔▔▔▔▔▔▔▔│    │   15 min daily    │
│  │Hormonal   74│ │Immune     95│    │                   │
│  │█ █ ░ ░ █ █  │ │█ █ █ █ █    │    │ ── Completed ──   │
│  │...          │ │...          │    │ ✓ Reduce alcohol  │
│  └─────────────┘ └─────────────┘    │                   │
│                                      │                   │
└──────────────────────────────────────┴───────────────────┘
```

---

## CONCEPT 4: "The Report" — Professional Medical Report

### Philosophy
Some users want their blood test results to look like they came from the best doctor in the world — structured, clinical, authoritative, but readable. This concept is a digital medical report: numbered sections, clear tables, structured findings. It borrows from Function Health's organized approach and the best clinical lab reports, but with modern typography and digital-native interactions. The design says: "A real expert reviewed this. Here are the findings."

### Layout
**Desktop:** Centered content area, 800px max-width (wider than concepts 1-2, narrower than a full dashboard). Left margin has a persistent table of contents (sticky, 200px wide) showing numbered sections. The main content scrolls; the TOC highlights the current section.

**Mobile:** Full-width single column. The TOC becomes a collapsible hamburger-style section menu accessible from a sticky header bar. The header shows the current section name (e.g., "Section 3: Cardiovascular") and tapping it reveals the full TOC as a dropdown.

**Structure mirrors a clinical report:**
1. Patient Summary
2. Key Findings
3. Biological Age Assessment
4. Body System Analysis (3a. Cardiovascular, 3b. Metabolic, etc.)
5. Cross-Marker Patterns
6. Risk Assessments
7. Action Plan
8. Methodology & References

### How the Summary is Presented

**Section 1: Patient Summary — formatted like the top of a medical document.**
- A clean header block with subtle top/bottom borders (1px, light grey):
  - Left column: Patient name, Date of analysis, Ordering context (e.g., "Self-ordered panel")
  - Right column: Report ID, Markers analyzed (98), Laboratory (if known)
- Below the header block: "Executive Summary" as a subsection heading in 16px bold sans-serif.
- The summary is a structured list, not a paragraph:
  - "Overall assessment: **Favorable** — 82 of 98 markers in optimal range"
  - "Primary concerns: Vitamin D deficiency, low ferritin"
  - "Notable strengths: Excellent cardiovascular profile, strong metabolic function"
  - "Recommended actions: 6 high-priority, 12 moderate-priority"
- Each line item has a small colored indicator (●/◐/○) for status.

**Section 2: Biological Age Assessment**
- Bio-age presented in a structured format: a centered card (480px wide) with the bio-age number, chronological age, and the delta. Below: a horizontal age scale (like a ruler) from 20-80, with a marker showing bio-age position and a different marker for chronological age. The gap between them is shaded in teal (younger) or coral (older).
- A 3-sentence interpretation paragraph below the visual.

### How Individual Markers are Shown

**Section 4: Body System Analysis — the bulk of the report.**
- Each subsection (4a, 4b, etc.) begins with a system header: system name, one-line summary, and a status badge ("5 of 7 Optimal" in a rounded pill, colored by predominant status).
- Marker data is presented in a proper table — this is the one concept that uses real tables:
  - Columns: Marker | Result | Unit | Standard Range | Optimal Range | Status | Percentile
  - Table styling: thin 1px borders, alternating row backgrounds (white / very light grey), header row in medium grey with white text. Status column uses colored dots. Percentile column shows a mini horizontal bar (40px wide) with fill.
  - Each table has 8-12 rows (one per marker in the system).
- Below each table: a "Findings" subsection listing notable observations as numbered items. Each finding is 2-3 sentences, clinically written but accessible. Findings reference specific marker values and cite the relevant research.
- Cross-marker patterns for the system are noted as "Clinical Correlations" at the end of each subsection — formatted as indented blockquotes with a vertical grey rule.

### How the Action Plan is Displayed

**Section 7: Action Plan — structured as a prioritized protocol.**
- Organized by domain, but each action is formatted as a clinical recommendation:
  - Priority level (High / Moderate / Low) as a colored badge
  - The recommendation in 1-2 specific sentences
  - Rationale (1 sentence referencing the relevant markers)
  - Monitoring note: "Retest in 90 days" or "Monitor at next panel"
  - References: superscript numbers linking to Section 8
- Example:

  | Priority | Recommendation | Rationale | Monitor |
  |----------|---------------|-----------|---------|
  | **High** | Vitamin D3 4,000 IU/day with fat-containing meal | Vitamin D at 28 ng/mL is below optimal range of 50-70 ng/mL | Retest 90 days |
  | **High** | Iron bisglycinate 25mg EOD with vitamin C | Ferritin at 22 ng/mL suggests depleted iron stores | Retest 90 days |

### How it Handles Free vs. Paid

**Free tier sees:**
- Complete Section 1 (Patient Summary) including executive summary
- Section 2 (Biological Age) fully visible
- Section 4 (Body System Analysis): table headers and first 2 markers per system are visible. Remaining rows show marker names but values are replaced with "—". Findings subsections are locked.
- Section 5 (Cross-Marker Patterns): locked entirely, shows a summary: "3 cross-marker patterns identified. Upgrade to view."
- Section 6 (Risk Assessments): locked.
- Section 7 (Action Plan): shows priority counts ("6 high-priority actions") but individual recommendations are locked.

**Paywall design:** A full-width "Unlock Full Report" banner appears between Section 2 and Section 4. Styled like a professional callout box with a subtle border: "Your complete report includes 98 marker analyses, cross-marker patterns, risk assessments, and a personalized action protocol." CTA button. This appears once — no repeated nagging throughout the report.

**Paid tier adds:**
- All marker values and findings
- Cross-marker patterns
- Risk assessments
- Full action plan protocol
- "Share with your doctor" feature — generates a clinician-friendly PDF with reference ranges and methodology notes
- Historical comparison tables (if repeat tests exist)

### Mobile Experience
The table is the challenge here. On mobile (below 640px), tables transform into a "definition list" layout: each marker becomes a row with the marker name as a bold label and the values stacked below it on separate lines. This avoids horizontal scrolling while keeping all data accessible.

The TOC becomes the section-tracking header bar. Tapping it reveals a dropdown of all sections with checkmarks next to sections already scrolled through — a progress indicator.

"Share with your doctor" is a prominent button at the bottom, recognizing that many users will forward this to a physician.

### What Makes it Feel Premium
- The clinical authority. Numbered sections, proper tables, structured findings, and references create trust. This looks like something a $500/hour doctor's office would produce.
- Typography: a clean humanist sans-serif (Söhne, Inter, or Graphik) at carefully scaled sizes. Section numbers in a slightly lighter weight create visual hierarchy without decoration.
- The table of contents with active section tracking feels like reading a well-organized research paper.
- The "Share with your doctor" feature signals that this is real, professional-grade analysis — not a toy.
- Print/PDF export is pixel-perfect — the digital version IS the printable version.

### Pros
- Highest credibility and trust — users feel they're getting a real medical analysis
- Doctors will take this seriously if patients share it — structured data in proper tables
- The numbered section structure makes it easy to reference specific parts ("Look at Section 4b, my testosterone panel")
- Scales extremely well to 98+ markers — tables are the most space-efficient way to show dense data
- Great for repeat users — comparison tables can show values across multiple test dates
- "Share with your doctor" is a potential viral growth mechanic

### Cons
- Can feel clinical and cold — some users want warmth, not authority
- Tables are a mobile UX challenge even with the definition-list fallback
- Less engaging for first-time users who don't understand what markers mean
- The structured format leaves less room for narrative explanation — findings are terse
- Risk of looking like a traditional lab report if the visual design isn't sufficiently elevated
- The TOC + sections model requires more navigation than a pure scroll experience

### Wireframe (Text-Based)

```
┌──────────┬─────────────────────────────────────────┐
│ CONTENTS │                                         │
│          │  LIPA HEALTH — BLOOD ANALYSIS REPORT    │
│ 1. Summary│                                        │
│ 2. Key    │ ─────────────────────────────────────── │
│    Findings│ Patrick L.          Report #LH-20260312│
│►3. Bio Age│ March 12, 2026      98 markers analyzed │
│ 4. Systems│ ─────────────────────────────────────── │
│  4a. Cardio│                                        │
│  4b. Metab│ EXECUTIVE SUMMARY                       │
│  4c. Horm │ ● Overall: Favorable (82/98 optimal)   │
│  4d. Immun│ ◐ Concerns: Vitamin D, Ferritin        │
│  4e. Liver│ ● Strengths: Cardiovascular, Metabolic │
│  4f. Renal│ ● Actions: 6 high, 12 moderate         │
│ 5. Patterns│                                        │
│ 6. Risk   │                                        │
│ 7. Actions│ ─────────────────────────────────────── │
│ 8. Refs   │                                         │
│          │ 3. BIOLOGICAL AGE ASSESSMENT             │
│          │                                          │
│          │        ╭──────────╮                      │
│          │        │    34    │                      │
│          │        │ bio age  │                      │
│          │        ╰──────────╯                      │
│          │                                          │
│          │  20 ──────●────────────○────── 80        │
│          │          34            41                 │
│          │          bio           chrono             │
│          │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                  │
│          │  ← 7 years younger                       │
│          │                                          │
│          │ ─────────────────────────────────────── │
│          │                                          │
│          │ 4a. CARDIOVASCULAR  [5/7 Optimal]        │
│          │                                          │
│          │ Marker       Result  Optimal   Status    │
│          │ ──────────── ─────── ───────── ──────    │
│          │ Total Chol.  195     <200      ●         │
│          │ LDL-C        112     60-100    ◐         │
│          │ ApoB          72     <80       ●         │
│          │ HDL-C          62     >50       ●         │
│          │ Triglyc.       89     <100      ●         │
│          │ Lp(a)          28     <75       ●         │
│          │ hs-CRP       0.8     <1.0      ●         │
│          │                                          │
│          │ Findings:                                 │
│          │ 1. LDL-C at 112 mg/dL is within          │
│          │    standard range but above the           │
│          │    optimal threshold of 100...            │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

---

## CONCEPT 5: "The Chat-First" — AI-Centered

### Philosophy
The dashboard IS the conversation. When the user opens their results, they see a chat interface with Lipa's analysis already written as the first set of messages — structured cards and visual elements inline within the conversation. The user can ask follow-up questions, dive deeper into any marker, or request their action plan, all through natural conversation. This is not "a dashboard with a chat feature" — it's "a chat that IS the dashboard." Inspired by the shift from dashboards to dialogue seen in Oura Advisor and WHOOP Coach, but taken to its logical conclusion.

### Layout
**The entire screen is a chat interface.** Full-width on mobile, max-width 720px centered on desktop with a soft shadow to distinguish the chat area from the background.

**Top bar:** Lipa logo, the user's name, and a small icon button to switch to "Report View" (a simplified structured view for users who want the traditional format — this is the escape hatch).

**Chat area:** Takes up the full viewport minus top bar (56px) and input bar (72px). Messages scroll vertically. Lipa's messages are left-aligned with a small Lipa avatar (32px circle, brand icon). User messages are right-aligned with a teal background.

**Input bar:** Fixed at bottom. Text input with a microphone icon (voice input) and a "+" icon (attach a new blood test PDF). Placeholder text: "Ask me anything about your results..."

**Pre-populated messages:** When the user first opens the results, the chat already contains Lipa's analysis as a series of messages — the user didn't type anything; Lipa "initiated" the conversation. This makes the results feel like a briefing, not a query.

### How the Summary is Presented

**Lipa's opening message sequence (pre-populated, appears with a typing animation on first view):**

**Message 1 — Greeting card:**
A message bubble containing a styled card (full chat width, rounded corners, subtle border):
- "Hi Patrick, your results from March 12 are ready. Here's what I found."
- Below the text: a horizontal strip showing bio-age (34) on the left, a small delta badge ("-7 years") in teal, and "82/98 optimal" on the right.

**Message 2 — Executive summary:**
A plain text message in Lipa's voice: "Overall, your numbers look strong. Your cardiovascular and metabolic markers are in great shape. I flagged two things that need your attention — ferritin and vitamin D — both very fixable. Want the details?"

**Message 3 — Quick-action buttons:**
Below message 2, a row of tappable pill buttons (horizontally scrollable): "Show key findings" | "Body systems" | "Action plan" | "Ask a question"

These buttons are the primary navigation. Tapping one sends it as a "user message" and triggers Lipa's response.

### How Individual Markers are Shown

**Triggered by tapping "Body systems" or asking "Show me my cardiovascular markers."**

**Lipa responds with a system card message:**
A card embedded in the chat bubble:
- System name and score at top (e.g., "Cardiovascular — 87/100")
- A compact list of markers: name, value, colored status dot. No range bars — keeping it clean for the chat context.
- Below the list: a 1-2 sentence interpretation. "Your lipid panel looks excellent. ApoB at 72 puts you in the top quartile for cardiovascular protection."
- At the bottom of the card: two pill buttons: "Tell me more about ApoB" | "Next system →"

**Drilling into a marker (tapping "Tell me more about ApoB"):**
Lipa responds with a text message explaining ApoB in plain English (3-4 sentences), followed by a small inline data card: the value, optimal range, population percentile bar, and the specific recommendation for this marker. A small "Sources" link at the bottom opens citations.

**The user can also just type:** "Why is my ferritin low?" and Lipa responds conversationally, referencing their specific values and suggesting causes and actions.

### How the Action Plan is Displayed

**Triggered by tapping "Action plan" or asking "What should I do?"**

**Lipa sends a structured message:**
"Based on your results, here are your top priorities, ranked by impact:"

Followed by a series of inline action cards (one per message bubble, sent in rapid sequence):

**Action card 1:**
- Priority badge: "High Priority" (coral)
- Action: "Start vitamin D3 — 4,000 IU daily"
- Context: "Your vitamin D is at 28 ng/mL. Optimal is 50-70."
- Two buttons: "Why this dose?" | "Done ✓"

**Action card 2:**
- Priority badge: "High Priority" (amber)
- Action: "Iron bisglycinate — 25mg every other day"
- Context: "Ferritin at 22 ng/mL. Aim for 50-100."
- Two buttons: "Best time to take?" | "Done ✓"

...and so on. The "Why this dose?" buttons trigger explanatory follow-up messages. The "Done" buttons mark the action as completed and Lipa responds: "Great, I'll note that. We'll check your levels on your next panel."

### How it Handles Free vs. Paid

**Free tier sees:**
- Message 1 (greeting with bio-age and summary stats) — fully visible
- Message 2 (executive summary text) — fully visible
- Message 3 (quick-action buttons) — "Show key findings" works; other buttons trigger a soft gate
- Tapping "Body systems" or "Action plan" triggers a Lipa message: "I can show you a preview of your cardiovascular system — your top system." Lipa then sends ONE system card (the best-performing system, to create a positive experience). After that: "To see all your body systems, individual markers, and your personalized action plan, unlock the full analysis."
- The user can type questions, but Lipa responds with general answers and gently redirects: "Your ferritin is in the range that typically suggests low iron stores. With the full analysis, I can give you the specific number, what it means in context with your other markers, and exactly what to do about it."

**Paywall design:** The paywall IS a chat message from Lipa — a styled card within the conversation: "Unlock the full conversation" with what's included and a CTA. It feels like Lipa is offering, not blocking.

**Paid tier adds:**
- Unlimited system cards and marker drill-downs
- Full action plan with interactive "Done" buttons
- Ability to ask unlimited follow-up questions
- Cross-marker pattern insights (Lipa proactively mentions these when showing relevant systems)
- "Email me a summary" feature
- Thread history — come back and continue the conversation later

### Mobile Experience
This concept IS a mobile experience. The chat interface is the most natural mobile pattern — everyone knows how to use a messaging app. The input bar is at the bottom of the screen exactly where the keyboard will appear. Cards within messages are designed for thumb-reach tapping.

**One key addition for mobile:** A small floating button (top right, above the chat) labeled "Jump to top" that scrolls to the beginning of the results conversation — essential because the chat can get long.

On desktop, the chat is centered with generous padding on either side. The wider space is used to make cards slightly wider and more readable, but the core experience is identical.

### What Makes it Feel Premium
- The conversational tone. Lipa speaks like a knowledgeable friend who happens to be a doctor. Not clinical, not casual — confident and clear. "Your ApoB at 72 is genuinely impressive. Keep doing whatever you're doing." This voice IS the product.
- The interactivity. Tapping buttons and getting immediate, personalized responses feels like a private consultation, not reading a report.
- The typing animation on first load. Lipa's messages appear one by one with a brief typing indicator (...) between them (300ms each). This pacing creates the feeling that Lipa is thinking about your results right now.
- The card design within messages. Rounded corners, subtle shadows, clean typography inside a chat bubble. It's the best of both worlds — structured data in a conversational frame.
- Dark mode in this concept is particularly natural — dark chat backgrounds are familiar from every messaging app.

### Pros
- Most engaging and interactive of all concepts — users spend more time, learn more
- Natural upsell path — the paywall feels like a conversation, not a gate
- Follow-up questions are a first-class feature, not bolted on
- Cross-marker patterns can be explained naturally in conversation when relevant
- Lowest barrier to understanding — if you can use WhatsApp, you can use this
- Users can come back and ask new questions as they implement changes
- The "Ask me anything" input bar is the most powerful feature in the product — always visible

### Cons
- The pre-populated messages can feel fake — the user knows they didn't have a real conversation
- Chat interfaces are inherently linear — hard to scan or find specific information later
- Long threads become unwieldy — finding "what was my LDL again?" requires scrolling
- The "Report View" escape hatch is necessary, which means building two interfaces
- AI response quality must be exceptional — a bad answer destroys trust in the entire concept
- Loading time is perceptually longer (typing animations) even if data loads instantly
- Users who want to print or share their results need an alternate view
- The concept depends entirely on the quality of the AI — this is a feature, but also a risk

### Wireframe (Text-Based)

```
┌─────────────────────────────────┐
│  Lipa 🔬         ≡ Report View  │
├─────────────────────────────────┤
│                                 │
│  ○ Hi Patrick, your results     │
│    from March 12 are ready.     │
│    Here's what I found.         │
│  ┌───────────────────────────┐  │
│  │ Bio Age: 34  (-7yr)       │  │
│  │ 82/98 markers optimal     │  │
│  └───────────────────────────┘  │
│                                 │
│  ○ Overall, your numbers look   │
│    strong. Your cardiovascular   │
│    and metabolic markers are in │
│    great shape. I flagged two   │
│    things — ferritin and        │
│    vitamin D — both fixable.    │
│                                 │
│  [Key findings] [Body systems]  │
│  [Action plan] [Ask a question] │
│                                 │
│                  Body systems ● │
│                                 │
│  ○ Here's your cardiovascular   │
│    system — your strongest:     │
│  ┌───────────────────────────┐  │
│  │ Cardiovascular — 87       │  │
│  │                           │  │
│  │ ● Total Chol.    195      │  │
│  │ ● LDL-C          112      │  │
│  │ ● ApoB            72      │  │
│  │ ● HDL-C            62      │  │
│  │ ● Triglycerides     89      │  │
│  │ ◐ Lp(a)            28      │  │
│  │                           │  │
│  │ Your lipid panel looks    │  │
│  │ excellent. ApoB at 72     │  │
│  │ puts you in the top       │  │
│  │ quartile.                 │  │
│  │                           │  │
│  │ [More on ApoB] [Next →]  │  │
│  └───────────────────────────┘  │
│                                 │
│  ○ ...                          │
│                                 │
│                Why is my       ●│
│                ferritin low?    │
│                                 │
│  ○ Your ferritin at 22 ng/mL   │
│    is below the optimal range   │
│    of 50-100. This means your   │
│    iron stores are depleted...  │
│                                 │
├─────────────────────────────────┤
│ Ask me anything about your...   │
│                          🎤  +  │
└─────────────────────────────────┘
```

---

## Comparison Matrix

| Dimension | Apple Health | Narrative | Command Center | Report | Chat-First |
|-----------|-------------|-----------|----------------|--------|------------|
| **Time to first insight** | 2 sec | 15 sec | 3 sec | 10 sec | 5 sec |
| **Depth available** | Medium | High | High | Highest | Medium |
| **Cognitive load** | Lowest | Low | Medium | Medium-High | Low |
| **Mobile-native** | Excellent | Excellent | Good | Fair | Excellent |
| **Repeat user experience** | Good | Fair | Excellent | Excellent | Good |
| **Shareability** | Low | High (PDF) | Medium | Highest | Low |
| **Build complexity** | Low | Medium | High | Medium | High |
| **Unique differentiator** | Simplicity | Writing quality | Visual density | Clinical trust | Interactivity |
| **Best for** | Casual users | First-time users | Data-hungry users | Share-with-doctor | Engaged learners |
| **Free→paid conversion** | Good | Good | Good | Fair | Best |

---

## Recommendation

These concepts are not mutually exclusive. The strongest product likely combines elements:

1. **Primary view: Concept 1 (Apple Health) as the default landing experience.** Minimalist summary-first ensures every user gets value in under 5 seconds. This is the "homepage."

2. **Concept 5 (Chat-First) as the primary engagement layer.** "Ask Lipa" is always one tap away. The chat is where users spend time, learn, and convert to paid.

3. **Concept 4 (Report) as the export/share format.** When users want to share with their doctor or print their results, generate the clinical report format. This doubles as a trust signal — "You can export this as a medical-grade report."

4. **Borrow the narrative writing quality from Concept 2** for all text throughout the product. Every explanation, every summary, every action item should read like it was written by a thoughtful physician, not generated by a template.

5. **Borrow the system scores from Concept 3** as a quick-scan tool, but use them as a navigation element within Concept 1, not as the primary interface.

The hybrid: users land on the Apple Health summary, see system scores as navigation, tap into details that read with narrative quality, ask Lipa follow-up questions in chat, and export as a clinical report. Each concept contributes its strongest element.

---

## Sources & Inspiration

Research informing these concepts:

- [Healthcare UI Design 2026: Best Practices](https://www.eleken.co/blog-posts/user-interface-design-for-healthcare-applications) — calm clarity, reduced cognitive load
- [Function Health Review](https://optimizebiomarkers.com/providers/function-health) — body system organization, color-coded markers
- [InsideTracker Bloodwork Page](https://blog.insidetracker.com/introducing-insidetrackers-new-bloodwork-page) — zone-colored graphs, personal optimal ranges
- [Progressive Disclosure in Health & Social Care](https://medium.com/@bmedlicottfoster/why-progressive-disclosure-is-non-negotiable-in-health-and-social-care-caffa1265bb6) — insight on surface, data one tap behind
- [Lucis — Preventive Health](https://www.lucis.life/) — narrative approach, connecting dots between biomarkers
- [Blood Test App Development 2026](https://topflightapps.com/ideas/blood-test-app-development/) — role-based interfaces, premium analytics
- [WHOOP UX Evaluation](https://everydayindustries.com/whoop-wearable-health-fitness-user-experience-evaluation/) — score-driven dashboards, recovery gauges
- [AI Dashboard Design Principles](https://www.lazarev.agency/articles/ai-dashboard-design) — hybrid chat + structured UI
- [Design Patterns for AI Interfaces](https://www.smashingmagazine.com/2025/07/design-patterns-ai-interfaces/) — cards over chat bubbles for complex data
- [Health App Paywall Best Practices](https://dev.to/paywallpro/effective-paywall-examples-in-health-fitness-apps-2025-3op9) — show value before price, 4-12% conversion benchmarks
- [SuperAge Bio-Age App](https://www.superage.app/en/blog/best-humanity-alternatives/) — ring visualizations, health domain scores
- [Conversational UI Design Patterns](https://www.aiuxdesign.guide/patterns/conversational-ui) — chat + structured elements hybrid approach

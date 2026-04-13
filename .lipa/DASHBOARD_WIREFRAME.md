# Lipa Dashboard Wireframe — Apple Health Hybrid + Ask Lipa

## Desktop Layout (max-width: 1200px, centered)

```
┌─────────────────────────────────────────────────────────────────┐
│  🌿 LIPA    Overview   Vault   Upload   Account      [Upload]  │
└─────────────────────────────────────────────────────────────────┘

  10 April 2026  ·  98 markers analyzed         [Export PDF] [Delete]

  ┌──────────────┐  ┌────────────────────────────────────────────┐
  │              │  │                                            │
  │  BIO-AGE     │  │  SUMMARY                                  │
  │              │  │                                            │
  │    32.9      │  │  Your blood work shows elevated            │
  │              │  │  cholesterol (LDL 152, ApoB 118) and       │
  │   -7.1 yrs  │  │  inflammation (hs-CRP 2.8) with            │
  │              │  │  borderline glucose control. Priority:     │
  │  vs age 40   │  │  aggressive lipid management, omega-3      │
  │  11 markers  │  │  supplementation, and anti-inflammatory    │
  │              │  │  dietary changes.                          │
  └──────────────┘  └────────────────────────────────────────────┘

  ● 46 optimal   ● 23 in range   ● 23 borderline   ● 6 need attention

  ─────────────────────────────────────────────────────────────────

  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │  🟢  ASK LIPA — Your Personal Health Assistant              │
  │                                                             │
  │  ┌───────────────────┐ ┌───────────────────┐ ┌───────────┐ │
  │  │ Why is my         │ │ What supplements  │ │ Should I  │ │
  │  │ cholesterol high? │ │ should I take?    │ │ retest in │ │
  │  │                   │ │                   │ │ 3 months? │ │
  │  └───────────────────┘ └───────────────────┘ └───────────┘ │
  │                                                             │
  │  ┌─────────────────────────────────────────────┐  ┌──────┐ │
  │  │ Ask anything about your results...          │  │ Send │ │
  │  └─────────────────────────────────────────────┘  └──────┘ │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘

  ─────────────────────────────────────────────────────────────────

  KEY FINDINGS                              What needs your attention

  ┌──────────────────────────────┐  ┌──────────────────────────────┐
  │ 🔴 LDL Cholesterol          │  │ 🔴 hs-CRP                    │
  │    152 mg/dL                 │  │    2.8 mg/L                  │
  │                              │  │                              │
  │ Elevated cardiovascular risk.│  │ Inflammation above target.   │
  │ Increase omega-3, reduce     │  │ Mediterranean diet +         │
  │ saturated fat intake.        │  │ omega-3 supplementation.     │
  │                       [→]    │  │                       [→]    │
  └──────────────────────────────┘  └──────────────────────────────┘

  ┌──────────────────────────────┐  ┌──────────────────────────────┐
  │ 🔴 Omega-3 Index             │  │ ⚠️  Fasting Glucose          │
  │    4.2%                      │  │    98 mg/dL                  │
  │                              │  │                              │
  │ Critically low. Take 2,000mg │  │ Borderline. Monitor HbA1c.  │
  │ EPA+DHA daily (triglyceride  │  │ Reduce refined sugar and    │
  │ form, with food).            │  │ simple carbohydrates.       │
  │                       [→]    │  │                       [→]    │
  └──────────────────────────────┘  └──────────────────────────────┘

  ─────────────────────────────────────────────────────────────────

  BODY SYSTEMS                           Tap any system to explore

  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
  │ ❤️           │ │ ⚡          │ │ 🧬          │ │ 🔥           │
  │ Cardio-     │ │ Metabolic   │ │ Hormonal    │ │ Inflam-     │
  │ vascular    │ │             │ │             │ │ matory      │
  │             │ │             │ │             │ │             │
  │ 3/8 optimal │ │ 4/5 optimal │ │ 10/12 optim │ │ 2/8 optimal │
  │             │ │             │ │             │ │             │
  │    [→]      │ │    [→]      │ │    [→]      │ │    [→]      │
  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                  ┌─────────────┐
                  │ 🥗           │
                  │ Nutritional │
                  │             │
                  │ 9/12 optim  │
                  │             │
                  │    [→]      │
                  └─────────────┘

  When tapped, system expands to show all markers in that group:

  ┌─── ❤️ CARDIOVASCULAR ─────────────────────────────────────────┐
  │                                                               │
  │  Total Cholesterol  228 mg/dL   🔴 Out of range        [→]   │
  │  ─────────────────────────────────────────────────────────    │
  │  LDL Cholesterol    152 mg/dL   🔴 Out of range        [→]   │
  │  ─────────────────────────────────────────────────────────    │
  │  HDL Cholesterol     48 mg/dL   ⚠️  Borderline          [→]   │
  │  ─────────────────────────────────────────────────────────    │
  │  Triglycerides      142 mg/dL   ● In range              [→]   │
  │  ─────────────────────────────────────────────────────────    │
  │  ApoB               118 mg/dL   🔴 Out of range        [→]   │
  │  ─────────────────────────────────────────────────────────    │
  │  ...                                                          │
  └───────────────────────────────────────────────────────────────┘

  When a marker is tapped, full detail expands:

  ┌─── TOTAL CHOLESTEROL ─────────────────────────────────────────┐
  │                                                               │
  │  228 mg/dL    🔴 Out of range    69th percentile              │
  │                                                               │
  │  ┌─ RANGE BAR ──────────────────────────────────────────────┐ │
  │  │  🔴 |  ⚠️  | ████████ 🟢 OPTIMAL ████████ |  ⚠️  |  🔴  │ │
  │  │              ↑ 150          ● 228              200       │ │
  │  └──────────────────────────────────────────────────────────┘ │
  │                                                               │
  │  ┌─ WHAT TO DO ─────────────────────────────────── (green) ─┐ │
  │  │ Reduce saturated fat. Eat fatty fish 3x/week. Consider   │ │
  │  │ 2g omega-3 (EPA+DHA). Discuss statin with your doctor    │ │
  │  │ given ApoB is also elevated at 118.                      │ │
  │  └──────────────────────────────────────────────────────────┘ │
  │                                                               │
  │  WHAT THIS MEANS                                              │
  │  At 228, you're above the 200 threshold. But total            │
  │  cholesterol alone doesn't tell the full story — particle     │
  │  type matters more. Your ApoB confirms elevated risk.         │
  │                                                               │
  │  WHAT THE RESEARCH SHOWS           · 10 studies               │
  │  A 2024 meta-analysis found that total cholesterol above      │
  │  200 is associated with increased cardiovascular risk...      │
  │                                                               │
  │  [Show 10 cited studies ▾]                                    │
  │                                                               │
  │  RELATED PATTERNS                                             │
  │  Your elevated LDL + ApoB + low HDL together suggest          │
  │  atherogenic dyslipidemia — a pattern worth monitoring.       │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘

  ─────────────────────────────────────────────────────────────────

  PATTERNS DETECTED                                    3 patterns

  ┌─────────────────────────────────────────────────────────────┐
  │  🔴 Atherogenic dyslipidemia                                │
  │     LDL + ApoB + HDL + Triglycerides                        │
  │     [Unlock details →]  (free) / [full detail]  (paid)      │
  ├─────────────────────────────────────────────────────────────┤
  │  ⚠️  Early metabolic syndrome                                │
  │     Glucose + HbA1c + Triglycerides + HDL                   │
  │     [Unlock details →]  (free) / [full detail]  (paid)      │
  ├─────────────────────────────────────────────────────────────┤
  │  ⚠️  Inflammation-cardiovascular link                        │
  │     hs-CRP + LDL + Omega-3                                  │
  │     [Unlock details →]  (free) / [full detail]  (paid)      │
  └─────────────────────────────────────────────────────────────┘

  ─────────────────────────────────────────────────────────────────

  YOUR ACTION PLAN                     Personalized to your results

  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ 🥗 Nutrition             │  │ 💊 Supplementation       │
  │    3 recommendations     │  │    4 recommendations     │
  │                   [→]    │  │                   [→]    │
  └──────────────────────────┘  └──────────────────────────┘
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ 😴 Sleep                 │  │ 🏃 Movement              │
  │    1 recommendation      │  │    2 recommendations     │
  │                   [→]    │  │                   [→]    │
  └──────────────────────────┘  └──────────────────────────┘
  ┌──────────────────────────┐  ┌──────────────────────────┐
  │ 🌿 Environment           │  │ 🧘 Lifestyle             │
  │    1 recommendation      │  │    2 recommendations     │
  │                   [→]    │  │                   [→]    │
  └──────────────────────────┘  └──────────────────────────┘

  ─────────────────────────────────────────────────────────────────

  RISK INSIGHTS                              12 calculations

  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
  │ eGFR          │ │ Castelli Idx  │ │ TG/HDL Ratio  │
  │ 117           │ │ 4.75          │ │ 2.96          │
  │ 🟢 Normal     │ │ ⚠️ Moderate    │ │ ⚠️ Moderate    │
  └───────────────┘ └───────────────┘ └───────────────┘

  ─────────────────────────────────────────────────────────────────

  ┌─── SHARE YOUR RESULTS ────────────────────────────────────────┐
  │                                                               │
  │  [📊 Report Card]   [📄 Export PDF]   [🔗 Share with Doctor]  │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘

  Upload another blood test →

  This analysis is educational content, not medical advice.

```

## Mobile Layout (single column, bottom nav)

```
┌─────────────────────────┐
│  🌿 LIPA        [Upload]│
├─────────────────────────┤
│                         │
│  10 Apr 2026 · 98 mkrs  │
│                         │
│  ┌───────────────────┐  │
│  │  BIO-AGE   32.9   │  │
│  │  -7.1y vs age 40  │  │
│  └───────────────────┘  │
│                         │
│  SUMMARY                │
│  Elevated cholesterol   │
│  + inflammation...      │
│  [Read more]            │
│                         │
│  ● 46 ● 23 ● 23 ● 6    │
│                         │
├─────────────────────────┤
│  🟢 ASK LIPA            │
│  [Why cholesterol?]     │
│  [Supplements?]         │
│  [Ask anything... Send] │
├─────────────────────────┤
│  KEY FINDINGS           │
│  🔴 LDL 152 → omega-3  │
│  🔴 hs-CRP 2.8 → diet  │
│  🔴 Omega-3 4.2% → sup │
│  ⚠️  Glucose 98 → sugar │
├─────────────────────────┤
│  BODY SYSTEMS           │
│  [❤️ 3/8] [⚡ 4/5]      │
│  [🧬 10/12] [🔥 2/8]    │
│  [🥗 9/12]              │
├─────────────────────────┤
│  ACTION PLAN            │
│  [Nutrition 3] [Supps 4]│
│  [Sleep 1] [Movement 2] │
├─────────────────────────┤
│  [Report] [PDF] [Share] │
│                         │
│  ───────────────────    │
│  [Overview][Vault]      │
│  [Upload][Account]      │
└─────────────────────────┘
```

## Free vs Paid Gating

```
FREE USER:
├─ Bio-age: SHOWN (hook — "I'm biologically 32.9!")
├─ Summary: 2 lines truncated + "Unlock full summary"
├─ Ask Lipa: Section visible, suggested Qs shown, but chat → "Upgrade to ask"
├─ Key Findings: 5 markers shown (the most concerning)
├─ Body Systems: Cards with counts shown, tap → "Upgrade to explore"
├─ Patterns: Names + severity shown, details → "Unlock details"
├─ Action Plan: Blurred preview of domains
├─ Risk Insights: Hidden
├─ Share: Hidden
└─ UPGRADE CARDS at bottom: Lipa Life (featured) + Lipa One

PAID USER:
├─ Everything unlocked
├─ All markers, all depth, all citations
├─ Ask Lipa unlimited
├─ Full action plan with dosages
├─ Report card + PDF export
└─ Share with doctor link
```

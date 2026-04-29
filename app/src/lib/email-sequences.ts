// Drip-sequence email templates fired by the cron from scheduled_emails rows.
//
// Each function takes the row's `payload` (whatever the scheduler stashed) and
// returns { subject, html, text }. The cron handler then sends via the shared
// `send()` helper in email.ts so BCC + Resend logic stays in one place.
//
// Keep templates small + opinionated. Each email serves a single purpose
// (cred / wedge / action / trust / conversion). See ./email-sequences.notes.md
// for the rationale per template.

type TemplateOutput = { subject: string; html: string; text: string };

interface SequencePayload {
  goalTitles?: string[];
  topMarkers?: string[];        // 3 hand-picked highest-impact markers for their goals
  country?: string;
  goals?: string[];             // raw keys, used to build the "update plan" link
}

const FROM = "Lipa Health <hello@lipa.health>";
export { FROM };

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(opts: { eyebrow: string; headline: string; bodyHtml: string; ctaText?: string; ctaUrl?: string; updatePlanUrl?: string }): string {
  const { eyebrow, headline, bodyHtml, ctaText, ctaUrl, updatePlanUrl } = opts;
  return `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;background:#F8F5EF;margin:0;padding:32px 0;color:#0F1A15;">
  <div style="max-width:560px;margin:0 auto;padding:0 24px;">
    <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#1B6B4A;margin-bottom:8px;">${escapeHtml(eyebrow)}</div>
    <h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;line-height:1.25;margin:0 0 18px;">${escapeHtml(headline)}</h1>
    <div style="font-size:14px;color:#0F1A15;line-height:1.65;">${bodyHtml}</div>
    ${ctaText && ctaUrl ? `<div style="margin-top:28px;"><a href="${ctaUrl}" style="display:inline-block;background:#1B6B4A;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 24px;border-radius:999px;">${escapeHtml(ctaText)}</a></div>` : ""}
    ${updatePlanUrl ? `<p style="font-size:12px;color:#5A635D;margin-top:24px;line-height:1.55;">Picked the wrong country or goals? <a href="${updatePlanUrl}" style="color:#1B6B4A;text-decoration:underline;">Update your plan &rarr;</a></p>` : ""}
    <p style="font-size:11px;color:#8A928C;margin-top:32px;line-height:1.55;border-top:1px solid rgba(15,26,21,0.06);padding-top:16px;">
      Lipa is educational content, not a medical device. Not a substitute for your physician.<br/>
      <a href="https://lipa.health" style="color:#1B6B4A;text-decoration:none;">lipa.health</a>
    </p>
  </div>
</body></html>`;
}

function planLink(payload: SequencePayload): string | undefined {
  if (!payload.goals || !payload.country) return undefined;
  return `https://my.lipa.health/test-finder?goals=${encodeURIComponent(payload.goals.join(","))}&country=${encodeURIComponent(payload.country)}`;
}

// -- Day 3 — Why these markers --
// Build credibility. Pick 3 highest-impact markers for their goal and explain
// what each measures + why it matters + 1 cited study. ~600 words total.
export function day3Markers(payload: SequencePayload): TemplateOutput {
  const top = payload.topMarkers || ["ApoB", "hs-CRP", "Vitamin D"];
  const goalLine = (payload.goalTitles || []).join(" + ");
  const subject = `Why we picked these markers for your ${goalLine || "Lipa"} panel`;

  const details: Record<string, { what: string; why: string; research: string }> = {
    "ApoB": {
      what: "ApoB counts every atherogenic particle in your blood — every LDL, VLDL, IDL, and Lp(a) particle has exactly one ApoB protein on it. So ApoB is a direct count of plaque-causing particles, while LDL-C is just an estimate of cholesterol mass.",
      why: "A 2023 European Society of Cardiology consensus statement now recommends ApoB over LDL-C in any case of mismatch — and 30% of people have mismatch (normal LDL but elevated ApoB or vice versa). For optimization, that 30% is who Lipa catches.",
      research: "Sniderman et al., JACC 2019. ApoB outperformed LDL-C and non-HDL-C in predicting cardiovascular events across 6 large prospective cohorts (N=380,000+).",
    },
    "Lp(a)": {
      what: "Lp(a) is a genetically-determined cholesterol particle that 1 in 5 people has at elevated levels. It's not affected by diet, exercise, or statins — and most doctors don't test for it.",
      why: "Elevated Lp(a) >50 mg/dL doubles cardiovascular risk independent of LDL. If you have it, you need to know — interventions exist (PCSK9 inhibitors, lipoprotein apheresis), and your protein-rich foods/dose timing matters more.",
      research: "Kamstrup et al., JACC 2008. 9,330 participants from the Copenhagen Heart Study — Lp(a) >115 mg/dL conferred a 2-3x higher risk of myocardial infarction.",
    },
    "hs-CRP": {
      what: "High-sensitivity C-reactive protein is the cleanest marker we have for systemic inflammation — the underlying driver of cardiovascular disease, cognitive decline, metabolic dysfunction, and 'normal but feeling off' symptoms.",
      why: "Optimal hs-CRP is below 1.0 mg/L. Most labs flag only above 3.0. The 1.0-3.0 range is silent inflammation that drives 70% of chronic disease — and it responds to interventions Lipa can recommend (omega-3, sleep, weight, magnesium).",
      research: "Ridker et al., NEJM 2008 (JUPITER trial). 17,802 participants with normal LDL but elevated hs-CRP — statin therapy reduced major events by 44%, suggesting the inflammation, not the cholesterol, was the driver.",
    },
    "Total Testosterone": {
      what: "Total testosterone is the headline number, but it's only useful with SHBG and free testosterone — together they tell you what's actually bioavailable.",
      why: "Two men with identical 'total T' of 600 ng/dL can have wildly different free T depending on SHBG. Lipa doesn't just flag total — it cross-checks all three to estimate bioavailable T against age-specific optimal ranges.",
      research: "Wittert et al., NEJM 2021. Total testosterone alone correlated poorly with symptoms — only the free + SHBG composite predicted clinical outcomes.",
    },
    "Free Testosterone": {
      what: "Free testosterone is the unbound, biologically active fraction — about 1-2% of total. This is what your tissues actually use.",
      why: "On TRT, free T is the more reliable marker for dialing dose. Total T can be artificially elevated by dehydration or shifted by SHBG changes; free T tracks what your body experiences.",
      research: "Bhasin et al., Endocrine Society Guidelines 2018. Recommends free T (calculated or directly measured) for dose monitoring on TRT, not total T alone.",
    },
    "SHBG": {
      what: "Sex hormone binding globulin determines how much testosterone is free vs bound. High SHBG = less bioavailable hormone, even if total testosterone looks normal.",
      why: "SHBG responds to liver health, insulin resistance, alcohol, and protein intake. Lipa flags it specifically because most doctors ignore it — and it's the single most actionable lever for hormone optimization.",
      research: "Wallace et al., Eur J Endocrinol 2013. SHBG independently predicted metabolic syndrome risk in 4,000+ men, even after adjusting for testosterone.",
    },
    "Hematocrit": {
      what: "Hematocrit is the percentage of your blood that's red blood cells. TRT can push it above 52%, which thickens the blood and increases stroke risk.",
      why: "Most doctors don't track hematocrit closely on TRT. Lipa flags it as part of the TRT panel because it's the #1 reason to dose-adjust or donate blood.",
      research: "Ory et al., J Sex Med 2022. Polycythemia (Hct >54%) occurred in 11% of men on TRT — and was the strongest predictor of cardiovascular events on therapy.",
    },
    "HbA1c": {
      what: "HbA1c is your average blood sugar over the last 3 months — measured by how much glucose has glycated onto your hemoglobin.",
      why: "Optimal HbA1c is below 5.4%. Most labs only flag above 5.7% (prediabetes). The 5.4-5.7 range is metabolic dysfunction in slow motion — and it responds to specific interventions Lipa recommends.",
      research: "Khaw et al., BMJ 2001. EPIC-Norfolk study, 10,232 participants — every 1% increase in HbA1c above 5.0% raised cardiovascular mortality by 28%, independent of diabetes status.",
    },
    "Fasting Insulin": {
      what: "Fasting insulin shows how hard your pancreas is working to keep glucose normal. Often elevated for years before glucose itself rises.",
      why: "Optimal fasting insulin is below 6 µIU/mL. The 6-15 range is silent insulin resistance — usually missed because doctors only test glucose. Lipa always pairs glucose with insulin to compute HOMA-IR (the ratio that actually matters).",
      research: "Jones et al., J Clin Endocrinol Metab 2019. Fasting insulin predicted metabolic dysfunction 5-7 years before glucose elevation in 7,500+ participants.",
    },
    "Vitamin D": {
      what: "Vitamin D (25-hydroxy) is technically a hormone, not a vitamin — and it modulates immune function, bone density, mood, and inflammation.",
      why: "Most labs say >30 ng/mL is normal. Research shows the optimal range is 50-70 ng/mL. The 30-50 range is functional deficiency — fixable with sunlight, supplementation, and vitamin K2 co-factor.",
      research: "Holick et al., Endocrine Society Guidelines 2011. Optimal range for cardiovascular and metabolic outcomes is 40-60 ng/mL, with no benefit (and possible harm) above 100 ng/mL.",
    },
  };

  const blocks = top
    .map((m) => {
      const d = details[m] || details["ApoB"];
      return `
<div style="margin:24px 0;padding:18px;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;">
  <div style="font-family:Georgia,serif;font-size:18px;font-weight:500;color:#0F1A15;margin-bottom:8px;">${escapeHtml(m)}</div>
  <p style="font-size:13px;color:#5A635D;line-height:1.65;margin:0 0 10px;"><strong style="color:#0F1A15;">What it measures.</strong> ${escapeHtml(d.what)}</p>
  <p style="font-size:13px;color:#5A635D;line-height:1.65;margin:0 0 10px;"><strong style="color:#0F1A15;">Why it matters for you.</strong> ${escapeHtml(d.why)}</p>
  <p style="font-size:12px;color:#8A928C;line-height:1.55;margin:0;font-style:italic;"><strong>Research.</strong> ${escapeHtml(d.research)}</p>
</div>`;
    })
    .join("");

  const intro = `<p style="margin:0 0 16px;">When you submitted your test plan we picked ${top.length} markers among the panel that matter most for your goals${goalLine ? ` (${escapeHtml(goalLine)})` : ""}. Here&rsquo;s what each one measures, why it matters specifically for you, and the research behind why we put it on the list.</p>`;

  const outro = `<p style="margin:24px 0 0;font-size:13px;color:#5A635D;">Want this depth on every marker on your panel — not just three? That&rsquo;s what Lipa does once your results arrive. 250,000+ peer-reviewed studies, every claim cited, six life domains of recommendations.</p>`;

  const html = shell({
    eyebrow: "Why these markers",
    headline: "The research behind your panel.",
    bodyHtml: intro + blocks + outro,
    ctaText: "See a sample analysis",
    ctaUrl: "https://my.lipa.health/demo",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

When you submitted your test plan we picked ${top.length} markers among the panel that matter most for your goals.

${top.map((m) => {
  const d = details[m] || details["ApoB"];
  return `${m}\n  What it measures: ${d.what}\n  Why it matters: ${d.why}\n  Research: ${d.research}`;
}).join("\n\n")}

Want this depth on every marker — not just three? That's what Lipa does once your results arrive.

See a sample: https://my.lipa.health/demo
— The Lipa team`;

  return { subject, html, text };
}

// -- Day 7 — What "normal" really means --
// Anti-doctor positioning. Reference range vs optimal range. Three concrete examples.
export function day7Normal(payload: SequencePayload): TemplateOutput {
  const subject = `'Your labs are normal.' But are they really?`;

  const body = `
<p>If you've ever had a blood test where the doctor said &ldquo;everything looks normal&rdquo; — but you didn't feel normal — there's a reason.</p>

<p>Lab reference ranges are statistical, not clinical. They're built from the middle 95% of <em>everyone who got tested</em> — which includes a lot of unhealthy people. &ldquo;Normal&rdquo; isn't optimal. It just means &ldquo;not flagged.&rdquo;</p>

<p>Three concrete examples your doctor probably won't mention:</p>

<div style="margin:20px 0;padding:18px;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;">
  <strong style="color:#0F1A15;">Ferritin</strong>
  <p style="margin:6px 0 0;font-size:13px;color:#5A635D;line-height:1.65;">Lab range: 30&ndash;400 ng/mL. Anything in there gets a pass.<br/>Optimal: 70&ndash;150 ng/mL. Below 50 is functional iron deficiency — fatigue, hair loss, brain fog. Above 200 is iron overload — inflammation, oxidative stress.</p>
</div>

<div style="margin:20px 0;padding:18px;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;">
  <strong style="color:#0F1A15;">TSH</strong>
  <p style="margin:6px 0 0;font-size:13px;color:#5A635D;line-height:1.65;">Lab range: 0.4&ndash;4.5 mIU/L. Anything below 4.5 is &ldquo;normal.&rdquo;<br/>Optimal (per the National Academy of Clinical Biochemistry): 1.0&ndash;2.0 mIU/L. Symptoms typically appear at 2.5+.</p>
</div>

<div style="margin:20px 0;padding:18px;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;">
  <strong style="color:#0F1A15;">HbA1c</strong>
  <p style="margin:6px 0 0;font-size:13px;color:#5A635D;line-height:1.65;">Lab range: anything below 5.7% is &ldquo;normal.&rdquo; Below 6.5% is &ldquo;not diabetic.&rdquo;<br/>Optimal: below 5.4%. The 5.4&ndash;5.7 range is metabolic dysfunction unfolding in slow motion — and the moment when reversal is easiest.</p>
</div>

<p>This is what Lipa does on every marker. Every value on your panel is checked against the lab's reference range AND against the research-backed optimal range. We highlight the gap — that's where the actionable interventions live.</p>

<p style="color:#5A635D;">Your doctor flags broken. Lipa shows you optimal.</p>`;

  const html = shell({
    eyebrow: "Reference vs optimal",
    headline: "“Normal” isn’t optimal.",
    bodyHtml: body,
    ctaText: "See a sample analysis",
    ctaUrl: "https://my.lipa.health/demo",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

If you've ever had a blood test where the doctor said "everything looks normal" — but you didn't feel normal — there's a reason.

Lab reference ranges are statistical, not clinical. They're built from the middle 95% of everyone who got tested — which includes unhealthy people. "Normal" just means "not flagged."

Three examples:

FERRITIN
Lab range: 30-400. Optimal: 70-150. Below 50 is functional iron deficiency.

TSH
Lab range: 0.4-4.5. Optimal: 1.0-2.0. Symptoms appear at 2.5+.

HbA1c
Lab "normal": <5.7%. Optimal: <5.4%. The 5.4-5.7 range is metabolic dysfunction unfolding.

This is what Lipa does on every marker. Reference range AND research-backed optimal range. The gap is where the interventions live.

Your doctor flags broken. Lipa shows you optimal.

See a sample: https://my.lipa.health/demo
— The Lipa team`;

  return { subject, html, text };
}

// -- Day 14 — What your doctor doesn't have time for --
// The wedge email. Frontloaded per Patrick's call.
export function day14DoctorWedge(payload: SequencePayload): TemplateOutput {
  const subject = `What your 7-minute doctor appointment can't tell you`;

  const body = `
<p>The average primary care visit in Europe is 7 to 12 minutes. Most of that is logistics — checking the chart, asking standard intake questions, ordering. Time spent actually <em>thinking about your biology</em>: 2 minutes. Maybe 3.</p>

<p>That's not a critique of doctors. It's the system. They have 30 patients a day and a 5-marker panel to interpret. They flag what's broken and move on.</p>

<p>The other 80% of what could be useful — the patterns across markers, the optimal-vs-normal gap, the protocol-level recommendations across nutrition, sleep, supplements, movement, environment — that's not their job. It can't be. There's no hour available.</p>

<p>That's the gap Lipa fills.</p>

<div style="margin:24px 0;padding:20px;background:#FCFAF5;border:1px solid rgba(15,26,21,0.06);border-radius:18px;">
  <strong style="color:#0F1A15;">When your results arrive, Lipa gives you:</strong>
  <ul style="margin:12px 0 0;padding-left:20px;font-size:13px;color:#5A635D;line-height:1.7;">
    <li>180+ markers analyzed in plain English (not 12)</li>
    <li>Cross-marker patterns: how iron + B12 + cortisol interact, what your TSH means in context of your reverse T3, etc.</li>
    <li>Reference range AND research-backed optimal range, side by side</li>
    <li>An action plan across 6 domains: nutrition, supplementation, sleep, movement, environment, lifestyle</li>
    <li>Specific dosages, forms, timing, and food sources for every supplement recommendation</li>
    <li>Every claim backed by peer-reviewed research, cited and linkable</li>
    <li>Biological age estimate + 16+ risk calculations (Reynolds, ASCVD, etc.)</li>
    <li>Every test you upload, remembered. Trends across years.</li>
  </ul>
</div>

<p>This is the depth of analysis your doctor would do if they had three hours per patient instead of seven minutes. You can't change the appointment. You can change what you walk in with.</p>`;

  const html = shell({
    eyebrow: "What your doctor can't",
    headline: "Seven minutes isn’t enough biology.",
    bodyHtml: body,
    ctaText: "See what 180+ markers analyzed looks like",
    ctaUrl: "https://my.lipa.health/demo",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

The average primary care visit in Europe is 7-12 minutes. Time spent thinking about your biology: 2-3 minutes. They flag what's broken and move on.

That's the system, not the doctors. The other 80% — patterns across markers, optimal-vs-normal gap, protocol recommendations — isn't their job.

That's what Lipa fills.

When your results arrive, you get:
- 180+ markers analyzed in plain English
- Cross-marker patterns
- Reference range AND research-backed optimal range
- Action plan across 6 domains: nutrition, supplements, sleep, movement, environment, lifestyle
- Every claim backed by peer-reviewed research, cited
- Biological age + 16+ risk calculations
- Every test remembered, trends across years

The depth your doctor would do with 3 hours per patient.

See a sample: https://my.lipa.health/demo
— The Lipa team`;

  return { subject, html, text };
}

// -- Day 21 — Where to actually book --
// Push action. Country-specific lab options were already in the Day 0 email,
// so this is a friction-removal nudge.
export function day21Book(payload: SequencePayload): TemplateOutput {
  const country = payload.country || "your country";
  const subject = `Ready to book your blood test?`;

  const body = `
<p>You picked up your test plan ${"three weeks ago"}. The hardest part is now — actually booking.</p>

<p>If you've been putting it off, here&rsquo;s the playbook in three sentences:</p>

<ol style="font-size:14px;color:#0F1A15;line-height:1.7;padding-left:20px;">
  <li>Open your test plan email and copy the marker list.</li>
  <li>Go to one of the labs we recommended for ${escapeHtml(country)} — most accept walk-ins or have online ordering. Show them the list.</li>
  <li>Fast for 10&ndash;12 hours beforehand if your plan includes lipids, glucose, or insulin (which it likely does).</li>
</ol>

<p>That&rsquo;s it. You&rsquo;ll have a PDF in 1&ndash;3 days depending on the lab.</p>

<p>One tip: book it in your calendar this week. The behavioral data is unambiguous — people who book within a week of deciding follow through. People who wait more than two weeks usually don&rsquo;t.</p>

<p>When the PDF arrives, just upload it to Lipa. The first analysis is free. We&rsquo;ll have your full results in 14 minutes.</p>`;

  const html = shell({
    eyebrow: "Time to book",
    headline: "Your test won’t schedule itself.",
    bodyHtml: body,
    ctaText: "Upload your blood test",
    ctaUrl: "https://my.lipa.health/upload",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

You picked up your test plan three weeks ago. The hardest part is now — actually booking.

The playbook in 3 steps:
1. Open your test plan email and copy the marker list.
2. Go to one of the recommended labs for ${country}. Most accept walk-ins or have online ordering. Show them the list.
3. Fast 10-12 hours beforehand if your plan includes lipids, glucose, or insulin.

You'll have a PDF in 1-3 days.

Tip: book it in your calendar this week. People who book within a week follow through. People who wait more than two weeks usually don't.

When the PDF arrives, upload to https://my.lipa.health/upload — first analysis free.

— The Lipa team`;

  return { subject, html, text };
}

// -- Day 35 — While you wait, fix these now --
// Trust + value before they pay. Five free interventions that move common markers.
export function day35WhileWaiting(payload: SequencePayload): TemplateOutput {
  const subject = `5 things you can fix before your blood test arrives`;

  const body = `
<p>Most people wait passively for blood test results. You can do better — five evidence-backed interventions that measurably improve common markers within 4&ndash;8 weeks. Free advice, no upsell.</p>

<ol style="font-size:14px;color:#0F1A15;line-height:1.75;padding-left:20px;">
  <li><strong>Vitamin D, 4,000 IU/day with K2 (MK-7, 100&ndash;200 mcg).</strong> Vitamin D drops in winter for 80% of Europeans. Fixes within 6&ndash;8 weeks. K2 prevents arterial calcification from elevated D.</li>
  <li><strong>Omega-3 EPA+DHA, 2&ndash;3 g/day in triglyceride form.</strong> Drops triglycerides 15&ndash;30% and small-dense LDL particles. Lowers hs-CRP. Single biggest lipid lever after diet.</li>
  <li><strong>Magnesium glycinate, 300&ndash;400 mg before bed.</strong> 80% of people are deficient (RBC magnesium, not serum). Improves sleep quality, lowers fasting glucose, supports cardiovascular function.</li>
  <li><strong>10-minute morning walk in sunlight.</strong> Cheapest intervention with the largest cross-marker effect: cortisol regulation, vitamin D synthesis, circadian alignment, mood, glucose tolerance. Zero cost.</li>
  <li><strong>Cut processed seed oils.</strong> The omega-6:3 ratio in processed foods drives systemic inflammation. Replace with olive oil, avocado oil, butter, ghee. Lowers hs-CRP within 4&ndash;6 weeks.</li>
</ol>

<p style="color:#5A635D;">When your results land, you&rsquo;ll see how these moved your markers. That&rsquo;s the feedback loop most people never get.</p>

<p style="color:#5A635D;">No supplement we recommend is fancy or expensive. The supplement industry inflates costs. The science is mostly settled on these five.</p>`;

  const html = shell({
    eyebrow: "Move the markers now",
    headline: "Five things to fix while you wait.",
    bodyHtml: body,
    ctaText: "See a sample analysis",
    ctaUrl: "https://my.lipa.health/demo",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

Five evidence-backed interventions that improve common markers within 4-8 weeks. No upsell.

1. Vitamin D 4,000 IU/day + K2 (MK-7, 100-200 mcg). Drops 80% of Europeans in winter.
2. Omega-3 EPA+DHA 2-3 g/day, triglyceride form. Drops triglycerides 15-30%, lowers hs-CRP.
3. Magnesium glycinate 300-400 mg before bed. 80% deficient. Improves sleep, glucose, cardiovascular.
4. 10-min morning walk in sunlight. Cortisol, vitamin D, circadian, mood, glucose. Zero cost.
5. Cut processed seed oils. Replace with olive, avocado, butter, ghee. Drops hs-CRP in 4-6 weeks.

When your results land, you'll see how these moved your markers. The feedback loop most people never get.

— The Lipa team`;

  return { subject, html, text };
}

// -- Day 50 — Time check --
// Conversion push. Gentle nudge with a path back to action.
export function day50TimeCheck(payload: SequencePayload): TemplateOutput {
  const subject = `Got your blood drawn yet?`;

  const body = `
<p>Quick check-in. Most users we hear from upload their results 6&ndash;8 weeks after deciding to test. You&rsquo;re right around that window.</p>

<p>Two paths from here:</p>

<div style="margin:20px 0;padding:18px;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;">
  <strong style="color:#1B6B4A;">Got your results?</strong>
  <p style="margin:6px 0 0;font-size:13px;color:#5A635D;line-height:1.65;">Upload the PDF — Lipa will analyze every marker against 250,000+ studies and have your full action plan ready in 14 minutes. The first analysis is free.</p>
</div>

<div style="margin:20px 0;padding:18px;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;">
  <strong style="color:#0F1A15;">Haven&rsquo;t booked yet?</strong>
  <p style="margin:6px 0 0;font-size:13px;color:#5A635D;line-height:1.65;">It happens. Life gets in the way. Want us to send the lab options for ${escapeHtml(payload.country || "your country")} again? Reply &ldquo;send labs&rdquo; and we will. Or update your plan if your goals or country changed.</p>
</div>

<p style="color:#5A635D;">No pressure either way. We&rsquo;ll be here when you&rsquo;re ready.</p>`;

  const html = shell({
    eyebrow: "Status check",
    headline: "Where are you in the process?",
    bodyHtml: body,
    ctaText: "Upload your results",
    ctaUrl: "https://my.lipa.health/upload",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

Quick check-in. Most users upload results 6-8 weeks after deciding to test. You're around that window.

Two paths:

GOT YOUR RESULTS?
Upload the PDF — full analysis in 14 minutes. First one's free.
https://my.lipa.health/upload

HAVEN'T BOOKED YET?
It happens. Reply "send labs" and we'll send your country's options again.

No pressure. We'll be here.

— The Lipa team`;

  return { subject, html, text };
}

// -- Day 75 — Long tail --
// Last touch. Warm, no pressure. If they bounce here they bounce.
export function day75LongTail(payload: SequencePayload): TemplateOutput {
  const subject = `One last thing — and then we’ll stop`;

  const body = `
<p>This is the last email in your test-plan sequence. We&rsquo;re not going to keep nagging.</p>

<p>If you booked, got results, and uploaded — thank you. Welcome to the depth. Watch your trends compound across years.</p>

<p>If you haven&rsquo;t — that&rsquo;s also fine. Lipa isn&rsquo;t going anywhere. When you do get tested, we&rsquo;ll be here. Just upload to <a href="https://my.lipa.health/upload" style="color:#1B6B4A;">my.lipa.health/upload</a> and your full analysis takes 14 minutes.</p>

<p>One ask: if anything stopped you, we&rsquo;d genuinely like to know. Reply to this email and tell us what got in the way. We read every reply. It helps us make this better for the next person.</p>

<p style="color:#5A635D;">Thanks for letting us help. — The Lipa team</p>`;

  const html = shell({
    eyebrow: "Sequence complete",
    headline: "We’ll be here when you’re ready.",
    bodyHtml: body,
    ctaText: "Upload when ready",
    ctaUrl: "https://my.lipa.health/upload",
    updatePlanUrl: planLink(payload),
  });

  const text = `${subject}

This is the last email in your test-plan sequence. We're not going to keep nagging.

If you booked, got results, and uploaded — thank you. Welcome to the depth.

If you haven't — also fine. Lipa isn't going anywhere. When you do test, just upload to https://my.lipa.health/upload — full analysis in 14 minutes.

One ask: if anything stopped you, reply and tell us. We read every reply. It helps make this better.

Thanks. — The Lipa team`;

  return { subject, html, text };
}

// Template registry — used by the cron handler to look up the right template
// from the scheduled_emails.template column.
export const SEQUENCE_TEMPLATES: Record<string, (p: SequencePayload) => TemplateOutput> = {
  day3_markers: day3Markers,
  day7_normal: day7Normal,
  day14_doctor_wedge: day14DoctorWedge,
  day21_book: day21Book,
  day35_while_waiting: day35WhileWaiting,
  day50_time_check: day50TimeCheck,
  day75_long_tail: day75LongTail,
};

// Top-marker selection per goal. Used to populate Day 3's `topMarkers` payload
// from the goals the user picked. Picks 3 highest-impact markers per goal.
const TOP_MARKERS_PER_GOAL: Record<string, string[]> = {
  general: ["ApoB", "hs-CRP", "Vitamin D"],
  longevity: ["ApoB", "Lp(a)", "hs-CRP"],
  trt: ["Total Testosterone", "Free Testosterone", "Hematocrit"],
  glp1: ["HbA1c", "Fasting Insulin", "ApoB"],
  perimenopause: ["FSH", "Vitamin D", "Ferritin"],
  thyroid: ["TSH", "Free T3", "Free T4"],
  metabolic: ["ApoB", "Fasting Insulin", "HbA1c"],
  comprehensive: ["ApoB", "Lp(a)", "Fasting Insulin"],
};

export function pickTopMarkers(goals: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of goals) {
    for (const m of TOP_MARKERS_PER_GOAL[g] || []) {
      if (!seen.has(m)) {
        seen.add(m);
        out.push(m);
      }
    }
    if (out.length >= 3) break;
  }
  return out.length > 0 ? out.slice(0, 3) : ["ApoB", "hs-CRP", "Vitamin D"];
}

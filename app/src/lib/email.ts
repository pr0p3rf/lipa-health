type ResendEmail = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

const FROM = "Lipa Health <hello@lipa.health>";

async function send(payload: ResendEmail): Promise<{ ok: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "RESEND_API_KEY not set" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, reason: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || "fetch failed" };
  }
}

export async function sendTestPlan(opts: {
  to: string;
  goals: string[]; // raw goal keys for the "update your plan" link
  goalTitles: string[];
  country: string;
  markers: string[];
  labs: Array<{ name: string; ease: string; cost: string; tip: string }>;
}) {
  const { to, goalTitles, country, markers, labs } = opts;

  const goalLine = goalTitles.length === 1 ? goalTitles[0] : goalTitles.join(" + ");
  const subject = `Your Lipa test plan: ${goalLine} (${country})`;

  // Plain-text fallback.
  const markerListText = markers.map((m) => `  • ${m}`).join("\n");
  const labText = labs
    .map(
      (l) =>
        `  ${l.name} — ${l.ease} · ${l.cost}\n    ${l.tip}`
    )
    .join("\n\n");

  const text = `Your Lipa test plan

Goals: ${goalLine}
Country: ${country}

MARKERS TO ORDER (${markers.length}):
${markerListText}

WHERE TO GET TESTED in ${country}:
${labText}

WHEN YOUR RESULTS ARRIVE
Upload the PDF to https://my.lipa.health/upload — we'll analyze every marker against 250,000+ peer-reviewed studies, build your full action plan, and remember it for trend tracking. The first analysis is free.

Save this email — you'll need this list when you book.

— The Lipa team`;

  // HTML rendering. Editorial styling that matches the brand.
  const markerListHtml = markers
    .map((m) => `<li style="margin:0;padding:4px 0;border-bottom:1px solid rgba(15,26,21,0.06);">${escapeHtml(m)}</li>`)
    .join("");

  const labsHtml = labs
    .map(
      (l) => `
    <div style="border:1px solid rgba(15,26,21,0.08);border-radius:14px;padding:18px;margin:12px 0;background:#FCFAF5;">
      <div style="font-weight:600;font-size:15px;color:#0F1A15;margin-bottom:6px;">${escapeHtml(l.name)}</div>
      <div style="font-size:12px;color:#5A635D;margin-bottom:8px;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#E8F5EE;color:#1B6B4A;font-weight:500;margin-right:6px;">${escapeHtml(l.ease)}</span>
        <span>${escapeHtml(l.cost)}</span>
      </div>
      <div style="font-size:13px;color:#0F1A15;line-height:1.55;">${escapeHtml(l.tip)}</div>
    </div>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;background:#F8F5EF;margin:0;padding:32px 0;color:#0F1A15;">
  <div style="max-width:560px;margin:0 auto;padding:0 24px;">
    <div style="font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#1B6B4A;margin-bottom:8px;">Your test plan</div>
    <h1 style="font-family:Georgia,serif;font-weight:500;font-size:28px;line-height:1.2;margin:0 0 16px;">Here&rsquo;s exactly what to order.</h1>
    <p style="color:#5A635D;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Goals: <strong style="color:#0F1A15;">${escapeHtml(goalLine)}</strong><br/>
      Country: <strong style="color:#0F1A15;">${escapeHtml(country)}</strong>
    </p>

    <h2 style="font-family:Georgia,serif;font-weight:500;font-size:18px;margin:32px 0 12px;color:#0F1A15;">${markers.length} markers to order</h2>
    <ul style="list-style:none;padding:0;margin:0;font-size:14px;color:#0F1A15;background:#FFFFFF;border:1px solid rgba(15,26,21,0.08);border-radius:14px;padding:8px 18px;">
      ${markerListHtml}
    </ul>

    <h2 style="font-family:Georgia,serif;font-weight:500;font-size:18px;margin:32px 0 8px;color:#0F1A15;">Where to get tested in ${escapeHtml(country)}</h2>
    ${labsHtml}

    <div style="margin-top:32px;padding:24px;background:linear-gradient(135deg,#FCFAF5 0%,#EEF5EF 100%);border:1px solid rgba(15,26,21,0.06);border-radius:18px;">
      <div style="font-family:Georgia,serif;font-size:18px;font-weight:500;color:#0F1A15;margin-bottom:8px;">When your results arrive</div>
      <p style="font-size:13px;color:#5A635D;line-height:1.6;margin:0 0 16px;">
        Upload the PDF to Lipa. We&rsquo;ll analyze every marker against 250,000+ peer-reviewed studies, build your full action plan, and remember it for trend tracking. <strong>The first analysis is free.</strong>
      </p>
      <a href="https://my.lipa.health/upload" style="display:inline-block;background:#1B6B4A;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:11px 22px;border-radius:999px;">Upload your results &rarr;</a>
    </div>

    <p style="font-size:12px;color:#8A928C;margin-top:24px;line-height:1.55;">
      Save this email &mdash; you&rsquo;ll need this marker list when you book.
    </p>

    <p style="font-size:12px;color:#5A635D;margin-top:8px;line-height:1.55;">
      Picked the wrong country or goals? <a href="${`https://my.lipa.health/test-finder?goals=${encodeURIComponent(opts.goals.join(","))}&country=${encodeURIComponent(country)}`}" style="color:#1B6B4A;text-decoration:underline;">Update your plan &rarr;</a>
    </p>

    <p style="font-size:11px;color:#8A928C;margin-top:32px;line-height:1.55;border-top:1px solid rgba(15,26,21,0.06);padding-top:16px;">
      Lipa is educational content, not a medical device. Not a substitute for your physician.
      <br/><a href="https://lipa.health" style="color:#1B6B4A;text-decoration:none;">lipa.health</a>
    </p>
  </div>
</body></html>`;

  return send({ from: FROM, to, subject, html, text });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendResultsReady(opts: {
  to: string;
  dashboardUrl: string;
  outOfRangeCount: number;
  borderlineCount: number;
  optimalCount: number;
  totalMarkers: number;
}) {
  const { to, dashboardUrl, outOfRangeCount, borderlineCount, optimalCount, totalMarkers } = opts;
  const subject = `Your Lipa Health analysis is ready (${totalMarkers} markers)`;
  const headlineBits: string[] = [];
  if (outOfRangeCount > 0) headlineBits.push(`${outOfRangeCount} need attention`);
  if (borderlineCount > 0) headlineBits.push(`${borderlineCount} borderline`);
  if (optimalCount > 0) headlineBits.push(`${optimalCount} optimal`);
  const headline = headlineBits.join(" · ") || `${totalMarkers} markers analyzed`;

  const text = `Your Lipa Health analysis is ready.

${headline}

View your full results, action plan, and biological age estimate:
${dashboardUrl}

— The Lipa team`;

  const html = `<!doctype html>
<html><body style="font-family:Georgia,serif;max-width:560px;margin:32px auto;padding:0 24px;color:#0F1A15;">
  <h1 style="font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:28px;margin:0 0 8px;">Your analysis is ready.</h1>
  <p style="color:#5A635D;font-family:system-ui,sans-serif;font-size:14px;margin:0 0 24px;">${headline}</p>
  <a href="${dashboardUrl}" style="display:inline-block;background:#1B6B4A;color:#fff;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;font-weight:600;padding:12px 24px;border-radius:999px;">View your results</a>
  <p style="color:#8A928C;font-family:system-ui,sans-serif;font-size:12px;margin-top:32px;">Cross-referenced against 250,000+ peer-reviewed studies. Educational content, not medical advice.</p>
</body></html>`;

  return send({ from: FROM, to, subject, html, text });
}

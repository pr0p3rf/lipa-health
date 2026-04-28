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

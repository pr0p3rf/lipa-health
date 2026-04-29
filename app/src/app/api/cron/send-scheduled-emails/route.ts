import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SEQUENCE_TEMPLATES, FROM } from "@/lib/email-sequences";

// Cron: runs every 10 minutes (configured in vercel.json). Picks pending
// scheduled_emails rows where send_at <= NOW(), renders their template,
// dispatches via Resend, and marks the row sent / failed.
//
// Auth: Vercel cron requests carry an Authorization header set to
// `Bearer ${process.env.CRON_SECRET}`. Reject anything else so this
// endpoint can't be hit externally to spam users.

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 50;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  // Vercel sets this header automatically on cron invocations. Block
  // everything else.
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not set" },
      { status: 500 }
    );
  }

  const adminBcc = process.env.EMAIL_BCC_ADMIN;

  // Pull due rows. ORDER BY send_at so the oldest queue head goes first.
  const { data: due, error: fetchError } = await supabase
    .from("scheduled_emails")
    .select("id, to_email, template, payload, attempts")
    .eq("status", "pending")
    .lte("send_at", new Date().toISOString())
    .order("send_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[cron] fetch failed:", fetchError.message);
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const results: any[] = [];

  for (const row of due) {
    const renderer = SEQUENCE_TEMPLATES[row.template];
    if (!renderer) {
      // Unknown template — mark failed permanently so it doesn't retry forever.
      await supabase
        .from("scheduled_emails")
        .update({
          status: "failed",
          error: `unknown template: ${row.template}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
      results.push({ id: row.id, status: "failed", reason: "unknown template" });
      continue;
    }

    let rendered;
    try {
      rendered = renderer(row.payload || {});
    } catch (e: any) {
      await supabase
        .from("scheduled_emails")
        .update({
          status: "failed",
          error: `render failed: ${e?.message || "unknown"}`,
          attempts: (row.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
      results.push({ id: row.id, status: "failed", reason: "render" });
      continue;
    }

    const body: any = {
      from: FROM,
      to: row.to_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };
    if (adminBcc) body.bcc = [adminBcc];

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await supabase
          .from("scheduled_emails")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            attempts: (row.attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        sent++;
        results.push({ id: row.id, status: "sent" });
      } else {
        const errText = await res.text().catch(() => "");
        const attempts = (row.attempts || 0) + 1;
        // Retry up to 3 times. After that, mark failed.
        const newStatus = attempts >= 3 ? "failed" : "pending";
        await supabase
          .from("scheduled_emails")
          .update({
            status: newStatus,
            error: `Resend ${res.status}: ${errText.slice(0, 200)}`,
            attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed++;
        results.push({ id: row.id, status: newStatus, attempts, http: res.status });
      }
    } catch (e: any) {
      const attempts = (row.attempts || 0) + 1;
      const newStatus = attempts >= 3 ? "failed" : "pending";
      await supabase
        .from("scheduled_emails")
        .update({
          status: newStatus,
          error: e?.message || "fetch failed",
          attempts,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      failed++;
      results.push({ id: row.id, status: newStatus, error: e?.message });
    }
  }

  console.log(
    `[cron] processed=${due.length} sent=${sent} failed=${failed}`
  );

  return NextResponse.json({
    processed: due.length,
    sent,
    failed,
    results,
  });
}

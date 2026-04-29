import { NextRequest, NextResponse } from "next/server";
import { SEQUENCE_TEMPLATES } from "@/lib/email-sequences";

// Admin-only endpoint for previewing the test-plan sequence emails.
// GET /api/admin/preview-email?template=day7_normal&email=plipnicki@gmail.com&adminKey=<last-10-of-service-role>
//
// Renders the requested template with a representative sample payload and
// dispatches it via Resend. Auth is the same lightweight admin-key pattern
// used by /api/reanalyze: last 10 chars of the SUPABASE_SERVICE_ROLE_KEY.
//
// Use this to review each template's copy without spinning up a real
// scheduled-emails row. The actual production cron will use the same
// templates with real user payloads.

const FROM = "Lipa <hello@lipa.health>";

function authorize(adminKey: string | null): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return false;
  return adminKey === key.slice(-10);
}

const SAMPLE_PAYLOAD = {
  goalTitles: ["Longevity", "TRT / Hormones / Peptides"],
  goals: ["longevity", "trt"],
  country: "Poland",
  topMarkers: ["ApoB", "Lp(a)", "hs-CRP"],
};

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const adminKey = sp.get("adminKey");
  if (!authorize(adminKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const template = sp.get("template");
  const to = sp.get("email") || "plipnicki@gmail.com";

  if (!template) {
    return NextResponse.json(
      {
        error: "template required",
        available: Object.keys(SEQUENCE_TEMPLATES),
      },
      { status: 400 }
    );
  }

  const renderer = SEQUENCE_TEMPLATES[template];
  if (!renderer) {
    return NextResponse.json(
      {
        error: `unknown template: ${template}`,
        available: Object.keys(SEQUENCE_TEMPLATES),
      },
      { status: 400 }
    );
  }

  const rendered = renderer(SAMPLE_PAYLOAD);

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not set", rendered },
      { status: 500 }
    );
  }

  // Direct send (bypasses the lib/email send() helper) so the BCC env-gate
  // doesn't apply — admin previews only go to the requested address.
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: `[PREVIEW] ${rendered.subject}`,
        html: rendered.html,
        text: rendered.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Resend ${res.status}`, detail: body.slice(0, 300) },
        { status: 500 }
      );
    }
    const data = await res.json();
    return NextResponse.json({
      success: true,
      template,
      to,
      subject: rendered.subject,
      messageId: data.id,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "send failed" },
      { status: 500 }
    );
  }
}

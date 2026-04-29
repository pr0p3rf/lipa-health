import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendTestPlan } from "@/lib/email";
import { pickTopMarkers } from "@/lib/email-sequences";

// Sequence schedule. Days after Day 0 (which sends immediately).
// Updated 2026-04-29 per Patrick: doctor-wedge moved to Day 14, rest bumped.
const SEQUENCE = [
  { template: "day3_markers", day: 3 },
  { template: "day7_normal", day: 7 },
  { template: "day14_doctor_wedge", day: 14 },
  { template: "day21_book", day: 21 },
  { template: "day35_while_waiting", day: 35 },
  { template: "day50_time_check", day: 50 },
  { template: "day75_long_tail", day: 75 },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Same allowlist used by /api/support — both routes are called by static-rendered
// pages on multiple hosts (lipa.health landing, my.lipa.health app, localhost dev).
const ALLOWED_ORIGINS = new Set([
  "https://lipa.health",
  "https://www.lipa.health",
  "https://my.lipa.health",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://my.lipa.health";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

interface Lab {
  name: string;
  ease: string;
  cost: string;
  tip: string;
}

export async function POST(request: NextRequest) {
  const cors = corsHeaders(request.headers.get("origin"));

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const email: string | undefined = body.email;
  const goals: string[] | undefined = body.goals;
  const goalTitles: string[] | undefined = body.goalTitles;
  const country: string | undefined = body.country;
  const markers: string[] | undefined = body.markers;
  const labs: Lab[] | undefined = body.labs;

  // Validate. Email + country + goals are the must-haves; markers/labs are
  // computed client-side (the page already has them resolved) and we just
  // pass them into the email.
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400, headers: cors });
  }
  if (!country || !Array.isArray(goals) || goals.length === 0) {
    return NextResponse.json({ error: "country and goals[] required" }, { status: 400, headers: cors });
  }
  if (!Array.isArray(markers) || markers.length === 0) {
    return NextResponse.json({ error: "markers[] required" }, { status: 400, headers: cors });
  }
  if (!Array.isArray(labs)) {
    return NextResponse.json({ error: "labs[] required" }, { status: 400, headers: cors });
  }

  const cleanEmail = email.trim().toLowerCase();
  const source = `test-finder:${goals.join(",")}:${country}`;

  // Save to newsletter_subscribers. Duplicate emails are fine — captured
  // moments matter (each fill-out is a fresh signal of intent), so we don't
  // dedupe at insert time.
  let logged = false;
  let logError: string | null = null;
  try {
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email: cleanEmail,
      source,
    });
    if (error) {
      logError = error.message;
      console.error("[test-finder-submit] insert failed:", error.message);
    } else {
      logged = true;
    }
  } catch (e: any) {
    logError = e?.message || "insert failed";
  }

  // Send the immediate "your test plan" email. Best-effort — never block on
  // it. If Resend is down or the key is missing, the user already saw their
  // results in the page; the email is the bonus channel for re-engagement.
  let emailSent = false;
  let emailError: string | null = null;
  try {
    const result = await sendTestPlan({
      to: cleanEmail,
      goals,
      goalTitles: Array.isArray(goalTitles) && goalTitles.length > 0 ? goalTitles : goals,
      country,
      markers,
      labs,
    });
    emailSent = result.ok;
    if (!result.ok) emailError = result.reason || null;
  } catch (e: any) {
    emailError = e?.message || "email send failed";
  }

  // Schedule the nurture sequence. First cancel any previous pending sends
  // for this email so we never double-send if they resubmit. Then enqueue
  // the 7-touch drip from now + Day N.
  let scheduled = 0;
  let scheduleError: string | null = null;
  try {
    const sequenceKey = `test-finder:${cleanEmail}`;

    await supabase
      .from("scheduled_emails")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("sequence_key", sequenceKey)
      .eq("status", "pending");

    const topMarkers = pickTopMarkers(goals);
    const goalTitlesArr = Array.isArray(goalTitles) && goalTitles.length > 0 ? goalTitles : goals;
    const sharedPayload = {
      goalTitles: goalTitlesArr,
      goals,
      country,
      topMarkers,
    };
    const now = Date.now();
    const rows = SEQUENCE.map(({ template, day }) => ({
      to_email: cleanEmail,
      send_at: new Date(now + day * 86_400_000).toISOString(),
      template,
      payload: sharedPayload,
      status: "pending" as const,
      sequence_key: sequenceKey,
    }));

    const { error } = await supabase.from("scheduled_emails").insert(rows);
    if (error) {
      scheduleError = error.message;
      console.error("[test-finder-submit] schedule insert failed:", error.message);
    } else {
      scheduled = rows.length;
    }
  } catch (e: any) {
    scheduleError = e?.message || "schedule failed";
  }

  console.log(
    `[test-finder-submit] email=${cleanEmail} country=${country} goals=${goals.join(",")} logged=${logged} emailSent=${emailSent} scheduled=${scheduled} emailErr=${emailError || "-"} logErr=${logError || "-"} schedErr=${scheduleError || "-"}`
  );

  return NextResponse.json(
    { success: logged, logged, emailSent, scheduled, logError, emailError, scheduleError },
    { headers: cors }
  );
}

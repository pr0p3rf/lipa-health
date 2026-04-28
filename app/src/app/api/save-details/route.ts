import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId: string | undefined = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const sex = body.sex && ["male", "female", "other"].includes(body.sex) ? body.sex : null;
  const age = Number.isFinite(body.age) && body.age >= 13 && body.age <= 120 ? Math.floor(body.age) : null;
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email.trim().toLowerCase() : null;

  if (sex !== null || age !== null) {
    await supabase
      .from("user_profiles")
      .upsert(
        { user_id: userId, sex, age, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
  }

  if (email) {
    await supabase
      .from("newsletter_subscribers")
      .insert({ email, source: `upload:${userId}` })
      .then(({ error }) => {
        if (error && !String(error.code).startsWith("23")) {
          console.error("[save-details] newsletter insert failed:", error.message);
        }
      });
  }

  return NextResponse.json({ ok: true });
}

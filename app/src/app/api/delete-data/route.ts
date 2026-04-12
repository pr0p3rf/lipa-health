import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const { userId, scope } = await request.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Delete in FK order
  await supabase.from("analysis_citations").delete().eq("user_id", userId);
  await supabase.from("user_analyses").delete().eq("user_id", userId);
  await supabase.from("action_plans").delete().eq("user_id", userId);
  await supabase.from("biomarker_results").delete().eq("user_id", userId);
  await supabase.from("uploads").delete().eq("user_id", userId);

  if (scope === "account") {
    await supabase.from("user_profiles").delete().eq("user_id", userId);
    await supabase.from("user_subscriptions").delete().eq("user_id", userId);
  }

  return NextResponse.json({ success: true });
}

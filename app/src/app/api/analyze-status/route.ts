import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const testDate = request.nextUrl.searchParams.get("testDate");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  // Count biomarker results
  const { count: resultCount } = await supabase
    .from("biomarker_results")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("test_date", testDate || new Date().toISOString().split("T")[0]);

  // Count analyses
  const { count: analysisCount } = await supabase
    .from("user_analyses")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  // Check action plan
  const { data: plan } = await supabase
    .from("action_plans")
    .select("id, overall_summary")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isComplete = (analysisCount || 0) >= (resultCount || 1) && !!plan;

  return NextResponse.json({
    biomarkers: resultCount || 0,
    analyses: analysisCount || 0,
    hasActionPlan: !!plan,
    hasSummary: !!plan?.overall_summary,
    isComplete,
  });
}

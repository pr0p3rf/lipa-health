import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/inngest/client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/reanalyze
 * Re-triggers analysis for an existing user's biomarker data.
 * Useful when analysis code has been updated (new aliases, calculations, etc).
 *
 * Body: { userId: string, testDate?: string }
 * - If testDate is provided, only re-analyzes that specific test date
 * - If omitted, re-analyzes the most recent test date
 *
 * Auth: requires admin key or service role
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, testDate, adminKey } = await request.json();

    // Simple auth: require admin key for re-analysis
    if (adminKey !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If no testDate, find the most recent one
    let effectiveDate = testDate;
    if (!effectiveDate) {
      const { data } = await supabase
        .from("biomarker_results")
        .select("test_date")
        .eq("user_id", userId)
        .order("test_date", { ascending: false })
        .limit(1)
        .single();
      effectiveDate = data?.test_date;
    }

    if (!effectiveDate) {
      return new Response(JSON.stringify({ error: "No test data found for user" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Delete existing analyses for this user+date so they get regenerated
    await supabase
      .from("user_analyses")
      .delete()
      .eq("user_id", userId)
      .in("biomarker_result_id",
        (await supabase
          .from("biomarker_results")
          .select("id")
          .eq("user_id", userId)
          .eq("test_date", effectiveDate)
        ).data?.map((r: any) => r.id) || []
      );

    // Delete existing action plan
    await supabase
      .from("action_plans")
      .delete()
      .eq("user_id", userId);

    // Re-trigger the analysis
    await inngest.send({
      name: "lipa/panel.uploaded",
      data: { userId, testDate: effectiveDate },
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Re-analysis triggered for user ${userId}, test date ${effectiveDate}`,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[reanalyze] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

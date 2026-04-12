import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createBillingPortalSession } from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Get customer ID from subscription record
    const { data: sub, error } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !sub?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || "https://lipa.health";
    const portalUrl = await createBillingPortalSession(
      sub.stripe_customer_id,
      `${origin}/account`
    );

    return NextResponse.json({ url: portalUrl });
  } catch (error: any) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session", details: error.message },
      { status: 500 }
    );
  }
}

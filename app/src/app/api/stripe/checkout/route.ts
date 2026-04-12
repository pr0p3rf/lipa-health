import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getOrCreateStripeCustomer,
  createCheckoutSession,
  TIER_PRICES,
  SubscriptionTier,
} from "@/lib/stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { tier, userId, email } = await request.json();

    if (!tier || !userId || !email) {
      return NextResponse.json(
        { error: "tier, userId, and email required" },
        { status: 400 }
      );
    }

    if (!["access", "essential", "complete"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const priceId = TIER_PRICES[tier as Exclude<SubscriptionTier, "free">];
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for tier: ${tier}` },
        { status: 500 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(email, userId);

    // Store customer ID in subscription record (if not already)
    await supabase.from("user_subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        tier: "free", // Keep as free until webhook confirms subscription
      },
      { onConflict: "user_id" }
    );

    // Create checkout session
    const origin = request.headers.get("origin") || "https://lipa.health";
    const checkoutUrl = await createCheckoutSession(
      customerId,
      priceId,
      `${origin}/dashboard?subscription=success`,
      `${origin}/pricing?subscription=cancel`
    );

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: any) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error.message },
      { status: 500 }
    );
  }
}

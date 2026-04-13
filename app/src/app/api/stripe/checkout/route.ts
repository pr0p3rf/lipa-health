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

    if (!["one", "insight"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const priceId = TIER_PRICES[tier as keyof typeof TIER_PRICES];
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

    // Create checkout session — Lipa One is one-time, Life is subscription
    const origin = request.headers.get("origin") || "https://lipa.health";
    const mode = tier === "one" ? "payment" : "subscription";
    const { getStripe } = await import("@/lib/stripe");
    const stripeClient = getStripe();

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/pricing?subscription=cancel`,
      allow_promotion_codes: true,
      metadata: { tier, userId },
    });

    const checkoutUrl = session.url!;

    return NextResponse.json({ url: checkoutUrl });
  } catch (error: any) {
    console.error("Checkout error:", error?.message, error?.type, error?.code);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error?.message || "Unknown error", type: error?.type, code: error?.code },
      { status: 500 }
    );
  }
}

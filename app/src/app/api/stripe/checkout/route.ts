import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  getStripe,
  getOrCreateStripeCustomer,
  TIER_PRICES,
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

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe secret key not configured" },
        { status: 500 }
      );
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(email, userId);

    // Store customer ID (don't overwrite existing tier)
    const { data: existingSub } = await supabase
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingSub) {
      await supabase.from("user_subscriptions").insert({
        user_id: userId,
        stripe_customer_id: customerId,
        tier: "free",
      });
    } else {
      await supabase
        .from("user_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId);
    }

    // Create checkout session
    const origin = request.headers.get("origin") || "https://my.lipa.health";
    const mode = tier === "one" ? "payment" : "subscription";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_update: { name: "auto" },
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/pricing?subscription=cancel`,
      allow_promotion_codes: true,
      metadata: { tier, userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error?.message, error?.type, error?.code);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

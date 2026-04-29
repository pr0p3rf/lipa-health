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

    if (!tier || !userId) {
      return NextResponse.json(
        { error: "tier and userId required" },
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

    const stripe = getStripe();
    const origin = request.headers.get("origin") || "https://my.lipa.health";
    const mode = tier === "one" ? "payment" : "subscription";

    const submittedEmail = typeof email === "string" && email.includes("@") ? email.trim().toLowerCase() : null;

    // Two checkout paths:
    // - Email known up front (logged-in user, or pre-checkout modal capture):
    //   pre-create the Stripe customer so we can attach metadata + reuse them.
    // - Email unknown (rare — UI shouldn't allow this, but be safe): let
    //   Stripe Checkout collect the email itself; the webhook can wire things
    //   up using session.customer_details.email + metadata.userId.
    const sessionParams: any = {
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}/dashboard?subscription=success`,
      cancel_url: `${origin}/pricing?subscription=cancel`,
      allow_promotion_codes: true,
      // Stripe Adaptive Pricing — auto-converts our EUR price to the
      // customer's local currency at checkout based on their geo.
      // Works for both one-time (Lipa One) and subscription (Lipa Life).
      adaptive_pricing: { enabled: true },
      metadata: { tier, userId },
    };

    if (submittedEmail) {
      const customerId = await getOrCreateStripeCustomer(submittedEmail, userId);

      // Track the customer id on user_subscriptions so the webhook can find
      // the right user when it fires.
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

      sessionParams.customer = customerId;
      sessionParams.customer_update = { name: "auto" };
    } else {
      // Stripe collects the email itself.
      sessionParams.customer_creation = "always";
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Checkout error:", error?.message, error?.type, error?.code);
    return NextResponse.json(
      { error: "Failed to create checkout session", details: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

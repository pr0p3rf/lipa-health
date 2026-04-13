import { NextResponse } from "next/server";
import { getStripe, TIER_PRICES } from "@/lib/stripe";

export async function GET() {
  try {
    const hasKey = !!process.env.STRIPE_SECRET_KEY;
    const keyPrefix = process.env.STRIPE_SECRET_KEY?.slice(0, 7) || "MISSING";
    const priceOne = TIER_PRICES.one || "MISSING";
    const priceInsight = TIER_PRICES.insight || "MISSING";

    // Try a simple Stripe API call
    const stripe = getStripe();
    const price = await stripe.prices.retrieve(priceOne);

    return NextResponse.json({
      hasKey,
      keyPrefix,
      priceOne,
      priceInsight,
      stripeWorks: true,
      priceAmount: price.unit_amount,
      priceCurrency: price.currency,
    });
  } catch (error: any) {
    return NextResponse.json({
      hasKey: !!process.env.STRIPE_SECRET_KEY,
      keyPrefix: process.env.STRIPE_SECRET_KEY?.slice(0, 7) || "MISSING",
      priceOne: TIER_PRICES.one || "MISSING",
      priceInsight: TIER_PRICES.insight || "MISSING",
      stripeWorks: false,
      error: error.message,
      type: error.type,
    });
  }
}

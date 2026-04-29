/**
 * =====================================================================
 * LIPA — Stripe integration
 * =====================================================================
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
      maxNetworkRetries: 1,
      timeout: 10000,
    });
  }
  return _stripe;
}

// Convenience alias
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  },
});

// ---------------------------------------------------------------------
// Tier → Stripe price ID mapping
// ---------------------------------------------------------------------
// Set these in .env.local after creating products in Stripe Dashboard

export const TIER_PRICES = {
  one: process.env.STRIPE_PRICE_ONE!,             // €39 one-time
  insight: process.env.STRIPE_PRICE_INSIGHT!,      // €89/year
} as const;

export type SubscriptionTier = "free" | "one" | "insight";

// ---------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------

export const TIER_INFO = {
  free: {
    name: "Free Preview",
    price: 0,
    priceDisplay: "Free",
    interval: null,
    features: [
      "Upload 1 blood test",
      "Preview: 10 markers analyzed",
      "Basic status overview",
    ],
  },
  one: {
    name: "Lipa One",
    price: 39,
    priceDisplay: "€39",
    interval: null, // one-time
    features: [
      "Full analysis of every marker",
      "Action plan across 6 life domains",
      "Risk calculations + biological age",
      "Cross-marker pattern detection",
      "PDF report",
      "Ask Lipa chat for 7 days",
    ],
  },
  insight: {
    name: "Lipa Life",
    price: 89,
    priceDisplay: "€89/year",
    interval: "year",
    features: [
      "Everything in Lipa One",
      "Up to 12 test uploads per year",
      "Vault: complete biological history",
      "Trend tracking + bio-age trajectory",
      "Ask Lipa chat — unlimited",
      "Wearable integration",
      "Personalized research alerts",
      "PDF export + doctor sharing",
    ],
  },
} as const;

// ---------------------------------------------------------------------
// Create or get Stripe customer
// ---------------------------------------------------------------------

export async function getOrCreateStripeCustomer(
  email: string,
  userId: string
): Promise<string> {
  // Search for existing customer by metadata
  const existing = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existing.data.length > 0) {
    return existing.data[0].id;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  return customer.id;
}

// ---------------------------------------------------------------------
// Create checkout session
// ---------------------------------------------------------------------

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    automatic_tax: {
      enabled: false, // Enable once you've set up tax settings in Stripe
    },
  });

  return session.url!;
}

// ---------------------------------------------------------------------
// Create billing portal session
// ---------------------------------------------------------------------

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ---------------------------------------------------------------------
// Tier lookup from price ID
// ---------------------------------------------------------------------

export function tierFromPriceId(priceId: string): SubscriptionTier {
  if (priceId === TIER_PRICES.one) return "one";
  if (priceId === TIER_PRICES.insight) return "insight";
  return "free";
}

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
  access: process.env.STRIPE_PRICE_ACCESS!,      // €79/year
  essential: process.env.STRIPE_PRICE_ESSENTIAL!, // €149/year
  complete: process.env.STRIPE_PRICE_COMPLETE!,   // €289/year
} as const;

export type SubscriptionTier = "free" | "access" | "essential" | "complete";

// ---------------------------------------------------------------------
// Tier metadata
// ---------------------------------------------------------------------

export const TIER_INFO = {
  free: {
    name: "Lipa Starter",
    price: 0,
    priceDisplay: "Free",
    interval: null,
    features: [
      "1 blood test upload",
      "Full Living Research™ analysis",
      "Real peer-reviewed citations",
      "Basic content library",
      "Email newsletter",
    ],
  },
  access: {
    name: "Lipa Insight",
    price: 79,
    priceDisplay: "€79/year",
    interval: "year",
    features: [
      "Everything in Starter",
      "Unlimited blood test uploads",
      "Full history and trend tracking",
      "Bio-age calculation (ensemble)",
      "SCORE2 cardiovascular risk",
      "Cross-marker pattern detection",
      "Downloadable PDF reports",
      "Wearable integration",
      "Research alerts",
      "Full research library access",
    ],
  },
  essential: {
    name: "Lipa Annual",
    price: 149,
    priceDisplay: "€149/year",
    interval: "year",
    features: [
      "Everything in Insight",
      "1 premium blood test included",
      "Priority customer support",
    ],
  },
  complete: {
    name: "Lipa Bi-Annual",
    price: 289,
    priceDisplay: "€289/year",
    interval: "year",
    features: [
      "Everything in Annual",
      "2 premium blood tests per year",
      "Quarterly trend reports",
      "Cohort benchmarking",
      "Early access to new features",
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
  if (priceId === TIER_PRICES.access) return "access";
  if (priceId === TIER_PRICES.essential) return "essential";
  if (priceId === TIER_PRICES.complete) return "complete";
  return "free";
}

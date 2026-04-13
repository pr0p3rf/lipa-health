import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe, tierFromPriceId } from "@/lib/stripe";
import Stripe from "stripe";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error(`Webhook handler error (${event.type}):`, err);
    return NextResponse.json(
      { error: "Webhook handler failed", details: err.message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  // Handle subscription payments (Lipa Life)
  if (session.subscription && session.customer) {
    const subscription = await stripe.subscriptions.retrieve(
      session.subscription as string
    );
    await handleSubscriptionUpsert(subscription);
    return;
  }

  // Handle one-time payments (Lipa One) — no subscription object
  if (session.mode === "payment" && session.metadata?.tier && session.metadata?.userId) {
    const tier = session.metadata.tier;
    const userId = session.metadata.userId;
    console.log(`[webhook] One-time payment: tier=${tier} userId=${userId}`);

    await supabase
      .from("user_subscriptions")
      .upsert(
        {
          user_id: userId,
          tier,
          stripe_customer_id: session.customer as string || null,
          status: "active",
        },
        { onConflict: "user_id" }
      );
    return;
  }
}

async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const priceId = subscription.items.data[0]?.price.id;
  const tier = tierFromPriceId(priceId);

  // Find user by customer ID
  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!existing) {
    console.error(`No user_subscription record for customer: ${customerId}`);
    return;
  }

  await supabase
    .from("user_subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      tier,
      status: subscription.status,
      current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
      current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", existing.user_id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await supabase
    .from("user_subscriptions")
    .update({
      tier: "free",
      status: "canceled",
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  console.log(`Invoice paid: ${invoice.id} for customer ${invoice.customer}`);
  // Could send a "payment received" email here
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  console.error(`Invoice failed: ${invoice.id} for customer ${invoice.customer}`);
  // Could send a "payment failed" email here
  // Subscription status will automatically update via subscription.updated event
}

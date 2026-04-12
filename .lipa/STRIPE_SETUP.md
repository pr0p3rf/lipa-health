# Stripe Setup Guide for Lipa

This guide walks you through setting up Stripe for Lipa's subscription billing.

## Prerequisites

- Stripe account (create at https://dashboard.stripe.com/register)
- Go Exe B.V. business details ready
- Dutch bank account for payouts

---

## Step 1: Create Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Sign up with your Lipa email (e.g., hello@lipa.health)
3. Business type: **Company → Private Limited Company**
4. Business details:
   - Legal name: **Go Exe B.V.**
   - Trading name: **Lipa**
   - Country: **Netherlands**
   - Business address: (your NL address)
   - VAT number: (your BTW number)
   - Business URL: **https://lipa.health**
5. Complete Stripe identity verification (usually within 24h)

---

## Step 2: Configure Business Settings

In Stripe Dashboard:

1. **Settings → Business**
   - Statement descriptor: `LIPA` (shows on customer bank statements)
   - Support email: hello@lipa.health
   - Support phone: (optional)

2. **Settings → Tax**
   - Enable if selling to EU consumers (you'll need to handle VAT OSS)
   - For MVP launch, you can disable automatic tax and handle manually

3. **Settings → Customer emails**
   - Enable "Email customers about successful payments"
   - Enable "Email customers about failed payments"

---

## Step 3: Create Products

Go to **Products → Add product** and create 3 subscription products:

### Product 1: Lipa Insight
- Name: **Lipa Insight**
- Description: **Unlimited biomarker analysis with tracking, research citations, and full platform access. BYO blood tests.**
- Pricing:
  - Model: **Recurring**
  - Price: **€79.00**
  - Billing period: **Yearly**
  - Currency: **EUR**
- Save. Copy the **Price ID** (starts with `price_...`)

### Product 2: Lipa Annual
- Name: **Lipa Annual**
- Description: **Everything in Insight plus 1 premium blood test included each year.**
- Pricing:
  - Model: **Recurring**
  - Price: **€149.00**
  - Billing period: **Yearly**
  - Currency: **EUR**
- Save. Copy the **Price ID**.

### Product 3: Lipa Bi-Annual
- Name: **Lipa Bi-Annual**
- Description: **Everything in Annual plus 2 premium blood tests per year and advanced analytics.**
- Pricing:
  - Model: **Recurring**
  - Price: **€289.00**
  - Billing period: **Yearly**
  - Currency: **EUR**
- Save. Copy the **Price ID**.

---

## Step 4: Get API Keys

1. Go to **Developers → API keys**
2. Copy the **Publishable key** (`pk_test_...` or `pk_live_...`)
3. Copy the **Secret key** (`sk_test_...` or `sk_live_...`) — keep this secret!

**Start in TEST mode** — use `pk_test_` / `sk_test_` keys until you're ready to launch.

---

## Step 5: Configure Webhook

Webhooks let Stripe notify Lipa when subscriptions change.

1. Go to **Developers → Webhooks → Add endpoint**
2. Endpoint URL: `https://lipa.health/api/stripe/webhook`
   - For local dev, use `https://your-ngrok-url.ngrok.io/api/stripe/webhook`
3. Events to listen for (select these):
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Save
5. Copy the **Signing secret** (`whsec_...`)

---

## Step 6: Enable Customer Portal

This lets users manage their own subscription.

1. Go to **Settings → Billing → Customer portal**
2. Enable the portal
3. Allow these actions:
   - ✅ Update payment method
   - ✅ View invoice history
   - ✅ Cancel subscription
   - ✅ Switch plans
4. Set default return URL: `https://lipa.health/account`
5. Save

---

## Step 7: Add Environment Variables

Open `/Users/plipnicki/Projects/lipa-health/app/.env.local` and add:

```env
# Stripe — Test mode keys (replace with live when ready)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (from Step 3)
STRIPE_PRICE_ACCESS=price_...       # Lipa Insight €79/year
STRIPE_PRICE_ESSENTIAL=price_...    # Lipa Annual €149/year
STRIPE_PRICE_COMPLETE=price_...     # Lipa Bi-Annual €289/year
```

---

## Step 8: Install Stripe SDK

```bash
cd /Users/plipnicki/Projects/lipa-health/app
npm install stripe
```

---

## Step 9: Test Locally with Stripe CLI

To test webhooks locally before going live:

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Login: `stripe login`
3. Forward webhooks to local:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
4. Copy the `whsec_...` it prints and use it as `STRIPE_WEBHOOK_SECRET`
5. In another terminal, run your Next.js app: `npm run dev`
6. Trigger a test checkout from `http://localhost:3000/pricing`

---

## Step 10: Test Checkout Flow

1. Go to http://localhost:3000/pricing
2. Click "Get Insight"
3. You'll be redirected to Stripe Checkout
4. Use test card: **4242 4242 4242 4242**
5. Any future expiry date, any CVC
6. Complete checkout
7. You should be redirected back to `/dashboard?subscription=success`
8. Check Supabase `user_subscriptions` table — you should see the user's tier updated

---

## Step 11: Switch to Live Mode

When ready to launch:

1. Toggle Stripe Dashboard from **Test mode** to **Live mode**
2. Get new API keys (live versions)
3. Re-create products in live mode
4. Re-configure webhook for production URL
5. Update `.env.local` (or production env vars) with live keys
6. Test one real transaction with your own card
7. Issue a refund to yourself in Stripe dashboard to verify

---

## Common Issues

**"No such price" error:**
- Price ID mismatch between test and live mode, or wrong tier key
- Check `STRIPE_PRICE_*` env vars match Stripe Dashboard

**Webhook signature verification failed:**
- Wrong `STRIPE_WEBHOOK_SECRET`
- In local dev, use the one from `stripe listen` command
- In prod, use the one from Dashboard → Webhooks endpoint

**Customer not found after checkout:**
- Webhook didn't fire or failed
- Check Stripe Dashboard → Webhooks → your endpoint → recent deliveries
- Verify user_subscriptions table has a row with the stripe_customer_id

---

## Support

Questions? Check:
- Stripe docs: https://stripe.com/docs
- Stripe API reference: https://stripe.com/docs/api
- Stripe support: https://support.stripe.com

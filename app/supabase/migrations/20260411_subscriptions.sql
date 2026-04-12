-- =====================================================================
-- LIPA — Subscriptions & Billing
-- =====================================================================
-- Stores Stripe subscription state per user
-- =====================================================================

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Stripe
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Subscription state
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'access', 'essential', 'complete')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid')),

  -- Dates
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_customer_id ON user_subscriptions(stripe_customer_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);

-- Row level security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own subscription"
  ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL USING (auth.role() = 'service_role');

-- =====================================================================
-- Helper function: get user's current tier
-- =====================================================================

CREATE OR REPLACE FUNCTION get_user_tier(user_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT COALESCE(tier, 'free') INTO user_tier
  FROM user_subscriptions
  WHERE user_id = user_uuid
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > NOW())
  LIMIT 1;

  RETURN COALESCE(user_tier, 'free');
END;
$$;

-- =====================================================================
-- Feature gating
-- =====================================================================
-- Tier → feature mapping helper

CREATE OR REPLACE FUNCTION user_has_feature(user_uuid UUID, feature_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_tier TEXT;
BEGIN
  SELECT get_user_tier(user_uuid) INTO user_tier;

  CASE feature_name
    WHEN 'unlimited_uploads' THEN
      RETURN user_tier IN ('access', 'essential', 'complete');
    WHEN 'historical_tracking' THEN
      RETURN user_tier IN ('access', 'essential', 'complete');
    WHEN 'bio_age_calculation' THEN
      RETURN user_tier IN ('access', 'essential', 'complete');
    WHEN 'wearable_integration' THEN
      RETURN user_tier IN ('access', 'essential', 'complete');
    WHEN 'research_alerts' THEN
      RETURN user_tier IN ('access', 'essential', 'complete');
    WHEN 'pdf_reports' THEN
      RETURN user_tier IN ('access', 'essential', 'complete');
    WHEN 'bundled_test' THEN
      RETURN user_tier IN ('essential', 'complete');
    WHEN 'quarterly_reports' THEN
      RETURN user_tier = 'complete';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;

COMMENT ON TABLE user_subscriptions IS 'Stripe subscription state per user, updated via webhooks';
COMMENT ON FUNCTION get_user_tier IS 'Returns the user''s current active subscription tier';
COMMENT ON FUNCTION user_has_feature IS 'Checks if user has access to a specific feature based on their tier';

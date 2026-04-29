-- Security hardening migration
-- Apply via Supabase Dashboard → SQL Editor.
--
-- Two things:
-- 1. Create scheduled_emails (was in 20260429_scheduled_emails.sql, never applied)
-- 2. Enable RLS on every public table that holds user data, plus appropriate
--    policies. Server-side API routes use the service role and bypass RLS;
--    these policies only constrain anon (landing-page widgets) and authenticated
--    (signed-in users on the app) clients.
--
-- Design principles:
-- - User-data tables: users can read/write only their own rows (auth.uid() = user_id)
-- - Anon-write-only tables (waitlist, newsletter_subscribers): anon can INSERT,
--   nobody can SELECT (server-side reads use service role)
-- - chat_messages: server-side INSERT only (the API does it); no client access
-- - admin_settings, scheduled_emails: server-side only
-- - profiles: users can read/update their own row, INSERT during signup
--
-- ALL EXISTING SERVER-SIDE OPERATIONS WILL CONTINUE TO WORK because the service
-- role used by /api/* routes bypasses RLS entirely.

-- ----------------------------------------------------------------------------
-- 1. scheduled_emails (queue for the test-finder nurture sequence)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scheduled_emails (
  id BIGSERIAL PRIMARY KEY,
  to_email TEXT NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','canceled','failed')),
  sent_at TIMESTAMPTZ,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sequence_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_emails_pending_idx
  ON scheduled_emails (status, send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scheduled_emails_seq_idx
  ON scheduled_emails (sequence_key, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS scheduled_emails_email_idx
  ON scheduled_emails (to_email, status);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;
-- No policies — service role only.

-- ----------------------------------------------------------------------------
-- 2. Health-data tables — users see/manage only their own rows
-- ----------------------------------------------------------------------------

ALTER TABLE biomarker_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS biomarker_results_owner ON biomarker_results;
CREATE POLICY biomarker_results_owner ON biomarker_results
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_analyses_owner ON user_analyses;
CREATE POLICY user_analyses_owner ON user_analyses
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS action_plans_owner ON action_plans;
CREATE POLICY action_plans_owner ON action_plans
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE analysis_citations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS analysis_citations_owner ON analysis_citations;
CREATE POLICY analysis_citations_owner ON analysis_citations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uploads_owner ON uploads;
CREATE POLICY uploads_owner ON uploads
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_subscriptions_owner ON user_subscriptions;
CREATE POLICY user_subscriptions_owner ON user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- INSERT/UPDATE only via webhook (service role) — no client policy.

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_profiles_owner ON user_profiles;
CREATE POLICY user_profiles_owner ON user_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. profiles — read/update own row, allow INSERT at signup time
-- ----------------------------------------------------------------------------

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS profiles_select_own ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- 4. Anon-write-only tables — landing pages POST emails directly via the
--    anon key. Allow INSERT, deny everything else.
-- ----------------------------------------------------------------------------

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS waitlist_anon_insert ON waitlist;
CREATE POLICY waitlist_anon_insert ON waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);
-- No SELECT/UPDATE/DELETE for client — service role only.

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS newsletter_anon_insert ON newsletter_subscribers;
CREATE POLICY newsletter_anon_insert ON newsletter_subscribers
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. chat_messages — service-role only.
--    The chat widget on lipa.health POSTs to my.lipa.health/api/support
--    (server-side) since the CORS fix earlier today, so anon clients no
--    longer need to write directly. Locking down both reads and writes.
-- ----------------------------------------------------------------------------

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
-- No policies — only service role inserts and reads.

-- ----------------------------------------------------------------------------
-- 6. admin_settings — service-role only.
-- ----------------------------------------------------------------------------

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
-- No policies.

-- ----------------------------------------------------------------------------
-- Done. Verify:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--     AND tablename IN ('biomarker_results','user_analyses','action_plans',
--                       'analysis_citations','uploads','user_subscriptions',
--                       'user_profiles','profiles','chat_messages',
--                       'newsletter_subscribers','waitlist','admin_settings',
--                       'scheduled_emails');
-- All should show rowsecurity = true.

-- Queue table for scheduled outbound emails.
-- Used by the test-finder nurture sequence (Days 3-75 after submit) and
-- can be reused by any future drip flow. The cron route at
-- /api/cron/send-scheduled-emails picks pending rows where send_at <= NOW()
-- and dispatches them via Resend.

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
  -- Group identifier so we can cancel a whole drip when a user resubmits.
  -- For test-finder: format "test-finder:<email>".
  sequence_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scheduled_emails_pending_idx
  ON scheduled_emails (status, send_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS scheduled_emails_seq_idx
  ON scheduled_emails (sequence_key, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS scheduled_emails_email_idx
  ON scheduled_emails (to_email, status);

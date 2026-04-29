-- =====================================================================
-- Lipa — Summary Step Failure Telemetry
-- Captures every time the generate-summary step falls back to the
-- placeholder action plan, with enough context to triage. Replaces the
-- silent fallback that hid pipeline-health signal.
-- =====================================================================

create table if not exists summary_failures (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  test_date text,
  failure_reason text not null,        -- 'anthropic_threw' | 'no_json_in_response' | 'parse_threw' | 'insert_failed'
  error_message text,
  model text,
  prompt_chars int,
  panel_size int,
  response_chars int,
  created_at timestamptz default now()
);

create index on summary_failures (user_id, test_date);
create index on summary_failures (created_at desc);
create index on summary_failures (failure_reason);

alter table summary_failures enable row level security;

create policy "Service role inserts summary failures"
  on summary_failures for insert
  with check (true);

create policy "Service role reads summary failures"
  on summary_failures for select
  using (true);

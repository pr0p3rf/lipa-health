-- =====================================================================
-- Lipa — Action Plans
-- Stores the personalized 6-domain action plan generated per upload
-- =====================================================================

create table if not exists action_plans (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  test_date text not null,
  overall_summary text,
  disclaimer text,
  domains jsonb not null default '[]',
  generation_time_ms int,
  created_at timestamptz default now()
);

create index on action_plans (user_id, test_date);

alter table action_plans enable row level security;

create policy "Users read own action plans"
  on action_plans for select
  using (auth.uid() = user_id);

create policy "Service role inserts action plans"
  on action_plans for insert
  with check (true);

-- =====================================================================
-- Lipa — Newsletter Subscribers (The Draw)
-- Captures email signups from the home page newsletter form
-- =====================================================================

create table if not exists newsletter_subscribers (
  id bigserial primary key,
  email text unique not null,
  source text default 'home',
  created_at timestamptz default now()
);

alter table newsletter_subscribers enable row level security;

-- Allow anonymous inserts (the form submits with the anon key)
create policy "Anyone can subscribe"
  on newsletter_subscribers for insert
  with check (true);

-- Only service role can read subscribers
create policy "Service role reads subscribers"
  on newsletter_subscribers for select
  using (auth.role() = 'service_role');

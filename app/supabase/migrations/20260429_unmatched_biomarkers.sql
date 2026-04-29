-- =====================================================================
-- Lipa — Unmatched Biomarker Telemetry
-- Logs biomarker names extracted by Claude vision that don't match the
-- canonical alias dictionary. Drives the "self-aware coverage" loop:
-- aggregate misses, expand biomarker-aliases.ts, reprocess.
-- =====================================================================

create table if not exists unmatched_biomarkers (
  id bigserial primary key,
  biomarker_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  test_date text,
  unit text,
  category text,
  created_at timestamptz default now()
);

create index on unmatched_biomarkers (biomarker_name);
create index on unmatched_biomarkers (created_at desc);

alter table unmatched_biomarkers enable row level security;

create policy "Service role inserts unmatched biomarkers"
  on unmatched_biomarkers for insert
  with check (true);

create policy "Service role reads unmatched biomarkers"
  on unmatched_biomarkers for select
  using (true);

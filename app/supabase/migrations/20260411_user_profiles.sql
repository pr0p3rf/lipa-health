-- =====================================================================
-- Lipa — User Profiles
-- Stores demographic data needed for risk calculations (SCORE2, FIB-4, KDM)
-- =====================================================================

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  age int,
  sex text check (sex in ('male', 'female')),
  is_smoker boolean default false,
  systolic_bp int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "Users read own profile"
  on user_profiles for select
  using (auth.uid() = user_id);

create policy "Users insert own profile"
  on user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users update own profile"
  on user_profiles for update
  using (auth.uid() = user_id);

create or replace function touch_user_profiles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on user_profiles;
create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function touch_user_profiles_updated_at();

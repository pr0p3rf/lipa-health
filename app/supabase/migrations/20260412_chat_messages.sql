-- =====================================================================
-- Lipa — Chat Messages
-- Stores messages from the on-site chat widget
-- A Supabase Edge Function forwards new messages to Telegram
-- =====================================================================

create table if not exists chat_messages (
  id bigserial primary key,
  name text default 'Anonymous',
  email text,
  message text not null,
  page text,
  source text default 'chat_widget',
  read boolean default false,
  created_at timestamptz default now()
);

alter table chat_messages enable row level security;

-- Anyone can submit a chat message (anon role)
create policy "Anyone can send a message"
  on chat_messages for insert
  with check (true);

-- Only service role can read messages
create policy "Service role reads messages"
  on chat_messages for select
  using (auth.role() = 'service_role');

-- Only service role can update (mark as read)
create policy "Service role updates messages"
  on chat_messages for update
  using (auth.role() = 'service_role');

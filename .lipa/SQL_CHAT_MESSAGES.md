# Run this in Supabase SQL Editor

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin instructions table
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO admin_settings (key, value) VALUES (
  'chat_system_instructions',
  'You are a health research assistant. Be warm, specific, cite research. Never diagnose. Frame supplements as "research shows" not "take this". Always end treatment-related answers with a reminder to discuss with their healthcare provider.'
) ON CONFLICT (key) DO NOTHING;
```

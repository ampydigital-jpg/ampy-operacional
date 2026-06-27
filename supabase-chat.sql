-- Execute no SQL Editor do Supabase para ativar o chat interno

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel TEXT NOT NULL DEFAULT 'geral',
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel ON chat_messages(channel);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_chat" ON chat_messages FOR ALL TO authenticated USING (true);

-- Ativar Realtime para o chat
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

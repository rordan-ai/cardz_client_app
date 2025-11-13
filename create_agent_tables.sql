-- טבלאות לתקשורת בין סוכנים CLIENT ו-ADMIN
-- הרץ ב-Supabase SQL Editor

-- טבלת הודעות
CREATE TABLE IF NOT EXISTS agent_messages (
  id BIGSERIAL PRIMARY KEY,
  from_agent TEXT NOT NULL CHECK (from_agent IN ('CLIENT', 'ADMIN')),
  to_agent TEXT NOT NULL CHECK (to_agent IN ('CLIENT', 'ADMIN')),
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_to_unread ON agent_messages(to_agent, read) WHERE read = FALSE;

-- טבלת מצבי סוכנים
CREATE TABLE IF NOT EXISTS agent_state (
  agent_name TEXT PRIMARY KEY CHECK (agent_name IN ('CLIENT', 'ADMIN')),
  state JSONB NOT NULL DEFAULT '{}',
  last_update TIMESTAMPTZ DEFAULT NOW()
);

-- הוספת רשומות ראשוניות
INSERT INTO agent_state (agent_name, state) 
VALUES ('CLIENT', '{}'), ('ADMIN', '{}')
ON CONFLICT (agent_name) DO NOTHING;

-- RLS (ללא הגבלה - שני הסוכנים רואים הכל)
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for agents" ON agent_messages;
CREATE POLICY "Allow all for agents" ON agent_messages FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all for agents state" ON agent_state;
CREATE POLICY "Allow all for agents state" ON agent_state FOR ALL USING (true);






























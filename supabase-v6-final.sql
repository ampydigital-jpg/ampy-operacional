-- V6 SQL COMPLETO — Execute no Supabase SQL Editor

-- 1. Coluna destino em work_items
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS destino TEXT DEFAULT 'kanban';

-- 2. Tabela de etapas de projeto
CREATE TABLE IF NOT EXISTS project_steps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID REFERENCES work_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  responsible_id UUID REFERENCES profiles(id),
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'not_started',
  position INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_steps_work_item ON project_steps(work_item_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_end_date ON project_steps(end_date);
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='project_steps' AND policyname='auth_all_steps') THEN
    CREATE POLICY auth_all_steps ON project_steps FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- 3. Tabela de posts do Feed Preview
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT,
  date DATE,
  time TEXT DEFAULT '09:00',
  status TEXT DEFAULT 'draft',
  caption TEXT,
  hashtags TEXT,
  drive_link TEXT,
  cover_url TEXT,
  notes TEXT,
  client_feedback TEXT,
  approved_at TIMESTAMPTZ,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feed_posts_client ON feed_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_date ON feed_posts(date);
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;

-- Acesso autenticado
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feed_posts' AND policyname='auth_all_feed') THEN
    CREATE POLICY auth_all_feed ON feed_posts FOR ALL TO authenticated USING (true);
  END IF;
END $$;

-- Acesso público para leitura (página de aprovação)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feed_posts' AND policyname='public_read_feed') THEN
    CREATE POLICY public_read_feed ON feed_posts FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- Acesso público para atualização (cliente aprova sem login)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feed_posts' AND policyname='public_update_feed') THEN
    CREATE POLICY public_update_feed ON feed_posts FOR UPDATE TO anon USING (true);
  END IF;
END $$;

-- Acesso público a clients (para mostrar nome/logo na aprovação)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients' AND policyname='public_read_clients') THEN
    CREATE POLICY public_read_clients ON clients FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 4. Colunas de contrato em clients (caso não existam)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notas_fiscais TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS valor_mensal DECIMAL(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tempo_contrato TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS inicio_contrato DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fim_contrato DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS situacao_contrato TEXT;

-- 5. Constraint de tipos de evento
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_type_check
CHECK (type IN ('meeting','capture','capture_external','capture_studio','recording','delivery','internal','commercial'));

SELECT 'V6 SQL executado com sucesso' as status;

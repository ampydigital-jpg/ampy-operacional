-- AMPY DIGITAL — GERENCIADOR DE DEMANDAS
-- HOTFIX 15A — Feed Preview como documento de aprovação
-- Objetivo:
-- 1. Criar estrutura própria para documentos/grades de Feed Preview.
-- 2. Permitir upload real de capas via Supabase Storage.
-- 3. Preparar página pública por token seguro.
-- 4. Registrar histórico vivo de alterações.
-- 5. Não implementar WhatsApp nesta etapa.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================
-- 1) DOCUMENTOS / GRADES DE FEED PREVIEW
-- =========================================================

CREATE TABLE IF NOT EXISTS feed_boards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  period_month DATE NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft',
  visual_preset TEXT NOT NULL DEFAULT 'custom',

  share_token TEXT NOT NULL DEFAULT replace(uuid_generate_v4()::TEXT, '-', ''),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,

  notes TEXT,

  published_at TIMESTAMPTZ,
  last_client_action_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feed_boards_status_check CHECK (
    status IN (
      'draft',
      'in_progress',
      'sent',
      'approved',
      'changes_requested',
      'archived'
    )
  ),

  CONSTRAINT feed_boards_visual_preset_check CHECK (
    visual_preset IN (
      'custom',
      'standard',
      'minimalist',
      'creative',
      'neutral',
      'bold'
    )
  ),

  CONSTRAINT feed_boards_period_month_check CHECK (
    period_month = date_trunc('month', period_month::timestamp)::date
  ),

  CONSTRAINT feed_boards_share_token_unique UNIQUE (share_token)
);

CREATE INDEX IF NOT EXISTS idx_feed_boards_client ON feed_boards(client_id);
CREATE INDEX IF NOT EXISTS idx_feed_boards_status ON feed_boards(status);
CREATE INDEX IF NOT EXISTS idx_feed_boards_period_month ON feed_boards(period_month);
CREATE INDEX IF NOT EXISTS idx_feed_boards_share_token ON feed_boards(share_token);
CREATE INDEX IF NOT EXISTS idx_feed_boards_created_by ON feed_boards(created_by);


-- =========================================================
-- 2) ITENS DA GRADE
-- =========================================================

CREATE TABLE IF NOT EXISTS feed_board_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  board_id UUID NOT NULL REFERENCES feed_boards(id) ON DELETE CASCADE,

  -- vínculo opcional futuro com uma demanda
  work_item_id UUID REFERENCES work_items(id) ON DELETE SET NULL,

  position INTEGER NOT NULL DEFAULT 0,

  title TEXT,
  cover_url TEXT,
  storage_path TEXT,

  content_url TEXT,
  caption TEXT,
  internal_notes TEXT,

  approval_status TEXT NOT NULL DEFAULT 'pending',
  client_feedback TEXT,
  approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feed_board_items_position_check CHECK (position >= 0),

  CONSTRAINT feed_board_items_approval_status_check CHECK (
    approval_status IN (
      'pending',
      'approved',
      'changes_requested',
      'rejected'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_feed_board_items_board ON feed_board_items(board_id);
CREATE INDEX IF NOT EXISTS idx_feed_board_items_work_item ON feed_board_items(work_item_id);
CREATE INDEX IF NOT EXISTS idx_feed_board_items_position ON feed_board_items(board_id, position);
CREATE INDEX IF NOT EXISTS idx_feed_board_items_approval_status ON feed_board_items(approval_status);


-- =========================================================
-- 3) HISTÓRICO VIVO DO DOCUMENTO
-- =========================================================

CREATE TABLE IF NOT EXISTS feed_board_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,

  board_id UUID NOT NULL REFERENCES feed_boards(id) ON DELETE CASCADE,
  item_id UUID REFERENCES feed_board_items(id) ON DELETE SET NULL,

  actor_type TEXT NOT NULL DEFAULT 'internal',
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT 'Ampy Digital',

  event_type TEXT NOT NULL,
  message TEXT NOT NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT feed_board_events_actor_type_check CHECK (
    actor_type IN ('internal', 'client', 'system')
  )
);

CREATE INDEX IF NOT EXISTS idx_feed_board_events_board ON feed_board_events(board_id);
CREATE INDEX IF NOT EXISTS idx_feed_board_events_item ON feed_board_events(item_id);
CREATE INDEX IF NOT EXISTS idx_feed_board_events_actor ON feed_board_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_feed_board_events_created_at ON feed_board_events(created_at);


-- =========================================================
-- 4) UPDATED_AT
-- =========================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_feed_boards ON feed_boards;
CREATE TRIGGER set_updated_at_feed_boards
BEFORE UPDATE ON feed_boards
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_feed_board_items ON feed_board_items;
CREATE TRIGGER set_updated_at_feed_board_items
BEFORE UPDATE ON feed_board_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- =========================================================
-- 5) STORAGE PARA CAPAS DO FEED PREVIEW
-- =========================================================
-- Bucket público para facilitar renderização das capas na página pública por token.
-- A segurança principal do documento será o share_token.
-- Evolução futura: trocar para signed URLs, se necessário.

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'feed-preview',
  'feed-preview',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- =========================================================
-- 6) RLS DAS TABELAS INTERNAS
-- =========================================================

ALTER TABLE feed_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_board_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_boards_read_authenticated ON feed_boards;
DROP POLICY IF EXISTS feed_boards_insert_authenticated ON feed_boards;
DROP POLICY IF EXISTS feed_boards_update_authenticated ON feed_boards;
DROP POLICY IF EXISTS feed_boards_delete_managers ON feed_boards;

CREATE POLICY feed_boards_read_authenticated
ON feed_boards
FOR SELECT
TO authenticated
USING (app_is_active_user());

CREATE POLICY feed_boards_insert_authenticated
ON feed_boards
FOR INSERT
TO authenticated
WITH CHECK (
  app_is_active_user()
  AND (created_by = auth.uid() OR created_by IS NULL)
);

CREATE POLICY feed_boards_update_authenticated
ON feed_boards
FOR UPDATE
TO authenticated
USING (app_is_active_user())
WITH CHECK (app_is_active_user());

CREATE POLICY feed_boards_delete_managers
ON feed_boards
FOR DELETE
TO authenticated
USING (app_is_manager());


DROP POLICY IF EXISTS feed_board_items_read_authenticated ON feed_board_items;
DROP POLICY IF EXISTS feed_board_items_insert_authenticated ON feed_board_items;
DROP POLICY IF EXISTS feed_board_items_update_authenticated ON feed_board_items;
DROP POLICY IF EXISTS feed_board_items_delete_authenticated ON feed_board_items;

CREATE POLICY feed_board_items_read_authenticated
ON feed_board_items
FOR SELECT
TO authenticated
USING (app_is_active_user());

CREATE POLICY feed_board_items_insert_authenticated
ON feed_board_items
FOR INSERT
TO authenticated
WITH CHECK (app_is_active_user());

CREATE POLICY feed_board_items_update_authenticated
ON feed_board_items
FOR UPDATE
TO authenticated
USING (app_is_active_user())
WITH CHECK (app_is_active_user());

CREATE POLICY feed_board_items_delete_authenticated
ON feed_board_items
FOR DELETE
TO authenticated
USING (app_is_active_user());


DROP POLICY IF EXISTS feed_board_events_read_authenticated ON feed_board_events;
DROP POLICY IF EXISTS feed_board_events_insert_authenticated ON feed_board_events;
DROP POLICY IF EXISTS feed_board_events_delete_managers ON feed_board_events;

CREATE POLICY feed_board_events_read_authenticated
ON feed_board_events
FOR SELECT
TO authenticated
USING (app_is_active_user());

CREATE POLICY feed_board_events_insert_authenticated
ON feed_board_events
FOR INSERT
TO authenticated
WITH CHECK (app_is_active_user());

CREATE POLICY feed_board_events_delete_managers
ON feed_board_events
FOR DELETE
TO authenticated
USING (app_is_manager());


-- =========================================================
-- 7) STORAGE POLICIES
-- =========================================================

DROP POLICY IF EXISTS feed_preview_objects_read_authenticated ON storage.objects;
DROP POLICY IF EXISTS feed_preview_objects_insert_authenticated ON storage.objects;
DROP POLICY IF EXISTS feed_preview_objects_update_authenticated ON storage.objects;
DROP POLICY IF EXISTS feed_preview_objects_delete_authenticated ON storage.objects;

CREATE POLICY feed_preview_objects_read_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'feed-preview');

CREATE POLICY feed_preview_objects_insert_authenticated
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'feed-preview');

CREATE POLICY feed_preview_objects_update_authenticated
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'feed-preview')
WITH CHECK (bucket_id = 'feed-preview');

CREATE POLICY feed_preview_objects_delete_authenticated
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'feed-preview');


-- =========================================================
-- 8) EVENTO AUTOMÁTICO AO CRIAR DOCUMENTO
-- =========================================================

CREATE OR REPLACE FUNCTION app_log_feed_board_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO feed_board_events (
    board_id,
    actor_type,
    actor_id,
    actor_name,
    event_type,
    message
  )
  VALUES (
    NEW.id,
    'internal',
    NEW.created_by,
    'Ampy Digital',
    'board_created',
    'Ampy Digital criou o documento de aprovação.'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_feed_board_created ON feed_boards;
CREATE TRIGGER log_feed_board_created
AFTER INSERT ON feed_boards
FOR EACH ROW
EXECUTE FUNCTION app_log_feed_board_created();


SELECT 'Hotfix 15A Feed Preview documentos aplicada com sucesso' AS status;
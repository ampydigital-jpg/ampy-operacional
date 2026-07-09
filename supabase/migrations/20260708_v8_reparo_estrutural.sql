-- AMPY DIGITAL — GERENCIADOR DE DEMANDAS V8
-- Reparo estrutural pós-V7.
-- Objetivo: corrigir núcleo de dados, permissões, RLS, histórico e integridade sem apagar dados.
-- Execute UMA VEZ no Supabase SQL Editor do projeto ampy-operacional após backup/snapshot.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Demandas: processo oficial e status padronizados.
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS destino TEXT DEFAULT 'quadro';
UPDATE work_items SET destino = 'quadro' WHERE destino IS NULL OR destino = 'kanban';
UPDATE work_items SET destino = 'quadro' WHERE destino NOT IN ('quadro','projeto','ambos','avulsa');
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_destino_check;
ALTER TABLE work_items ADD CONSTRAINT work_items_destino_check CHECK (destino IN ('quadro','projeto','ambos','avulsa'));
CREATE INDEX IF NOT EXISTS idx_work_items_destino ON work_items(destino);

UPDATE work_items SET status = 'not_started' WHERE status IS NULL OR status NOT IN (
  'not_started','in_progress','waiting','blocked','in_review','awaiting_approval','approved','scheduled','delivered','done','cancelled','archived'
);
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_status_check;
ALTER TABLE work_items ADD CONSTRAINT work_items_status_check CHECK (status IN (
  'not_started','in_progress','waiting','blocked','in_review','awaiting_approval','approved','scheduled','delivered','done','cancelled','archived'
));

UPDATE work_items SET priority = 'normal' WHERE priority IS NULL OR priority NOT IN ('low','normal','high','urgent');
ALTER TABLE work_items DROP CONSTRAINT IF EXISTS work_items_priority_check;
ALTER TABLE work_items ADD CONSTRAINT work_items_priority_check CHECK (priority IN ('low','normal','high','urgent'));

-- Mantém fechamento coerente para demandas encerradas.
UPDATE work_items SET closed_at = COALESCE(closed_at, updated_at, NOW())
WHERE status IN ('done','delivered','cancelled','archived') AND closed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_client ON work_items(client_id);
CREATE INDEX IF NOT EXISTS idx_work_items_client_service ON work_items(client_service_id);
CREATE INDEX IF NOT EXISTS idx_work_items_responsible ON work_items(responsible_id);
CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
CREATE INDEX IF NOT EXISTS idx_work_items_final_deadline ON work_items(final_deadline);

-- 2) Serviços: preservar legados e garantir serviços oficiais ativos sem desativação em massa.
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS monthly_quantity INTEGER;
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS quantity_unit TEXT;
ALTER TABLE client_services ADD COLUMN IF NOT EXISTS delivered_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE client_services DROP CONSTRAINT IF EXISTS client_services_monthly_quantity_check;
ALTER TABLE client_services ADD CONSTRAINT client_services_monthly_quantity_check CHECK (monthly_quantity IS NULL OR monthly_quantity >= 0);
ALTER TABLE client_services DROP CONSTRAINT IF EXISTS client_services_delivered_quantity_check;
ALTER TABLE client_services ADD CONSTRAINT client_services_delivered_quantity_check CHECK (delivered_quantity >= 0);

INSERT INTO service_catalog (name, category, description, default_workflow, is_active)
SELECT 'Social Media', 'Conteúdo', 'Planejamento e produção mensal de conteúdos.', ARRAY['planejamento','producao','revisao','aprovacao','programacao'], true
WHERE NOT EXISTS (SELECT 1 FROM service_catalog WHERE lower(name) = 'social media');
INSERT INTO service_catalog (name, category, description, default_workflow, is_active)
SELECT 'Meta Ads', 'Tráfego', 'Operação e otimização de campanhas Meta.', ARRAY['briefing','acessos','criativos','campanha','otimizacao','relatorio'], true
WHERE NOT EXISTS (SELECT 1 FROM service_catalog WHERE lower(name) = 'meta ads');
INSERT INTO service_catalog (name, category, description, default_workflow, is_active)
SELECT 'Google Ads', 'Tráfego', 'Operação e otimização de campanhas Google.', ARRAY['briefing','acessos','campanha','otimizacao','relatorio'], true
WHERE NOT EXISTS (SELECT 1 FROM service_catalog WHERE lower(name) = 'google ads');
INSERT INTO service_catalog (name, category, description, default_workflow, is_active)
SELECT 'Plano Audiovisual', 'Audiovisual', 'Produção de vídeos e entregas audiovisuais.', ARRAY['briefing','agendamento','captacao','edicao','revisao','entrega'], true
WHERE NOT EXISTS (SELECT 1 FROM service_catalog WHERE lower(name) = 'plano audiovisual');

UPDATE service_catalog SET is_active = true
WHERE lower(name) IN ('social media','meta ads','google ads','plano audiovisual');

-- 3) Agenda: colunas, índices, tipos e exclusão autorizada por RLS.
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS recurrence_rule TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'internal';
UPDATE calendar_events SET type = 'capture_external' WHERE type = 'capture';
UPDATE calendar_events SET type = 'internal' WHERE type IS NULL OR type NOT IN ('meeting','capture_external','capture_studio','recording','delivery','internal','commercial');
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_type_check CHECK (type IN ('meeting','capture_external','capture_studio','recording','delivery','internal','commercial'));
CREATE INDEX IF NOT EXISTS idx_calendar_events_responsible ON calendar_events(responsible_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_work_item ON calendar_events(work_item_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_client ON calendar_events(client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_starts_at ON calendar_events(starts_at);

-- 4) Pessoas: usuário inativo deixa de operar via função de permissão.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_area TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_profiles_active ON profiles(is_active);

CREATE OR REPLACE FUNCTION app_is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true) $$;

CREATE OR REPLACE FUNCTION app_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true $$;

CREATE OR REPLACE FUNCTION app_is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE(app_current_role() IN ('admin','director','manager','team_lead'), false) $$;

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT COALESCE(app_current_role() IN ('admin','director'), false) $$;

-- 5) Cronograma interno e histórico.
CREATE TABLE IF NOT EXISTS project_steps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  responsible_id UUID REFERENCES profiles(id),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'not_started',
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
UPDATE project_steps SET status = 'not_started' WHERE status IS NULL OR status NOT IN ('not_started','in_progress','waiting','blocked','done');
ALTER TABLE project_steps DROP CONSTRAINT IF EXISTS project_steps_status_check;
ALTER TABLE project_steps ADD CONSTRAINT project_steps_status_check CHECK (status IN ('not_started','in_progress','waiting','blocked','done'));
CREATE INDEX IF NOT EXISTS idx_project_steps_work_item ON project_steps(work_item_id);
CREATE INDEX IF NOT EXISTS idx_project_steps_end_date ON project_steps(end_date);
ALTER TABLE project_steps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS work_item_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_work_item_history_work_item ON work_item_history(work_item_id);
CREATE INDEX IF NOT EXISTS idx_work_item_history_actor ON work_item_history(actor_id);
ALTER TABLE work_item_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS set_updated_at_project_steps ON project_steps;
CREATE TRIGGER set_updated_at_project_steps BEFORE UPDATE ON project_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 6) Integridade entre cliente, serviço, demanda e agenda.
CREATE OR REPLACE FUNCTION app_validate_work_item_links()
RETURNS TRIGGER AS $$
DECLARE service_client UUID;
BEGIN
  IF NEW.client_service_id IS NOT NULL THEN
    IF NEW.client_id IS NULL THEN
      RAISE EXCEPTION 'Serviço vinculado exige cliente na demanda.';
    END IF;
    SELECT client_id INTO service_client FROM client_services WHERE id = NEW.client_service_id;
    IF service_client IS NULL THEN
      RAISE EXCEPTION 'Serviço vinculado não encontrado.';
    END IF;
    IF service_client <> NEW.client_id THEN
      RAISE EXCEPTION 'Serviço vinculado não pertence ao cliente da demanda.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS validate_work_item_links ON work_items;
CREATE TRIGGER validate_work_item_links BEFORE INSERT OR UPDATE OF client_id, client_service_id ON work_items
FOR EACH ROW EXECUTE FUNCTION app_validate_work_item_links();

CREATE OR REPLACE FUNCTION app_validate_calendar_links()
RETURNS TRIGGER AS $$
DECLARE demand_client UUID;
BEGIN
  IF NEW.work_item_id IS NOT NULL THEN
    SELECT client_id INTO demand_client FROM work_items WHERE id = NEW.work_item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Demanda vinculada ao evento não encontrada.';
    END IF;
    IF NEW.client_id IS NOT NULL AND demand_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Cliente do evento não corresponde ao cliente da demanda.';
    END IF;
    IF NEW.client_id IS NULL AND demand_client IS NOT NULL THEN
      NEW.client_id := demand_client;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS validate_calendar_links ON calendar_events;
CREATE TRIGGER validate_calendar_links BEFORE INSERT OR UPDATE OF client_id, work_item_id ON calendar_events
FOR EACH ROW EXECUTE FUNCTION app_validate_calendar_links();

-- 7) RLS pós-V7: leitura autenticada, escrita operacional, usuário inativo bloqueado.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_read_authenticated ON profiles;
DROP POLICY IF EXISTS profiles_update_own ON profiles;
DROP POLICY IF EXISTS profiles_manage_admin ON profiles;
CREATE POLICY profiles_read_authenticated ON profiles FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY profiles_update_own ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id AND app_is_active_user()) WITH CHECK (auth.uid() = id AND app_is_active_user());
CREATE POLICY profiles_manage_admin ON profiles FOR UPDATE TO authenticated USING (app_is_admin()) WITH CHECK (app_is_admin());

DROP POLICY IF EXISTS clients_read_authenticated ON clients;
DROP POLICY IF EXISTS clients_manage_managers ON clients;
CREATE POLICY clients_read_authenticated ON clients FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY clients_manage_managers ON clients FOR ALL TO authenticated USING (app_is_manager()) WITH CHECK (app_is_manager());

DROP POLICY IF EXISTS services_read_authenticated ON service_catalog;
DROP POLICY IF EXISTS services_manage_managers ON service_catalog;
CREATE POLICY services_read_authenticated ON service_catalog FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY services_manage_managers ON service_catalog FOR ALL TO authenticated USING (app_is_manager()) WITH CHECK (app_is_manager());

DROP POLICY IF EXISTS client_services_read_authenticated ON client_services;
DROP POLICY IF EXISTS client_services_manage_managers ON client_services;
CREATE POLICY client_services_read_authenticated ON client_services FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY client_services_manage_managers ON client_services FOR ALL TO authenticated USING (app_is_manager()) WITH CHECK (app_is_manager());

DROP POLICY IF EXISTS demands_read_authenticated ON work_items;
DROP POLICY IF EXISTS demands_create_authenticated ON work_items;
DROP POLICY IF EXISTS demands_update_operational ON work_items;
DROP POLICY IF EXISTS demands_delete_managers ON work_items;
CREATE POLICY demands_read_authenticated ON work_items FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY demands_create_authenticated ON work_items FOR INSERT TO authenticated WITH CHECK (app_is_active_user() AND (created_by = auth.uid() OR created_by IS NULL));
CREATE POLICY demands_update_operational ON work_items FOR UPDATE TO authenticated USING (app_is_manager() OR (app_is_active_user() AND (responsible_id = auth.uid() OR created_by = auth.uid()))) WITH CHECK (app_is_manager() OR (app_is_active_user() AND (responsible_id = auth.uid() OR created_by = auth.uid())));
CREATE POLICY demands_delete_managers ON work_items FOR DELETE TO authenticated USING (app_is_manager());

DROP POLICY IF EXISTS agenda_read_authenticated ON calendar_events;
DROP POLICY IF EXISTS agenda_create_authenticated ON calendar_events;
DROP POLICY IF EXISTS agenda_update_operational ON calendar_events;
DROP POLICY IF EXISTS agenda_delete_operational ON calendar_events;
CREATE POLICY agenda_read_authenticated ON calendar_events FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY agenda_create_authenticated ON calendar_events FOR INSERT TO authenticated WITH CHECK (app_is_active_user() AND (created_by = auth.uid() OR created_by IS NULL));
CREATE POLICY agenda_update_operational ON calendar_events FOR UPDATE TO authenticated USING (app_is_manager() OR (app_is_active_user() AND (responsible_id = auth.uid() OR created_by = auth.uid()))) WITH CHECK (app_is_manager() OR (app_is_active_user() AND (responsible_id = auth.uid() OR created_by = auth.uid())));
CREATE POLICY agenda_delete_operational ON calendar_events FOR DELETE TO authenticated USING (app_is_manager() OR (app_is_active_user() AND (responsible_id = auth.uid() OR created_by = auth.uid())));

DROP POLICY IF EXISTS steps_read_authenticated ON project_steps;
DROP POLICY IF EXISTS steps_operational ON project_steps;
CREATE POLICY steps_read_authenticated ON project_steps FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY steps_operational ON project_steps FOR ALL TO authenticated
USING (app_is_manager() OR EXISTS (SELECT 1 FROM work_items w WHERE w.id = project_steps.work_item_id AND app_is_active_user() AND (w.responsible_id = auth.uid() OR w.created_by = auth.uid())))
WITH CHECK (app_is_manager() OR EXISTS (SELECT 1 FROM work_items w WHERE w.id = project_steps.work_item_id AND app_is_active_user() AND (w.responsible_id = auth.uid() OR w.created_by = auth.uid())));

DROP POLICY IF EXISTS history_read_authenticated ON work_item_history;
DROP POLICY IF EXISTS history_insert_authenticated ON work_item_history;
CREATE POLICY history_read_authenticated ON work_item_history FOR SELECT TO authenticated USING (app_is_active_user());
CREATE POLICY history_insert_authenticated ON work_item_history FOR INSERT TO authenticated WITH CHECK (app_is_active_user() AND (actor_id = auth.uid() OR actor_id IS NULL));

SELECT 'V8 reparo estrutural aplicado com sucesso' AS status;

-- =============================================
-- AMPY DIGITAL — GERENCIADOR OPERACIONAL
-- Schema do banco de dados — Supabase / PostgreSQL
-- Execute este arquivo no SQL Editor do Supabase
-- =============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PERFIS DE USUÁRIO
-- =============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'collaborator'
    CHECK (role IN ('admin','director','manager','team_lead','collaborator','freelancer','traffic','financial')),
  avatar_initials TEXT NOT NULL DEFAULT 'AM',
  avatar_color TEXT NOT NULL DEFAULT '#888888',
  avatar_bg TEXT NOT NULL DEFAULT '#1A1A1A',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CATÁLOGO DE SERVIÇOS
-- =============================================
CREATE TABLE service_catalog (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  default_workflow TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Serviços iniciais da Ampy
INSERT INTO service_catalog (name, category, default_workflow) VALUES
  ('Social media', 'Conteúdo', ARRAY['planejamento','producao','revisao_interna','aprovacao','programacao','publicacao','encerramento']),
  ('Captação', 'Vídeo', ARRAY['briefing','agendamento','captacao','revisao','entrega']),
  ('Edição de vídeo', 'Vídeo', ARRAY['briefing','edicao','revisao_interna','aprovacao','entrega']),
  ('Design', 'Design', ARRAY['briefing','criacao','revisao_interna','aprovacao','entrega']),
  ('Gestão de tráfego', 'Tráfego', ARRAY['briefing','acessos','configuracao','criativos','aprovacao','campanha_ativa','otimizacao','relatorio']),
  ('Relatórios', 'Gestão', ARRAY['coleta','analise','montagem','revisao','entrega']),
  ('Organização de feed', 'Conteúdo', ARRAY['planejamento','aprovacao','programacao']),
  ('Reuniões estratégicas', 'Gestão', ARRAY['agendamento','pauta','realizacao','ata']);

-- =============================================
-- CLIENTES
-- =============================================
CREATE TABLE clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  segment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','onboarding','paused','cancelled')),
  avatar_initials TEXT NOT NULL DEFAULT 'CL',
  avatar_color TEXT NOT NULL DEFAULT '#888888',
  avatar_bg TEXT NOT NULL DEFAULT '#1A1A1A',
  responsible_id UUID REFERENCES profiles(id),
  main_contact_name TEXT,
  main_contact_email TEXT,
  main_contact_phone TEXT,
  drive_folder_url TEXT,
  briefing_url TEXT,
  last_report_url TEXT,
  website TEXT,
  instagram TEXT,
  notes TEXT,
  crm_client_id TEXT,
  started_at DATE,
  ended_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- SERVIÇOS ATIVOS POR CLIENTE
-- =============================================
CREATE TABLE client_services (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  service_catalog_id UUID NOT NULL REFERENCES service_catalog(id),
  responsible_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','cancelled')),
  started_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- PROJETOS E OPERAÇÕES
-- =============================================
CREATE TABLE projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'recurring'
    CHECK (type IN ('recurring','project','campaign','internal','traffic')),
  client_id UUID REFERENCES clients(id),
  responsible_id UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','at_risk','done','cancelled')),
  description TEXT,
  started_at DATE,
  deadline DATE,
  drive_folder_url TEXT,
  crm_deal_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DEMANDAS (WORK ITEMS)
-- =============================================
CREATE TABLE work_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  client_id UUID REFERENCES clients(id),
  client_service_id UUID REFERENCES client_services(id),
  project_id UUID REFERENCES projects(id),
  type TEXT NOT NULL DEFAULT 'task',
  origin TEXT NOT NULL DEFAULT 'planned'
    CHECK (origin IN ('planned','recurring','extra','adjustment','urgent','internal')),
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started','in_progress','waiting','blocked','in_review','awaiting_approval','approved','scheduled','delivered','done','cancelled','archived')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low','normal','high','urgent')),
  responsible_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  internal_deadline DATE,
  final_deadline DATE,
  blocked_reason TEXT,
  blocked_at TIMESTAMPTZ,
  drive_link TEXT,
  notes TEXT,
  closed_at TIMESTAMPTZ,
  close_reason TEXT,
  crm_contract_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- COMENTÁRIOS
-- =============================================
CREATE TABLE work_item_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- HISTÓRICO DE ALTERAÇÕES
-- =============================================
CREATE TABLE work_item_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- CHECKLISTS
-- =============================================
CREATE TABLE work_item_checklists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN NOT NULL DEFAULT false,
  done_by UUID REFERENCES profiles(id),
  done_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- APROVAÇÕES
-- =============================================
CREATE TABLE approvals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  sent_by UUID REFERENCES profiles(id),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','changes_requested','cancelled')),
  feedback TEXT,
  drive_link TEXT,
  responded_at TIMESTAMPTZ
);

-- =============================================
-- BLOQUEIOS
-- =============================================
CREATE TABLE blockers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  reason TEXT NOT NULL,
  responsible_id UUID REFERENCES profiles(id),
  deadline DATE,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','resolved','cancelled')),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- AGENDA / EVENTOS
-- =============================================
CREATE TABLE calendar_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'meeting'
    CHECK (type IN ('meeting','capture','recording','delivery','internal','commercial')),
  client_id UUID REFERENCES clients(id),
  work_item_id UUID REFERENCES work_items(id),
  responsible_id UUID REFERENCES profiles(id),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  location TEXT,
  notes TEXT,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  drive_link TEXT,
  external_url TEXT,
  google_event_id TEXT,
  google_calendar_id TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- LINKS DE ARQUIVOS
-- =============================================
CREATE TABLE resource_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'drive_folder',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- LOGS DE AUDITORIA
-- =============================================
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  before_data JSONB,
  after_data JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_work_items_client ON work_items(client_id);
CREATE INDEX idx_work_items_responsible ON work_items(responsible_id);
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_final_deadline ON work_items(final_deadline);
CREATE INDEX idx_work_items_priority ON work_items(priority);
CREATE INDEX idx_calendar_events_starts_at ON calendar_events(starts_at);
CREATE INDEX idx_calendar_events_client ON calendar_events(client_id);
CREATE INDEX idx_approvals_work_item ON approvals(work_item_id);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_blockers_work_item ON blockers(work_item_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_item_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE blockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário autenticado vê tudo (ajustar por perfil na fase seguinte)
CREATE POLICY "authenticated_read_profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_update_own_profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "authenticated_all_clients" ON clients FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_client_services" ON client_services FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_read_service_catalog" ON service_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_all_projects" ON projects FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_work_items" ON work_items FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_comments" ON work_item_comments FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_read_history" ON work_item_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_all_checklists" ON work_item_checklists FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_approvals" ON approvals FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_blockers" ON blockers FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_calendar_events" ON calendar_events FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_all_resource_links" ON resource_links FOR ALL TO authenticated USING (true);
CREATE POLICY "authenticated_read_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (true);

-- =============================================
-- TRIGGER: CRIAR PERFIL AUTOMATICAMENTE
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'collaborator'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- TRIGGER: UPDATED_AT AUTOMÁTICO
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_clients BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_work_items BEFORE UPDATE ON work_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_calendar_events BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at_client_services BEFORE UPDATE ON client_services FOR EACH ROW EXECUTE FUNCTION update_updated_at();

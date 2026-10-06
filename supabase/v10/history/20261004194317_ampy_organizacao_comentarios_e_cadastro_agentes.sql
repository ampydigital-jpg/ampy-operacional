-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

comment on table public.comercial_config is '[comercial | Alfredo] Configurações do Alfredo: prompt, agenda da R1, site, formulário, Instagram, cortes de qualificação. Uma linha por chave.';

comment on table public.comercial_leads is '[comercial | Alfredo] Um lead por conversa (session_id wa_<telefone> ou form_<id>). Qualificação, avaliação, status (ia ou humano) e datas de formulário.';

comment on table public.comercial_mensagens is '[comercial | Alfredo] Histórico de mensagens de cada lead (lead, alfredo, equipe).';

comment on table public.comercial_reunioes is '[comercial | Alfredo] Reuniões R1 marcadas, com evento do Google Agenda e link do Meet.';

comment on table public.comercial_formularios is '[comercial | Alfredo] Respostas do formulário do site (Tally), ligadas ao lead.';

comment on table public.meta_ad_accounts is '[tráfego] Contas de anúncio do Meta. is_selected define quais entram no relatório semanal.';

comment on table public.meta_campaigns is '[tráfego] Campanhas do Meta sincronizadas.';

comment on table public.meta_adsets is '[tráfego] Conjuntos de anúncios do Meta sincronizados.';

comment on table public.meta_ads is '[tráfego] Anúncios do Meta sincronizados.';

comment on table public.meta_ad_creatives is '[tráfego] Criativos dos anúncios do Meta.';

comment on table public.meta_insights_daily is '[tráfego] Métricas diárias do Meta por objeto. Maior tabela do projeto.';

comment on table public.meta_period_insights is '[tráfego] Métricas do Meta agregadas por período, usadas nos relatórios.';

comment on table public.meta_sync_runs is '[tráfego] Registro de cada sincronização com o Meta (início, fim, erro).';

comment on table public.traffic_report_clients is '[tráfego] Clientes que recebem relatório em Slides e PDF, com modelo e pasta do Drive.';

comment on table public.traffic_report_settings is '[tráfego] Configurações dos relatórios de clientes.';

comment on table public.traffic_report_deliveries is '[tráfego] Registro dos relatórios gerados e enviados.';

create table if not exists public.ampy_agentes (
  slug text primary key,
  nome text not null,
  sistema text not null,
  descricao text not null,
  status text not null check (status in ('ativo', 'desligado', 'sob_demanda')),
  canal text,
  n8n_workflows text[] not null default '{}',
  supabase_tabelas text[] not null default '{}',
  edge_function text,
  segredo_vault text,
  credenciais_n8n text[] not null default '{}',
  responsavel text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.ampy_agentes enable row level security;

revoke all on public.ampy_agentes from anon, authenticated;

comment on table public.ampy_agentes is '[ampy] Cadastro de todos os agentes e automações: onde roda, tabelas, função, segredo e credenciais. Atualizar a cada agente novo.';

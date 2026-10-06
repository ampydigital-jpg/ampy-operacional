-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Configuração global dos relatórios
create table if not exists public.traffic_report_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Uma linha por conta de anúncio que recebe relatório
create table if not exists public.traffic_report_clients (
  id uuid primary key default gen_random_uuid(),
  ad_account_id uuid not null unique references public.meta_ad_accounts(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  display_name text not null,
  report_enabled boolean not null default true,
  recipients text[],
  cc text[],
  drive_client_folder_id text,
  drive_weekly_folder_id text,
  manager_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Registro de cada entrega (passo 23)
create table if not exists public.traffic_report_deliveries (
  id uuid primary key default gen_random_uuid(),
  report_client_id uuid references public.traffic_report_clients(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  ad_account_id uuid references public.meta_ad_accounts(id) on delete set null,
  client_name text not null,
  period_since date not null,
  period_until date not null,
  mode text not null check (mode in ('revisao', 'cliente')),
  slides_file_id text,
  pdf_file_id text,
  pdf_file_name text,
  pdf_md5 text,
  drive_folder_id text,
  recipient text,
  cc text,
  subject text,
  sent_at timestamptz,
  gmail_message_id text,
  status text not null check (status in ('gerado', 'enviado', 'falhou', 'pulado')),
  error text,
  checks jsonb,
  created_at timestamptz not null default now()
);

create index if not exists traffic_report_deliveries_period_idx on public.traffic_report_deliveries (period_since, period_until);

-- Métricas agregadas por período (alcance e frequência não somam por dia)
create table if not exists public.meta_period_insights (
  id bigserial primary key,
  ad_account_id uuid not null references public.meta_ad_accounts(id) on delete cascade,
  level text not null,
  entity_id text not null,
  entity_name text,
  meta_campaign_id text,
  since date not null,
  until date not null,
  objective text,
  spend numeric,
  impressions bigint,
  reach bigint,
  frequency numeric,
  clicks bigint,
  inline_link_clicks bigint,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  actions jsonb,
  action_values jsonb,
  purchase_roas jsonb,
  results jsonb,
  result_indicator text,
  result_count numeric,
  raw jsonb,
  synced_at timestamptz not null default now(),
  unique (ad_account_id, level, entity_id, since, until)
);

-- Criativos (miniatura e texto) dos anúncios
create table if not exists public.meta_ad_creatives (
  meta_ad_id text primary key,
  ad_account_id uuid references public.meta_ad_accounts(id) on delete cascade,
  creative_id text,
  ad_name text,
  thumbnail_url text,
  image_url text,
  title text,
  body text,
  object_type text,
  synced_at timestamptz not null default now()
);

alter table public.traffic_report_settings enable row level security;

alter table public.traffic_report_clients enable row level security;

alter table public.traffic_report_deliveries enable row level security;

alter table public.meta_period_insights enable row level security;

alter table public.meta_ad_creatives enable row level security;

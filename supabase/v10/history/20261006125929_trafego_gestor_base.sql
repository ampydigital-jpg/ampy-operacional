-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create table public.trafego_config (
  key text primary key,
  value jsonb not null,
  descricao text,
  updated_at timestamptz not null default now()
);

comment on table public.trafego_config is '[tráfego | gestor] Configuração do gestor de tráfego: chave geral de execução, limites das regras, equipe que recebe alertas.';

create table public.trafego_contas (
  meta_account_id text primary key references public.meta_ad_accounts(meta_account_id) on delete cascade,
  modo text not null default 'executar' check (modo in ('executar','observar','desligado')),
  orcamento_mensal numeric,
  objetivo_negocio text,
  observacoes text,
  updated_at timestamptz not null default now()
);

comment on table public.trafego_contas is '[tráfego | gestor] Regras por conta: modo (executar, observar, desligado), orçamento mensal do cliente e contexto do negócio. Sem orçamento mensal o gestor não aumenta orçamento.';

create table public.trafego_metas (
  id uuid primary key default gen_random_uuid(),
  meta_account_id text not null references public.meta_ad_accounts(meta_account_id) on delete cascade,
  result_indicator text not null default '*',
  nome_resultado text,
  cpr_alvo numeric,
  cpr_max numeric,
  roas_alvo numeric,
  observacoes text,
  updated_at timestamptz not null default now(),
  unique (meta_account_id, result_indicator)
);

comment on table public.trafego_metas is '[tráfego | gestor] Metas por conta e tipo de resultado (result_indicator da Meta; * vale para todos). cpr_alvo = custo por resultado alvo; roas_alvo para e-commerce. Sem meta o gestor usa o custo dos últimos 30 dias como referência.';

create table public.trafego_execucoes (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  origem text not null default 'diario',
  modo text not null,
  periodo jsonb,
  resumo jsonb,
  texto_whatsapp text,
  texto_email text,
  erro text
);

comment on table public.trafego_execucoes is '[tráfego | gestor] Cada rodada do gestor (diária, manual ou pelo Claude) com o resumo e os textos enviados.';

create table public.trafego_acoes (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  execucao_id bigint references public.trafego_execucoes(id) on delete set null,
  meta_account_id text not null,
  conta_nome text,
  nivel text not null check (nivel in ('campaign','adset','ad')),
  objeto_id text not null,
  objeto_nome text,
  tipo text not null check (tipo in ('pausar','reduzir_orcamento','aumentar_orcamento','reativar','ajustar_orcamento')),
  regra text,
  motivo text,
  antes jsonb,
  depois jsonb,
  metricas jsonb,
  status text not null check (status in ('simulado','executado','erro','desfeito','bloqueado')),
  erro text,
  origem text not null default 'diario',
  executado_at timestamptz,
  desfeito_at timestamptz,
  desfaz_acao_id bigint references public.trafego_acoes(id)
);

create index trafego_acoes_objeto_idx on public.trafego_acoes (objeto_id, created_at desc);

create index trafego_acoes_conta_idx on public.trafego_acoes (meta_account_id, created_at desc);

comment on table public.trafego_acoes is '[tráfego | gestor] Toda ação do gestor na Meta (pausar, orçamento), com valor antes e depois, regra, métricas e status. Base para desfazer.';

create table public.trafego_alertas (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  execucao_id bigint references public.trafego_execucoes(id) on delete set null,
  meta_account_id text,
  conta_nome text,
  tipo text not null,
  severidade text not null check (severidade in ('critico','atencao','info')),
  mensagem text not null,
  dados jsonb,
  chave text not null,
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  resolvido_at timestamptz,
  unique (chave, dia)
);

comment on table public.trafego_alertas is '[tráfego | gestor] Alertas do gestor (limite de gasto, conta parada, anúncio reprovado, custo alto, frequência). Um por chave por dia.';

alter table public.trafego_config enable row level security;

alter table public.trafego_contas enable row level security;

alter table public.trafego_metas enable row level security;

alter table public.trafego_execucoes enable row level security;

alter table public.trafego_acoes enable row level security;

alter table public.trafego_alertas enable row level security;

create or replace function public.meta_write_token()
returns text language sql security definer set search_path to ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'meta_write_token' limit 1; $$;

revoke all on function public.meta_write_token() from public, anon, authenticated;

grant execute on function public.meta_write_token() to service_role;

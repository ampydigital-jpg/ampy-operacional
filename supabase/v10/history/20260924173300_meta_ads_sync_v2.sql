-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Migration: meta_ads_sync_v2
-- Só cria/altera objetos com prefixo meta_ / vw_meta_. Nada nas tabelas do app.

-- 1. Coluna "Resultados" (igual ao Gerenciador de Anúncios) e ligação com campanha/conjunto
alter table public.meta_insights_daily
  add column if not exists meta_campaign_id text,
  add column if not exists meta_adset_id text,
  add column if not exists objective text,
  add column if not exists results jsonb not null default '[]'::jsonb,
  add column if not exists cost_per_result jsonb not null default '[]'::jsonb,
  add column if not exists result_indicator text,
  add column if not exists result_count numeric;

create index if not exists meta_insights_daily_campaign_idx
  on public.meta_insights_daily (meta_campaign_id, date_start desc);

-- 2. Extensões para agendamento
create extension if not exists pg_net with schema extensions;

create extension if not exists pg_cron with schema pg_catalog;

create or replace function public.meta_sync_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'meta_sync_secret' limit 1;
$$;

revoke all on function public.meta_sync_secret() from public, anon, authenticated;

grant execute on function public.meta_sync_secret() to service_role;

-- 4. Dispara a sincronização (uma chamada por conta selecionada)
create or replace function public.meta_enqueue_sync(p_days integer default 7, p_mode text default 'sync')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'meta_sync_secret' limit 1);
  v_url text := 'https://epzrrsaibqdcaafkvwmm.supabase.co/functions/v1/meta-sync';
  v_acc record;
  v_n integer := 0;
begin
  if p_mode = 'discover' then
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
      body := jsonb_build_object('mode', 'discover'),
      timeout_milliseconds := 60000
    );
    return 1;
  end if;

  for v_acc in select meta_account_id from public.meta_ad_accounts where is_selected loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-sync-secret', v_secret),
      body := jsonb_build_object('mode', 'sync', 'meta_account_id', v_acc.meta_account_id, 'days', p_days),
      timeout_milliseconds := 150000
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.meta_enqueue_sync(integer, text) from public, anon, authenticated;

-- 5. Visões para consulta (nomes em português)
create or replace view public.vw_meta_campanhas_dia
with (security_invoker = true) as
select
  i.date_start                         as dia,
  a.name                               as conta,
  a.meta_account_id,
  a.client_id,
  i.entity_id                          as meta_campaign_id,
  i.entity_name                        as campanha,
  i.objective                          as objetivo,
  i.spend                              as investimento,
  i.impressions                        as impressoes,
  i.reach                              as alcance,
  i.frequency                          as frequencia,
  i.clicks                             as cliques,
  i.inline_link_clicks                 as cliques_link,
  i.ctr,
  i.cpc,
  i.cpm,
  i.result_indicator                   as tipo_resultado,
  i.result_count                       as resultados,
  case when i.result_count > 0 then round(i.spend / i.result_count, 2) end as custo_por_resultado
from public.meta_insights_daily i
join public.meta_ad_accounts a on a.id = i.ad_account_id
where i.level = 'campaign';

create or replace view public.vw_meta_contas_dia
with (security_invoker = true) as
select
  i.date_start          as dia,
  a.name                as conta,
  a.meta_account_id,
  a.client_id,
  i.spend               as investimento,
  i.impressions         as impressoes,
  i.reach               as alcance,
  i.frequency           as frequencia,
  i.clicks              as cliques,
  i.inline_link_clicks  as cliques_link,
  i.ctr,
  i.cpc,
  i.cpm
from public.meta_insights_daily i
join public.meta_ad_accounts a on a.id = i.ad_account_id
where i.level = 'account';

revoke all on public.vw_meta_campanhas_dia from anon, authenticated;

revoke all on public.vw_meta_contas_dia from anon, authenticated;

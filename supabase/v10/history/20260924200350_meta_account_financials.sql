-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

alter table public.meta_ad_accounts
  add column if not exists amount_spent_total numeric(14,2),
  add column if not exists balance numeric(14,2),
  add column if not exists spend_cap numeric(14,2),
  add column if not exists is_prepay_account boolean,
  add column if not exists billing_type text,
  add column if not exists payment_method_label text,
  add column if not exists funding_source_details jsonb,
  add column if not exists financial_synced_at timestamptz;

create or replace view public.vw_meta_contas_financeiro
with (security_invoker = true)
as
with agg as (
  select
    a.id as ad_account_id,
    coalesce(
      sum(i.spend) filter (
        where i.level = 'account'
          and i.date_start >= date_trunc('month', timezone(coalesce(a.timezone_name, 'America/Sao_Paulo'), now()))::date
          and i.date_start <= timezone(coalesce(a.timezone_name, 'America/Sao_Paulo'), now())::date
      ), 0
    )::numeric(14,2) as spend_month,
    coalesce(
      sum(i.spend) filter (
        where i.level = 'account'
          and i.date_start >= timezone(coalesce(a.timezone_name, 'America/Sao_Paulo'), now())::date - 6
          and i.date_start <= timezone(coalesce(a.timezone_name, 'America/Sao_Paulo'), now())::date
      ), 0
    )::numeric(14,2) as spend_7d
  from public.meta_ad_accounts a
  left join public.meta_insights_daily i on i.ad_account_id = a.id
  group by a.id
)
select
  a.id,
  a.meta_account_id,
  a.name,
  a.currency,
  a.account_status,
  a.is_selected,
  a.balance,
  a.amount_spent_total,
  a.spend_cap,
  a.is_prepay_account,
  a.billing_type,
  a.payment_method_label,
  a.financial_synced_at,
  agg.spend_month,
  agg.spend_7d,
  round((agg.spend_7d / 7.0)::numeric, 2) as avg_daily_7d,
  case
    when a.is_prepay_account is true and coalesce(a.balance,0) > 0 and agg.spend_7d > 0
    then round((a.balance / (agg.spend_7d / 7.0))::numeric, 1)
    else null
  end as estimated_days_remaining,
  case
    when a.is_prepay_account is true and coalesce(a.balance,0) > 0 and agg.spend_7d > 0
    then timezone(coalesce(a.timezone_name, 'America/Sao_Paulo'), now())::date
         + ceil(a.balance / (agg.spend_7d / 7.0))::int
    else null
  end as estimated_end_date,
  case
    when a.is_prepay_account is true and coalesce(a.balance,0) > 0 and agg.spend_7d > 0 then
      case
        when (a.balance / (agg.spend_7d / 7.0)) < 3 then 'CRITICO'
        when (a.balance / (agg.spend_7d / 7.0)) < 7 then 'ATENCAO'
        else 'OK'
      end
    when a.is_prepay_account is true and coalesce(a.balance,0) <= 0 then 'SEM SALDO'
    else 'OK'
  end as financial_status
from public.meta_ad_accounts a
join agg on agg.ad_account_id = a.id;

revoke all on public.vw_meta_contas_financeiro from anon, authenticated;

grant select on public.vw_meta_contas_financeiro to service_role;

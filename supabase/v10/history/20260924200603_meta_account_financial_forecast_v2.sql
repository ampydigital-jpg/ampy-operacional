-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

drop view if exists public.vw_meta_contas_financeiro;

create view public.vw_meta_contas_financeiro
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
),
calc as (
  select
    a.*,
    agg.spend_month,
    agg.spend_7d,
    round((agg.spend_7d / 7.0)::numeric, 2) as avg_daily_7d,
    case
      when coalesce(a.spend_cap,0) > 0
      then greatest(a.spend_cap - coalesce(a.amount_spent_total,0), 0)::numeric(14,2)
      else null
    end as spend_cap_remaining
  from public.meta_ad_accounts a
  join agg on agg.ad_account_id = a.id
)
select
  id,
  meta_account_id,
  name,
  currency,
  account_status,
  is_selected,
  balance,
  amount_spent_total,
  spend_cap,
  spend_cap_remaining,
  is_prepay_account,
  billing_type,
  payment_method_label,
  financial_synced_at,
  spend_month,
  spend_7d,
  avg_daily_7d,
  case
    when spend_cap_remaining is not null and avg_daily_7d > 0
    then round((spend_cap_remaining / avg_daily_7d)::numeric, 1)
    else null
  end as estimated_days_remaining,
  case
    when spend_cap_remaining is not null and avg_daily_7d > 0
    then timezone(coalesce(timezone_name, 'America/Sao_Paulo'), now())::date
         + ceil(spend_cap_remaining / avg_daily_7d)::int
    else null
  end as estimated_end_date,
  case
    when coalesce(spend_cap,0) = 0 then 'SEM LIMITE INFORMADO'
    when spend_cap_remaining <= 0 then 'LIMITE ATINGIDO'
    when avg_daily_7d <= 0 then 'SEM GASTO RECENTE'
    when (spend_cap_remaining / avg_daily_7d) < 3 then 'CRITICO'
    when (spend_cap_remaining / avg_daily_7d) < 7 then 'ATENCAO'
    else 'OK'
  end as financial_status
from calc;

revoke all on public.vw_meta_contas_financeiro from anon, authenticated;

grant select on public.vw_meta_contas_financeiro to service_role;

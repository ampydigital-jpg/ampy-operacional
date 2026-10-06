-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Rótulo em português para o indicador de resultado da Meta
create or replace function public.meta_result_label(p_indicator text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_indicator is null then null
    when p_indicator like '%messaging_conversation_started%' then 'Conversas iniciadas'
    when p_indicator in ('profile_visit_view', 'total_profile_visits') then 'Visitas ao perfil'
    when p_indicator = 'lead' or p_indicator like '%fb_pixel_lead%' or p_indicator like '%lead_grouped%' or p_indicator = 'actions:lead' then 'Leads'
    when p_indicator like '%fb_pixel_purchase%' or p_indicator in ('actions:omni_purchase', 'actions:purchase') then 'Compras'
    when p_indicator like '%initiate_checkout%' then 'Finalizações de compra iniciadas'
    when p_indicator like '%add_to_cart%' then 'Adições ao carrinho'
    when p_indicator like '%complete_registration%' then 'Cadastros'
    when p_indicator = 'actions:link_click' then 'Cliques no link'
    when p_indicator like '%landing_page_view%' then 'Visualizações da página de destino'
    when p_indicator = 'reach' then 'Alcance'
    when p_indicator like '%video_view%' or p_indicator like '%thruplay%' then 'Visualizações de vídeo'
    when p_indicator like '%post_engagement%' then 'Engajamentos'
    else p_indicator
  end
$$;

-- Relatório semanal consolidado das contas selecionadas (somente leitura)
create or replace function public.traffic_weekly_report(p_since date, p_until date, p_account_ids text[] default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with p as (
  select p_since as s, p_until as u, p_since - (p_until - p_since + 1) as ps, p_since - 1 as pu
),
accs as (
  select a.id, a.meta_account_id, a.name, a.last_synced_at
  from public.meta_ad_accounts a
  where a.is_selected and (p_account_ids is null or a.meta_account_id = any(p_account_ids))
),
acc_m as (
  select i.ad_account_id,
    coalesce(sum(i.spend) filter (where i.date_start between p.s and p.u), 0) as spend,
    coalesce(sum(i.spend) filter (where i.date_start between p.ps and p.pu), 0) as spend_prev,
    coalesce(sum(i.impressions) filter (where i.date_start between p.s and p.u), 0) as impressions,
    coalesce(sum(i.clicks) filter (where i.date_start between p.s and p.u), 0) as clicks
  from public.meta_insights_daily i cross join p
  where i.level = 'account' and i.date_start between p.ps and p.u
    and i.ad_account_id in (select id from accs)
  group by i.ad_account_id
),
ad_rows as (
  select i.ad_account_id, i.entity_id, i.meta_campaign_id, i.objective, i.spend,
    i.result_indicator, i.result_count, i.actions,
    (i.date_start between p.s and p.u) as cur
  from public.meta_insights_daily i cross join p
  where i.level = 'adset' and i.date_start between p.ps and p.u
    and i.ad_account_id in (select id from accs)
),
adset_ind as (
  select entity_id,
    coalesce(
      mode() within group (order by result_indicator) filter (where result_indicator is not null and result_indicator <> 'mixed'),
      case when bool_or(objective = 'OUTCOME_LEADS') then 'lead' end
    ) as ind
  from ad_rows
  group by entity_id
),
res_raw as (
  select r.ad_account_id, r.meta_campaign_id, r.cur, r.spend, ai.ind,
    case
      when ai.ind = 'lead' and (r.result_indicator is null or r.result_indicator = 'mixed')
        then coalesce((select sum((x->>'value')::numeric)
                       from jsonb_array_elements(coalesce(r.actions, '[]'::jsonb)) x
                       where x->>'action_type' = 'lead'), 0)
      else coalesce(r.result_count, 0)
    end as cnt
  from ad_rows r
  join adset_ind ai on ai.entity_id = r.entity_id
  where ai.ind is not null
),
acc_res as (
  select ad_account_id, public.meta_result_label(ind) as label,
    sum(cnt) filter (where cur) as cnt,
    sum(cnt) filter (where not cur) as cnt_prev,
    sum(spend) filter (where cur) as spend,
    sum(spend) filter (where not cur) as spend_prev
  from res_raw
  group by 1, 2
),
camp_res as (
  select ad_account_id, meta_campaign_id, public.meta_result_label(ind) as label,
    sum(cnt) as cnt, sum(spend) as spend
  from res_raw
  where cur
  group by 1, 2, 3
  having sum(spend) > 0 or sum(cnt) > 0
),
camp_m as (
  select i.ad_account_id, i.entity_id as meta_campaign_id, max(i.entity_name) as name,
    sum(i.spend) as spend, sum(i.impressions) as impressions, sum(i.clicks) as clicks
  from public.meta_insights_daily i cross join p
  where i.level = 'campaign' and i.date_start between p.s and p.u
    and i.ad_account_id in (select id from accs)
  group by 1, 2
  having sum(i.spend) > 0
),
camp_obj as (
  select c.ad_account_id, c.spend, jsonb_build_object(
    'name', coalesce(mc.name, c.name),
    'status', mc.effective_status,
    'objective', mc.objective,
    'daily_budget', coalesce(mc.daily_budget,
        (select sum(s.daily_budget) from public.meta_adsets s
          where s.meta_campaign_id = c.meta_campaign_id and s.effective_status = 'ACTIVE')),
    'spend', round(c.spend, 2),
    'impressions', c.impressions,
    'cpm', case when c.impressions > 0 then round(c.spend / c.impressions * 1000, 2) end,
    'ctr', case when c.impressions > 0 then round(c.clicks::numeric / c.impressions * 100, 2) end,
    'results', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'label', cr.label,
                 'count', cr.cnt,
                 'cost', case when cr.cnt > 0 then round(cr.spend / cr.cnt, 2) end)
               order by cr.spend desc)
        from camp_res cr
        where cr.ad_account_id = c.ad_account_id and cr.meta_campaign_id = c.meta_campaign_id), '[]'::jsonb)
  ) as obj
  from camp_m c
  left join public.meta_campaigns mc on mc.meta_campaign_id = c.meta_campaign_id
),
acc_obj as (
  select a.id, coalesce(m.spend, 0) as spend, coalesce(m.spend_prev, 0) as spend_prev, jsonb_build_object(
    'meta_account_id', a.meta_account_id,
    'name', a.name,
    'last_synced_at', a.last_synced_at,
    'spend', round(coalesce(m.spend, 0), 2),
    'spend_prev', round(coalesce(m.spend_prev, 0), 2),
    'impressions', coalesce(m.impressions, 0),
    'cpm', case when m.impressions > 0 then round(m.spend / m.impressions * 1000, 2) end,
    'ctr', case when m.impressions > 0 then round(m.clicks::numeric / m.impressions * 100, 2) end,
    'results', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'label', r.label,
                 'count', coalesce(r.cnt, 0),
                 'count_prev', coalesce(r.cnt_prev, 0),
                 'cost', case when r.cnt > 0 then round(r.spend / r.cnt, 2) end,
                 'cost_prev', case when r.cnt_prev > 0 then round(r.spend_prev / r.cnt_prev, 2) end)
               order by r.spend desc nulls last)
        from acc_res r
        where r.ad_account_id = a.id
          and (coalesce(r.cnt, 0) > 0 or coalesce(r.cnt_prev, 0) > 0 or coalesce(r.spend, 0) > 0)), '[]'::jsonb),
    'campaigns', coalesce((select jsonb_agg(co.obj order by co.spend desc) from camp_obj co where co.ad_account_id = a.id), '[]'::jsonb)
  ) as obj
  from accs a
  left join acc_m m on m.ad_account_id = a.id
)
select jsonb_build_object(
  'period', jsonb_build_object('since', p.s, 'until', p.u),
  'previous', jsonb_build_object('since', p.ps, 'until', p.pu),
  'totals', jsonb_build_object(
    'spend', (select round(coalesce(sum(spend), 0), 2) from acc_obj),
    'spend_prev', (select round(coalesce(sum(spend_prev), 0), 2) from acc_obj),
    'accounts_with_spend', (select count(*) from acc_obj where spend > 0),
    'accounts_selected', (select count(*) from acc_obj)),
  'accounts', coalesce((select jsonb_agg(obj order by spend desc) from acc_obj where spend > 0), '[]'::jsonb),
  'no_spend', coalesce((select jsonb_agg(jsonb_build_object('name', obj->>'name', 'spend_prev', round(spend_prev, 2)) order by spend_prev desc, obj->>'name')
                        from acc_obj where spend = 0), '[]'::jsonb)
)
from p;
$$;

-- Segredo que o n8n usa para chamar a função traffic-weekly
create or replace function public.n8n_traffic_secret()
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'n8n_traffic_secret' limit 1;
$$;

revoke all on function public.traffic_weekly_report(date, date, text[]) from public, anon, authenticated;

grant execute on function public.traffic_weekly_report(date, date, text[]) to service_role;

revoke all on function public.n8n_traffic_secret() from public, anon, authenticated;

grant execute on function public.n8n_traffic_secret() to service_role;

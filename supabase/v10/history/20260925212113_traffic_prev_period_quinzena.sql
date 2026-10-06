-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.traffic_prev_period(p_since date, p_until date, out prev_since date, out prev_until date)
language sql immutable
set search_path to ''
as $$
  select
    case
      -- 1 a 15: compara com 16 ao último dia do mês anterior
      when extract(day from p_since) = 1 and p_until = p_since + 14
        then (p_since - interval '1 month' + interval '15 days')::date
      -- 16 ao último dia: compara com 1 a 15 do mesmo mês
      when extract(day from p_since) = 16 and p_until = (date_trunc('month', p_since) + interval '1 month - 1 day')::date
        then p_since - 15
      -- qualquer outro período: mesmo tamanho, logo antes
      else p_since - (p_until - p_since + 1)
    end,
    p_since - 1
$$;

revoke all on function public.traffic_prev_period(date, date) from public, anon, authenticated;

grant execute on function public.traffic_prev_period(date, date) to service_role;

CREATE OR REPLACE FUNCTION public.traffic_client_report(p_report_client_id uuid, p_since date, p_until date)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with rc as (
  select r.*, a.meta_account_id, a.name as account_name, a.last_synced_at,
         c.name as client_name, c.main_contact_name, c.main_contact_email
  from public.traffic_report_clients r
  join public.meta_ad_accounts a on a.id = r.ad_account_id
  left join public.clients c on c.id = r.client_id
  where r.id = p_report_client_id
),
p as (
  select p_since as s, p_until as u, pp.prev_since as ps, pp.prev_until as pu
  from public.traffic_prev_period(p_since, p_until) pp
),
tot as (
  select i.since,
    jsonb_build_object(
      'spend', round(i.spend, 2), 'impressions', i.impressions, 'reach', i.reach, 'frequency', round(i.frequency, 2),
      'clicks', i.clicks, 'link_clicks', i.inline_link_clicks,
      'ctr_link', case when i.impressions > 0 then round(i.inline_link_clicks::numeric / i.impressions * 100, 2) end,
      'cpc_link', case when i.inline_link_clicks > 0 then round(i.spend / i.inline_link_clicks, 2) end,
      'cpm', case when i.impressions > 0 then round(i.spend / i.impressions * 1000, 2) end,
      'purchases', public.meta_action_sum(i.actions, array['purchase','omni_purchase','offsite_conversion.fb_pixel_purchase']),
      'purchase_value', public.meta_action_sum(i.action_values, array['purchase','omni_purchase','offsite_conversion.fb_pixel_purchase']),
      'roas', (select round((x->>'value')::numeric, 2) from jsonb_array_elements(coalesce(i.purchase_roas, '[]'::jsonb)) x limit 1),
      'synced_at', i.synced_at
    ) as obj
  from public.meta_period_insights i, rc, p
  where i.ad_account_id = rc.ad_account_id and i.level = 'account'
    and ((i.since = p.s and i.until = p.u) or (i.since = p.ps and i.until = p.pu))
),
ad_rows as (
  select i.entity_id, i.meta_campaign_id, i.objective, i.spend, i.result_indicator, i.result_count, i.actions,
         (i.date_start between p.s and p.u) as cur, i.date_start
  from public.meta_insights_daily i, rc, p
  where i.ad_account_id = rc.ad_account_id and i.level = 'adset' and i.date_start between p.ps and p.u
),
adset_ind as (
  select entity_id,
    coalesce(mode() within group (order by result_indicator) filter (where result_indicator is not null and result_indicator <> 'mixed'),
             case when bool_or(objective = 'OUTCOME_LEADS') then 'lead' end) as ind
  from ad_rows group by entity_id
),
res_raw as (
  select r.meta_campaign_id, r.cur, r.spend, ai.ind,
    case when ai.ind = 'lead' and (r.result_indicator is null or r.result_indicator = 'mixed')
         then public.meta_action_sum(r.actions, array['lead'])
         else coalesce(r.result_count, 0) end as cnt
  from ad_rows r join adset_ind ai on ai.entity_id = r.entity_id
  where ai.ind is not null
),
res as (
  select public.meta_result_label(ind) as label, min(ind) as indicator,
    coalesce(sum(cnt) filter (where cur), 0) as cnt, coalesce(sum(cnt) filter (where not cur), 0) as cnt_prev,
    coalesce(sum(spend) filter (where cur), 0) as spend, coalesce(sum(spend) filter (where not cur), 0) as spend_prev
  from res_raw group by 1
),
camp_res as (
  select meta_campaign_id, public.meta_result_label(ind) as label, sum(cnt) as cnt, sum(spend) as spend
  from res_raw where cur group by 1, 2
),
camps as (
  select i.entity_id, i.entity_name, i.spend, i.impressions, i.reach, i.frequency, i.inline_link_clicks, i.objective,
         mc.effective_status, mc.daily_budget
  from public.meta_period_insights i
  cross join p
  join rc on rc.ad_account_id = i.ad_account_id
  left join public.meta_campaigns mc on mc.meta_campaign_id = i.entity_id
  where i.level = 'campaign' and i.since = p.s and i.until = p.u and i.spend > 0
),
ads as (
  select i.entity_id as ad_id, i.entity_name as ad_name, i.meta_campaign_id, i.spend, i.impressions, i.inline_link_clicks,
    coalesce(nullif(i.result_indicator, 'mixed'), case when i.objective = 'OUTCOME_LEADS' then 'lead' end) as ind,
    case when (i.result_indicator is null or i.result_indicator = 'mixed') and i.objective = 'OUTCOME_LEADS'
         then public.meta_action_sum(i.actions, array['lead']) else coalesce(i.result_count, 0) end as cnt,
    cr.thumbnail_url, cr.image_url, cr.object_type, cr.title, cr.body
  from public.meta_period_insights i
  cross join p
  join rc on rc.ad_account_id = i.ad_account_id
  left join public.meta_ad_creatives cr on cr.meta_ad_id = i.entity_id
  where i.level = 'ad' and i.since = p.s and i.until = p.u and i.spend > 0
)
select jsonb_build_object(
  'client', (select jsonb_build_object(
      'report_client_id', rc.id, 'display_name', rc.display_name, 'client_id', rc.client_id, 'client_name', rc.client_name,
      'contact_name', rc.main_contact_name,
      'recipients', coalesce(to_jsonb(rc.recipients), case when coalesce(rc.main_contact_email, '') <> '' then jsonb_build_array(rc.main_contact_email) else '[]'::jsonb end),
      'cc', coalesce(to_jsonb(rc.cc), '[]'::jsonb),
      'weekly_folder_id', rc.drive_weekly_folder_id, 'client_folder_id', rc.drive_client_folder_id,
      'manager_name', rc.manager_name, 'report_enabled', rc.report_enabled, 'sales_validated', rc.sales_validated,
      'meta_account_id', rc.meta_account_id, 'account_name', rc.account_name, 'last_synced_at', rc.last_synced_at) from rc),
  'period', (select jsonb_build_object('since', s, 'until', u) from p),
  'previous', (select jsonb_build_object('since', ps, 'until', pu) from p),
  'current', (select t.obj from tot t, p where t.since = p.s),
  'previous_totals', (select t.obj from tot t, p where t.since = p.ps),
  'results', coalesce((select jsonb_agg(jsonb_build_object(
      'label', label, 'indicator', indicator, 'count', cnt, 'count_prev', cnt_prev,
      'spend', round(spend, 2), 'spend_prev', round(spend_prev, 2),
      'cost', case when cnt > 0 then round(spend / cnt, 2) end,
      'cost_prev', case when cnt_prev > 0 then round(spend_prev / cnt_prev, 2) end) order by spend desc)
    from res where cnt > 0 or cnt_prev > 0 or spend > 0), '[]'::jsonb),
  'campaigns', coalesce((select jsonb_agg(jsonb_build_object(
      'campaign_id', c.entity_id, 'name', c.entity_name, 'objective', c.objective, 'status', c.effective_status,
      'daily_budget', c.daily_budget, 'spend', round(c.spend, 2), 'impressions', c.impressions, 'reach', c.reach,
      'frequency', round(c.frequency, 2), 'link_clicks', c.inline_link_clicks,
      'ctr_link', case when c.impressions > 0 then round(c.inline_link_clicks::numeric / c.impressions * 100, 2) end,
      'cpm', case when c.impressions > 0 then round(c.spend / c.impressions * 1000, 2) end,
      'results', coalesce((select jsonb_agg(jsonb_build_object('label', cr.label, 'count', cr.cnt,
                    'cost', case when cr.cnt > 0 then round(cr.spend / cr.cnt, 2) end) order by cr.spend desc)
                  from camp_res cr where cr.meta_campaign_id = c.entity_id), '[]'::jsonb)) order by c.spend desc)
    from camps c), '[]'::jsonb),
  'ads', coalesce((select jsonb_agg(jsonb_build_object(
      'ad_id', a.ad_id, 'ad_name', a.ad_name, 'campaign_id', a.meta_campaign_id,
      'spend', round(a.spend, 2), 'impressions', a.impressions, 'link_clicks', a.inline_link_clicks,
      'result_label', public.meta_result_label(a.ind), 'result_count', a.cnt,
      'cost', case when a.cnt > 0 then round(a.spend / a.cnt, 2) end,
      'object_type', a.object_type, 'thumbnail_url', coalesce(a.image_url, a.thumbnail_url)) order by a.cnt desc, a.spend desc)
    from ads a), '[]'::jsonb),
  'data_days', (select jsonb_build_object(
      'current', count(distinct i.date_start) filter (where i.date_start between p.s and p.u),
      'previous', count(distinct i.date_start) filter (where i.date_start between p.ps and p.pu))
    from public.meta_insights_daily i, rc, p
    where i.ad_account_id = rc.ad_account_id and i.level = 'account' and i.date_start between p.ps and p.u)
);
$function$;

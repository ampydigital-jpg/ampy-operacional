-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Sugestões de ação (só leitura): anúncio ativo gastando sem resultado nos últimos 7 dias.
-- Usa o resultado principal da campanha no nível de anúncio. Pausar só quando a campanha tem outro anúncio ativo; senão, trocar o criativo.
create or replace function public.traffic_sugestoes(d date, base jsonb)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  with paradas as (
    select distinct e->>'cliente' as cliente
      from jsonb_array_elements(coalesce(base->'alertas', '[]'::jsonb)) e
     where e->>'tipo' in ('status_conta', 'limite_atingido', 'saldo_zerado', 'parada_antiga')
  ),
  contas as (
    select a.id, coalesce(tc.display_name, regexp_replace(a.name, '^CA\s*-\s*', '')) as cliente
      from public.meta_ad_accounts a
      left join public.traffic_report_clients tc on tc.ad_account_id = a.id
     where a.is_selected
  ),
  base_ad as (
    select i.ad_account_id, i.meta_campaign_id, i.entity_id as ad_id, i.result_indicator as ind,
           sum(i.spend) as s, sum(coalesce(i.result_count, 0)) as r
      from public.meta_insights_daily i
      join contas c on c.id = i.ad_account_id
     where i.level = 'ad' and i.date_start between d - 6 and d
     group by 1, 2, 3, 4
  ),
  camp_ind as (
    select ad_account_id, meta_campaign_id, (array_agg(ind order by rr desc))[1] as ind
      from (select ad_account_id, meta_campaign_id, ind, sum(r) as rr
              from base_ad where ind is not null and ind <> 'mixed'
             group by 1, 2, 3 having sum(r) > 0) z
     group by 1, 2
  ),
  camp as (
    select b.ad_account_id, b.meta_campaign_id, ci.ind, sum(b.s) as s,
           sum(case when b.ind = ci.ind then b.r else 0 end) as r
      from base_ad b join camp_ind ci using (ad_account_id, meta_campaign_id)
     group by 1, 2, 3
  ),
  ads as (
    select b.ad_account_id, b.ad_id, b.meta_campaign_id, sum(b.s) as s,
           sum(case when b.ind = cm.ind then b.r else 0 end) as r
      from base_ad b join camp cm using (ad_account_id, meta_campaign_id)
     group by 1, 2, 3
  ),
  cand as (
    select c.cliente, ad.name as ad_name, cp.name as camp_name, x.s, cm.ind, cm.s / nullif(cm.r, 0) as cpr,
           (select count(*) from public.meta_ads o join public.meta_adsets os on os.id = o.adset_id
             where o.campaign_id = cp.id and o.effective_status = 'ACTIVE' and os.effective_status = 'ACTIVE') as ativos
      from ads x
      join camp cm on cm.ad_account_id = x.ad_account_id and cm.meta_campaign_id = x.meta_campaign_id
      join contas c on c.id = x.ad_account_id
      join public.meta_ads ad on ad.meta_ad_id = x.ad_id and ad.effective_status = 'ACTIVE'
      join public.meta_campaigns cp on cp.id = ad.campaign_id and cp.effective_status = 'ACTIVE'
      join public.meta_adsets st on st.id = ad.adset_id and st.effective_status = 'ACTIVE'
     where x.r = 0 and cm.r > 0 and x.s >= greatest(15, 1.5 * cm.s / cm.r)
       and c.cliente not in (select cliente from paradas)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'cliente', cliente, 'nivel', 'acao',
           'tipo', case when ativos >= 2 then 'pausar_anuncio' else 'trocar_criativo' end,
           'texto', case when ativos >= 2
             then format('Pausar o anúncio %s (%s): R$ %s em 7 dias sem resultado (%s). A campanha custa R$ %s por resultado.',
                         ad_name, camp_name, public.traffic_brl(s), public.traffic_indicador(ind), public.traffic_brl(cpr))
             else format('Trocar o criativo de %s: o único anúncio ativo (%s) gastou R$ %s em 7 dias sem resultado (%s).',
                         camp_name, ad_name, public.traffic_brl(s), public.traffic_indicador(ind)) end)
         order by cliente, s desc), '[]'::jsonb)
    from cand
$$;

alter function public.traffic_alertas(date) rename to traffic_alertas_base;

create or replace function public.traffic_alertas(p_ref date default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  d date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date - 1);
  b jsonb := public.traffic_alertas_base(d);
  s jsonb := public.traffic_sugestoes(d, b);
begin
  return b || jsonb_build_object('alertas', coalesce(b->'alertas', '[]'::jsonb) || s, 'acoes', jsonb_array_length(s));
end
$$;

revoke all on function public.traffic_alertas(date) from public, anon, authenticated;

revoke all on function public.traffic_alertas_base(date) from public, anon, authenticated;

revoke all on function public.traffic_sugestoes(date, jsonb) from public, anon, authenticated;

grant execute on function public.traffic_alertas(date) to service_role;

grant execute on function public.traffic_alertas_base(date) to service_role;

grant execute on function public.traffic_sugestoes(date, jsonb) to service_role;

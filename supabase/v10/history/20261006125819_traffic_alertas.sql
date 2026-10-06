-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.traffic_brl(v numeric)
returns text language sql immutable set search_path = '' as $$
  select translate(to_char(round(coalesce(v, 0), 2), 'FM999,999,990.00'), ',.', '.,')
$$;

create or replace function public.traffic_indicador(ind text)
returns text language sql immutable set search_path = '' as $$
  select case ind
    when 'actions:onsite_conversion.messaging_conversation_started_7d' then 'conversas'
    when 'profile_visit_view' then 'visitas ao perfil'
    when 'actions:offsite_conversion.fb_pixel_initiate_checkout' then 'checkouts'
    when 'actions:offsite_conversion.fb_pixel_purchase' then 'compras'
    when 'actions:lead' then 'leads'
    when 'actions:onsite_conversion.lead_grouped' then 'leads'
    when 'actions:link_click' then 'cliques no link'
    when 'video_thruplay_watched_actions' then 'ThruPlays'
    when 'reach' then 'alcance'
    else 'resultados' end
$$;

-- Alertas diários das contas Meta (contas com is_selected). p_ref = dia de referência (padrão: ontem no horário de Brasília).
-- Crítico: conta parada (status, limite de gasto atingido, saldo pré-pago zerado).
-- Atenção: limite ou saldo acabando em até 3 dias, campanha ativa com entrega caindo ou sem gastar,
-- custo por resultado subindo 50% ou mais, gasto sem resultado, anúncio reprovado ou com problema em campanha ativa.
create or replace function public.traffic_alertas(p_ref date default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  d date := coalesce(p_ref, (now() at time zone 'America/Sao_Paulo')::date - 1);
  r record;
  c record;
  out jsonb := '[]'::jsonb;
  contas jsonb := '[]'::jsonb;
  media numeric;
  restante numeric;
  saldo numeric;
  parada boolean;
  ind text;
  r_rec numeric; s_rec numeric; r_base numeric; s_base numeric; cpr_base numeric; cpr_rec numeric;
  n int; nomes text;
begin
  for r in
    select a.id, a.name, a.account_status, a.spend_cap, a.amount_spent_total, a.billing_type, a.payment_method_label,
           a.last_synced_at, a.financial_synced_at,
           coalesce(tc.display_name, regexp_replace(a.name, '^CA\s*-\s*', '')) as cliente,
           (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date_start between d - 6 and d) as gasto7,
           (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
             where i.ad_account_id = a.id and i.level = 'account' and i.date_start = d) as gasto_ontem,
           (select count(*) from public.meta_campaigns cp
             where cp.ad_account_id = a.id and cp.effective_status = 'ACTIVE') as camp_ativas
      from public.meta_ad_accounts a
      left join public.traffic_report_clients tc on tc.ad_account_id = a.id
     where a.is_selected
     order by 10
  loop
    parada := false;
    media := round(r.gasto7 / 7.0, 2);
    contas := contas || jsonb_build_object('cliente', r.cliente, 'gasto_ontem', r.gasto_ontem, 'media_dia', media,
                                           'camp_ativas', r.camp_ativas, 'sync', r.last_synced_at);

    -- 1. status da conta
    if r.account_status is not null and r.account_status <> 1 then
      out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'critico', 'tipo', 'status_conta', 'texto',
        case r.account_status
          when 2 then 'Conta desativada pela Meta.'
          when 3 then 'Conta com pagamento pendente. A Meta para os anúncios até acertar.'
          when 7 then 'Conta em análise de risco pela Meta.'
          when 8 then 'Conta com acerto de pagamento pendente.'
          when 9 then 'Conta em período de carência por pagamento. Acertar antes de parar.'
          when 100 then 'Conta em encerramento.'
          when 101 then 'Conta encerrada.'
          else 'Conta com status ' || r.account_status || ' na Meta.' end);
      parada := true;
    end if;

    -- 2. limite de gasto da conta
    if coalesce(r.spend_cap, 0) > 0 then
      restante := r.spend_cap - coalesce(r.amount_spent_total, 0);
      if restante < 1 and r.camp_ativas > 0 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'critico', 'tipo', 'limite_atingido', 'texto',
          format('Limite de gasto da conta atingido (R$ %s). %s campanha(s) ativa(s) sem entregar até aumentar o limite.',
                 public.traffic_brl(r.spend_cap), r.camp_ativas));
        parada := true;
      elsif media > 0 and restante < media * 3 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'limite_perto', 'texto',
          format('Limite de gasto acaba em cerca de %s dia(s): faltam R$ %s de R$ %s, média de R$ %s por dia.',
                 greatest(1, floor(restante / media))::int, public.traffic_brl(restante), public.traffic_brl(r.spend_cap), public.traffic_brl(media)));
      end if;
    end if;

    -- 3. saldo pré-pago
    if r.billing_type = 'PRE_PAGO' and coalesce(r.payment_method_label, '') ~ 'R\$\s*[0-9.]+,[0-9]{2}' then
      saldo := replace(replace(substring(r.payment_method_label from 'R\$\s*([0-9.]+,[0-9]{2})'), '.', ''), ',', '.')::numeric;
      if saldo < 1 and r.camp_ativas > 0 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'critico', 'tipo', 'saldo_zerado', 'texto',
          'Saldo pré-pago zerado. Anúncios parados até adicionar saldo.');
        parada := true;
      elsif media > 0 and saldo < media * 3 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'saldo_baixo', 'texto',
          format('Saldo pré-pago acaba em cerca de %s dia(s): R$ %s, média de R$ %s por dia.',
                 greatest(1, floor(saldo / media))::int, public.traffic_brl(saldo), public.traffic_brl(media)));
      end if;
    end if;

    if not parada then
      -- 4 e 5. campanhas ativas: entrega e custo por resultado
      for c in
        select cp.name, cp.meta_campaign_id, cp.meta_created_time, cp.start_time,
               (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
                 where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = cp.meta_campaign_id and i.date_start = d) as ontem,
               (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
                 where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = cp.meta_campaign_id and i.date_start between d - 7 and d - 1) as ant7,
               (select coalesce(sum(i.spend), 0) from public.meta_insights_daily i
                 where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = cp.meta_campaign_id and i.date_start between d - 6 and d) as ult7
          from public.meta_campaigns cp
         where cp.ad_account_id = r.id and cp.effective_status = 'ACTIVE'
         order by cp.name
      loop
        if c.ant7 / 7.0 >= 5 and c.ontem < (c.ant7 / 7.0) * 0.3 then
          out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'entrega_caiu', 'texto',
            format('%s: gastou R$ %s ontem, média de R$ %s por dia na semana anterior. Ver entrega.',
                   c.name, public.traffic_brl(c.ontem), public.traffic_brl(c.ant7 / 7.0)));
        elsif c.ult7 = 0 and coalesce(c.start_time, c.meta_created_time) < (d - 3)::timestamptz then
          out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'sem_entrega', 'texto',
            format('%s: ativa e sem gastar nos últimos 7 dias.', c.name));
        end if;

        select i.result_indicator into ind
          from public.meta_insights_daily i
         where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = c.meta_campaign_id
           and i.date_start between d - 9 and d and i.result_indicator is not null and i.result_indicator <> 'mixed'
         group by 1 order by sum(coalesce(i.result_count, 0)) desc limit 1;

        if ind is not null then
          select coalesce(sum(case when i.date_start >= d - 2 then i.result_count end), 0),
                 coalesce(sum(case when i.date_start >= d - 2 then i.spend end), 0),
                 coalesce(sum(case when i.date_start < d - 2 then i.result_count end), 0),
                 coalesce(sum(case when i.date_start < d - 2 then i.spend end), 0)
            into r_rec, s_rec, r_base, s_base
            from public.meta_insights_daily i
           where i.ad_account_id = r.id and i.level = 'campaign' and i.entity_id = c.meta_campaign_id
             and i.date_start between d - 9 and d
             and (i.result_indicator = ind or coalesce(i.result_count, 0) = 0);
          if r_base >= 5 and s_rec >= 20 then
            cpr_base := s_base / r_base;
            if r_rec > 0 then
              cpr_rec := s_rec / r_rec;
              if cpr_rec >= cpr_base * 1.5 then
                out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'custo_subiu', 'texto',
                  format('%s: custo por resultado (%s) subiu %s%%. R$ %s nos últimos 3 dias contra R$ %s nos 7 dias antes.',
                         c.name, public.traffic_indicador(ind), round((cpr_rec / cpr_base - 1) * 100)::int,
                         public.traffic_brl(cpr_rec), public.traffic_brl(cpr_base)));
              end if;
            elsif s_rec >= cpr_base * 2 then
              out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'sem_resultado', 'texto',
                format('%s: R$ %s em 3 dias sem resultado (%s). Antes custava R$ %s cada.',
                       c.name, public.traffic_brl(s_rec), public.traffic_indicador(ind), public.traffic_brl(cpr_base)));
            end if;
          end if;
        end if;
      end loop;

      -- 6. anúncios reprovados ou com problema em campanha e conjunto ativos
      select count(*), string_agg(x.name, ', ' order by x.name)
        into n, nomes
        from (select ad.name
                from public.meta_ads ad
                join public.meta_campaigns cp on cp.id = ad.campaign_id
                join public.meta_adsets s on s.id = ad.adset_id
               where ad.ad_account_id = r.id and ad.effective_status in ('DISAPPROVED', 'WITH_ISSUES')
                 and cp.effective_status = 'ACTIVE' and s.effective_status = 'ACTIVE'
               order by ad.name limit 5) x;
      if n > 0 then
        out := out || jsonb_build_object('cliente', r.cliente, 'nivel', 'atencao', 'tipo', 'anuncio_problema', 'texto',
          format('%s anúncio(s) reprovado(s) ou com problema em campanha ativa: %s.', n, nomes));
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'ref', d,
    'criticos', (select count(*) from jsonb_array_elements(out) e where e->>'nivel' = 'critico'),
    'atencao', (select count(*) from jsonb_array_elements(out) e where e->>'nivel' = 'atencao'),
    'alertas', out,
    'contas', contas);
end
$$;

revoke all on function public.traffic_alertas(date) from public, anon, authenticated;

grant execute on function public.traffic_alertas(date) to service_role;

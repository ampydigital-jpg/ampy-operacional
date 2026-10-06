-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

CREATE OR REPLACE FUNCTION public.traffic_prev_period(p_since date, p_until date, OUT prev_since date, OUT prev_until date)
 RETURNS record
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select
    case
      -- mês inteiro: compara com o mês anterior inteiro
      when extract(day from p_since) = 1 and p_until = (date_trunc('month', p_since) + interval '1 month - 1 day')::date
        then (p_since - interval '1 month')::date
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
$function$;

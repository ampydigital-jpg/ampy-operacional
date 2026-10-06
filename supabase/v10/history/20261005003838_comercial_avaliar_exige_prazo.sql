-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.comercial_avaliar(l comercial_leads)
 returns jsonb
 language plpgsql
 stable
 set search_path to 'public'
as $function$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  corte text := nullif(cfg->>'corte_investimento', '');
  exigir_decisor boolean := coalesce((cfg->>'exigir_decisor')::boolean, true);
  rank_inv int := case l.investimento_faixa when 'ate_1k' then 1 when '1k_3k' then 2 when '3k_5k' then 3 when 'acima_5k' then 4 end;
  rank_corte int := case corte when 'ate_1k' then 1 when '1k_3k' then 2 when '3k_5k' then 3 when 'acima_5k' then 4 end;
  motivo text;
  falta text[] := array[]::text[];
begin
  if l.estagio = 'abrindo' then motivo := 'a empresa ainda não está funcionando';
  elsif l.estagio = 'pessoa_fisica' then motivo := 'não tem empresa, é perfil pessoal';
  elsif l.pedido_tipo = 'avulso' then motivo := 'procura serviço avulso, a Ampy trabalha com acompanhamento mensal';
  elsif rank_corte is not null and rank_inv is not null and rank_inv < rank_corte then motivo := 'investimento abaixo do mínimo';
  elsif exigir_decisor and l.decisor = 'nao' then motivo := 'não decide e quem decide não participa';
  end if;

  if motivo is not null then
    return jsonb_build_object('decisao', 'fora_do_perfil', 'motivo', motivo, 'falta', '[]'::jsonb);
  end if;

  -- Curioso: sem previsão de começar não ganha reunião, recebe formulário e site.
  if l.urgencia = 'sem_prazo' then
    return jsonb_build_object('decisao', 'morno', 'motivo', 'sem previsão para começar, ainda entendendo as possibilidades', 'falta', '[]'::jsonb);
  end if;

  if l.dor is null then falta := array_append(falta, 'motivo do contato'::text); end if;
  if l.empresa is null then falta := array_append(falta, 'empresa'::text); end if;
  if l.estagio is null then falta := array_append(falta, 'se a empresa já está funcionando'::text); end if;
  if l.investimento_faixa is null then falta := array_append(falta, 'investimento'::text); end if;
  if l.urgencia is null then falta := array_append(falta, 'quando quer começar'::text); end if;
  if exigir_decisor and l.decisor is null then falta := array_append(falta, 'quem decide'::text); end if;

  if cardinality(falta) > 0 then
    return jsonb_build_object('decisao', 'falta_info', 'motivo', null, 'falta', to_jsonb(falta));
  end if;
  return jsonb_build_object('decisao', 'pode_agendar', 'motivo', null, 'falta', '[]'::jsonb);
end $function$;

revoke execute on function public.comercial_avaliar(comercial_leads) from public, anon, authenticated;

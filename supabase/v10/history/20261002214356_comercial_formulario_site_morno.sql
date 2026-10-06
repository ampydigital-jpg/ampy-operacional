-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

alter table comercial_leads drop constraint if exists comercial_leads_canal_check;

alter table comercial_leads add constraint comercial_leads_canal_check check (canal = any (array['whatsapp','teste_n8n','formulario']));

alter table comercial_leads
  add column if not exists formulario_enviado_em timestamptz,
  add column if not exists formulario_respondido_em timestamptz;

create table if not exists comercial_formularios (
  id bigserial primary key,
  response_id text not null unique,
  session_id text,
  dados jsonb,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table comercial_formularios enable row level security;

revoke all on comercial_formularios from anon, authenticated;

-- Situação morno: tem perfil, mas está sem previsão e sem investimento definido. Recebe o formulário, não a R1.
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

  if l.urgencia = 'sem_prazo' and l.investimento_faixa = 'nao_definido' then
    return jsonb_build_object('decisao', 'morno', 'motivo', 'ainda entendendo as possibilidades, sem previsão e sem investimento definido', 'falta', '[]'::jsonb);
  end if;

  if l.dor is null then falta := array_append(falta, 'motivo do contato'::text); end if;
  if l.empresa is null then falta := array_append(falta, 'empresa'::text); end if;
  if l.estagio is null then falta := array_append(falta, 'se a empresa já está funcionando'::text); end if;
  if l.investimento_faixa is null then falta := array_append(falta, 'investimento'::text); end if;
  if exigir_decisor and l.decisor is null then falta := array_append(falta, 'quem decide'::text); end if;

  if cardinality(falta) > 0 then
    return jsonb_build_object('decisao', 'falta_info', 'motivo', null, 'falta', to_jsonb(falta));
  end if;
  return jsonb_build_object('decisao', 'pode_agendar', 'motivo', null, 'falta', '[]'::jsonb);
end $function$;

-- Chave de telefone: DDD + 8 últimos dígitos (o WhatsApp às vezes tira o 9 do celular).
create or replace function public.comercial_tel_chave(p text)
 returns text
 language sql
 immutable
 set search_path to 'public'
as $function$
  select case when length(d) >= 10 then substr(d, 1, 2) || right(d, 8) end
  from (select case when length(x) >= 12 and left(x, 2) = '55' then substr(x, 3) else x end as d
        from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as x) a) b
$function$;

-- Resposta do formulário do site: junta no lead certo (link do Alfredo ou mesmo telefone) ou cria um lead novo.
create or replace function public.comercial_formulario(p_response_id text, p_dados jsonb, p_session_hint text default null, p_payload jsonb default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_session text;
  v_tel text;
  novo boolean := false;
  status_antes text;
  dados jsonb := coalesce(p_dados, '{}'::jsonb);
  l comercial_leads;
begin
  if coalesce(p_response_id, '') = '' then
    return jsonb_build_object('ok', false, 'erro', 'response_id obrigatório');
  end if;

  insert into comercial_formularios (response_id, dados, payload) values (p_response_id, dados, p_payload)
  on conflict (response_id) do nothing;
  if not found then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;

  if coalesce(p_session_hint, '') <> '' then
    select session_id into v_session from comercial_leads where session_id = p_session_hint;
  end if;
  if v_session is null and comercial_tel_chave(dados->>'telefone') is not null then
    select session_id into v_session from comercial_leads
    where comercial_tel_chave(telefone) = comercial_tel_chave(dados->>'telefone')
    order by updated_at desc limit 1;
  end if;

  if v_session is null then
    v_session := 'form_' || p_response_id;
    novo := true;
  else
    select status, telefone into status_antes, v_tel from comercial_leads where session_id = v_session;
    -- O telefone do WhatsApp é o que o Alfredo usa para responder: não troca pelo digitado no formulário.
    if v_tel is not null then dados := dados - 'telefone'; end if;
  end if;

  l := comercial_salvar_lead(v_session, dados || jsonb_build_object('canal', 'formulario', 'origem', 'formulario'));
  update comercial_leads set formulario_respondido_em = now() where session_id = v_session returning * into l;
  update comercial_formularios set session_id = v_session where response_id = p_response_id;

  return jsonb_build_object('ok', true, 'duplicado', false, 'lead_novo', novo, 'status_antes', status_antes, 'lead', to_jsonb(l));
end $function$;

revoke execute on function public.comercial_formulario(text, jsonb, text, jsonb) from public, anon, authenticated;

revoke execute on function public.comercial_tel_chave(text) from public, anon, authenticated;

-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Filtro de quem ganha R1. Todo lead é atendido, mas só quem se encaixa recebe reunião.
alter table public.comercial_leads
  add column if not exists estagio text check (estagio in ('operando','abrindo','pessoa_fisica')),
  add column if not exists pedido_tipo text check (pedido_tipo in ('recorrente','avulso')),
  add column if not exists motivo_fora text,
  add column if not exists avaliacao jsonb;

-- Decide se o lead pode ter R1. Critérios configuráveis em comercial_config.
create or replace function public.comercial_avaliar(l public.comercial_leads)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  corte text := nullif(cfg->>'corte_investimento', '');
  exigir_decisor boolean := coalesce((cfg->>'exigir_decisor')::boolean, true);
  rank_inv int := case l.investimento_faixa when 'ate_1k' then 1 when '1k_3k' then 2 when '3k_5k' then 3 when 'acima_5k' then 4 end;
  rank_corte int := case corte when 'ate_1k' then 1 when '1k_3k' then 2 when '3k_5k' then 3 when 'acima_5k' then 4 end;
  motivo text;
  falta text[] := '{}';
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

  if l.dor is null then falta := falta || 'motivo do contato'; end if;
  if l.empresa is null then falta := falta || 'empresa'; end if;
  if l.estagio is null then falta := falta || 'se a empresa já está funcionando'; end if;
  if l.investimento_faixa is null then falta := falta || 'investimento'; end if;
  if exigir_decisor and l.decisor is null then falta := falta || 'quem decide'; end if;

  if array_length(falta, 1) is not null then
    return jsonb_build_object('decisao', 'falta_info', 'motivo', null, 'falta', to_jsonb(falta));
  end if;
  return jsonb_build_object('decisao', 'pode_agendar', 'motivo', null, 'falta', '[]'::jsonb);
end $$;

CREATE OR REPLACE FUNCTION public.comercial_salvar_lead(p_session text, p_dados jsonb)
 RETURNS comercial_leads
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l public.comercial_leads;
  s jsonb;
  a jsonb;
  status_antes text;
  novo_status text;
  colab int := case when coalesce(p_dados->>'colaboradores','') ~ '^\d+$' then (p_dados->>'colaboradores')::int end;
begin
  insert into comercial_leads (session_id, canal, origem, telefone, pode_agendar)
  values (p_session,
          coalesce(nullif(p_dados->>'canal',''), 'whatsapp'),
          nullif(p_dados->>'origem',''),
          nullif(p_dados->>'telefone',''),
          true)
  on conflict (session_id) do nothing;

  select status into status_antes from comercial_leads where session_id = p_session;

  update comercial_leads set
    nome = coalesce(nullif(p_dados->>'nome',''), nome),
    empresa = coalesce(nullif(p_dados->>'empresa',''), empresa),
    segmento = coalesce(nullif(p_dados->>'segmento',''), segmento),
    cidade = coalesce(nullif(p_dados->>'cidade',''), cidade),
    colaboradores = coalesce(colab, colaboradores),
    faturamento_faixa = coalesce(nullif(p_dados->>'faturamento_faixa',''), faturamento_faixa),
    investe_marketing = coalesce(nullif(p_dados->>'investe_marketing',''), investe_marketing),
    marketing_hoje = coalesce(nullif(p_dados->>'marketing_hoje',''), marketing_hoje),
    trafego_pago = coalesce(nullif(p_dados->>'trafego_pago',''), trafego_pago),
    investimento_faixa = coalesce(nullif(p_dados->>'investimento_faixa',''), investimento_faixa),
    dor = coalesce(nullif(p_dados->>'dor',''), dor),
    decisor = coalesce(nullif(p_dados->>'decisor',''), decisor),
    urgencia = coalesce(nullif(p_dados->>'urgencia',''), urgencia),
    estagio = coalesce(nullif(p_dados->>'estagio',''), estagio),
    pedido_tipo = coalesce(nullif(p_dados->>'pedido_tipo',''), pedido_tipo),
    email = coalesce(nullif(lower(trim(p_dados->>'email')),''), email),
    telefone = coalesce(nullif(p_dados->>'telefone',''), telefone),
    origem = coalesce(origem, nullif(p_dados->>'origem','')),
    ad_id = coalesce(ad_id, nullif(p_dados->>'ad_id','')),
    ctwa_clid = coalesce(ctwa_clid, nullif(p_dados->>'ctwa_clid','')),
    campanha = coalesce(campanha, nullif(p_dados->>'campanha','')),
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo),
    updated_at = now()
  where session_id = p_session
  returning * into l;

  s := comercial_pontuar(l);
  a := comercial_avaliar(l);

  novo_status := case
    when l.status in ('agendado','humano','compareceu','nao_compareceu') then l.status
    when a->>'decisao' = 'fora_do_perfil' then 'desqualificado'
    when l.status = 'desqualificado' then 'em_conversa'
    else l.status end;

  a := a || jsonb_build_object('acabou_de_ficar_fora', novo_status = 'desqualificado' and coalesce(status_antes, '') <> 'desqualificado');

  update comercial_leads set
    score = (s->>'score')::int,
    temperatura = s->>'temperatura',
    score_detalhe = s,
    avaliacao = a,
    pode_agendar = (a->>'decisao') <> 'fora_do_perfil',
    motivo_fora = case when a->>'decisao' = 'fora_do_perfil' then a->>'motivo' end,
    status = novo_status
  where id = l.id
  returning * into l;
  return l;
end $function$;

CREATE OR REPLACE FUNCTION public.comercial_agendar(p_session text, p_inicio timestamp with time zone, p_formato text DEFAULT 'online'::text, p_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  dur int := (cfg->>'duracao_min')::int;
  l comercial_leads;
  r comercial_reunioes;
  a jsonb;
  local_t time := (p_inicio at time zone 'America/Sao_Paulo')::time;
  valido boolean;
begin
  select * into l from comercial_leads where session_id = p_session;
  if l.id is null then
    return jsonb_build_object('ok', false, 'erro', 'lead não encontrado, chame salvar_lead antes de agendar');
  end if;

  -- Filtro: só agenda quem se encaixa (reagendamento de quem já tem reunião passa).
  if l.status <> 'agendado' then
    a := comercial_avaliar(l);
    if a->>'decisao' = 'fora_do_perfil' then
      return jsonb_build_object('ok', false, 'erro', 'lead fora do perfil (' || (a->>'motivo') || '). Não agende, faça o encerramento');
    elsif a->>'decisao' = 'falta_info' then
      return jsonb_build_object('ok', false, 'erro', 'antes de agendar falta saber ' || array_to_string(array(select jsonb_array_elements_text(a->'falta')), ', ') || '. Pergunte isso e depois agende');
    end if;
  end if;

  if p_inicio < now() + make_interval(mins => (cfg->>'antecedencia_min')::int) then
    return jsonb_build_object('ok', false, 'erro', 'horário muito próximo ou passado, consulte os horários de novo');
  end if;
  select exists (
    select 1 from jsonb_array_elements(cfg->'janelas') w
    where local_t >= (w->>0)::time and local_t + make_interval(mins => dur) <= (w->>1)::time
  ) and extract(isodow from p_inicio at time zone 'America/Sao_Paulo')::int in (select jsonb_array_elements_text(cfg->'dias_semana')::int)
  into valido;
  if not valido then return jsonb_build_object('ok', false, 'erro', 'fora do horário de atendimento, consulte os horários de novo'); end if;
  if exists (select 1 from comercial_reunioes x where x.status in ('agendada','confirmada') and x.lead_id <> l.id
             and tstzrange(x.inicio, x.fim) && tstzrange(p_inicio, p_inicio + make_interval(mins => dur))) then
    return jsonb_build_object('ok', false, 'erro', 'horário acabou de ser ocupado, consulte os horários de novo');
  end if;

  update comercial_reunioes set status = 'reagendada'
  where lead_id = l.id and status in ('agendada','confirmada');

  insert into comercial_reunioes (lead_id, inicio, fim, formato, responsavel)
  values (l.id, p_inicio, p_inicio + make_interval(mins => dur), coalesce(nullif(p_formato,''),'online'), cfg->>'responsavel')
  returning * into r;

  update comercial_leads set status = 'agendado', email = coalesce(nullif(lower(trim(p_email)),''), email)
  where id = l.id returning * into l;

  return jsonb_build_object(
    'ok', true,
    'reuniao_id', r.id,
    'inicio', r.inicio, 'fim', r.fim,
    'rotulo', comercial_rotulo(r.inicio),
    'formato', r.formato,
    'endereco', case when r.formato = 'presencial' then cfg->>'endereco_presencial' end,
    'responsavel', r.responsavel,
    'lead', jsonb_build_object('nome', l.nome, 'empresa', l.empresa, 'segmento', l.segmento, 'cidade', l.cidade,
      'faturamento_faixa', l.faturamento_faixa, 'colaboradores', l.colaboradores, 'dor', l.dor, 'investe_marketing', l.investe_marketing,
      'marketing_hoje', l.marketing_hoje, 'trafego_pago', l.trafego_pago, 'investimento_faixa', l.investimento_faixa,
      'decisor', l.decisor, 'urgencia', l.urgencia, 'temperatura', l.temperatura, 'score', l.score, 'score_detalhe', l.score_detalhe,
      'email', l.email, 'telefone', l.telefone, 'origem', l.origem, 'ad_id', l.ad_id, 'campanha', l.campanha,
      'estagio', l.estagio, 'pedido_tipo', l.pedido_tipo)
  );
end $function$;

revoke execute on function public.comercial_avaliar(public.comercial_leads) from public, anon, authenticated;

grant execute on function public.comercial_avaliar(public.comercial_leads) to service_role;

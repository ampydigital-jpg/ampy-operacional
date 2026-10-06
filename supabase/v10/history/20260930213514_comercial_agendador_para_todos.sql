-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Agente passa a ser agendador: todo lead pode marcar a R1. Temperatura continua calculada, só para informar o closer.
create or replace function public.comercial_salvar_lead(p_session text, p_dados jsonb)
returns public.comercial_leads language plpgsql security definer set search_path = public as $$
declare
  l public.comercial_leads;
  alto boolean;
  dec_ok boolean;
  urg_ok boolean;
begin
  insert into comercial_leads (session_id, canal, origem, telefone, pode_agendar)
  values (p_session,
          coalesce(nullif(p_dados->>'canal',''), 'whatsapp'),
          nullif(p_dados->>'origem',''),
          nullif(p_dados->>'telefone',''),
          true)
  on conflict (session_id) do nothing;

  update comercial_leads set
    nome = coalesce(nullif(p_dados->>'nome',''), nome),
    empresa = coalesce(nullif(p_dados->>'empresa',''), empresa),
    segmento = coalesce(nullif(p_dados->>'segmento',''), segmento),
    cidade = coalesce(nullif(p_dados->>'cidade',''), cidade),
    faturamento_faixa = coalesce(nullif(p_dados->>'faturamento_faixa',''), faturamento_faixa),
    investe_marketing = coalesce(nullif(p_dados->>'investe_marketing',''), investe_marketing),
    dor = coalesce(nullif(p_dados->>'dor',''), dor),
    decisor = coalesce(nullif(p_dados->>'decisor',''), decisor),
    urgencia = coalesce(nullif(p_dados->>'urgencia',''), urgencia),
    email = coalesce(nullif(lower(trim(p_dados->>'email')),''), email),
    telefone = coalesce(nullif(p_dados->>'telefone',''), telefone),
    origem = coalesce(nullif(p_dados->>'origem',''), origem),
    ad_id = coalesce(nullif(p_dados->>'ad_id',''), ad_id),
    ctwa_clid = coalesce(nullif(p_dados->>'ctwa_clid',''), ctwa_clid),
    campanha = coalesce(nullif(p_dados->>'campanha',''), campanha),
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo),
    pode_agendar = true
  where session_id = p_session
  returning * into l;

  if l.faturamento_faixa is not null then
    alto := l.faturamento_faixa in ('50k_100k','acima_100k');
    dec_ok := coalesce(l.decisor in ('sim','participa'), false);
    urg_ok := coalesce(l.urgencia in ('imediato','30_dias'), false);
    l.temperatura := case when not alto then 'frio' when dec_ok and urg_ok then 'quente' else 'morno' end;
    update comercial_leads set
      temperatura = l.temperatura,
      status = case
        when status in ('agendado','compareceu','nao_compareceu','humano') then status
        else 'em_conversa' end
    where id = l.id
    returning * into l;
  end if;
  return l;
end $$;

create or replace function public.comercial_agendar(p_session text, p_inicio timestamptz, p_formato text default 'online', p_email text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  dur int := (cfg->>'duracao_min')::int;
  l comercial_leads;
  r comercial_reunioes;
  local_t time := (p_inicio at time zone 'America/Sao_Paulo')::time;
  valido boolean;
begin
  select * into l from comercial_leads where session_id = p_session;
  if l.id is null then
    insert into comercial_leads (session_id, pode_agendar) values (p_session, true) returning * into l;
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
      'faturamento_faixa', l.faturamento_faixa, 'dor', l.dor, 'investe_marketing', l.investe_marketing,
      'decisor', l.decisor, 'urgencia', l.urgencia, 'temperatura', l.temperatura, 'email', l.email, 'telefone', l.telefone, 'origem', l.origem)
  );
end $$;

revoke all on function public.comercial_salvar_lead(text, jsonb) from public, anon, authenticated;

revoke all on function public.comercial_agendar(text, timestamptz, text, text) from public, anon, authenticated;

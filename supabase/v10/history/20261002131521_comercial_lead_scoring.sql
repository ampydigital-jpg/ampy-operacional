-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

alter table public.comercial_leads
  add column if not exists marketing_hoje text,
  add column if not exists trafego_pago text,
  add column if not exists investimento_faixa text,
  add column if not exists score integer,
  add column if not exists score_detalhe jsonb;

comment on column public.comercial_leads.marketing_hoje is 'nunca | ja_trabalhou | sozinho | equipe_interna | agencia_freela (mesmas opções do formulário da landing page)';

comment on column public.comercial_leads.trafego_pago is 'nunca | nao_sabe | ja_investiu | atualmente';

comment on column public.comercial_leads.investimento_faixa is 'nao_definido | ate_1k | 1k_3k | 3k_5k | acima_5k (investimento mensal que imagina para marketing)';

comment on column public.comercial_leads.score is 'Pontuação 0 a 100 do lead (comercial_pontuar)';

create or replace function public.comercial_pontuar(l public.comercial_leads)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  p_colab int := case
    when l.colaboradores is null then null
    when l.colaboradores <= 5 then 5
    when l.colaboradores <= 10 then 15
    when l.colaboradores <= 20 then 22
    else 25 end;
  p_fat int := case l.faturamento_faixa
    when 'acima_100k' then 25 when '50k_100k' then 22 when '20k_50k' then 12 when 'ate_20k' then 5 end;
  p_porte int := greatest(p_colab, p_fat);
  p_mkt int := case l.marketing_hoje
    when 'agencia_freela' then 15 when 'equipe_interna' then 12 when 'ja_trabalhou' then 10 when 'sozinho' then 6 when 'nunca' then 0 end;
  p_traf int := case l.trafego_pago
    when 'atualmente' then 15 when 'ja_investiu' then 8 when 'nunca' then 0 when 'nao_sabe' then 0 end;
  p_inv int := case l.investimento_faixa
    when 'acima_5k' then 25 when '3k_5k' then 18 when '1k_3k' then 10 when 'ate_1k' then 3 when 'nao_definido' then 3 end;
  p_urg int := case l.urgencia
    when 'imediato' then 15 when '30_dias' then 15 when '90_dias' then 8 when 'sem_prazo' then 2 end;
  p_dec int := case l.decisor
    when 'sim' then 5 when 'participa' then 5 when 'nao' then 0 end;
  total int := coalesce(p_porte,0) + coalesce(p_mkt,0) + coalesce(p_traf,0) + coalesce(p_inv,0) + coalesce(p_urg,0) + coalesce(p_dec,0);
  faltando text[] := array_remove(array[
    case when p_porte is null then 'porte' end,
    case when p_mkt is null then 'marketing_hoje' end,
    case when p_traf is null then 'trafego_pago' end,
    case when p_inv is null then 'investimento_faixa' end,
    case when p_urg is null then 'urgencia' end,
    case when p_dec is null then 'decisor' end
  ], null);
begin
  return jsonb_build_object(
    'score', total,
    'temperatura', case when total >= 65 then 'quente' when total >= 40 then 'morno' else 'frio' end,
    'pontos', jsonb_build_object(
      'porte', p_porte, 'marketing_hoje', p_mkt, 'trafego_pago', p_traf,
      'investimento', p_inv, 'urgencia', p_urg, 'decisor', p_dec),
    'faltando', to_jsonb(faltando)
  );
end $function$;

create or replace function public.comercial_salvar_lead(p_session text, p_dados jsonb)
returns public.comercial_leads
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l public.comercial_leads;
  s jsonb;
  colab int := case when coalesce(p_dados->>'colaboradores','') ~ '^\d+$' then (p_dados->>'colaboradores')::int end;
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
    colaboradores = coalesce(colab, colaboradores),
    faturamento_faixa = coalesce(nullif(p_dados->>'faturamento_faixa',''), faturamento_faixa),
    investe_marketing = coalesce(nullif(p_dados->>'investe_marketing',''), investe_marketing),
    marketing_hoje = coalesce(nullif(p_dados->>'marketing_hoje',''), marketing_hoje),
    trafego_pago = coalesce(nullif(p_dados->>'trafego_pago',''), trafego_pago),
    investimento_faixa = coalesce(nullif(p_dados->>'investimento_faixa',''), investimento_faixa),
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

  s := comercial_pontuar(l);
  update comercial_leads set
    score = (s->>'score')::int,
    temperatura = s->>'temperatura',
    score_detalhe = s
  where id = l.id
  returning * into l;
  return l;
end $function$;

create or replace function public.comercial_agendar(p_session text, p_inicio timestamp with time zone, p_formato text default 'online'::text, p_email text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
      'faturamento_faixa', l.faturamento_faixa, 'colaboradores', l.colaboradores, 'dor', l.dor, 'investe_marketing', l.investe_marketing,
      'marketing_hoje', l.marketing_hoje, 'trafego_pago', l.trafego_pago, 'investimento_faixa', l.investimento_faixa,
      'decisor', l.decisor, 'urgencia', l.urgencia, 'temperatura', l.temperatura, 'score', l.score, 'score_detalhe', l.score_detalhe,
      'email', l.email, 'telefone', l.telefone, 'origem', l.origem)
  );
end $function$;

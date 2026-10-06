-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Agente SDR da Ampy Digital: leads, reuniões R1 e configuração de agenda.

create table if not exists public.comercial_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.comercial_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  session_id text not null unique,
  canal text not null default 'whatsapp' check (canal in ('whatsapp','teste_n8n')),
  origem text check (origem in ('anuncio','formulario','organico','teste')),
  telefone text,
  nome text,
  empresa text,
  segmento text,
  cidade text,
  faturamento_faixa text check (faturamento_faixa in ('ate_20k','20k_50k','50k_100k','acima_100k')),
  investe_marketing text,
  dor text,
  decisor text check (decisor in ('sim','nao','participa')),
  urgencia text check (urgencia in ('imediato','30_dias','90_dias','sem_prazo')),
  temperatura text check (temperatura in ('quente','morno','frio')),
  pode_agendar boolean not null default false,
  status text not null default 'em_conversa' check (status in ('em_conversa','qualificado','agendado','desqualificado','sem_resposta','humano','compareceu','nao_compareceu')),
  email text,
  ad_id text,
  ctwa_clid text,
  campanha text,
  resumo text
);

create table if not exists public.comercial_reunioes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.comercial_leads(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  formato text not null default 'online' check (formato in ('online','presencial')),
  status text not null default 'agendada' check (status in ('agendada','confirmada','reagendada','cancelada','realizada','no_show')),
  responsavel text,
  google_event_id text,
  meet_link text,
  lembrete_24h_em timestamptz,
  lembrete_2h_em timestamptz
);

create unique index if not exists comercial_reunioes_slot_ativo
  on public.comercial_reunioes (inicio) where status in ('agendada','confirmada');

create index if not exists comercial_reunioes_lead on public.comercial_reunioes (lead_id);

alter table public.comercial_config enable row level security;

alter table public.comercial_leads enable row level security;

alter table public.comercial_reunioes enable row level security;

-- Sem políticas: acesso só pelo service_role (função do agente). Dados de lead não ficam expostos.

create or replace function public.comercial_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists comercial_leads_touch on public.comercial_leads;

create trigger comercial_leads_touch before update on public.comercial_leads for each row execute function public.comercial_touch();

drop trigger if exists comercial_reunioes_touch on public.comercial_reunioes;

create trigger comercial_reunioes_touch before update on public.comercial_reunioes for each row execute function public.comercial_touch();

-- Rótulo pt-BR: "quinta, 02/10 às 10h"
create or replace function public.comercial_rotulo(p timestamptz) returns text language sql immutable as $$
  select (array['segunda','terça','quarta','quinta','sexta','sábado','domingo'])[extract(isodow from p at time zone 'America/Sao_Paulo')::int]
    || ', ' || to_char(p at time zone 'America/Sao_Paulo', 'DD/MM')
    || ' às ' || to_char(p at time zone 'America/Sao_Paulo', 'FMHH24')
    || case when extract(minute from p at time zone 'America/Sao_Paulo') = 0 then 'h' else 'h' || to_char(p at time zone 'America/Sao_Paulo', 'MI') end
$$;

-- Salva/atualiza o lead e calcula temperatura e se pode agendar.
create or replace function public.comercial_salvar_lead(p_session text, p_dados jsonb)
returns public.comercial_leads language plpgsql security definer set search_path = public as $$
declare
  l public.comercial_leads;
  alto boolean;
begin
  insert into comercial_leads (session_id, canal, origem, telefone)
  values (p_session,
          coalesce(nullif(p_dados->>'canal',''), 'whatsapp'),
          nullif(p_dados->>'origem',''),
          nullif(p_dados->>'telefone',''))
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
    resumo = coalesce(nullif(p_dados->>'resumo',''), resumo)
  where session_id = p_session
  returning * into l;

  if l.faturamento_faixa is not null then
    alto := l.faturamento_faixa in ('50k_100k','acima_100k');
    if not alto then
      l.temperatura := 'frio'; l.pode_agendar := false;
    elsif l.decisor in ('sim','participa') and l.urgencia in ('imediato','30_dias') then
      l.temperatura := 'quente'; l.pode_agendar := true;
    else
      l.temperatura := 'morno'; l.pode_agendar := l.decisor in ('sim','participa');
    end if;
    update comercial_leads set
      temperatura = l.temperatura,
      pode_agendar = l.pode_agendar,
      status = case
        when status in ('agendado','compareceu','nao_compareceu','humano') then status
        when l.temperatura = 'frio' then 'desqualificado'
        when l.pode_agendar then 'qualificado'
        else status end
    where id = l.id
    returning * into l;
  end if;
  return l;
end $$;

-- Horários livres para a R1, no máximo 2 por dia para variar as opções.
create or replace function public.comercial_horarios_livres(p_limite int default 6)
returns table (inicio timestamptz, fim timestamptz, rotulo text)
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := (select jsonb_object_agg(key, value) from comercial_config);
  dur int := (cfg->>'duracao_min')::int;
  passo int := (cfg->>'intervalo_slot_min')::int;
  antec int := (cfg->>'antecedencia_min')::int;
  dias int := (cfg->>'dias_busca')::int;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  return query
  with d as (
    select (hoje + g)::date as dia from generate_series(0, dias) g
  ), dd as (
    select dia from d where extract(isodow from dia)::int in (select jsonb_array_elements_text(cfg->'dias_semana')::int)
  ), j as (
    select dia, (w->>0)::time as ini, (w->>1)::time as fimj
    from dd cross join jsonb_array_elements(cfg->'janelas') w
  ), s as (
    select ((dia + t) at time zone 'America/Sao_Paulo') as ini_ts, dia
    from j cross join lateral generate_series(ini, fimj - make_interval(mins => dur), make_interval(mins => passo)) t
  ), livres as (
    select s.ini_ts, s.ini_ts + make_interval(mins => dur) as fim_ts, s.dia
    from s
    where s.ini_ts >= now() + make_interval(mins => antec)
      and not exists (
        select 1 from comercial_reunioes r
        where r.status in ('agendada','confirmada')
          and tstzrange(r.inicio, r.fim) && tstzrange(s.ini_ts, s.ini_ts + make_interval(mins => dur))
      )
  ), rank as (
    select *, row_number() over (partition by dia order by ini_ts) as n,
           case when extract(hour from ini_ts at time zone 'America/Sao_Paulo') < 12 then 0 else 1 end as turno
    from livres
  ), pick as (
    -- primeiro horário da manhã e primeiro da tarde de cada dia
    select ini_ts, fim_ts from (
      select *, row_number() over (partition by dia, turno order by ini_ts) as nt from rank
    ) x where nt = 1
  )
  select p.ini_ts, p.fim_ts, comercial_rotulo(p.ini_ts) from pick p order by p.ini_ts limit p_limite;
end $$;

-- Agenda a R1 validando que o horário está livre.
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
  if l.id is null then return jsonb_build_object('ok', false, 'erro', 'lead não encontrado, salve o lead antes'); end if;
  if not l.pode_agendar then return jsonb_build_object('ok', false, 'erro', 'lead não qualificado para R1', 'temperatura', l.temperatura); end if;
  if p_inicio < now() + make_interval(mins => (cfg->>'antecedencia_min')::int) then
    return jsonb_build_object('ok', false, 'erro', 'horário muito próximo ou passado, consulte os horários de novo');
  end if;
  select exists (
    select 1 from jsonb_array_elements(cfg->'janelas') w
    where local_t >= (w->>0)::time and local_t + make_interval(mins => dur) <= (w->>1)::time
  ) and extract(isodow from p_inicio at time zone 'America/Sao_Paulo')::int in (select jsonb_array_elements_text(cfg->'dias_semana')::int)
  into valido;
  if not valido then return jsonb_build_object('ok', false, 'erro', 'fora do horário de atendimento, consulte os horários de novo'); end if;
  if exists (select 1 from comercial_reunioes x where x.status in ('agendada','confirmada')
             and tstzrange(x.inicio, x.fim) && tstzrange(p_inicio, p_inicio + make_interval(mins => dur))) then
    return jsonb_build_object('ok', false, 'erro', 'horário acabou de ser ocupado, consulte os horários de novo');
  end if;

  -- Reagendamento: cancela reunião ativa anterior do mesmo lead.
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

revoke all on function public.comercial_horarios_livres(int) from public, anon, authenticated;

revoke all on function public.comercial_agendar(text, timestamptz, text, text) from public, anon, authenticated;

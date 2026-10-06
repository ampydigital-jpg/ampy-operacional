-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

-- Mensagens do WhatsApp do Alfredo: histórico, junção de mensagens picadas e eco do atendimento humano.
create table if not exists public.comercial_mensagens (
  id bigint generated always as identity primary key,
  session_id text not null,
  direcao text not null check (direcao in ('lead','alfredo','humano')),
  texto text not null,
  wa_id text unique,
  processada boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists comercial_mensagens_sessao_idx on public.comercial_mensagens (session_id, id);

alter table public.comercial_mensagens enable row level security;

revoke all on public.comercial_mensagens from anon, authenticated;

-- Grava uma mensagem. Devolve id, se era duplicada (wa_id repetido) e o status do lead.
create or replace function public.comercial_registrar_mensagem(p_session text, p_direcao text, p_texto text, p_wa_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_status text;
begin
  insert into comercial_mensagens (session_id, direcao, texto, wa_id, processada)
  values (p_session, p_direcao, coalesce(p_texto, ''), nullif(p_wa_id, ''), p_direcao <> 'lead')
  on conflict (wa_id) do nothing
  returning id into v_id;
  select status into v_status from comercial_leads where session_id = p_session;
  return jsonb_build_object('ok', true, 'mensagem_id', v_id, 'duplicada', v_id is null, 'status', v_status);
end $$;

-- Junta as mensagens do lead que ainda não foram respondidas.
-- Só processa se p_ultimo for a última mensagem do lead (as anteriores esperam por ela).
create or replace function public.comercial_lote(p_session text, p_ultimo bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max bigint;
  v_min bigint;
  v_novas text;
  v_hist text;
  v_status text;
begin
  perform pg_advisory_xact_lock(hashtext('comercial_lote:' || p_session));

  select max(id) into v_max from comercial_mensagens where session_id = p_session and direcao = 'lead';
  if v_max is null or v_max > p_ultimo then
    return jsonb_build_object('processar', false, 'motivo', 'chegou mensagem mais nova');
  end if;

  select min(id), string_agg(texto, E'\n' order by id) into v_min, v_novas
  from comercial_mensagens where session_id = p_session and direcao = 'lead' and not processada;
  if v_novas is null then
    return jsonb_build_object('processar', false, 'motivo', 'já respondido');
  end if;

  update comercial_mensagens set processada = true
  where session_id = p_session and direcao = 'lead' and not processada;

  select status into v_status from comercial_leads where session_id = p_session;
  if v_status = 'humano' then
    return jsonb_build_object('processar', false, 'motivo', 'atendimento humano');
  end if;

  select string_agg(
           case direcao when 'lead' then 'Lead: ' when 'alfredo' then 'Alfredo: ' else 'Equipe Ampy: ' end || texto,
           E'\n' order by id)
    into v_hist
  from (select id, direcao, texto from comercial_mensagens
        where session_id = p_session and id < v_min
        order by id desc limit 40) t;

  return jsonb_build_object(
    'processar', true,
    'novas', v_novas,
    'historico', coalesce(v_hist, ''),
    'primeira_conversa', v_hist is null,
    'status', v_status
  );
end $$;

-- Mensagem enviada pelo celular (fromMe) que não foi o Alfredo: alguém da equipe assumiu.
create or replace function public.comercial_eco(p_session text, p_texto text, p_wa_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_wa_id is not null and exists (select 1 from comercial_mensagens where wa_id = p_wa_id) then
    return jsonb_build_object('ok', true, 'ignorado', true);
  end if;
  insert into comercial_mensagens (session_id, direcao, texto, wa_id, processada)
  values (p_session, 'humano', coalesce(p_texto, ''), nullif(p_wa_id, ''), true)
  on conflict (wa_id) do nothing;
  update comercial_leads set status = 'humano', updated_at = now()
  where session_id = p_session and status <> 'humano';
  return jsonb_build_object('ok', true, 'ignorado', false, 'status', 'humano');
end $$;

revoke execute on function public.comercial_registrar_mensagem(text, text, text, text) from public, anon, authenticated;

revoke execute on function public.comercial_lote(text, bigint) from public, anon, authenticated;

revoke execute on function public.comercial_eco(text, text, text) from public, anon, authenticated;

grant execute on function public.comercial_registrar_mensagem(text, text, text, text) to service_role;

grant execute on function public.comercial_lote(text, bigint) to service_role;

grant execute on function public.comercial_eco(text, text, text) to service_role;

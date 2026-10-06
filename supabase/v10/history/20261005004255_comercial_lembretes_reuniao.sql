-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.comercial_lembretes_pendentes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with cfg as (select coalesce((select value #>> '{}' from comercial_config where key = 'responsavel'), 'Willian') as resp),
  base as (
    select r.id, r.inicio, r.meet_link, r.created_at, r.lembrete_24h_em, r.lembrete_2h_em,
           l.session_id, regexp_replace(coalesce(l.telefone, ''), '\D', '', 'g') as telefone,
           nullif(split_part(trim(coalesce(l.nome, '')), ' ', 1), '') as primeiro_nome,
           case when (r.inicio at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date then 'hoje' else 'amanhã' end as quando,
           extract(hour from r.inicio at time zone 'America/Sao_Paulo')::int as hora,
           extract(minute from r.inicio at time zone 'America/Sao_Paulo')::int as minuto
    from comercial_reunioes r
    join comercial_leads l on l.id = r.lead_id
    where r.status in ('agendada', 'confirmada', 'reagendada')
      and l.status <> 'humano'
      and l.session_id like 'wa\_%'
      and r.inicio > now()
  ),
  pend as (
    select b.*, '24h'::text as tipo from base b
    where b.lembrete_24h_em is null
      and now() >= b.inicio - interval '24 hours' and now() < b.inicio - interval '4 hours'
      and b.created_at < b.inicio - interval '20 hours'
    union all
    select b.*, '2h'::text from base b
    where b.lembrete_2h_em is null
      and now() >= b.inicio - interval '2 hours' and now() < b.inicio - interval '20 minutes'
      and b.created_at < b.inicio - interval '3 hours'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'reuniao_id', p.id,
    'tipo', p.tipo,
    'session_id', p.session_id,
    'telefone', p.telefone,
    'texto', case p.tipo
      when '24h' then
        'Oi' || coalesce(', ' || p.primeiro_nome, '') || '! Passando para lembrar da nossa conversa ' || p.quando || ', ' || comercial_rotulo(p.inicio)
        || ', com o ' || (select resp from cfg) || ', nosso responsável comercial.'
        || coalesce(' O link é ' || p.meet_link, '')
        || ' 😊 Se precisar mudar o horário, é só me avisar por aqui.'
      else
        'Oi' || coalesce(', ' || p.primeiro_nome, '') || '! Daqui a pouco, às ' || p.hora || 'h' || case when p.minuto > 0 then lpad(p.minuto::text, 2, '0') else '' end
        || ', é a nossa conversa com o ' || (select resp from cfg) || '.'
        || coalesce(' O link é ' || p.meet_link, '')
        || ' Até já!'
    end
  ) order by p.inicio), '[]'::jsonb)
  from pend p
  where length(p.telefone) between 10 and 13;
$$;

create or replace function public.comercial_lembrete_marcar(p_reuniao uuid, p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo = '24h' then
    update comercial_reunioes set lembrete_24h_em = now(), updated_at = now() where id = p_reuniao;
  elsif p_tipo = '2h' then
    update comercial_reunioes set lembrete_2h_em = now(), updated_at = now() where id = p_reuniao;
  else
    return jsonb_build_object('ok', false, 'erro', 'tipo deve ser 24h ou 2h');
  end if;
  return jsonb_build_object('ok', found);
end $$;

revoke execute on function public.comercial_lembretes_pendentes() from public, anon, authenticated;

revoke execute on function public.comercial_lembrete_marcar(uuid, text) from public, anon, authenticated;

grant execute on function public.comercial_lembretes_pendentes() to service_role;

grant execute on function public.comercial_lembrete_marcar(uuid, text) to service_role;

comment on function public.comercial_lembretes_pendentes() is '[comercial | Alfredo] Lembretes de reunião a enviar agora (24h e 2h antes), com o texto pronto.';

comment on function public.comercial_lembrete_marcar(uuid, text) is '[comercial | Alfredo] Marca o lembrete de reunião como enviado.';

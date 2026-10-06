-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.comercial_resumo_semana(p_since date default null, p_until date default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
per as (
  select coalesce(p_since, (select d - (extract(isodow from d)::int - 1) - 7 from hoje)) as s,
         coalesce(p_until, (select d - (extract(isodow from d)::int - 1) - 1 from hoje)) as u
),
leads as (
  select l.*, (l.created_at at time zone 'America/Sao_Paulo')::date as dia,
         exists (select 1 from public.comercial_reunioes r where r.lead_id = l.id and r.status <> 'cancelada') as tem_r1
  from public.comercial_leads l, per
  where (l.created_at at time zone 'America/Sao_Paulo')::date between per.s and per.u
    and coalesce(l.origem, '') <> 'teste'
    and l.session_id not ilike 'teste%'
),
cls as (
  select l.*,
    case when l.tem_r1 then 'r1'
         when l.status = 'desqualificado' or l.motivo_fora is not null then 'fora'
         when l.formulario_enviado_em is not null then 'morno'
         when l.status = 'humano' then 'humano'
         else 'em_conversa' end as resultado
  from leads l
),
reun as (
  select r.inicio, r.status, r.meet_link, l.nome, l.empresa
  from public.comercial_reunioes r
  join public.comercial_leads l on l.id = r.lead_id
  where l.session_id not ilike 'teste%' and coalesce(l.origem, '') <> 'teste'
)
select jsonb_build_object(
  'periodo', (select jsonb_build_object('since', s, 'until', u) from per),
  'totais', jsonb_build_object(
    'leads', (select count(*) from cls),
    'r1', (select count(*) from cls where resultado = 'r1'),
    'morno', (select count(*) from cls where resultado = 'morno'),
    'fora', (select count(*) from cls where resultado = 'fora'),
    'humano', (select count(*) from cls where resultado = 'humano'),
    'em_conversa', (select count(*) from cls where resultado = 'em_conversa'),
    'anuncio', (select count(*) from cls where origem = 'anuncio'),
    'organico', (select count(*) from cls where origem = 'organico'),
    'formulario', (select count(*) from cls where origem = 'formulario')
  ),
  'campanhas', coalesce((
    select jsonb_agg(jsonb_build_object('campanha', c, 'leads', n, 'r1', r1) order by n desc)
    from (select coalesce(nullif(campanha, ''), '(sem nome)') as c, count(*) as n, count(*) filter (where resultado = 'r1') as r1
          from cls where origem = 'anuncio' group by 1) x), '[]'::jsonb),
  'reunioes_semana', coalesce((
    select jsonb_agg(jsonb_build_object('inicio', inicio, 'status', status, 'nome', nome, 'empresa', empresa) order by inicio)
    from reun, per where (inicio at time zone 'America/Sao_Paulo')::date between per.s and per.u), '[]'::jsonb),
  'proximas_reunioes', coalesce((
    select jsonb_agg(jsonb_build_object('inicio', inicio, 'status', status, 'nome', nome, 'empresa', empresa, 'meet', meet_link) order by inicio)
    from reun where inicio > now() and status in ('agendada', 'confirmada', 'reagendada')), '[]'::jsonb),
  'leads', coalesce((
    select jsonb_agg(jsonb_build_object('dia', dia, 'nome', nome, 'empresa', empresa, 'segmento', segmento, 'cidade', cidade,
      'resultado', resultado, 'temperatura', temperatura, 'score', score, 'origem', origem, 'campanha', campanha,
      'motivo_fora', motivo_fora, 'telefone', telefone) order by created_at)
    from cls), '[]'::jsonb)
);
$$;

revoke all on function public.comercial_resumo_semana(date, date) from public, anon, authenticated;

grant execute on function public.comercial_resumo_semana(date, date) to service_role;

comment on function public.comercial_resumo_semana(date, date) is '[comercial | Alfredo] Resumo dos leads da semana (segunda a domingo) para o email de segunda. Ignora testes.';

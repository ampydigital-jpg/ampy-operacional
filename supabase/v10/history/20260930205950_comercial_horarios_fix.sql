-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

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
    select d.dia from d where extract(isodow from d.dia)::int in (select jsonb_array_elements_text(cfg->'dias_semana')::int)
  ), j as (
    select dd.dia, (dd.dia + (w->>0)::time) as ini, (dd.dia + (w->>1)::time) as fimj
    from dd cross join jsonb_array_elements(cfg->'janelas') w
  ), s as (
    select (t at time zone 'America/Sao_Paulo') as ini_ts, j.dia,
           case when t::time < '12:00' then 0 else 1 end as turno
    from j cross join lateral generate_series(j.ini, j.fimj - make_interval(mins => dur), make_interval(mins => passo)) t
  ), livres as (
    select s.ini_ts, s.ini_ts + make_interval(mins => dur) as fim_ts, s.dia, s.turno
    from s
    where s.ini_ts >= now() + make_interval(mins => antec)
      and not exists (
        select 1 from comercial_reunioes r
        where r.status in ('agendada','confirmada')
          and tstzrange(r.inicio, r.fim) && tstzrange(s.ini_ts, s.ini_ts + make_interval(mins => dur))
      )
  ), pick as (
    select x.ini_ts, x.fim_ts from (
      select l.*, row_number() over (partition by l.dia, l.turno order by l.ini_ts) as nt from livres l
    ) x where x.nt = 1
  )
  select p.ini_ts, p.fim_ts, comercial_rotulo(p.ini_ts) from pick p order by p.ini_ts limit p_limite;
end $$;

revoke all on function public.comercial_horarios_livres(int) from public, anon, authenticated;

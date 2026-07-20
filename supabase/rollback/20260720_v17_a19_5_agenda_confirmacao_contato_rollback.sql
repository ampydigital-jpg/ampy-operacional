
-- ATENÇÃO:
-- não executar após utilizar nomes personalizados,
-- pois os dados armazenados nessa coluna serão removidos.

begin;

alter table
  public.calendar_events
drop column if exists
  custom_name;

commit;

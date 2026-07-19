
-- ATENÇÃO:
-- este rollback remove os metadados das séries recorrentes.
-- não executar depois que a equipe começar a usar recorrências
-- sem antes fazer backup do banco.

begin;

drop index if exists
  public.calendar_events_series_start_idx;

drop index if exists
  public.calendar_events_series_id_idx;

alter table
  public.calendar_events
drop column if exists
  auto_recurrence;

alter table
  public.calendar_events
drop column if exists
  recurrence_until;

alter table
  public.calendar_events
drop column if exists
  series_sequence;

alter table
  public.calendar_events
drop column if exists
  series_id;

commit;

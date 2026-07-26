-- =========================================================
-- ROLLBACK V17-A25.3A4A
-- =========================================================
-- Os vínculos já gravados são preservados para não apagar
-- agendas válidas nem perder histórico operacional.
-- =========================================================

begin;

drop trigger if exists
  trg_calendar_event_sync_cycle_requirement
on public.calendar_events;

drop trigger if exists
  trg_calendar_event_clear_cycle_requirement
on public.calendar_events;

drop function if exists
  public.sync_cycle_schedule_requirement_from_calendar_event();

drop index if exists
  public.idx_calendar_events_work_item_type;

commit;

select
  'Rollback V17-A25.3A4A aplicado'
    as resultado;
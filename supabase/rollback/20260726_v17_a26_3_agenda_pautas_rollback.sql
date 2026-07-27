-- ============================================================
-- ROLLBACK V17-A26.3 — AGENDA INTEGRADA ÀS PAUTAS
-- ============================================================

begin;

do $function$
declare
  v_direct_links bigint := 0;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'pauta_id'
  ) then
    select count(*)
      into v_direct_links
    from public.calendar_events
    where pauta_id is not null
      and work_item_id is null;
  end if;

  if v_direct_links > 0 then
    raise exception
      'Rollback bloqueado: existem % agendas ligadas diretamente a Pautas.',
      v_direct_links;
  end if;
end;
$function$;

drop trigger if exists trg_calendar_event_sync_pauta
  on public.calendar_events;

drop function if exists public.sync_calendar_event_pauta();

drop index if exists public.calendar_events_pauta_id_idx;

alter table public.calendar_events
  drop column if exists pauta_id;

commit;

select
  'Rollback V17-A26.3 aplicado com sucesso' as resultado;

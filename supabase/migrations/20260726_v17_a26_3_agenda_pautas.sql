-- ============================================================
-- V17-A26.3 — AGENDA INTEGRADA ÀS PAUTAS
-- ============================================================

begin;

alter table public.calendar_events
  add column if not exists pauta_id uuid
    references public.pautas(id)
    on delete set null;

create index if not exists calendar_events_pauta_id_idx
  on public.calendar_events (
    pauta_id,
    starts_at
  );

update public.calendar_events as event
set pauta_id = item.pauta_id
from public.work_items as item
where event.work_item_id = item.id
  and item.pauta_id is not null
  and event.pauta_id is distinct from item.pauta_id;

create or replace function public.sync_calendar_event_pauta()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_work_item_pauta_id uuid;
begin
  if new.work_item_id is not null then
    select item.pauta_id
      into v_work_item_pauta_id
    from public.work_items as item
    where item.id = new.work_item_id;

    if not found then
      raise exception
        'Demanda vinculada à agenda não encontrada.';
    end if;

    if new.pauta_id is not null
       and new.pauta_id is distinct from v_work_item_pauta_id then
      raise exception
        'A Pauta da agenda não corresponde à Pauta da demanda vinculada.';
    end if;

    new.pauta_id := v_work_item_pauta_id;
  end if;

  if new.pauta_id is not null
     and not exists (
       select 1
       from public.pautas as pauta
       where pauta.id = new.pauta_id
         and pauta.archived_at is null
     ) then
    raise exception
      'A Pauta vinculada à agenda não está disponível.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_calendar_event_sync_pauta
  on public.calendar_events;

create trigger trg_calendar_event_sync_pauta
before insert or update of work_item_id, pauta_id
on public.calendar_events
for each row
execute function public.sync_calendar_event_pauta();

comment on column public.calendar_events.pauta_id is
  'Pauta mensal vinculada diretamente ou herdada da demanda da agenda.';

commit;

select
  'V17-A26.3 aplicada com sucesso' as resultado,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'pauta_id'
  ) as calendar_pauta_id_ok,

  exists (
    select 1
    from pg_trigger
    where tgname = 'trg_calendar_event_sync_pauta'
      and not tgisinternal
  ) as pauta_sync_trigger_ok,

  (
    select count(*)
    from public.calendar_events
    where pauta_id is not null
  ) as agendas_vinculadas_a_pautas;

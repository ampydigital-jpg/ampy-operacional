-- =========================================================
-- V17-A25.3A4A
-- SINCRONIZAÇÃO AUTOMÁTICA ENTRE AGENDA E CICLO
-- =========================================================

begin;

-- Ajuda as consultas do Quadro e da sincronização.
create index if not exists
  idx_calendar_events_work_item_type
on public.calendar_events (
  work_item_id,
  type
)
where work_item_id is not null;

-- =========================================================
-- FUNÇÃO DE SINCRONIZAÇÃO
-- =========================================================

create or replace function
  public.sync_cycle_schedule_requirement_from_calendar_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_old_requirement_type text;
  v_new_requirement_type text;

  v_existing_event_id uuid;
  v_actor uuid;
begin
  -- -------------------------------------------------------
  -- Exclusão do evento
  -- -------------------------------------------------------

  if tg_op = 'DELETE' then
    v_old_requirement_type :=
      case
        when old.type = 'reu_a'
          then 'alignment_meeting'

        when old.type in (
          'cap_e',
          'cap_s'
        )
          then 'capture'

        else null
      end;

    if
      old.work_item_id is not null
      and v_old_requirement_type is not null
    then
      update
        public.work_item_schedule_requirements
      set
        status = 'pending',
        calendar_event_id = null,
        scheduled_at = null,
        confirmed_at = null,
        completed_at = null,
        updated_at = now()
      where
        work_item_id = old.work_item_id
        and requirement_type =
          v_old_requirement_type
        and calendar_event_id = old.id;
    end if;

    return old;
  end if;

  -- -------------------------------------------------------
  -- Inserção ou atualização do evento
  -- -------------------------------------------------------

  v_new_requirement_type :=
    case
      when new.type = 'reu_a'
        then 'alignment_meeting'

      when new.type in (
        'cap_e',
        'cap_s'
      )
        then 'capture'

      else null
    end;

  if tg_op = 'UPDATE' then
    v_old_requirement_type :=
      case
        when old.type = 'reu_a'
          then 'alignment_meeting'

        when old.type in (
          'cap_e',
          'cap_s'
        )
          then 'capture'

        else null
      end;

    if
      old.work_item_id is not null
      and v_old_requirement_type is not null
      and (
        new.work_item_id is distinct from
          old.work_item_id

        or v_new_requirement_type is distinct from
          v_old_requirement_type
      )
    then
      update
        public.work_item_schedule_requirements
      set
        status = 'pending',
        calendar_event_id = null,
        scheduled_at = null,
        confirmed_at = null,
        completed_at = null,
        updated_at = now()
      where
        work_item_id = old.work_item_id
        and requirement_type =
          v_old_requirement_type
        and calendar_event_id = old.id;
    end if;
  end if;

  -- Tipos que não representam reunião ou captação
  -- não alteram requisitos operacionais.
  if
    new.work_item_id is null
    or v_new_requirement_type is null
  then
    return new;
  end if;

  select
    calendar_event_id
  into
    v_existing_event_id
  from
    public.work_item_schedule_requirements
  where
    work_item_id = new.work_item_id
    and requirement_type =
      v_new_requirement_type
  for update;

  if
    found
    and v_existing_event_id is not null
    and v_existing_event_id <> new.id
  then
    raise exception
      'Esta demanda já possui uma agenda principal de % vinculada.',
      case
        when v_new_requirement_type =
          'alignment_meeting'
          then 'reunião'

        else 'captação'
      end;
  end if;

  v_actor :=
    coalesce(
      new.created_by,
      auth.uid()
    );

  insert into
    public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_event_id,
      calendar_type,
      created_by,
      scheduled_at,
      confirmed_at,
      completed_at,
      created_at,
      updated_at
    )
  values (
    new.work_item_id,
    v_new_requirement_type,

    case
      when coalesce(
        new.confirmed,
        false
      )
        then 'confirmed'

      else 'scheduled'
    end,

    new.id,
    new.type,
    v_actor,
    new.starts_at,

    case
      when coalesce(
        new.confirmed,
        false
      )
        then now()

      else null
    end,

    null,
    now(),
    now()
  )
  on conflict (
    work_item_id,
    requirement_type
  )
  do update
  set
    status =
      case
        when coalesce(
          new.confirmed,
          false
        )
          then 'confirmed'

        else 'scheduled'
      end,

    calendar_event_id =
      new.id,

    calendar_type =
      new.type,

    scheduled_at =
      new.starts_at,

    confirmed_at =
      case
        when coalesce(
          new.confirmed,
          false
        )
          then coalesce(
            public
              .work_item_schedule_requirements
              .confirmed_at,
            now()
          )

        else null
      end,

    completed_at =
      null,

    updated_at =
      now();

  return new;
end;
$function$;

revoke all
on function
  public.sync_cycle_schedule_requirement_from_calendar_event()
from public;

-- =========================================================
-- TRIGGERS
-- =========================================================

drop trigger if exists
  trg_calendar_event_sync_cycle_requirement
on public.calendar_events;

create trigger
  trg_calendar_event_sync_cycle_requirement
after insert
or update of
  work_item_id,
  type,
  starts_at,
  confirmed
on public.calendar_events
for each row
execute function
  public.sync_cycle_schedule_requirement_from_calendar_event();

drop trigger if exists
  trg_calendar_event_clear_cycle_requirement
on public.calendar_events;

create trigger
  trg_calendar_event_clear_cycle_requirement
before delete
on public.calendar_events
for each row
execute function
  public.sync_cycle_schedule_requirement_from_calendar_event();

-- =========================================================
-- BACKFILL SEGURO
-- =========================================================
-- Liga apenas requisitos que:
-- 1. ainda não possuem evento;
-- 2. possuem exatamente uma agenda compatível;
-- 3. já estão vinculados à mesma demanda.

with compatible_events as (
  select
    requirement.id as requirement_id,
    event.id as event_id,
    event.type as event_type,
    event.starts_at,
    event.confirmed,

    count(*) over (
      partition by requirement.id
    ) as compatible_count

  from
    public.work_item_schedule_requirements
      as requirement

  join
    public.calendar_events
      as event
    on event.work_item_id =
       requirement.work_item_id

    and (
      (
        requirement.requirement_type =
          'alignment_meeting'

        and event.type =
          'reu_a'
      )

      or (
        requirement.requirement_type =
          'capture'

        and event.type in (
          'cap_e',
          'cap_s'
        )
      )
    )

  where
    requirement.calendar_event_id is null
)

update
  public.work_item_schedule_requirements
    as requirement
set
  calendar_event_id =
    compatible.event_id,

  calendar_type =
    compatible.event_type,

  status =
    case
      when compatible.confirmed
        then 'confirmed'

      else 'scheduled'
    end,

  scheduled_at =
    compatible.starts_at,

  confirmed_at =
    case
      when compatible.confirmed
        then coalesce(
          requirement.confirmed_at,
          now()
        )

      else null
    end,

  completed_at =
    null,

  updated_at =
    now()

from
  compatible_events
    as compatible

where
  requirement.id =
    compatible.requirement_id

  and compatible.compatible_count = 1;

-- =========================================================
-- VALIDAÇÃO ESTRUTURAL
-- =========================================================

do $validation$
begin
  if to_regprocedure(
    'public.sync_cycle_schedule_requirement_from_calendar_event()'
  ) is null then
    raise exception
      'Função de sincronização não foi criada.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname =
      'trg_calendar_event_sync_cycle_requirement'
      and not tgisinternal
  ) then
    raise exception
      'Trigger de criação/atualização não foi criado.';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname =
      'trg_calendar_event_clear_cycle_requirement'
      and not tgisinternal
  ) then
    raise exception
      'Trigger de exclusão não foi criado.';
  end if;
end
$validation$;

commit;

select
  'V17-A25.3A4A aplicada com sucesso'
    as resultado,

  (
    select count(*)
    from
      public.work_item_schedule_requirements
    where calendar_event_id is not null
  ) as requisitos_ja_vinculados;
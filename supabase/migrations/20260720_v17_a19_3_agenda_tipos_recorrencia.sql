
begin;

alter table public.calendar_events
  drop constraint if exists calendar_events_type_check;

alter table public.calendar_events
  add constraint calendar_events_type_check
  check (
    type in (
      'meeting',
      'capture_external',
      'capture_studio',
      'recording',
      'delivery',
      'internal',
      'commercial',
      'reu_a',
      'reu_c',
      'cap_e',
      'cap_s',
      'out_a'
    )
  );

commit;

select
  exists (
    select 1
    from pg_constraint c
    join pg_class t
      on t.oid = c.conrelid
    join pg_namespace n
      on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'calendar_events'
      and c.conname = 'calendar_events_type_check'
      and position(
        'reu_a'
        in pg_get_constraintdef(c.oid)
      ) > 0
      and position(
        'out_a'
        in pg_get_constraintdef(c.oid)
      ) > 0
  ) as type_constraint_ok;

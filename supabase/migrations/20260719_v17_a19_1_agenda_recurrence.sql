
begin;

alter table
  public.calendar_events
add column if not exists
  series_id uuid;

alter table
  public.calendar_events
add column if not exists
  series_sequence integer
  not null
  default 0;

alter table
  public.calendar_events
add column if not exists
  recurrence_until date;

alter table
  public.calendar_events
add column if not exists
  auto_recurrence boolean
  not null
  default false;

create index if not exists
  calendar_events_series_id_idx
on public.calendar_events (
  series_id
)
where series_id is not null;

create index if not exists
  calendar_events_series_start_idx
on public.calendar_events (
  series_id,
  starts_at
)
where series_id is not null;

comment on column
  public.calendar_events.series_id
is
  'Identificador comum das ocorrências de uma agenda recorrente.';

comment on column
  public.calendar_events.series_sequence
is
  'Posição da ocorrência dentro da série recorrente.';

comment on column
  public.calendar_events.recurrence_until
is
  'Data final utilizada para gerar a recorrência.';

comment on column
  public.calendar_events.auto_recurrence
is
  'Indica que as ocorrências foram criadas automaticamente.';

commit;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'series_id'
  ) as series_id_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'series_sequence'
  ) as series_sequence_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'recurrence_until'
  ) as recurrence_until_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'auto_recurrence'
  ) as auto_recurrence_ok;

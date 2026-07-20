
begin;

alter table
  public.calendar_events
add column if not exists
  custom_name text;

comment on column
  public.calendar_events.custom_name
is
  'Nome personalizado para lead, parceiro ou contato que não possui cadastro de cliente.';

update
  public.calendar_events
set
  color = '#DC2626'
where
  confirmed is not true
  and type in (
    'reu_a',
    'reu_c',
    'cap_e',
    'cap_s',
    'out_a'
  );

update
  public.calendar_events
set
  color = case type
    when 'reu_a'
      then '#22C55E'
    when 'reu_c'
      then '#15803D'
    when 'cap_e'
      then '#1E3A8A'
    when 'cap_s'
      then '#60A5FA'
    when 'out_a'
      then '#64748B'
    else color
  end
where
  confirmed is true;

commit;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'custom_name'
  ) as custom_name_ok,

  count(*) filter (
    where confirmed is not true
      and type in (
        'reu_a',
        'reu_c',
        'cap_e',
        'cap_s',
        'out_a'
      )
      and color = '#DC2626'
  ) as unconfirmed_red,

  count(*) filter (
    where confirmed is true
      and type in (
        'reu_a',
        'reu_c',
        'cap_e',
        'cap_s',
        'out_a'
      )
  ) as confirmed_events
from
  public.calendar_events;

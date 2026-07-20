
-- ATENÇÃO:
-- executar somente antes de criar agendas com os novos tipos.

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
      'commercial'
    )
  );

commit;

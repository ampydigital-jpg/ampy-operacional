begin;

revoke all on function public.distribute_existing_pauta_demands(uuid, jsonb, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_work_item_board_assignment_completion(uuid, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_work_item_completion(uuid, boolean, boolean, text)
  from public, anon, authenticated, service_role;
revoke all on function public.set_calendar_event_completion(uuid, boolean, text)
  from public, anon, authenticated, service_role;

drop function if exists public.distribute_existing_pauta_demands(uuid, jsonb, jsonb, text);
drop function if exists public.set_work_item_board_assignment_completion(uuid, boolean, text);
drop function if exists public.set_work_item_completion(uuid, boolean, boolean, text);
drop function if exists public.set_calendar_event_completion(uuid, boolean, text);

drop trigger if exists work_item_board_assignments_simple_card_trg
  on public.work_item_board_assignments;
drop function if exists public.v9_prepare_simple_assignment_card();

update public.work_item_board_assignments
set metadata = coalesce(metadata, '{}'::jsonb) - 'display_mode' - 'card_scope'
where coalesce(metadata ->> 'source', '') in (
  'pauta_distribution',
  'pauta_existing_distribution'
);

drop table if exists public.calendar_event_history;
drop index if exists public.calendar_events_completion_idx;

alter table public.calendar_events
  drop constraint if exists calendar_events_completion_state_chk,
  drop constraint if exists calendar_events_completed_by_fk,
  drop constraint if exists calendar_events_completion_status_chk,
  drop column if exists completion_note,
  drop column if exists completed_by,
  drop column if exists completed_at,
  drop column if exists completion_status;

commit;

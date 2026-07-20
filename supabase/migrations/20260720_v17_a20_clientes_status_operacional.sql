begin;

alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check
  check (
    status in (
      'active',
      'cancelled',
      'onboarding',
      'paused',
      'archived',
      'inactive'
    )
  );

commit;

select
  c.conname as constraint_name,
  pg_get_constraintdef(c.oid) as constraint_definition,
  position(
    '''archived'''
    in pg_get_constraintdef(c.oid)
  ) > 0 as archived_ok,
  position(
    '''inactive'''
    in pg_get_constraintdef(c.oid)
  ) > 0 as inactive_ok
from pg_constraint c
where c.conrelid = 'public.clients'::regclass
  and c.conname = 'clients_status_check';
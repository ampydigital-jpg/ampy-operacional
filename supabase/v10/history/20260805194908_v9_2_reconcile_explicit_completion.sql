-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

begin;

set local lock_timeout = '10s';

set local statement_timeout = '120s';

lock table public.work_items
  in share row exclusive mode;

lock table public.work_item_history
  in row exclusive mode;

alter table public.work_item_history
  alter column actor_id drop not null;

create temporary table v9_2_invalid_explicit_completions
on commit drop
as
select
  work_item.id,
  work_item.status as previous_status,
  work_item.closed_at as previous_closed_at,
  status_history.old_value as restored_status
from public.work_items as work_item
join lateral (
  select history.old_value
  from public.work_item_history as history
  where history.work_item_id = work_item.id
    and history.field_changed = 'status'
    and history.new_value = 'done'
    and history.old_value in (
      'not_started','in_progress','waiting','blocked','in_review','awaiting_approval','approved','scheduled','delivered'
    )
  order by history.created_at desc, history.id desc
  limit 1
) as status_history on true
where work_item.status = 'done'
  and work_item.completed_at is null;

alter table public.work_items
  drop constraint if exists work_items_done_requires_completed_at;

alter table public.work_items
  add constraint work_items_done_requires_completed_at
  check (status <> 'done' or completed_at is not null)
  not valid;

alter table public.work_items
  validate constraint work_items_done_requires_completed_at;

commit;

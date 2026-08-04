-- ============================================================
-- V8-B — VERIFICAÇÃO FINAL SOMENTE LEITURA
-- ============================================================

with checks as (
  select jsonb_build_object(
    'work_items_total', (select count(*) from public.work_items),
    'legacy_candidates_untouched', (
      select count(*)
      from public.work_items wi
      join public.boards b on b.id = wi.board_id
      where b.board_kind = 'pauta'
        and wi.pauta_id is null
        and wi.is_pauta_card = false
        and wi.status not in ('archived','cancelled')
    ),
    'pauta_members_total', (select count(*) from public.pauta_members),
    'active_members_without_target_date', (
      select count(*)
      from public.pauta_members
      where membership_status='active' and target_date is null
    ),
    'assignments_total', (select count(*) from public.work_item_board_assignments),
    'assignments_from_custom_backfill', (
      select count(*)
      from public.work_item_board_assignments
      where metadata ->> 'source' = 'legacy_backfill'
    ),
    'assignments_on_pauta_board', (
      select count(*)
      from public.work_item_board_assignments a
      join public.boards b on b.id=a.board_id
      where b.board_kind='pauta'
    ),
    'duplicate_active_work_item_board', (
      select count(*)
      from (
        select work_item_id, board_id
        from public.work_item_board_assignments
        where assignment_status='active'
        group by work_item_id, board_id
        having count(*) > 1
      ) duplicate_rows
    ),
    'assignment_column_mismatch', (
      select count(*)
      from public.work_item_board_assignments a
      join public.board_columns c on c.id=a.board_column_id
      where a.board_id <> c.board_id
    ),
    'orphan_assignments', (
      select count(*)
      from public.work_item_board_assignments a
      left join public.work_items wi on wi.id=a.work_item_id
      left join public.boards b on b.id=a.board_id
      left join public.board_columns c on c.id=a.board_column_id
      where wi.id is null or b.id is null or c.id is null
    ),
    'pauta_delete_authenticated_blocked', not has_function_privilege(
      'authenticated','public.delete_empty_pauta(uuid,text)','EXECUTE'
    ),
    'multiboard_create_authenticated', has_function_privilege(
      'authenticated','public.create_and_distribute_pauta_demands(uuid,jsonb,jsonb,text)','EXECUTE'
    ),
    'multiboard_move_authenticated', has_function_privilege(
      'authenticated','public.move_work_item_board_assignment(uuid,uuid)','EXECUTE'
    ),
    'assignments_rls', (
      select relrowsecurity
      from pg_class
      where oid='public.work_item_board_assignments'::regclass
    ),
    'assignment_events_rls', (
      select relrowsecurity
      from pg_class
      where oid='public.work_item_board_assignment_events'::regclass
    )
  ) as result
)
select jsonb_pretty(result) as v8_b_verification
from checks;

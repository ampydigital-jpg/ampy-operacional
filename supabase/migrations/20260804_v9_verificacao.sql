with checks as (
  select jsonb_build_object(
    'calendar_completion_status_exists', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'completion_status'
    ),
    'calendar_completed_at_exists', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'completed_at'
    ),
    'calendar_completed_by_exists', exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'calendar_events' and column_name = 'completed_by'
    ),
    'calendar_history_exists', to_regclass('public.calendar_event_history') is not null,
    'calendar_history_rls', coalesce((
      select relrowsecurity from pg_class where oid = to_regclass('public.calendar_event_history')
    ), false),
    'distribution_rpc_exists', to_regprocedure('public.distribute_existing_pauta_demands(uuid,jsonb,jsonb,text)') is not null,
    'assignment_completion_rpc_exists', to_regprocedure('public.set_work_item_board_assignment_completion(uuid,boolean,text)') is not null,
    'work_item_completion_rpc_exists', to_regprocedure('public.set_work_item_completion(uuid,boolean,boolean,text)') is not null,
    'calendar_completion_rpc_exists', to_regprocedure('public.set_calendar_event_completion(uuid,boolean,text)') is not null,
    'distribution_authenticated', has_function_privilege('authenticated', 'public.distribute_existing_pauta_demands(uuid,jsonb,jsonb,text)', 'EXECUTE'),
    'assignment_completion_authenticated', has_function_privilege('authenticated', 'public.set_work_item_board_assignment_completion(uuid,boolean,text)', 'EXECUTE'),
    'work_item_completion_authenticated', has_function_privilege('authenticated', 'public.set_work_item_completion(uuid,boolean,boolean,text)', 'EXECUTE'),
    'calendar_completion_authenticated', has_function_privilege('authenticated', 'public.set_calendar_event_completion(uuid,boolean,text)', 'EXECUTE'),
    'work_items_total', (select count(*) from public.work_items),
    'legacy_candidates_untouched', (
      select count(*)
      from public.work_items
      where pauta_id is null
        and is_pauta_card = false
        and final_deadline >= date '2026-09-01'
        and final_deadline < date '2026-10-01'
    ),
    'assignments_total', (select count(*) from public.work_item_board_assignments),
    'simple_sector_assignments', (
      select count(*) from public.work_item_board_assignments
      where assignment_status = 'active'
        and metadata ->> 'display_mode' = 'simple'
        and metadata ->> 'card_scope' = 'sector'
    ),
    'duplicate_active_work_item_board', (
      select count(*) from (
        select work_item_id, board_id
        from public.work_item_board_assignments
        where assignment_status = 'active'
        group by work_item_id, board_id
        having count(*) > 1
      ) duplicate_rows
    ),
    'orphan_assignments', (
      select count(*)
      from public.work_item_board_assignments assignment_row
      left join public.work_items item on item.id = assignment_row.work_item_id
      left join public.boards board_row on board_row.id = assignment_row.board_id
      left join public.board_columns column_row on column_row.id = assignment_row.board_column_id
      where item.id is null or board_row.id is null or column_row.id is null
    ),
    'assignment_column_mismatch', (
      select count(*)
      from public.work_item_board_assignments assignment_row
      join public.board_columns column_row on column_row.id = assignment_row.board_column_id
      where assignment_row.board_id <> column_row.board_id
    ),
    'calendar_completion_inconsistent', (
      select count(*)
      from public.calendar_events
      where (completion_status = 'completed' and completed_at is null)
         or (completion_status = 'open' and (completed_at is not null or completed_by is not null))
    ),
    'assignment_completion_inconsistent', (
      select count(*)
      from public.work_item_board_assignments
      where (completed_at is null and completed_by is not null)
         or (completed_at is not null and completed_by is null)
    )
  ) as result
)
select result as v9_verification from checks;

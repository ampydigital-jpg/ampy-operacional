-- V9.3-A2 — remoção reversível de associação de Quadro
-- A demanda canônica, Pauta, histórico e demais associações permanecem.

create or replace function public.remove_work_item_board_assignment(
  p_assignment_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_role text;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in (
       'admin',
       'director',
       'manager',
       'team_lead'
     )
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception
      'Você não possui permissão para remover esta associação.';
  end if;

  v_old := jsonb_build_object(
    'assignment_status',
    v_assignment.assignment_status,
    'board_id',
    v_assignment.board_id,
    'board_column_id',
    v_assignment.board_column_id,
    'operational_status',
    v_assignment.operational_status,
    'completed_at',
    v_assignment.completed_at
  );

  update public.work_item_board_assignments
  set
    assignment_status = 'removed',
    removed_at = now(),
    removed_by = v_actor,
    completed_at = null,
    completed_by = null,
    metadata =
      coalesce(
        metadata,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'removal_note',
        nullif(
          trim(
            coalesce(
              p_note,
              ''
            )
          ),
          ''
        )
      ),
    updated_at = now()
  where id = p_assignment_id
  returning *
  into v_assignment;

  v_new := jsonb_build_object(
    'assignment_status',
    v_assignment.assignment_status,
    'board_id',
    v_assignment.board_id,
    'board_column_id',
    v_assignment.board_column_id,
    'operational_status',
    v_assignment.operational_status,
    'removed_at',
    v_assignment.removed_at,
    'removed_by',
    v_assignment.removed_by
  );

  perform public.v8_log_assignment_event(
    v_assignment.id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    v_assignment.board_column_id,
    v_actor,
    'assignment_removed',
    v_old,
    v_new,
    jsonb_build_object(
      'note',
      nullif(
        trim(
          coalesce(
            p_note,
            ''
          )
        ),
        ''
      )
    )
  );

  if
    v_item.pauta_id
    is not null
  then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      'assignment_removed',
      'work_item',
      v_item.id,
      v_old,
      v_new,
      jsonb_build_object(
        'assignment_id',
        v_assignment.id,
        'note',
        nullif(
          trim(
            coalesce(
              p_note,
              ''
            )
          ),
          ''
        )
      )
    );
  end if;

  perform public.recalculate_work_item_global_status(
    v_assignment.work_item_id
  );

  return jsonb_build_object(
    'success',
    true,
    'assignment_id',
    v_assignment.id,
    'work_item_id',
    v_assignment.work_item_id,
    'board_id',
    v_assignment.board_id,
    'removed',
    true
  );
end;
$function$;

grant execute
on function public.remove_work_item_board_assignment(
  uuid,
  text
)
to authenticated;

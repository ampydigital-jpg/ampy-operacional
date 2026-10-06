-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.move_work_item_board_assignment(
  p_assignment_id uuid,
  p_target_column_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor uuid;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_next_operational_status text;
begin
  v_actor := public.pauta_current_active_actor();

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
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception
      'Você não possui permissão para movimentar esta demanda.';
  end if;

  select *
  into v_target
  from public.board_columns
  where id = p_target_column_id
    and board_id = v_assignment.board_id;

  if not found then
    raise exception
      'A coluna de destino deve pertencer ao mesmo Quadro.';
  end if;

  v_next_operational_status :=
    case
      when public.v8_assignment_is_complete(v_target.operational_status)
        then v_assignment.operational_status
      else v_target.operational_status
    end;

  v_old_values := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  update public.work_item_board_assignments
  set
    board_column_id = p_target_column_id,
    operational_status = v_next_operational_status,
    updated_at = now()
  where id = p_assignment_id;

  v_new_values := jsonb_build_object(
    'board_column_id', p_target_column_id,
    'operational_status', v_next_operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  perform public.v8_log_assignment_event(
    p_assignment_id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    p_target_column_id,
    v_actor,
    'assignment_moved',
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'completion_requires_explicit_action', true
    )
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      'assignment_moved',
      'work_item',
      v_item.id,
      v_old_values,
      v_new_values,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'completion_requires_explicit_action', true
      )
    );
  end if;

  perform public.recalculate_work_item_global_status(
    v_assignment.work_item_id
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'work_item_id', v_assignment.work_item_id,
    'board_column_id', p_target_column_id,
    'operational_status', v_next_operational_status,
    'completed', v_assignment.completed_at is not null
  );
end;
$function$;

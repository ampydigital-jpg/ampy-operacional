-- V9.1.4-R1
-- REGRA: movimentar para coluna final não conclui.
-- Conclusão ocorre somente por ação explícita.

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

create or replace function public.set_work_item_completion(
  p_work_item_id uuid,
  p_completed boolean,
  p_complete_assignments boolean default true,
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
  v_item public.work_items%rowtype;
  v_assignment record;
  v_assignment_count integer := 0;
  v_old_status text;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
  for update;

  if not found then
    raise exception 'Demanda não encontrada.';
  end if;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta demanda.';
  end if;

  v_old_status := v_item.status;

  select count(*)
  into v_assignment_count
  from public.work_item_board_assignments
  where work_item_id = p_work_item_id
    and assignment_status = 'active';

  if v_assignment_count > 0 and not p_complete_assignments then
    raise exception
      'Esta demanda possui etapas em Quadros. Conclua as etapas ou confirme a conclusão completa.';
  end if;

  if v_assignment_count > 0 then
    for v_assignment in
      select id
      from public.work_item_board_assignments
      where work_item_id = p_work_item_id
        and assignment_status = 'active'
      order by assigned_at
    loop
      perform public.set_work_item_board_assignment_completion(
        v_assignment.id,
        p_completed,
        p_note
      );
    end loop;
  else
    update public.work_items
    set
      status = case when p_completed then 'done' else 'not_started' end,
      completed_at = case when p_completed then now() else null end,
      completed_by = case when p_completed then v_actor else null end,
      closed_at = case when p_completed then now() else null end,
      close_reason = case
        when p_completed then nullif(trim(coalesce(p_note, '')), '')
        else null
      end,
      updated_at = now()
    where id = p_work_item_id;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    p_work_item_id,
    v_actor,
    case when p_completed then 'completed' else 'reopened' end,
    v_old_status,
    jsonb_build_object(
      'status', case when p_completed then 'done' else 'not_started' end,
      'note', nullif(trim(coalesce(p_note, '')), ''),
      'assignments', v_assignment_count,
      'explicit_action', true
    )::text
  );

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'completed', p_completed,
    'assignments_updated', v_assignment_count,
    'explicit_action', true
  );
end;
$function$;


-- A criação em coluna final também depende de ação explícita.
-- Função create_pauta_demand atualizada no Supabase pela migration v9_1_4_r2_criacao_em_coluna_final_nao_conclui.

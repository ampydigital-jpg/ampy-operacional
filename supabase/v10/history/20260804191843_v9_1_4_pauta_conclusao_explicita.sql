-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

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
    raise exception 'Esta demanda possui etapas em Quadros. Conclua as etapas ou confirme a conclusão completa.';
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

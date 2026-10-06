-- PENDENTE DE APROVACAO. NAO EXECUTADA.
-- Conferido: nenhum destes helpers/triggers e chamado por rpc no app.
begin;

revoke execute on function public.pauta_log_event(p_pauta_id uuid, p_board_id uuid, p_actor_id uuid, p_action text, p_target_type text, p_target_id uuid, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) from public, anon, authenticated;
revoke execute on function public.v8_log_assignment_event(p_assignment_id uuid, p_work_item_id uuid, p_pauta_id uuid, p_board_id uuid, p_board_column_id uuid, p_actor_id uuid, p_action text, p_old_values jsonb, p_new_values jsonb, p_metadata jsonb) from public, anon, authenticated;
revoke execute on function public.pauta_create_main_card_core(p_pauta_id uuid, p_client_id uuid, p_actor_id uuid, p_source text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.seed_board_default_columns() from public, anon, authenticated;
revoke execute on function public.seed_project_step_statuses_for_work_item() from public, anon, authenticated;
revoke execute on function public.sync_calendar_event_pauta() from public, anon, authenticated;
revoke execute on function public.sync_cycle_schedule_requirement_from_calendar_event() from public, anon, authenticated;
revoke execute on function public.guard_active_pauta_work_item_requires_pauta() from public, anon, authenticated;
revoke execute on function public.v8_assignment_after_change() from public, anon, authenticated;
revoke execute on function public.v8_sync_assignment_from_work_item() from public, anon, authenticated;

-- App usa estas tres, mas o estado atual so checa sessao ativa, sem escopo.

CREATE OR REPLACE FUNCTION public.create_pauta_demand(p_pauta_id uuid, p_client_id uuid, p_board_column_id uuid, p_title text, p_client_service_id uuid, p_responsible_id uuid, p_priority text, p_internal_deadline date, p_final_deadline date, p_drive_link text, p_notes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_column public.board_columns%rowtype;
  v_work_item_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_priority text := trim(coalesce(p_priority, 'normal'));
  v_initial_status text;
begin
  v_actor := public.pauta_current_active_actor();
  if not public.app_has_total_access() and (
    p_responsible_id is distinct from v_actor or not exists (
      select 1 from public.clients c where c.id = p_client_id and c.responsible_id = v_actor
    )
  ) then
    raise exception 'Sem permissao para criar demanda para este cliente ou responsavel.';
  end if;

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  if p_board_column_id is null then
    raise exception 'Coluna obrigatória.';
  end if;

  if length(v_title) not between 2 and 180 then
    raise exception
      'O título deve possuir entre 2 e 180 caracteres.';
  end if;

  if v_priority not in (
    'low',
    'normal',
    'high',
    'urgent'
  ) then
    raise exception 'Prioridade inválida.';
  end if;

  if p_responsible_id is null then
    raise exception 'Responsável obrigatório.';
  end if;

  if p_internal_deadline is null
     or p_final_deadline is null
  then
    raise exception
      'Início e prazo final são obrigatórios.';
  end if;

  if p_internal_deadline > p_final_deadline then
    raise exception
      'A data inicial não pode ser posterior ao prazo final.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber demandas.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1;

  if not found
     or v_member.main_work_item_id is null
  then
    raise exception
      'O cliente não possui participação ativa e card principal nesta Pauta.';
  end if;

  if not exists (
    select 1
    from public.work_items
    where id = v_member.main_work_item_id
      and pauta_id = p_pauta_id
      and client_id = p_client_id
      and is_pauta_card = true
  ) then
    raise exception
      'O card principal do cliente está inconsistente.';
  end if;

  select *
  into v_column
  from public.board_columns
  where id = p_board_column_id
    and board_id = v_pauta.board_id;

  if not found then
    raise exception
      'A coluna selecionada não pertence ao Quadro da Pauta.';
  end if;

  v_initial_status :=
    case
      when coalesce(v_column.operational_status, '') in (
        'done',
        'delivered',
        'approved'
      ) then 'not_started'
      else coalesce(
        v_column.operational_status,
        'not_started'
      )
    end;

  if not exists (
    select 1
    from public.profiles
    where id = p_responsible_id
      and is_active = true
  ) then
    raise exception
      'Responsável não encontrado ou inativo.';
  end if;

  if p_client_service_id is null then
    raise exception
      'Demandas operacionais de cliente precisam de um serviço ativo.';
  end if;

  if not exists (
    select 1
    from public.client_services
    where id = p_client_service_id
      and client_id = p_client_id
      and status = 'active'
  ) then
    raise exception
      'O serviço não está ativo ou não pertence ao cliente.';
  end if;

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,
    client_id,
    client_service_id,
    responsible_id,
    board_id,
    board_column_id,
    internal_deadline,
    final_deadline,
    drive_link,
    notes,
    blocked_reason,
    created_by,
    closed_at,
    pauta_id,
    is_pauta_card,
    pauta_card_id,
    completed_at
  )
  values (
    v_title,
    null,
    'Operação',
    'planned',
    'quadro',
    v_initial_status,
    v_priority,
    p_client_id,
    p_client_service_id,
    p_responsible_id,
    v_pauta.board_id,
    p_board_column_id,
    p_internal_deadline,
    p_final_deadline,
    nullif(trim(coalesce(p_drive_link, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    null,
    v_actor,
    null,
    p_pauta_id,
    false,
    v_member.main_work_item_id,
    null
  )
  returning id
  into v_work_item_id;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_work_item_id,
    v_actor,
    'pauta_demand_created',
    null,
    jsonb_build_object(
      'pauta_id', p_pauta_id,
      'pauta_card_id', v_member.main_work_item_id,
      'board_column_id', p_board_column_id,
      'status', v_initial_status,
      'completion_requires_explicit_action', true
    )::text
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'demand_created',
    'work_item',
    v_work_item_id,
    '{}'::jsonb,
    jsonb_build_object(
      'client_id', p_client_id,
      'main_work_item_id', v_member.main_work_item_id,
      'board_column_id', p_board_column_id,
      'client_service_id', p_client_service_id,
      'responsible_id', p_responsible_id,
      'status', v_initial_status,
      'completion_requires_explicit_action', true
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', v_work_item_id,
    'pauta_card_id', v_member.main_work_item_id,
    'status', v_initial_status,
    'completion_requires_explicit_action', true
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.preview_pauta_client_additions(p_pauta_id uuid, p_client_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_clients jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_management_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'É permitido analisar no máximo 300 clientes por operação.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  if (
    select count(*)
    from unnest(p_client_ids)
  ) <> (
    select count(distinct client_id)
    from unnest(p_client_ids) as selected(client_id)
  ) then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  with selected_clients as (
    select distinct selected.client_id
    from unnest(p_client_ids) as selected(client_id)
  ),
  analyzed as (
    select
      selected.client_id,
      client.name as client_name,
      client.status as client_status,

      exists (
        select 1
        from public.pauta_members as member
        where member.pauta_id = p_pauta_id
          and member.client_id = selected.client_id
          and member.membership_status = 'active'
      ) as already_in_pauta,

      (
        select count(*)
        from public.work_items as item
        where item.board_id = v_pauta.board_id
          and item.pauta_id is null
          and item.client_id = selected.client_id
          and item.is_pauta_card = false
          and item.status not in (
            'archived',
            'cancelled'
          )
      ) as legacy_count,

      (
        select count(*)
        from public.client_services as service
        where service.client_id = selected.client_id
          and service.status = 'active'
      ) as active_service_count,

      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'work_item_id', item.id,
              'title', item.title,
              'status', item.status,
              'priority', item.priority,
              'board_column_id', item.board_column_id,
              'responsible_id', item.responsible_id,
              'client_service_id', item.client_service_id,
              'internal_deadline', item.internal_deadline,
              'final_deadline', item.final_deadline,
              'created_at', item.created_at
            )
            order by item.created_at
          ),
          '[]'::jsonb
        )
        from public.work_items as item
        where item.board_id = v_pauta.board_id
          and item.pauta_id is null
          and item.client_id = selected.client_id
          and item.is_pauta_card = false
          and item.status not in (
            'archived',
            'cancelled'
          )
      ) as legacy_candidates
    from selected_clients as selected
    left join public.clients as client
      on client.id = selected.client_id
  ),
  classified as (
    select
      analyzed.*,
      case
        when client_name is null
          or client_status <> 'active'
          then 'INACTIVE_CLIENT'

        when already_in_pauta
          then 'ALREADY_IN_PAUTA'

        when legacy_count = 1
          then 'LEGACY_CARD_AVAILABLE'

        when legacy_count > 1
          then 'MULTIPLE_LEGACY_CARDS'

        when active_service_count = 0
          then 'NO_ACTIVE_SERVICE'

        else 'NO_LEGACY_CARD'
      end as classification
    from analyzed
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'client_id', client_id,
          'client_name', client_name,
          'client_status', client_status,
          'classification', classification,
          'already_in_pauta', already_in_pauta,
          'legacy_count', legacy_count,
          'legacy_candidates', legacy_candidates,
          'active_service_count', active_service_count,
          'service_warning',
            active_service_count = 0
        )
        order by client_name nulls last
      ),
      '[]'::jsonb
    ),

    jsonb_build_object(
      'total',
        count(*),

      'already_in_pauta',
        count(*) filter (
          where classification = 'ALREADY_IN_PAUTA'
        ),

      'legacy_card_available',
        count(*) filter (
          where classification = 'LEGACY_CARD_AVAILABLE'
        ),

      'multiple_legacy_cards',
        count(*) filter (
          where classification = 'MULTIPLE_LEGACY_CARDS'
        ),

      'no_legacy_card',
        count(*) filter (
          where classification = 'NO_LEGACY_CARD'
        ),

      'inactive_client',
        count(*) filter (
          where classification = 'INACTIVE_CLIENT'
        ),

      'no_active_service',
        count(*) filter (
          where classification = 'NO_ACTIVE_SERVICE'
        )
    )
  into
    v_clients,
    v_summary
  from classified;

  return jsonb_build_object(
    'pauta_id', p_pauta_id,
    'board_id', v_pauta.board_id,
    'clients', v_clients,
    'summary', v_summary,
    'requested_by', v_actor
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_pauta_management_snapshot(p_pauta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_members jsonb := '[]'::jsonb;
  v_extra_demands jsonb := '[]'::jsonb;
  v_legacy_candidates jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_dependencies jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_management_actor();

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'member_id', member.id,
        'membership_status', member.membership_status,
        'source', member.source,
        'target_date', member.target_date,
        'target_date_updated_at', member.target_date_updated_at,
        'target_date_updated_by', member.target_date_updated_by,
        'added_by', member.added_by,
        'added_at', member.added_at,
        'removed_by', member.removed_by,
        'removed_at', member.removed_at,
        'metadata', member.metadata,
        'client', jsonb_build_object(
          'id', client.id,
          'name', client.name,
          'status', client.status,
          'responsible_id', client.responsible_id,
          'drive_folder_url', client.drive_folder_url
        ),
        'main_work_item',
          case
            when item.id is null then null
            else jsonb_build_object(
              'id', item.id,
              'title', item.title,
              'status', item.status,
              'priority', item.priority,
              'board_id', item.board_id,
              'board_column_id', item.board_column_id,
              'responsible_id', item.responsible_id,
              'client_service_id', item.client_service_id,
              'internal_deadline', item.internal_deadline,
              'final_deadline', item.final_deadline,
              'completed_at', item.completed_at,
              'programming_covered_until', item.programming_covered_until
            )
          end
      )
      order by
        member.membership_status,
        client.name,
        member.added_at
    ),
    '[]'::jsonb
  )
  into v_members
  from public.pauta_members member
  join public.clients client
    on client.id = member.client_id
  left join public.work_items item
    on item.id = member.main_work_item_id
  where member.pauta_id = p_pauta_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'client_name', client.name,
        'pauta_card_id', item.pauta_card_id,
        'status', item.status,
        'priority', item.priority,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'drive_link', item.drive_link,
        'notes', item.notes,
        'card_tag', item.card_tag,
        'card_tag_color', item.card_tag_color,
        'completed_at', item.completed_at,
        'assignments', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', assignment.id,
                'board_id', assignment.board_id,
                'board_name', board_row.name,
                'board_color', board_row.color,
                'board_column_id', assignment.board_column_id,
                'board_column_name', column_row.name,
                'board_column_color', column_row.color,
                'operational_status', assignment.operational_status,
                'is_required', assignment.is_required,
                'completed_at', assignment.completed_at,
                'assigned_at', assignment.assigned_at
              )
              order by board_row.name
            )
            from public.work_item_board_assignments assignment
            join public.boards board_row
              on board_row.id = assignment.board_id
            join public.board_columns column_row
              on column_row.id = assignment.board_column_id
            where assignment.work_item_id = item.id
              and assignment.assignment_status = 'active'
          ),
          '[]'::jsonb
        )
      )
      order by client.name, item.created_at desc
    ),
    '[]'::jsonb
  )
  into v_extra_demands
  from public.work_items item
  left join public.clients client
    on client.id = item.client_id
  where item.pauta_id = p_pauta_id
    and item.is_pauta_card = false
    and item.status not in ('archived', 'cancelled');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'work_item_id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'client_name', client.name,
        'client_status', client.status,
        'status', item.status,
        'priority', item.priority,
        'board_id', item.board_id,
        'board_column_id', item.board_column_id,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'created_at', item.created_at
      )
      order by client.name, item.created_at
    ),
    '[]'::jsonb
  )
  into v_legacy_candidates
  from public.work_items item
  join public.clients client
    on client.id = item.client_id
  where item.board_id = v_pauta.board_id
    and item.pauta_id is null
    and item.is_pauta_card = false
    and item.status not in ('archived', 'cancelled')
    and not exists (
      select 1
      from public.pauta_members member
      where member.pauta_id = p_pauta_id
        and member.client_id = item.client_id
        and member.membership_status = 'active'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'action', event.action,
        'target_type', event.target_type,
        'target_id', event.target_id,
        'actor_id', event.actor_id,
        'actor',
          case
            when actor.id is null then null
            else jsonb_build_object(
              'id', actor.id,
              'full_name', actor.full_name,
              'display_name', actor.display_name,
              'avatar_url', actor.avatar_url
            )
          end,
        'old_values', event.old_values,
        'new_values', event.new_values,
        'metadata', event.metadata,
        'created_at', event.created_at
      )
      order by event.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select *
    from public.pauta_events
    where pauta_id = p_pauta_id
    order by created_at desc
    limit 300
  ) event
  left join public.profiles actor
    on actor.id = event.actor_id;

  v_dependencies :=
    public.pauta_dependency_summary(p_pauta_id)
    ||
    jsonb_build_object(
      'active_assignments',
        (
          select count(*)
          from public.work_item_board_assignments assignment
          join public.work_items item
            on item.id = assignment.work_item_id
          where item.pauta_id = p_pauta_id
            and assignment.assignment_status = 'active'
        ),
      'pending_required_assignments',
        (
          select count(*)
          from public.work_item_board_assignments assignment
          join public.work_items item
            on item.id = assignment.work_item_id
          where item.pauta_id = p_pauta_id
            and assignment.assignment_status = 'active'
            and assignment.is_required = true
            and not public.v8_assignment_is_complete(
              assignment.operational_status
            )
        )
    );

  return jsonb_build_object(
    'pauta', to_jsonb(v_pauta),
    'members', v_members,
    'extra_demands', v_extra_demands,
    'legacy_candidates', v_legacy_candidates,
    'events', v_events,
    'dependency_summary', v_dependencies,
    'permissions', jsonb_build_object(
      'can_manage', public.app_has_total_access(),
      'can_operate', true
    ),
    'requested_by', v_actor
  );
end;
$function$;

commit;


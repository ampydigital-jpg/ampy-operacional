-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

create or replace function public.create_pauta_demand(
  p_pauta_id uuid,
  p_client_id uuid,
  p_board_column_id uuid,
  p_title text,
  p_client_service_id uuid,
  p_responsible_id uuid,
  p_priority text,
  p_internal_deadline date,
  p_final_deadline date,
  p_drive_link text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
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

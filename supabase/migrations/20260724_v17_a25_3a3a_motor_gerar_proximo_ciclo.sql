-- =========================================================
-- V17-A25.3A3A — MOTOR ATÔMICO DE GERAÇÃO DO PRÓXIMO CICLO
-- =========================================================

begin;

alter table public.work_item_schedule_requirements
  add column if not exists calendar_type text;

alter table public.work_item_schedule_requirements
  drop constraint if exists
    work_item_schedule_requirements_calendar_type_check;

alter table public.work_item_schedule_requirements
  add constraint
    work_item_schedule_requirements_calendar_type_check
  check (
    calendar_type is null
    or calendar_type in (
      'reu_a',
      'cap_e',
      'cap_s'
    )
  );

comment on column
  public.work_item_schedule_requirements.calendar_type
is
  'Tipo de Agenda sugerido para atender a pendência operacional.';

create or replace function public.generate_next_work_item_cycle(
  p_source_id uuid,
  p_client_service_id uuid,
  p_start_date date,
  p_end_date date,
  p_programming_verified boolean,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();

  v_source
    public.work_items%rowtype;

  v_source_column
    public.board_columns%rowtype;

  v_target_column
    public.board_columns%rowtype;

  v_service
    public.client_services%rowtype;

  v_client
    public.clients%rowtype;

  v_existing_successor uuid;
  v_new_id uuid;
  v_next_cycle_number integer;
  v_duration integer;
  v_title text;
  v_drive_link text;
  v_requirement_count integer := 0;
begin
  if v_actor is null then
    raise exception
      'Sessão inválida ou expirada.';
  end if;

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem gerar ciclos.';
  end if;

  if coalesce(trim(p_confirmation), '') <> 'GERAR CICLO' then
    raise exception
      'Confirmação de segurança inválida.';
  end if;

  if coalesce(p_programming_verified, false) is not true then
    raise exception
      'Confirme que a programação do ciclo foi concluída.';
  end if;

  if p_source_id is null then
    raise exception
      'Card de origem não informado.';
  end if;

  if p_client_service_id is null then
    raise exception
      'Selecione o serviço que define o próximo ciclo.';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception
      'Informe as datas do próximo ciclo.';
  end if;

  if p_end_date <= p_start_date then
    raise exception
      'A data final precisa ser posterior à data inicial.';
  end if;

  v_duration :=
    p_end_date - p_start_date;

  if v_duration < 1 or v_duration > 365 then
    raise exception
      'A duração do ciclo precisa estar entre 1 e 365 dias.';
  end if;

  select *
    into v_source
  from public.work_items
  where id = p_source_id
  for update;

  if not found then
    raise exception
      'Card de origem não encontrado.';
  end if;

  if v_source.board_id is null
     or v_source.board_column_id is null then
    raise exception
      'O card não está vinculado a um Quadro e coluna válidos.';
  end if;

  select *
    into v_source_column
  from public.board_columns
  where id = v_source.board_column_id
    and board_id = v_source.board_id;

  if not found then
    raise exception
      'Coluna atual do card não encontrada.';
  end if;

  if v_source_column.automation_role <> 'completed' then
    raise exception
      'Somente cards da coluna Concluído podem gerar o próximo ciclo.';
  end if;

  if v_source.status not in ('done', 'delivered') then
    raise exception
      'O card precisa estar concluído antes de gerar o próximo ciclo.';
  end if;

  if v_source.client_id is null then
    raise exception
      'O card concluído não possui cliente vinculado.';
  end if;

  select id
    into v_existing_successor
  from public.work_items
  where generated_from_cycle_id = v_source.id
  limit 1;

  if v_existing_successor is not null then
    raise exception
      'Este card já gerou um próximo ciclo.';
  end if;

  select *
    into v_service
  from public.client_services
  where id = p_client_service_id
    and client_id = v_source.client_id
    and status = 'active'
  for update;

  if not found then
    raise exception
      'O serviço selecionado não pertence ao cliente ou não está ativo.';
  end if;

  if v_service.cycle_duration_days is null then
    raise exception
      'Configure a duração do ciclo neste serviço antes de continuar.';
  end if;

  select *
    into v_client
  from public.clients
  where id = v_source.client_id
    and status = 'active';

  if not found then
    raise exception
      'Cliente não encontrado ou fora da operação.';
  end if;

  select *
    into v_target_column
  from public.board_columns
  where board_id = v_source.board_id
    and automation_role = 'alignment'
  limit 1;

  if not found then
    raise exception
      'A coluna técnica Reunião de Alinhamento não foi encontrada.';
  end if;

  select
    coalesce(
      max(cycle_number),
      0
    ) + 1
    into v_next_cycle_number
  from public.work_items
  where client_id = v_source.client_id
    and client_service_id = p_client_service_id;

  v_title :=
    trim(v_client.name)
    || ' — '
    || to_char(p_start_date, 'DD/MM')
    || '–'
    || to_char(p_end_date, 'DD/MM');

  v_drive_link :=
    coalesce(
      nullif(
        trim(v_source.drive_link),
        ''
      ),
      nullif(
        trim(v_client.drive_folder_url),
        ''
      )
    );

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

    generated_from_cycle_id,
    cycle_number,
    cycle_duration_days_snapshot,
    generated_at,
    generated_by
  )
  values (
    v_title,
    null,
    coalesce(
      v_source.type,
      'Planejamento'
    ),
    coalesce(
      v_source.origin,
      'planned'
    ),
    'quadro',
    v_target_column.operational_status,
    coalesce(
      v_source.priority,
      'normal'
    ),

    v_source.client_id,
    v_service.id,
    v_source.responsible_id,

    v_source.board_id,
    v_target_column.id,

    p_start_date,
    p_end_date,

    v_drive_link,
    null,
    null,

    v_actor,
    null,

    v_source.id,
    v_next_cycle_number,
    v_duration,
    now(),
    v_actor
  )
  returning id
    into v_new_id;

  if v_service.requires_alignment_meeting then
    insert into
      public.work_item_schedule_requirements (
        work_item_id,
        requirement_type,
        status,
        calendar_type,
        created_by
      )
    values (
      v_new_id,
      'alignment_meeting',
      'pending',
      'reu_a',
      v_actor
    );

    v_requirement_count :=
      v_requirement_count + 1;
  end if;

  if v_service.requires_capture then
    insert into
      public.work_item_schedule_requirements (
        work_item_id,
        requirement_type,
        status,
        calendar_type,
        created_by
      )
    values (
      v_new_id,
      'capture',
      'pending',
      v_service.default_capture_type,
      v_actor
    );

    v_requirement_count :=
      v_requirement_count + 1;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_source.id,
    v_actor,
    'cycle_generated',
    null,
    v_new_id::text
  );

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_new_id,
    v_actor,
    'generated_from_cycle',
    v_source.id::text,
    v_title
  );

  return jsonb_build_object(
    'success',
    true,

    'source_id',
    v_source.id,

    'new_id',
    v_new_id,

    'title',
    v_title,

    'cycle_number',
    v_next_cycle_number,

    'start_date',
    p_start_date,

    'end_date',
    p_end_date,

    'duration_days',
    v_duration,

    'configured_duration_days',
    v_service.cycle_duration_days,

    'requirements_created',
    v_requirement_count,

    'drive_link',
    v_drive_link
  );

exception
  when unique_violation then
    raise exception
      'Este card já gerou um próximo ciclo.';
end;
$function$;

revoke all
on function public.generate_next_work_item_cycle(
  uuid,
  uuid,
  date,
  date,
  boolean,
  text
)
from public;

grant execute
on function public.generate_next_work_item_cycle(
  uuid,
  uuid,
  date,
  date,
  boolean,
  text
)
to authenticated;

comment on function
  public.generate_next_work_item_cycle(
    uuid,
    uuid,
    date,
    date,
    boolean,
    text
  )
is
  'Gera atomicamente um novo ciclo a partir de um card concluído.';

commit;

select
  'V17-A25.3A3A aplicada com sucesso' as resultado;
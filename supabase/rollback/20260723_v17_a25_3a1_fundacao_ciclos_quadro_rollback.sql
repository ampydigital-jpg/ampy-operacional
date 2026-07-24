-- ROLLBACK V17-A25.3A1
-- Usar somente antes de iniciar o uso operacional dos novos ciclos.

begin;

do $$
declare
  v_total_requirements integer;
  v_generated_cycles integer;
  v_configured_services integer;

  v_board uuid;
  v_planning uuid;
  v_capture uuid;
  v_production uuid;
  v_organization uuid;
  v_approval uuid;
  v_metrics uuid;
  v_alignment uuid;
  v_programming uuid;
  v_completed uuid;
begin
  if to_regclass(
    'public.work_item_schedule_requirements'
  ) is not null then
    select count(*)
      into v_total_requirements
    from public.work_item_schedule_requirements;
  else
    v_total_requirements := 0;
  end if;

  select count(*)
    into v_generated_cycles
  from public.work_items
  where generated_from_cycle_id is not null
     or generated_at is not null
     or generated_by is not null;

  select count(*)
    into v_configured_services
  from public.client_services
  where cycle_duration_days is not null
     or default_capture_type is not null;

  if (
    v_total_requirements > 0
    or v_generated_cycles > 0
    or v_configured_services > 0
  ) then
    raise exception
      'Rollback bloqueado: a estrutura de ciclos já possui dados operacionais.';
  end if;

  select id
    into v_board
  from public.boards
  where lower(trim(name)) =
        lower(trim('Operação Geral'))
    and status = 'active'
  order by created_at
  limit 1;

  if v_board is not null then
    select id into v_planning
    from public.board_columns
    where board_id = v_board
      and automation_role = 'planning'
    limit 1;

    select id into v_capture
    from public.board_columns
    where board_id = v_board
      and automation_role = 'capture'
    limit 1;

    select id into v_production
    from public.board_columns
    where board_id = v_board
      and automation_role = 'production'
    limit 1;

    select id into v_organization
    from public.board_columns
    where board_id = v_board
      and automation_role = 'organization'
    limit 1;

    select id into v_approval
    from public.board_columns
    where board_id = v_board
      and automation_role = 'approval'
    limit 1;

    select id into v_metrics
    from public.board_columns
    where board_id = v_board
      and automation_role = 'legacy_metrics'
    limit 1;

    select id into v_alignment
    from public.board_columns
    where board_id = v_board
      and automation_role = 'alignment'
    limit 1;

    select id into v_programming
    from public.board_columns
    where board_id = v_board
      and automation_role = 'programming'
    limit 1;

    select id into v_completed
    from public.board_columns
    where board_id = v_board
      and automation_role = 'completed'
    limit 1;

    if exists (
      select 1
      from public.work_items
      where board_column_id in (
        v_programming,
        v_completed
      )
    ) then
      raise exception
        'Rollback bloqueado: Programação ou Concluído já possuem cards.';
    end if;

    delete from public.board_columns
    where id in (
      v_programming,
      v_completed
    );

    update public.board_columns
    set
      name = 'Planejamento Estratégico',
      operational_status = 'done',
      position = 0,
      updated_at = now()
    where id = v_planning;

    update public.board_columns
    set
      name = 'Captação',
      operational_status = 'waiting',
      position = 1,
      updated_at = now()
    where id = v_capture;

    update public.board_columns
    set
      name = 'Edição | Design',
      operational_status = 'in_review',
      position = 2,
      updated_at = now()
    where id = v_production;

    update public.board_columns
    set
      name = 'Organização Feed',
      operational_status = 'awaiting_approval',
      position = 3,
      updated_at = now()
    where id = v_organization;

    update public.board_columns
    set
      name = 'Aprovação do Cliente',
      operational_status = 'scheduled',
      position = 4,
      updated_at = now()
    where id = v_approval;

    update public.board_columns
    set
      name = 'Análise de Métricas',
      operational_status = 'not_started',
      position = 5,
      updated_at = now()
    where id = v_metrics;

    update public.board_columns
    set
      name = 'Reunião de Alinhamento',
      operational_status = 'not_started',
      position = 6,
      updated_at = now()
    where id = v_alignment;
  end if;
end
$$;

drop table if exists
  public.work_item_schedule_requirements;

drop index if exists
  public.work_items_generated_from_cycle_unique;

drop index if exists
  public.idx_work_items_cycle_number;

drop index if exists
  public.idx_work_items_generated_by;

alter table public.work_items
  drop constraint if exists
    work_items_cycle_number_check,
  drop constraint if exists
    work_items_cycle_duration_snapshot_check,
  drop column if exists
    generated_from_cycle_id,
  drop column if exists
    cycle_number,
  drop column if exists
    cycle_duration_days_snapshot,
  drop column if exists
    generated_at,
  drop column if exists
    generated_by;

alter table public.client_services
  drop constraint if exists
    client_services_cycle_duration_days_check,
  drop constraint if exists
    client_services_default_capture_type_check,
  drop constraint if exists
    client_services_capture_configuration_check,
  drop column if exists
    cycle_duration_days,
  drop column if exists
    requires_alignment_meeting,
  drop column if exists
    requires_capture,
  drop column if exists
    default_capture_type;

drop index if exists
  public.board_columns_automation_role_unique;

drop index if exists
  public.idx_board_columns_automation_role;

alter table public.board_columns
  drop constraint if exists
    board_columns_automation_role_check,
  drop column if exists
    automation_role;

commit;

select
  'Rollback V17-A25.3A1 aplicado' as resultado;
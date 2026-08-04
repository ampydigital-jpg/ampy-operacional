begin;

-- =========================================================
-- V9 — OPERAÇÃO COMPLETA, CONCLUSÕES E DASHBOARDS
-- =========================================================

alter table public.calendar_events
  add column if not exists completion_status text not null default 'open',
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid,
  add column if not exists completion_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_completion_status_chk'
      and conrelid = 'public.calendar_events'::regclass
  ) then
    alter table public.calendar_events
      add constraint calendar_events_completion_status_chk
      check (completion_status in ('open', 'completed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_completed_by_fk'
      and conrelid = 'public.calendar_events'::regclass
  ) then
    alter table public.calendar_events
      add constraint calendar_events_completed_by_fk
      foreign key (completed_by)
      references public.profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_completion_state_chk'
      and conrelid = 'public.calendar_events'::regclass
  ) then
    alter table public.calendar_events
      add constraint calendar_events_completion_state_chk
      check (
        (
          completion_status = 'completed'
          and completed_at is not null
        )
        or
        (
          completion_status = 'open'
          and completed_at is null
          and completed_by is null
        )
      );
  end if;
end;
$$;

create index if not exists calendar_events_completion_idx
  on public.calendar_events(completion_status, completed_at);

create table if not exists public.calendar_event_history (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  actor_id uuid,
  action text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint calendar_event_history_event_fk
    foreign key (event_id)
    references public.calendar_events(id)
    on delete cascade,

  constraint calendar_event_history_actor_fk
    foreign key (actor_id)
    references public.profiles(id)
    on delete set null
);

create index if not exists calendar_event_history_event_idx
  on public.calendar_event_history(event_id, created_at desc);

alter table public.calendar_event_history enable row level security;

drop policy if exists calendar_event_history_select_authenticated
  on public.calendar_event_history;

create policy calendar_event_history_select_authenticated
  on public.calendar_event_history
  for select
  to authenticated
  using (true);

grant select on public.calendar_event_history to authenticated, service_role;
revoke insert, update, delete on public.calendar_event_history from public, anon, authenticated;

-- Cards provenientes da Pauta chegam aos setores em modo simples.
create or replace function public.v9_prepare_simple_assignment_card()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce(new.metadata ->> 'source', '') in (
    'pauta_distribution',
    'pauta_existing_distribution'
  ) then
    new.metadata :=
      coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'display_mode', 'simple',
        'card_scope', 'sector'
      );
  end if;

  return new;
end;
$$;

drop trigger if exists work_item_board_assignments_simple_card_trg
  on public.work_item_board_assignments;

create trigger work_item_board_assignments_simple_card_trg
before insert or update of metadata
on public.work_item_board_assignments
for each row
execute function public.v9_prepare_simple_assignment_card();

update public.work_item_board_assignments
set metadata = coalesce(metadata, '{}'::jsonb)
  || jsonb_build_object(
    'display_mode', 'simple',
    'card_scope', 'sector'
  )
where coalesce(metadata ->> 'source', '') in (
  'pauta_distribution',
  'pauta_existing_distribution'
)
  and coalesce(metadata ->> 'display_mode', '') <> 'simple';

create or replace function public.distribute_existing_pauta_demands(
  p_pauta_id uuid,
  p_work_item_ids jsonb,
  p_targets jsonb,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_work_item_id uuid;
  v_item public.work_items%rowtype;
  v_target jsonb;
  v_board_id uuid;
  v_column_id uuid;
  v_is_required boolean;
  v_column public.board_columns%rowtype;
  v_assignment public.work_item_board_assignments%rowtype;
  v_count integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
begin
  v_actor := public.pauta_current_active_actor();

  if not public.app_has_total_access() then
    raise exception 'Acesso Total é obrigatório para distribuir demandas.';
  end if;

  if trim(coalesce(p_confirmation, '')) <> 'DISTRIBUIR DEMANDAS' then
    raise exception 'Confirmação inválida. Digite DISTRIBUIR DEMANDAS.';
  end if;

  if p_work_item_ids is null
     or jsonb_typeof(p_work_item_ids) <> 'array'
     or jsonb_array_length(p_work_item_ids) = 0
  then
    raise exception 'Selecione pelo menos uma demanda.';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) = 0
  then
    raise exception 'Selecione pelo menos um Quadro de destino.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception 'Somente Pautas abertas ou em rascunho podem distribuir demandas.';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(p_targets)
  loop
    v_board_id := (v_target ->> 'board_id')::uuid;
    v_column_id := (v_target ->> 'board_column_id')::uuid;

    select column_row.*
    into v_column
    from public.board_columns column_row
    join public.boards board_row
      on board_row.id = column_row.board_id
    where column_row.id = v_column_id
      and column_row.board_id = v_board_id
      and board_row.board_kind = 'custom'
      and board_row.status = 'active';

    if not found then
      raise exception 'Um dos Quadros ou colunas de destino é inválido.';
    end if;
  end loop;

  for v_work_item_id in
    select value::uuid
    from jsonb_array_elements_text(p_work_item_ids) as ids(value)
  loop
    select *
    into v_item
    from public.work_items
    where id = v_work_item_id
      and pauta_id = p_pauta_id
      and is_pauta_card = false
      and status not in ('archived', 'cancelled')
    for update;

    if not found then
      raise exception 'Uma das demandas não pertence à Pauta ou não está ativa.';
    end if;

    for v_target in
      select value
      from jsonb_array_elements(p_targets)
    loop
      v_board_id := (v_target ->> 'board_id')::uuid;
      v_column_id := (v_target ->> 'board_column_id')::uuid;
      v_is_required := coalesce((v_target ->> 'is_required')::boolean, true);

      select *
      into v_column
      from public.board_columns
      where id = v_column_id
        and board_id = v_board_id;

      select *
      into v_assignment
      from public.work_item_board_assignments
      where work_item_id = v_work_item_id
        and board_id = v_board_id
        and assignment_status = 'active'
      for update;

      if found then
        update public.work_item_board_assignments
        set
          board_column_id = v_column_id,
          operational_status = v_column.operational_status,
          is_required = v_is_required,
          metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'source', 'pauta_existing_distribution',
              'pauta_id', p_pauta_id,
              'display_mode', 'simple',
              'card_scope', 'sector'
            ),
          completed_at = case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then coalesce(completed_at, now())
            else null
          end,
          completed_by = case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then coalesce(completed_by, v_actor)
            else null
          end,
          updated_at = now()
        where id = v_assignment.id;

        v_updated := v_updated + 1;
      else
        insert into public.work_item_board_assignments (
          work_item_id,
          board_id,
          board_column_id,
          operational_status,
          is_required,
          assignment_status,
          position,
          assigned_by,
          assigned_at,
          completed_by,
          completed_at,
          metadata
        )
        values (
          v_work_item_id,
          v_board_id,
          v_column_id,
          v_column.operational_status,
          v_is_required,
          'active',
          coalesce(
            (
              select max(position) + 1
              from public.work_item_board_assignments
              where board_id = v_board_id
                and board_column_id = v_column_id
                and assignment_status = 'active'
            ),
            0
          ),
          v_actor,
          now(),
          case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then v_actor
            else null
          end,
          case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then now()
            else null
          end,
          jsonb_build_object(
            'source', 'pauta_existing_distribution',
            'pauta_id', p_pauta_id,
            'display_mode', 'simple',
            'card_scope', 'sector'
          )
        )
        returning *
        into v_assignment;

        v_created := v_created + 1;
      end if;

      perform public.v8_log_assignment_event(
        v_assignment.id,
        v_work_item_id,
        p_pauta_id,
        v_board_id,
        v_column_id,
        v_actor,
        'assignment_distributed',
        '{}'::jsonb,
        jsonb_build_object(
          'board_id', v_board_id,
          'board_column_id', v_column_id,
          'is_required', v_is_required,
          'display_mode', 'simple'
        ),
        jsonb_build_object('source', 'pauta_management')
      );

      v_count := v_count + 1;
    end loop;

    perform public.recalculate_work_item_global_status(v_work_item_id);

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'demand_distributed_multiboard',
      'work_item',
      v_work_item_id,
      '{}'::jsonb,
      jsonb_build_object('targets', p_targets),
      jsonb_build_object('display_mode', 'simple')
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'assignments_processed', v_count,
    'assignments_created', v_created,
    'assignments_updated', v_updated
  );
end;
$$;

create or replace function public.set_work_item_board_assignment_completion(
  p_assignment_id uuid,
  p_completed boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_role text;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_action text;
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
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta etapa.';
  end if;

  v_old := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  if p_completed then
    select *
    into v_target
    from public.board_columns
    where board_id = v_assignment.board_id
      and operational_status in ('done', 'delivered', 'approved')
    order by position
    limit 1;

    update public.work_item_board_assignments
    set
      board_column_id = coalesce(v_target.id, board_column_id),
      operational_status = coalesce(v_target.operational_status, 'done'),
      completed_at = now(),
      completed_by = v_actor,
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('completion_note', nullif(trim(coalesce(p_note, '')), '')),
      updated_at = now()
    where id = p_assignment_id
    returning *
    into v_assignment;

    v_action := 'assignment_completed';
  else
    select *
    into v_target
    from public.board_columns
    where board_id = v_assignment.board_id
      and operational_status not in ('done', 'delivered', 'approved')
    order by position
    limit 1;

    update public.work_item_board_assignments
    set
      board_column_id = coalesce(v_target.id, board_column_id),
      operational_status = coalesce(v_target.operational_status, 'in_progress'),
      completed_at = null,
      completed_by = null,
      metadata = coalesce(metadata, '{}'::jsonb)
        - 'completion_note',
      updated_at = now()
    where id = p_assignment_id
    returning *
    into v_assignment;

    v_action := 'assignment_reopened';
  end if;

  v_new := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  perform public.v8_log_assignment_event(
    v_assignment.id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    v_assignment.board_column_id,
    v_actor,
    v_action,
    v_old,
    v_new,
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), ''))
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      v_action,
      'work_item',
      v_item.id,
      v_old,
      v_new,
      jsonb_build_object('assignment_id', v_assignment.id)
    );
  end if;

  perform public.recalculate_work_item_global_status(v_assignment.work_item_id);

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'work_item_id', v_assignment.work_item_id,
    'completed', p_completed,
    'completed_at', v_assignment.completed_at
  );
end;
$$;

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
as $$
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

  if v_item.is_pauta_card then
    raise exception 'O card mensal da Pauta não pode ser concluído como demanda comum.';
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
      'assignments', v_assignment_count
    )::text
  );

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'completed', p_completed,
    'assignments_updated', v_assignment_count
  );
end;
$$;

create or replace function public.set_calendar_event_completion(
  p_event_id uuid,
  p_completed boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_role text;
  v_event public.calendar_events%rowtype;
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
  into v_event
  from public.calendar_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Agenda não encontrada.';
  end if;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_event.responsible_id is distinct from v_actor
     and v_event.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta agenda.';
  end if;

  v_old := jsonb_build_object(
    'completion_status', v_event.completion_status,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by,
    'completion_note', v_event.completion_note
  );

  update public.calendar_events
  set
    completion_status = case when p_completed then 'completed' else 'open' end,
    completed_at = case when p_completed then now() else null end,
    completed_by = case when p_completed then v_actor else null end,
    completion_note = case
      when p_completed then nullif(trim(coalesce(p_note, '')), '')
      else null
    end,
    updated_at = now()
  where id = p_event_id
  returning *
  into v_event;

  v_new := jsonb_build_object(
    'completion_status', v_event.completion_status,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by,
    'completion_note', v_event.completion_note
  );

  insert into public.calendar_event_history (
    event_id,
    actor_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_event_id,
    v_actor,
    case when p_completed then 'completed' else 'reopened' end,
    v_old,
    v_new,
    jsonb_build_object('work_item_id', v_event.work_item_id)
  );

  if v_event.work_item_id is not null then
    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_event.work_item_id,
      v_actor,
      case
        when p_completed then 'calendar_event_completed'
        else 'calendar_event_reopened'
      end,
      v_old::text,
      v_new::text
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'completed', p_completed,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by
  );
end;
$$;

revoke all on function public.distribute_existing_pauta_demands(uuid, jsonb, jsonb, text)
  from public, anon;
revoke all on function public.set_work_item_board_assignment_completion(uuid, boolean, text)
  from public, anon;
revoke all on function public.set_work_item_completion(uuid, boolean, boolean, text)
  from public, anon;
revoke all on function public.set_calendar_event_completion(uuid, boolean, text)
  from public, anon;

grant execute on function public.distribute_existing_pauta_demands(uuid, jsonb, jsonb, text)
  to authenticated, service_role;
grant execute on function public.set_work_item_board_assignment_completion(uuid, boolean, text)
  to authenticated, service_role;
grant execute on function public.set_work_item_completion(uuid, boolean, boolean, text)
  to authenticated, service_role;
grant execute on function public.set_calendar_event_completion(uuid, boolean, text)
  to authenticated, service_role;

comment on column public.calendar_events.completion_status is
  'Estado operacional de realização da agenda. Independente de confirmed.';
comment on table public.calendar_event_history is
  'Histórico auditável de conclusão e reabertura das agendas.';

rollback;

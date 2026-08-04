-- ============================================================
-- V8-B — ENTREGA FUNCIONAL CONSOLIDADA DE PAUTAS MULTIQUADRO
-- Base esperada: f2ef1efdae7f4bfd498b567f0016e147ccc71ffd
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. DATA-META INDIVIDUAL POR CLIENTE
-- ------------------------------------------------------------

alter table public.pauta_members
  add column if not exists target_date date,
  add column if not exists target_date_updated_at timestamptz,
  add column if not exists target_date_updated_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_target_date_updated_by_fkey'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_target_date_updated_by_fkey
      foreign key (target_date_updated_by)
      references public.profiles(id)
      on delete set null;
  end if;
end;
$$;

update public.pauta_members member
set
  target_date = pauta.scheduled_until_date,
  target_date_updated_at = coalesce(member.updated_at, now())
from public.pautas pauta
where pauta.id = member.pauta_id
  and member.target_date is null;

create index if not exists pauta_members_target_date_idx
  on public.pauta_members(pauta_id, target_date)
  where membership_status = 'active';

-- ------------------------------------------------------------
-- 2. ASSOCIAÇÃO MULTIQUADRO
-- ------------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'board_columns_board_id_id_key'
      and conrelid = 'public.board_columns'::regclass
  ) then
    alter table public.board_columns
      add constraint board_columns_board_id_id_key
      unique (board_id, id);
  end if;
end;
$$;

create table if not exists public.work_item_board_assignments (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null,
  board_id uuid not null,
  board_column_id uuid not null,
  operational_status text not null default 'not_started',
  is_required boolean not null default true,
  assignment_status text not null default 'active',
  position bigint not null default 0,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  completed_by uuid,
  completed_at timestamptz,
  removed_by uuid,
  removed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint work_item_board_assignments_work_item_fk
    foreign key (work_item_id)
    references public.work_items(id)
    on delete cascade,

  constraint work_item_board_assignments_board_fk
    foreign key (board_id)
    references public.boards(id)
    on delete restrict,

  constraint work_item_board_assignments_column_fk
    foreign key (board_id, board_column_id)
    references public.board_columns(board_id, id)
    on delete restrict,

  constraint work_item_board_assignments_assigned_by_fk
    foreign key (assigned_by)
    references public.profiles(id)
    on delete set null,

  constraint work_item_board_assignments_completed_by_fk
    foreign key (completed_by)
    references public.profiles(id)
    on delete set null,

  constraint work_item_board_assignments_removed_by_fk
    foreign key (removed_by)
    references public.profiles(id)
    on delete set null,

  constraint work_item_board_assignments_status_chk
    check (
      operational_status in (
        'not_started',
        'in_progress',
        'waiting',
        'blocked',
        'in_review',
        'awaiting_approval',
        'approved',
        'scheduled',
        'delivered',
        'done',
        'cancelled',
        'archived'
      )
    ),

  constraint work_item_board_assignments_assignment_status_chk
    check (assignment_status in ('active', 'removed')),

  constraint work_item_board_assignments_removed_state_chk
    check (
      (
        assignment_status = 'active'
        and removed_at is null
      )
      or
      (
        assignment_status = 'removed'
        and removed_at is not null
      )
    ),

  constraint work_item_board_assignments_completed_state_chk
    check (
      (
        operational_status in ('done', 'delivered', 'approved')
        and completed_at is not null
      )
      or
      (
        operational_status not in ('done', 'delivered', 'approved')
      )
    )
);

create unique index if not exists work_item_board_assignments_active_uidx
  on public.work_item_board_assignments(work_item_id, board_id)
  where assignment_status = 'active';

create index if not exists work_item_board_assignments_board_column_idx
  on public.work_item_board_assignments(board_id, board_column_id, assignment_status, position);

create index if not exists work_item_board_assignments_work_item_idx
  on public.work_item_board_assignments(work_item_id, assignment_status);

create index if not exists work_item_board_assignments_status_idx
  on public.work_item_board_assignments(operational_status, assignment_status);

create table if not exists public.work_item_board_assignment_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid,
  work_item_id uuid not null,
  pauta_id uuid,
  board_id uuid,
  board_column_id uuid,
  actor_id uuid,
  action text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint work_item_board_assignment_events_assignment_fk
    foreign key (assignment_id)
    references public.work_item_board_assignments(id)
    on delete set null,

  constraint work_item_board_assignment_events_work_item_fk
    foreign key (work_item_id)
    references public.work_items(id)
    on delete cascade,

  constraint work_item_board_assignment_events_pauta_fk
    foreign key (pauta_id)
    references public.pautas(id)
    on delete set null,

  constraint work_item_board_assignment_events_board_fk
    foreign key (board_id)
    references public.boards(id)
    on delete set null,

  constraint work_item_board_assignment_events_column_fk
    foreign key (board_column_id)
    references public.board_columns(id)
    on delete set null,

  constraint work_item_board_assignment_events_actor_fk
    foreign key (actor_id)
    references public.profiles(id)
    on delete set null,

  constraint work_item_board_assignment_events_action_chk
    check (char_length(trim(action)) between 2 and 80)
);

create index if not exists work_item_board_assignment_events_item_created_idx
  on public.work_item_board_assignment_events(work_item_id, created_at desc);

create index if not exists work_item_board_assignment_events_assignment_created_idx
  on public.work_item_board_assignment_events(assignment_id, created_at desc);

create index if not exists work_item_board_assignment_events_pauta_created_idx
  on public.work_item_board_assignment_events(pauta_id, created_at desc);

-- ------------------------------------------------------------
-- 3. RLS
-- ------------------------------------------------------------

alter table public.work_item_board_assignments enable row level security;
alter table public.work_item_board_assignment_events enable row level security;

drop policy if exists work_item_board_assignments_select_active
  on public.work_item_board_assignments;

create policy work_item_board_assignments_select_active
  on public.work_item_board_assignments
  for select
  to authenticated
  using (public.app_is_active_user());

drop policy if exists work_item_board_assignment_events_select_active
  on public.work_item_board_assignment_events;

create policy work_item_board_assignment_events_select_active
  on public.work_item_board_assignment_events
  for select
  to authenticated
  using (public.app_is_active_user());

revoke insert, update, delete
  on public.work_item_board_assignments
  from anon, authenticated;

revoke insert, update, delete
  on public.work_item_board_assignment_events
  from anon, authenticated;

grant select
  on public.work_item_board_assignments,
     public.work_item_board_assignment_events
  to authenticated;

-- ------------------------------------------------------------
-- 4. STATUS GLOBAL DERIVADO
-- ------------------------------------------------------------

create or replace function public.v8_assignment_is_complete(
  p_status text
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_status, '') in ('done', 'delivered', 'approved');
$$;

create or replace function public.recalculate_work_item_global_status(
  p_work_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_item public.work_items%rowtype;
  v_active_count integer := 0;
  v_required_count integer := 0;
  v_all_complete boolean := false;
  v_next_status text := 'not_started';
  v_completed_at timestamptz;
  v_completed_by uuid;
  v_single_board_id uuid;
  v_single_column_id uuid;
begin
  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'WORK_ITEM_NOT_FOUND'
    );
  end if;

  select
    count(*),
    count(*) filter (where is_required)
  into
    v_active_count,
    v_required_count
  from public.work_item_board_assignments
  where work_item_id = p_work_item_id
    and assignment_status = 'active';

  if v_active_count = 0 then
    return jsonb_build_object(
      'success', true,
      'work_item_id', p_work_item_id,
      'assignments', 0,
      'status', v_item.status
    );
  end if;

  with effective as (
    select *
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
      and (
        v_required_count = 0
        or is_required = true
      )
  )
  select
    bool_and(public.v8_assignment_is_complete(operational_status)),
    max(completed_at),
    (
      array_agg(
        completed_by
        order by completed_at desc nulls last
      )
    )[1]
  into
    v_all_complete,
    v_completed_at,
    v_completed_by
  from effective;

  if coalesce(v_all_complete, false) then
    v_next_status := 'done';
  else
    with effective as (
      select *
      from public.work_item_board_assignments
      where work_item_id = p_work_item_id
        and assignment_status = 'active'
        and (
          v_required_count = 0
          or is_required = true
        )
    )
    select operational_status
    into v_next_status
    from effective
    where not public.v8_assignment_is_complete(operational_status)
    order by
      case operational_status
        when 'blocked' then 1
        when 'waiting' then 2
        when 'awaiting_approval' then 3
        when 'in_review' then 4
        when 'in_progress' then 5
        when 'scheduled' then 6
        when 'not_started' then 7
        else 8
      end,
      updated_at desc
    limit 1;

    v_next_status := coalesce(v_next_status, 'not_started');
    v_completed_at := null;
    v_completed_by := null;
  end if;

  if v_item.pauta_id is null and v_active_count = 1 then
    select board_id, board_column_id
    into v_single_board_id, v_single_column_id
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
    limit 1;
  else
    v_single_board_id := null;
    v_single_column_id := null;
  end if;

  update public.work_items
  set
    status = v_next_status,
    completed_at =
      case
        when v_next_status = 'done'
          then coalesce(v_completed_at, now())
        else null
      end,
    completed_by =
      case
        when v_next_status = 'done'
          then v_completed_by
        else null
      end,
    closed_at =
      case
        when v_next_status = 'done'
          then coalesce(v_completed_at, now())
        else null
      end,
    board_id = v_single_board_id,
    board_column_id = v_single_column_id,
    updated_at = now()
  where id = p_work_item_id;

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'assignments', v_active_count,
    'required_assignments', v_required_count,
    'status', v_next_status
  );
end;
$$;

create or replace function public.v8_assignment_after_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_work_item_global_status(old.work_item_id);
    return old;
  end if;

  perform public.recalculate_work_item_global_status(new.work_item_id);

  if tg_op = 'UPDATE'
     and old.work_item_id is distinct from new.work_item_id
  then
    perform public.recalculate_work_item_global_status(old.work_item_id);
  end if;

  return new;
end;
$$;

drop trigger if exists work_item_board_assignments_recalculate_trg
  on public.work_item_board_assignments;

create trigger work_item_board_assignments_recalculate_trg
after insert or update or delete
on public.work_item_board_assignments
for each row
execute function public.v8_assignment_after_change();

-- ------------------------------------------------------------
-- 5. DUAL-WRITE PARA QUADROS EXISTENTES
-- ------------------------------------------------------------

create or replace function public.v8_sync_assignment_from_work_item()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_old_custom boolean := false;
  v_new_custom boolean := false;
  v_new_status text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_actor := coalesce(
    auth.uid(),
    new.created_by,
    new.responsible_id
  );

  if tg_op = 'UPDATE' and old.board_id is not null then
    select exists(
      select 1
      from public.boards
      where id = old.board_id
        and board_kind = 'custom'
    )
    into v_old_custom;
  end if;

  if new.board_id is not null then
    select exists(
      select 1
      from public.boards
      where id = new.board_id
        and board_kind = 'custom'
        and status = 'active'
    )
    into v_new_custom;
  end if;

  if new.status in ('archived', 'cancelled')
     or (
       tg_op = 'UPDATE'
       and old.pauta_id is not null
       and new.pauta_id is null
     )
  then
    update public.work_item_board_assignments
    set
      assignment_status = 'removed',
      removed_at = now(),
      removed_by = v_actor,
      updated_at = now(),
      metadata =
        metadata ||
        jsonb_build_object(
          'removed_by_work_item_sync', true
        )
    where work_item_id = new.id
      and assignment_status = 'active';

    return new;
  end if;

  if tg_op = 'UPDATE'
     and v_old_custom
     and (
       old.board_id is distinct from new.board_id
       or old.board_column_id is distinct from new.board_column_id
     )
  then
    update public.work_item_board_assignments
    set
      assignment_status = 'removed',
      removed_at = now(),
      removed_by = v_actor,
      updated_at = now()
    where work_item_id = new.id
      and board_id = old.board_id
      and assignment_status = 'active';
  end if;

  if v_new_custom and new.board_column_id is not null then
    select operational_status
    into v_new_status
    from public.board_columns
    where id = new.board_column_id
      and board_id = new.board_id;

    if v_new_status is not null then
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
        new.id,
        new.board_id,
        new.board_column_id,
        coalesce(v_new_status, new.status, 'not_started'),
        true,
        'active',
        extract(epoch from now())::bigint,
        v_actor,
        coalesce(new.created_at, now()),
        case
          when public.v8_assignment_is_complete(
            coalesce(v_new_status, new.status)
          )
            then new.completed_by
          else null
        end,
        case
          when public.v8_assignment_is_complete(
            coalesce(v_new_status, new.status)
          )
            then coalesce(new.completed_at, now())
          else null
        end,
        jsonb_build_object(
          'source', 'legacy_dual_write'
        )
      )
      on conflict (work_item_id, board_id)
      where assignment_status = 'active'
      do update set
        board_column_id = excluded.board_column_id,
        operational_status = excluded.operational_status,
        completed_by = excluded.completed_by,
        completed_at = excluded.completed_at,
        updated_at = now();
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists work_items_sync_assignment_trg
  on public.work_items;

create trigger work_items_sync_assignment_trg
after insert or update of
  board_id,
  board_column_id,
  status,
  completed_at,
  completed_by,
  pauta_id
on public.work_items
for each row
execute function public.v8_sync_assignment_from_work_item();

-- ------------------------------------------------------------
-- 6. BACKFILL DOS QUADROS PERSONALIZADOS
-- Os 35 cards legados do Quadro de Pauta são excluídos naturalmente.
-- ------------------------------------------------------------

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
select
  item.id,
  item.board_id,
  item.board_column_id,
  coalesce(column_row.operational_status, item.status),
  true,
  'active',
  row_number() over (
    partition by item.board_id, item.board_column_id
    order by item.created_at, item.id
  ),
  coalesce(item.created_by, item.responsible_id),
  item.created_at,
  case
    when public.v8_assignment_is_complete(
      coalesce(column_row.operational_status, item.status)
    )
      then item.completed_by
    else null
  end,
  case
    when public.v8_assignment_is_complete(
      coalesce(column_row.operational_status, item.status)
    )
      then coalesce(item.completed_at, item.updated_at)
    else null
  end,
  jsonb_build_object(
    'source', 'legacy_backfill',
    'legacy_board_id', item.board_id,
    'legacy_board_column_id', item.board_column_id
  )
from public.work_items item
join public.boards board_row
  on board_row.id = item.board_id
 and board_row.board_kind = 'custom'
join public.board_columns column_row
  on column_row.id = item.board_column_id
 and column_row.board_id = item.board_id
where item.status not in ('archived', 'cancelled')
on conflict (work_item_id, board_id)
where assignment_status = 'active'
do nothing;

-- ------------------------------------------------------------
-- 7. HISTÓRICO DE ASSOCIAÇÃO
-- ------------------------------------------------------------

create or replace function public.v8_log_assignment_event(
  p_assignment_id uuid,
  p_work_item_id uuid,
  p_pauta_id uuid,
  p_board_id uuid,
  p_board_column_id uuid,
  p_actor_id uuid,
  p_action text,
  p_old_values jsonb,
  p_new_values jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_event_id uuid;
begin
  insert into public.work_item_board_assignment_events (
    assignment_id,
    work_item_id,
    pauta_id,
    board_id,
    board_column_id,
    actor_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_assignment_id,
    p_work_item_id,
    p_pauta_id,
    p_board_id,
    p_board_column_id,
    p_actor_id,
    trim(p_action),
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$$;

-- ------------------------------------------------------------
-- 8. ADICIONAR CLIENTES COM DATA-META
-- ------------------------------------------------------------

create or replace function public.add_clients_to_pauta_v8(
  p_pauta_id uuid,
  p_clients jsonb,
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
  v_row jsonb;
  v_client_id uuid;
  v_target_date date;
  v_member public.pauta_members%rowtype;
  v_result jsonb;
  v_added integer := 0;
  v_already_present integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADICIONAR CLIENTES' then
    raise exception 'Confirmação inválida. Digite ADICIONAR CLIENTES.';
  end if;

  if p_clients is null
     or jsonb_typeof(p_clients) <> 'array'
     or jsonb_array_length(p_clients) = 0
  then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  if jsonb_array_length(p_clients) > 300 then
    raise exception 'É permitido incluir no máximo 300 clientes por operação.';
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
    raise exception 'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  for v_row in
    select value from jsonb_array_elements(p_clients)
  loop
    begin
      v_client_id := (v_row ->> 'client_id')::uuid;
    exception when others then
      raise exception 'A seleção contém cliente inválido.';
    end;

    if not exists (
      select 1 from public.clients
      where id = v_client_id and status = 'active'
    ) then
      raise exception 'Um dos clientes não existe ou está inativo.';
    end if;

    v_target_date := coalesce(
      nullif(v_row ->> 'target_date', '')::date,
      v_pauta.scheduled_until_date
    );

    select *
    into v_member
    from public.pauta_members
    where pauta_id = p_pauta_id
      and client_id = v_client_id
      and membership_status = 'active'
    order by added_at desc
    limit 1
    for update;

    if not found then
      v_result := public.pauta_create_main_card_core(
        p_pauta_id,
        v_client_id,
        v_actor,
        'added'
      );

      select *
      into v_member
      from public.pauta_members
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and membership_status = 'active'
      order by added_at desc
      limit 1
      for update;

      if not found then
        raise exception 'Não foi possível criar a participação do cliente.';
      end if;

      v_added := v_added + 1;
    else
      v_already_present := v_already_present + 1;
    end if;

    update public.pauta_members
    set
      target_date = v_target_date,
      target_date_updated_at = now(),
      target_date_updated_by = v_actor,
      updated_at = now()
    where id = v_member.id;

    update public.work_items
    set
      internal_deadline = v_pauta.magic_number_date,
      final_deadline = v_target_date,
      updated_at = now()
    where id = v_member.main_work_item_id;

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      case when v_result is null then 'client_target_date_updated' else 'client_added' end,
      'member',
      v_member.id,
      jsonb_build_object('target_date', v_member.target_date),
      jsonb_build_object(
        'target_date', v_target_date,
        'client_id', v_client_id,
        'legacy_cards_preserved', true
      ),
      '{}'::jsonb
    );

    v_result := null;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_added', v_added,
    'clients_already_present', v_already_present,
    'legacy_cards_adopted', 0
  );
end;
$$;

create or replace function public.update_pauta_member_target_date(
  p_member_id uuid,
  p_target_date date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_member public.pauta_members%rowtype;
  v_pauta public.pautas%rowtype;
  v_old_date date;
begin
  v_actor := public.pauta_management_actor();

  if p_target_date is null then
    raise exception 'Informe uma data-meta válida.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where id = p_member_id
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Participação ativa não encontrada.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = v_member.pauta_id
  for update;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem alterar a data-meta.';
  end if;

  v_old_date := v_member.target_date;

  update public.pauta_members
  set
    target_date = p_target_date,
    target_date_updated_at = now(),
    target_date_updated_by = v_actor,
    updated_at = now()
  where id = p_member_id;

  update public.work_items
  set
    final_deadline = p_target_date,
    internal_deadline = v_pauta.magic_number_date,
    updated_at = now()
  where id = v_member.main_work_item_id;

  perform public.pauta_log_event(
    v_member.pauta_id,
    v_pauta.board_id,
    v_actor,
    'client_target_date_updated',
    'member',
    p_member_id,
    jsonb_build_object(
      'target_date', v_old_date
    ),
    jsonb_build_object(
      'target_date', p_target_date,
      'client_id', v_member.client_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'target_date', p_target_date
  );
end;
$$;

-- ------------------------------------------------------------
-- 9. REMOÇÕES EM LOTE, SEM APAGAR HISTÓRICO
-- ------------------------------------------------------------

create or replace function public.remove_pauta_clients_batch(
  p_pauta_id uuid,
  p_client_ids uuid[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_client_id uuid;
  v_removed integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR CLIENTES' then
    raise exception
      'Confirmação inválida. Digite RETIRAR CLIENTES.';
  end if;

  if p_client_ids is null or cardinality(p_client_ids) = 0 then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  for v_client_id in
    select distinct unnest(p_client_ids)
  loop
    perform public.remove_client_from_pauta(
      p_pauta_id,
      v_client_id,
      'RETIRAR CLIENTE'
    );

    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'clients_removed', v_removed,
    'actor_id', v_actor
  );
end;
$$;

create or replace function public.remove_pauta_demands_batch(
  p_pauta_id uuid,
  p_work_item_ids uuid[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_work_item_id uuid;
  v_removed integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR DEMANDAS' then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDAS.';
  end if;

  if p_work_item_ids is null or cardinality(p_work_item_ids) = 0 then
    raise exception 'Selecione pelo menos uma demanda.';
  end if;

  for v_work_item_id in
    select distinct unnest(p_work_item_ids)
  loop
    perform public.detach_pauta_demand(
      p_pauta_id,
      v_work_item_id,
      'RETIRAR DEMANDA'
    );

    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'demands_removed', v_removed,
    'actor_id', v_actor
  );
end;
$$;

-- ------------------------------------------------------------
-- 10. CRIAÇÃO CANÔNICA E DISTRIBUIÇÃO EM LOTE
-- ------------------------------------------------------------

create or replace function public.create_and_distribute_pauta_demands(
  p_pauta_id uuid,
  p_rows jsonb,
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
  v_row jsonb;
  v_target jsonb;
  v_member public.pauta_members%rowtype;
  v_client public.clients%rowtype;
  v_client_id uuid;
  v_service_id uuid;
  v_responsible_id uuid;
  v_start_date date;
  v_final_date date;
  v_priority text;
  v_title text;
  v_drive_link text;
  v_notes text;
  v_card_tag text;
  v_card_tag_color text;
  v_work_item_id uuid;
  v_board_id uuid;
  v_column_id uuid;
  v_column public.board_columns%rowtype;
  v_assignment_id uuid;
  v_is_required boolean;
  v_created jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'CRIAR E DISTRIBUIR' then
    raise exception
      'Confirmação inválida. Digite CRIAR E DISTRIBUIR.';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0
  then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) = 0
  then
    raise exception 'Selecione pelo menos um Quadro de destino.';
  end if;

  if jsonb_array_length(p_rows) > 100 then
    raise exception
      'É permitido criar no máximo 100 demandas por operação.';
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
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber demandas.';
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
      raise exception
        'Um dos Quadros ou colunas de destino é inválido.';
    end if;
  end loop;

  for v_row in
    select value
    from jsonb_array_elements(p_rows)
  loop
    v_client_id := (v_row ->> 'client_id')::uuid;
    v_service_id := (v_row ->> 'client_service_id')::uuid;
    v_responsible_id := (v_row ->> 'responsible_id')::uuid;
    v_start_date := (v_row ->> 'internal_deadline')::date;
    v_final_date := (v_row ->> 'final_deadline')::date;
    v_priority := coalesce(nullif(v_row ->> 'priority', ''), 'normal');
    v_drive_link := nullif(trim(coalesce(v_row ->> 'drive_link', '')), '');
    v_notes := nullif(trim(coalesce(v_row ->> 'notes', '')), '');
    v_card_tag := nullif(
      upper(
        left(
          regexp_replace(
            trim(coalesce(v_row ->> 'card_tag', '')),
            '\s+',
            ' ',
            'g'
          ),
          16
        )
      ),
      ''
    );
    v_card_tag_color := coalesce(
      nullif(v_row ->> 'card_tag_color', ''),
      'slate'
    );

    if v_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Prioridade inválida.';
    end if;

    if v_card_tag_color not in (
      'slate',
      'blue',
      'purple',
      'yellow',
      'red',
      'green'
    ) then
      v_card_tag_color := 'slate';
    end if;

    if v_start_date is null
       or v_final_date is null
       or v_start_date > v_final_date
    then
      raise exception
        'Informe um período válido para todas as demandas.';
    end if;

    select *
    into v_member
    from public.pauta_members
    where pauta_id = p_pauta_id
      and client_id = v_client_id
      and membership_status = 'active'
    order by added_at desc
    limit 1;

    if not found or v_member.main_work_item_id is null then
      raise exception
        'Um dos clientes não participa ativamente desta Pauta.';
    end if;

    select *
    into v_client
    from public.clients
    where id = v_client_id
      and status = 'active';

    if not found then
      raise exception 'Cliente não encontrado ou inativo.';
    end if;

    if not exists (
      select 1
      from public.client_services
      where id = v_service_id
        and client_id = v_client_id
        and status = 'active'
    ) then
      raise exception
        'Um dos serviços não está ativo ou não pertence ao cliente.';
    end if;

    if not exists (
      select 1
      from public.profiles
      where id = v_responsible_id
        and is_active = true
    ) then
      raise exception
        'Responsável não encontrado ou inativo.';
    end if;

    v_title :=
      upper(v_client.name)
      || ' - '
      || to_char(v_start_date, 'DD/MM')
      || ' - '
      || to_char(v_final_date, 'DD/MM');

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
      created_by,
      pauta_id,
      is_pauta_card,
      pauta_card_id,
      card_tag,
      card_tag_color
    )
    values (
      v_title,
      null,
      'Operação',
      'planned',
      'quadro',
      'not_started',
      v_priority,
      v_client_id,
      v_service_id,
      v_responsible_id,
      null,
      null,
      v_start_date,
      v_final_date,
      v_drive_link,
      v_notes,
      v_actor,
      p_pauta_id,
      false,
      v_member.main_work_item_id,
      v_card_tag,
      v_card_tag_color
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
      'pauta_demand_created_multiboard',
      null,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'client_id', v_client_id,
        'targets', p_targets
      )::text
    );

    for v_target in
      select value
      from jsonb_array_elements(p_targets)
    loop
      v_board_id := (v_target ->> 'board_id')::uuid;
      v_column_id := (v_target ->> 'board_column_id')::uuid;
      v_is_required := coalesce(
        (v_target ->> 'is_required')::boolean,
        true
      );

      select *
      into v_column
      from public.board_columns
      where id = v_column_id
        and board_id = v_board_id;

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
          when public.v8_assignment_is_complete(
            v_column.operational_status
          )
            then v_actor
          else null
        end,
        case
          when public.v8_assignment_is_complete(
            v_column.operational_status
          )
            then now()
          else null
        end,
        jsonb_build_object(
          'source', 'pauta_distribution',
          'pauta_id', p_pauta_id
        )
      )
      returning id
      into v_assignment_id;

      perform public.v8_log_assignment_event(
        v_assignment_id,
        v_work_item_id,
        p_pauta_id,
        v_board_id,
        v_column_id,
        v_actor,
        'assignment_created',
        '{}'::jsonb,
        jsonb_build_object(
          'board_id', v_board_id,
          'board_column_id', v_column_id,
          'operational_status', v_column.operational_status,
          'is_required', v_is_required
        ),
        '{}'::jsonb
      );
    end loop;

    perform public.recalculate_work_item_global_status(
      v_work_item_id
    );

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'demand_created_multiboard',
      'work_item',
      v_work_item_id,
      '{}'::jsonb,
      jsonb_build_object(
        'client_id', v_client_id,
        'pauta_card_id', v_member.main_work_item_id,
        'targets', p_targets
      ),
      '{}'::jsonb
    );

    v_created :=
      v_created ||
      jsonb_build_array(
        jsonb_build_object(
          'work_item_id', v_work_item_id,
          'client_id', v_client_id,
          'title', v_title
        )
      );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'demands_created', v_count,
    'items', v_created
  );
end;
$$;

-- ------------------------------------------------------------
-- 11. MOVIMENTAÇÃO INDEPENDENTE POR QUADRO
-- ------------------------------------------------------------

create or replace function public.move_work_item_board_assignment(
  p_assignment_id uuid,
  p_target_column_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
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

  v_old_values := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at
  );

  update public.work_item_board_assignments
  set
    board_column_id = p_target_column_id,
    operational_status = v_target.operational_status,
    completed_at =
      case
        when public.v8_assignment_is_complete(v_target.operational_status)
          then coalesce(completed_at, now())
        else null
      end,
    completed_by =
      case
        when public.v8_assignment_is_complete(v_target.operational_status)
          then v_actor
        else null
      end,
    updated_at = now()
  where id = p_assignment_id;

  v_new_values := jsonb_build_object(
    'board_column_id', p_target_column_id,
    'operational_status', v_target.operational_status,
    'completed_at',
      case
        when public.v8_assignment_is_complete(v_target.operational_status)
          then now()
        else null
      end
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
    '{}'::jsonb
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
        'assignment_id', p_assignment_id
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
    'operational_status', v_target.operational_status
  );
end;
$$;

-- ------------------------------------------------------------
-- 12. SNAPSHOT COMPLETO DA PAUTA
-- ------------------------------------------------------------

create or replace function public.get_pauta_management_snapshot(
  p_pauta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_members jsonb := '[]'::jsonb;
  v_extra_demands jsonb := '[]'::jsonb;
  v_legacy_candidates jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_dependencies jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_current_active_actor();

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
$$;

-- ------------------------------------------------------------
-- 13. CONFIGURAÇÕES SEM SOBRESCREVER DATA-META
-- ------------------------------------------------------------

create or replace function public.update_pauta_settings(
  p_pauta_id uuid,
  p_name text,
  p_magic_number_date date,
  p_scheduled_until_date date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old_values jsonb;
  v_new_values jsonb;
  v_updated_cards integer := 0;
begin
  v_actor := public.pauta_management_actor();

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem ser editadas.';
  end if;

  if length(v_name) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if p_magic_number_date is null
     or p_scheduled_until_date is null
  then
    raise exception
      'Magic Number e Programado até são obrigatórios.';
  end if;

  if p_magic_number_date > p_scheduled_until_date then
    raise exception
      'O Magic Number não pode ser posterior à data Programado até.';
  end if;

  v_old_values := jsonb_build_object(
    'name', v_pauta.name,
    'magic_number_date', v_pauta.magic_number_date,
    'scheduled_until_date', v_pauta.scheduled_until_date
  );

  update public.pautas
  set
    name = v_name,
    magic_number_date = p_magic_number_date,
    scheduled_until_date = p_scheduled_until_date,
    updated_at = now()
  where id = p_pauta_id;

  update public.work_items item
  set
    internal_deadline = p_magic_number_date,
    final_deadline = coalesce(
      member.target_date,
      p_scheduled_until_date
    ),
    updated_at = now()
  from public.pauta_members member
  where member.pauta_id = p_pauta_id
    and member.membership_status = 'active'
    and item.id = member.main_work_item_id
    and item.status not in ('archived', 'cancelled');

  get diagnostics v_updated_cards = row_count;

  v_new_values := jsonb_build_object(
    'name', v_name,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'settings_updated',
    'pauta',
    p_pauta_id,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'main_cards_updated', v_updated_cards,
      'individual_target_dates_preserved', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'cards_updated', v_updated_cards,
    'settings', v_new_values
  );
end;
$$;

-- ------------------------------------------------------------
-- 14. CONCLUSÃO DA PAUTA COM DISTRIBUIÇÕES OBRIGATÓRIAS
-- ------------------------------------------------------------

create or replace function public.change_pauta_lifecycle(
  p_pauta_id uuid,
  p_action text,
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
  v_action text := lower(trim(coalesce(p_action, '')));
  v_expected_confirmation text;
  v_next_status text;
  v_pending_main_cards integer := 0;
  v_pending_assignments integer := 0;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if v_action not in ('close', 'reopen', 'archive') then
    raise exception 'Ação de ciclo de vida inválida.';
  end if;

  v_expected_confirmation :=
    case v_action
      when 'close' then 'CONCLUIR PAUTA'
      when 'reopen' then 'REABRIR PAUTA'
      when 'archive' then 'ARQUIVAR PAUTA'
    end;

  if trim(coalesce(p_confirmation, '')) <> v_expected_confirmation then
    raise exception
      'Confirmação inválida. Digite %.',
      v_expected_confirmation;
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  v_old_values := jsonb_build_object(
    'lifecycle_status', v_pauta.lifecycle_status,
    'opened_at', v_pauta.opened_at,
    'closed_at', v_pauta.closed_at,
    'archived_at', v_pauta.archived_at
  );

  if v_action = 'close' then
    if v_pauta.lifecycle_status not in ('draft', 'open') then
      raise exception
        'Somente Pautas abertas ou em rascunho podem ser concluídas.';
    end if;

    select count(*)
    into v_pending_main_cards
    from public.pauta_members member
    join public.work_items item
      on item.id = member.main_work_item_id
    where member.pauta_id = p_pauta_id
      and member.membership_status = 'active'
      and item.is_pauta_card = true
      and item.completed_at is null
      and item.status not in ('done', 'delivered', 'approved');

    select count(*)
    into v_pending_assignments
    from public.work_item_board_assignments assignment
    join public.work_items item
      on item.id = assignment.work_item_id
    where item.pauta_id = p_pauta_id
      and item.is_pauta_card = false
      and assignment.assignment_status = 'active'
      and assignment.is_required = true
      and not public.v8_assignment_is_complete(
        assignment.operational_status
      );

    if v_pending_main_cards > 0
       or v_pending_assignments > 0
    then
      raise exception
        'A Pauta ainda possui % card(s) mensal(is) e % distribuição(ões) obrigatória(s) pendente(s).',
        v_pending_main_cards,
        v_pending_assignments;
    end if;

    v_next_status := 'closed';

    update public.pautas
    set
      lifecycle_status = 'closed',
      closed_at = now(),
      archived_at = null,
      updated_at = now()
    where id = p_pauta_id;

  elsif v_action = 'reopen' then
    if v_pauta.lifecycle_status not in ('closed', 'archived') then
      raise exception
        'Somente Pautas concluídas ou arquivadas podem ser reabertas.';
    end if;

    v_next_status := 'open';

    update public.pautas
    set
      lifecycle_status = 'open',
      opened_at = coalesce(opened_at, now()),
      closed_at = null,
      archived_at = null,
      updated_at = now()
    where id = p_pauta_id;

  else
    if v_pauta.lifecycle_status = 'archived' then
      raise exception 'A Pauta já está arquivada.';
    end if;

    v_next_status := 'archived';

    update public.pautas
    set
      lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
    where id = p_pauta_id;
  end if;

  select jsonb_build_object(
    'lifecycle_status', pauta.lifecycle_status,
    'opened_at', pauta.opened_at,
    'closed_at', pauta.closed_at,
    'archived_at', pauta.archived_at
  )
  into v_new_values
  from public.pautas pauta
  where pauta.id = p_pauta_id;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'lifecycle_' || v_action,
    'pauta',
    p_pauta_id,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'pending_main_cards', v_pending_main_cards,
      'pending_required_assignments', v_pending_assignments
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'previous_status', v_pauta.lifecycle_status,
    'lifecycle_status', v_next_status
  );
end;
$$;

-- ------------------------------------------------------------
-- 15. COLUNAS E QUADROS COMPATÍVEIS COM ASSOCIAÇÕES
-- ------------------------------------------------------------

create or replace function public.delete_board_column_move_cards(
  p_column_id uuid,
  p_target_column_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_board_id uuid;
  v_column_name text;
  v_target_board_id uuid;
  v_target_status text;
  v_columns_count integer;
  v_legacy_cards_count integer;
  v_assignments_count integer;
  v_cards_moved integer := 0;
  v_assignments_moved integer := 0;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para excluir colunas.';
  end if;

  select board_id, name
  into v_board_id, v_column_name
  from public.board_columns
  where id = p_column_id
  for update;

  if v_board_id is null then
    raise exception 'Coluna não encontrada.';
  end if;

  select count(*)
  into v_columns_count
  from public.board_columns
  where board_id = v_board_id;

  if v_columns_count <= 1 then
    raise exception
      'Não é possível excluir a última coluna do Quadro.';
  end if;

  select count(*)
  into v_legacy_cards_count
  from public.work_items
  where board_column_id = p_column_id
    and status not in ('archived', 'cancelled');

  select count(*)
  into v_assignments_count
  from public.work_item_board_assignments
  where board_column_id = p_column_id
    and assignment_status = 'active';

  if v_legacy_cards_count > 0 or v_assignments_count > 0 then
    if p_target_column_id is null then
      raise exception
        'Escolha uma coluna de destino para os cards existentes.';
    end if;

    select board_id, operational_status
    into v_target_board_id, v_target_status
    from public.board_columns
    where id = p_target_column_id
    for update;

    if v_target_board_id is null
       or v_target_board_id <> v_board_id
       or p_target_column_id = p_column_id
    then
      raise exception
        'A coluna de destino deve pertencer ao mesmo Quadro.';
    end if;

    update public.work_item_board_assignments
    set
      board_column_id = p_target_column_id,
      operational_status = v_target_status,
      completed_at =
        case
          when public.v8_assignment_is_complete(v_target_status)
            then coalesce(completed_at, now())
          else null
        end,
      completed_by =
        case
          when public.v8_assignment_is_complete(v_target_status)
            then coalesce(auth.uid(), completed_by)
          else null
        end,
      updated_at = now()
    where board_column_id = p_column_id
      and assignment_status = 'active';

    get diagnostics v_assignments_moved = row_count;

    update public.work_items
    set
      board_column_id = p_target_column_id,
      board_id = v_board_id,
      status = v_target_status,
      updated_at = now()
    where board_column_id = p_column_id;

    get diagnostics v_cards_moved = row_count;
  end if;

  delete from public.board_columns
  where id = p_column_id;

  with ordered as (
    select
      id,
      row_number() over (
        order by position, created_at, id
      ) - 1 as next_position
    from public.board_columns
    where board_id = v_board_id
  )
  update public.board_columns column_row
  set
    position = ordered.next_position,
    updated_at = now()
  from ordered
  where column_row.id = ordered.id;

  return jsonb_build_object(
    'success', true,
    'column', v_column_name,
    'cards_moved', v_cards_moved,
    'assignments_moved', v_assignments_moved
  );
end;
$$;

create or replace function public.delete_board_preserve_demands(
  p_board_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_demands_preserved integer := 0;
  v_assignments_removed integer := 0;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para excluir Quadros.';
  end if;

  v_actor := public.pauta_current_active_actor();

  select *
  into v_board
  from public.boards
  where id = p_board_id
  for update;

  if not found then
    raise exception 'Quadro não encontrado.';
  end if;

  if v_board.board_kind = 'pauta' then
    raise exception
      'A estrutura de Pautas não pode ser excluída.';
  end if;

  update public.work_item_board_assignments
  set
    assignment_status = 'removed',
    removed_at = now(),
    removed_by = v_actor,
    updated_at = now(),
    metadata =
      metadata ||
      jsonb_build_object(
        'board_archived', true
      )
  where board_id = p_board_id
    and assignment_status = 'active';

  get diagnostics v_assignments_removed = row_count;

  update public.work_items
  set
    board_id = null,
    board_column_id = null,
    updated_at = now()
  where board_id = p_board_id;

  get diagnostics v_demands_preserved = row_count;

  update public.boards
  set
    status = 'archived',
    updated_at = now()
  where id = p_board_id;

  return jsonb_build_object(
    'success', true,
    'board', v_board.name,
    'board_archived', true,
    'demands_preserved', v_demands_preserved,
    'assignments_removed', v_assignments_removed
  );
end;
$$;

-- ------------------------------------------------------------
-- 16. GRANTS
-- ------------------------------------------------------------

revoke all
on function public.add_clients_to_pauta_v8(uuid, jsonb, text)
from public, anon;

revoke all
on function public.update_pauta_member_target_date(uuid, date)
from public, anon;

revoke all
on function public.remove_pauta_clients_batch(uuid, uuid[], text)
from public, anon;

revoke all
on function public.remove_pauta_demands_batch(uuid, uuid[], text)
from public, anon;

revoke all
on function public.create_and_distribute_pauta_demands(uuid, jsonb, jsonb, text)
from public, anon;

revoke all
on function public.move_work_item_board_assignment(uuid, uuid)
from public, anon;

grant execute
on function public.add_clients_to_pauta_v8(uuid, jsonb, text)
to authenticated;

grant execute
on function public.update_pauta_member_target_date(uuid, date)
to authenticated;

grant execute
on function public.remove_pauta_clients_batch(uuid, uuid[], text)
to authenticated;

grant execute
on function public.remove_pauta_demands_batch(uuid, uuid[], text)
to authenticated;

grant execute
on function public.create_and_distribute_pauta_demands(uuid, jsonb, jsonb, text)
to authenticated;

grant execute
on function public.move_work_item_board_assignment(uuid, uuid)
to authenticated;

comment on table public.work_item_board_assignments is
  'V8-B: associa uma demanda canônica a um ou mais Quadros com progresso independente.';

comment on table public.work_item_board_assignment_events is
  'V8-B: histórico imutável das distribuições multiquadro.';

rollback;

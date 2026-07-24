-- V17-A25.3A1 — FUNDAÇÃO DE CICLOS, SERVIÇOS E QUADRO
-- Migration aditiva e protegida.
-- Não movimenta automaticamente cards existentes.

begin;

-- =========================================================
-- 1. PAPÉIS TÉCNICOS DAS COLUNAS
-- =========================================================

alter table public.board_columns
  add column if not exists automation_role text;

alter table public.board_columns
  drop constraint if exists board_columns_automation_role_check;

alter table public.board_columns
  add constraint board_columns_automation_role_check
  check (
    automation_role is null
    or automation_role in (
      'alignment',
      'planning',
      'capture',
      'production',
      'organization',
      'approval',
      'programming',
      'completed',
      'legacy_metrics'
    )
  );

comment on column public.board_columns.automation_role is
  'Papel técnico usado por automações. O nome visível da coluna continua editável.';

-- =========================================================
-- 2. CONFIGURAÇÕES DO CICLO NO SERVIÇO DO CLIENTE
-- =========================================================

alter table public.client_services
  add column if not exists cycle_duration_days integer,
  add column if not exists requires_alignment_meeting boolean not null default true,
  add column if not exists requires_capture boolean not null default true,
  add column if not exists default_capture_type text;

alter table public.client_services
  drop constraint if exists client_services_cycle_duration_days_check;

alter table public.client_services
  add constraint client_services_cycle_duration_days_check
  check (
    cycle_duration_days is null
    or cycle_duration_days between 1 and 365
  );

alter table public.client_services
  drop constraint if exists client_services_default_capture_type_check;

alter table public.client_services
  add constraint client_services_default_capture_type_check
  check (
    default_capture_type is null
    or default_capture_type in ('cap_e', 'cap_s')
  );

alter table public.client_services
  drop constraint if exists client_services_capture_configuration_check;

alter table public.client_services
  add constraint client_services_capture_configuration_check
  check (
    requires_capture
    or default_capture_type is null
  );

comment on column public.client_services.cycle_duration_days is
  'Duração padrão sugerida para o próximo ciclo. As datas continuam editáveis.';

comment on column public.client_services.requires_alignment_meeting is
  'Define se novos ciclos criam pendência de reunião de alinhamento.';

comment on column public.client_services.requires_capture is
  'Define se novos ciclos criam pendência de captação.';

comment on column public.client_services.default_capture_type is
  'Tipo padrão de captação: cap_e ou cap_s.';

-- =========================================================
-- 3. VÍNCULO ENTRE CICLOS
-- =========================================================

alter table public.work_items
  add column if not exists generated_from_cycle_id uuid
    references public.work_items(id)
    on delete set null,
  add column if not exists cycle_number integer,
  add column if not exists cycle_duration_days_snapshot integer,
  add column if not exists generated_at timestamptz,
  add column if not exists generated_by uuid
    references public.profiles(id)
    on delete set null;

alter table public.work_items
  drop constraint if exists work_items_cycle_number_check;

alter table public.work_items
  add constraint work_items_cycle_number_check
  check (
    cycle_number is null
    or cycle_number >= 1
  );

alter table public.work_items
  drop constraint if exists work_items_cycle_duration_snapshot_check;

alter table public.work_items
  add constraint work_items_cycle_duration_snapshot_check
  check (
    cycle_duration_days_snapshot is null
    or cycle_duration_days_snapshot between 1 and 365
  );

create unique index if not exists
  work_items_generated_from_cycle_unique
on public.work_items (generated_from_cycle_id)
where generated_from_cycle_id is not null;

create index if not exists
  idx_work_items_cycle_number
on public.work_items (client_id, cycle_number);

create index if not exists
  idx_work_items_generated_by
on public.work_items (generated_by);

comment on column public.work_items.generated_from_cycle_id is
  'Ciclo anterior que originou esta demanda. Um ciclo só pode gerar um sucessor.';

comment on column public.work_items.cycle_number is
  'Número sequencial do ciclo dentro do cliente e serviço.';

comment on column public.work_items.cycle_duration_days_snapshot is
  'Duração usada no momento da geração, preservada como histórico.';

-- =========================================================
-- 4. PENDÊNCIAS DE AGENDA DO CICLO
-- =========================================================

create table if not exists public.work_item_schedule_requirements (
  id uuid primary key default gen_random_uuid(),

  work_item_id uuid not null
    references public.work_items(id)
    on delete cascade,

  requirement_type text not null,
  status text not null default 'pending',

  calendar_event_id uuid
    references public.calendar_events(id)
    on delete set null,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  scheduled_at timestamptz,
  confirmed_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint work_item_schedule_requirements_type_check
    check (
      requirement_type in (
        'alignment_meeting',
        'capture'
      )
    ),

  constraint work_item_schedule_requirements_status_check
    check (
      status in (
        'pending',
        'scheduled',
        'confirmed',
        'completed',
        'cancelled'
      )
    ),

  constraint work_item_schedule_requirements_item_type_unique
    unique (
      work_item_id,
      requirement_type
    )
);

create unique index if not exists
  work_item_schedule_requirements_event_unique
on public.work_item_schedule_requirements (calendar_event_id)
where calendar_event_id is not null;

create index if not exists
  idx_work_item_schedule_requirements_item
on public.work_item_schedule_requirements (work_item_id);

create index if not exists
  idx_work_item_schedule_requirements_status
on public.work_item_schedule_requirements (status);

alter table public.work_item_schedule_requirements
  enable row level security;

grant select, insert, update, delete
on public.work_item_schedule_requirements
to authenticated;

drop policy if exists
  work_item_schedule_requirements_read_authenticated
on public.work_item_schedule_requirements;

create policy
  work_item_schedule_requirements_read_authenticated
on public.work_item_schedule_requirements
for select
to authenticated
using (
  public.app_is_active_user()
);

drop policy if exists
  work_item_schedule_requirements_insert_authenticated
on public.work_item_schedule_requirements;

create policy
  work_item_schedule_requirements_insert_authenticated
on public.work_item_schedule_requirements
for insert
to authenticated
with check (
  public.app_is_active_user()
);

drop policy if exists
  work_item_schedule_requirements_update_authenticated
on public.work_item_schedule_requirements;

create policy
  work_item_schedule_requirements_update_authenticated
on public.work_item_schedule_requirements
for update
to authenticated
using (
  public.app_is_active_user()
)
with check (
  public.app_is_active_user()
);

drop policy if exists
  work_item_schedule_requirements_delete_total
on public.work_item_schedule_requirements;

create policy
  work_item_schedule_requirements_delete_total
on public.work_item_schedule_requirements
for delete
to authenticated
using (
  public.app_has_total_access()
);

-- =========================================================
-- 5. ESTRUTURA OFICIAL DO QUADRO OPERAÇÃO GERAL
-- =========================================================

do $$
declare
  v_board uuid;

  v_alignment uuid;
  v_planning uuid;
  v_capture uuid;
  v_production uuid;
  v_organization uuid;
  v_approval uuid;
  v_programming uuid;
  v_completed uuid;
  v_metrics uuid;
begin
  select id
    into v_board
  from public.boards
  where lower(trim(name)) =
        lower(trim('Operação Geral'))
    and status = 'active'
  order by created_at
  limit 1;

  if v_board is null then
    raise exception
      'Quadro ativo Operação Geral não encontrado.';
  end if;

  select id
    into v_alignment
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'alignment'
      or lower(trim(name)) =
         lower(trim('Reunião de Alinhamento'))
    )
  order by created_at
  limit 1;

  select id
    into v_planning
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'planning'
      or lower(trim(name)) in (
        lower(trim('Planejamento Estratégico')),
        lower(trim('Planejamento'))
      )
    )
  order by created_at
  limit 1;

  select id
    into v_capture
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'capture'
      or lower(trim(name)) =
         lower(trim('Captação'))
    )
  order by created_at
  limit 1;

  select id
    into v_production
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'production'
      or lower(trim(name)) =
         lower(trim('Edição | Design'))
    )
  order by created_at
  limit 1;

  select id
    into v_organization
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'organization'
      or lower(trim(name)) in (
        lower(trim('Organização Feed')),
        lower(trim('Organização do Feed'))
      )
    )
  order by created_at
  limit 1;

  select id
    into v_approval
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'approval'
      or lower(trim(name)) =
         lower(trim('Aprovação do Cliente'))
    )
  order by created_at
  limit 1;

  select id
    into v_metrics
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'legacy_metrics'
      or lower(trim(name)) =
         lower(trim('Análise de Métricas'))
    )
  order by created_at
  limit 1;

  if (
    v_alignment is null
    or v_planning is null
    or v_capture is null
    or v_production is null
    or v_organization is null
    or v_approval is null
    or v_metrics is null
  ) then
    raise exception
      'Uma ou mais colunas obrigatórias do Quadro Operação Geral não foram encontradas.';
  end if;

  select id
    into v_programming
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'programming'
      or lower(trim(name)) =
         lower(trim('Programação'))
    )
  order by created_at
  limit 1;

  if v_programming is null then
    insert into public.board_columns (
      board_id,
      name,
      color,
      operational_status,
      position,
      updated_at
    )
    values (
      v_board,
      'Programação',
      '#2563EB',
      'scheduled',
      100,
      now()
    )
    returning id
      into v_programming;
  end if;

  select id
    into v_completed
  from public.board_columns
  where board_id = v_board
    and (
      automation_role = 'completed'
      or lower(trim(name)) =
         lower(trim('Concluído'))
    )
  order by created_at
  limit 1;

  if v_completed is null then
    insert into public.board_columns (
      board_id,
      name,
      color,
      operational_status,
      position,
      updated_at
    )
    values (
      v_board,
      'Concluído',
      '#16A34A',
      'done',
      101,
      now()
    )
    returning id
      into v_completed;
  end if;

  update public.board_columns
  set
    name = 'Reunião de Alinhamento',
    operational_status = 'not_started',
    automation_role = 'alignment',
    position = 0,
    updated_at = now()
  where id = v_alignment;

  update public.board_columns
  set
    name = 'Planejamento',
    operational_status = 'not_started',
    automation_role = 'planning',
    position = 1,
    updated_at = now()
  where id = v_planning;

  update public.board_columns
  set
    name = 'Captação',
    operational_status = 'waiting',
    automation_role = 'capture',
    position = 2,
    updated_at = now()
  where id = v_capture;

  update public.board_columns
  set
    name = 'Edição | Design',
    operational_status = 'in_review',
    automation_role = 'production',
    position = 3,
    updated_at = now()
  where id = v_production;

  update public.board_columns
  set
    name = 'Organização do Feed',
    operational_status = 'awaiting_approval',
    automation_role = 'organization',
    position = 4,
    updated_at = now()
  where id = v_organization;

  update public.board_columns
  set
    name = 'Aprovação do Cliente',
    operational_status = 'awaiting_approval',
    automation_role = 'approval',
    position = 5,
    updated_at = now()
  where id = v_approval;

  update public.board_columns
  set
    name = 'Programação',
    operational_status = 'scheduled',
    automation_role = 'programming',
    position = 6,
    updated_at = now()
  where id = v_programming;

  update public.board_columns
  set
    name = 'Concluído',
    operational_status = 'done',
    automation_role = 'completed',
    position = 7,
    updated_at = now()
  where id = v_completed;

  update public.board_columns
  set
    automation_role = 'legacy_metrics',
    position = 8,
    updated_at = now()
  where id = v_metrics;
end
$$;

create unique index if not exists
  board_columns_automation_role_unique
on public.board_columns (
  board_id,
  automation_role
)
where automation_role is not null;

create index if not exists
  idx_board_columns_automation_role
on public.board_columns (
  automation_role
);

commit;

select
  'V17-A25.3A1 aplicada com sucesso' as resultado;
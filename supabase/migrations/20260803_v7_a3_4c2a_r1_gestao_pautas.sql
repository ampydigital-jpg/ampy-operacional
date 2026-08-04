-- =====================================================================
-- V7-A3.4C.2A-R1 — GESTÃO COMPLETA, AUDITÁVEL E SEGURA DE PAUTAS
-- Projeto: Gerenciador de Demandas Ampy
-- Base de código esperada: dd72363
-- Supabase esperado: epzrrsaibqdcaafkvwmm
--
-- OBJETIVOS:
-- 1. Criar pauta_members e pauta_events.
-- 2. Representar explicitamente a participação do cliente na Pauta.
-- 3. Preservar work_items como registro canônico único.
-- 4. Não duplicar cards existentes em Sem Pauta / Legado.
-- 5. Permitir adoção explícita de cards legados por UUID.
-- 6. Restringir ações estruturais ao Acesso Total.
-- 7. Permitir operação normal das demandas por usuários ativos.
-- 8. Remover escrita estrutural direta em public.pautas.
-- 9. Preservar a assinatura pública de open_monthly_pauta.
--
-- ESTA MIGRATION NÃO:
-- - vincula automaticamente os 35 cards legados de Setembro;
-- - procura clientes por semelhança de nome;
-- - mescla clientes;
-- - exclui work_items;
-- - altera prazos ou colunas dos cards legados;
-- - executa qualquer adoção sem mapping explícito.
-- =====================================================================

begin;

-- =====================================================================
-- 1. PRÉ-CONDIÇÕES
-- =====================================================================

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.pautas') is null then
    v_missing := array_append(v_missing, 'public.pautas');
  end if;

  if to_regclass('public.work_items') is null then
    v_missing := array_append(v_missing, 'public.work_items');
  end if;

  if to_regclass('public.clients') is null then
    v_missing := array_append(v_missing, 'public.clients');
  end if;

  if to_regclass('public.client_services') is null then
    v_missing := array_append(v_missing, 'public.client_services');
  end if;

  if to_regclass('public.boards') is null then
    v_missing := array_append(v_missing, 'public.boards');
  end if;

  if to_regclass('public.board_columns') is null then
    v_missing := array_append(v_missing, 'public.board_columns');
  end if;

  if to_regclass('public.profiles') is null then
    v_missing := array_append(v_missing, 'public.profiles');
  end if;

  if to_regclass('public.team_members') is null then
    v_missing := array_append(v_missing, 'public.team_members');
  end if;

  if to_regclass('public.work_item_history') is null then
    v_missing := array_append(v_missing, 'public.work_item_history');
  end if;

  if to_regclass('public.work_item_schedule_requirements') is null then
    v_missing := array_append(
      v_missing,
      'public.work_item_schedule_requirements'
    );
  end if;

  if to_regclass('public.calendar_events') is null then
    v_missing := array_append(v_missing, 'public.calendar_events');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception
      'V7-A3.4C.2A-R1 bloqueada. Objetos ausentes: %.',
      array_to_string(v_missing, ', ');
  end if;

  if to_regprocedure('public.app_has_total_access()') is null then
    raise exception
      'Função public.app_has_total_access() não encontrada.';
  end if;

  if to_regprocedure('public.app_is_active_user()') is null then
    raise exception
      'Função public.app_is_active_user() não encontrada.';
  end if;

  if to_regprocedure(
    'public.open_monthly_pauta(uuid,text,date,date,date,uuid[],text)'
  ) is null then
    raise exception
      'A RPC open_monthly_pauta esperada não foi encontrada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'boards'
      and column_name = 'board_kind'
  ) then
    raise exception
      'Coluna public.boards.board_kind não encontrada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'pauta_id'
  ) then
    raise exception
      'Coluna public.work_items.pauta_id não encontrada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'is_pauta_card'
  ) then
    raise exception
      'Coluna public.work_items.is_pauta_card não encontrada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'pauta_card_id'
  ) then
    raise exception
      'Coluna public.work_items.pauta_card_id não encontrada.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_events'
      and column_name = 'pauta_id'
  ) then
    raise exception
      'Coluna public.calendar_events.pauta_id não encontrada.';
  end if;
end;
$$;

-- =====================================================================
-- 2. TABELA PAUTA_MEMBERS
-- =====================================================================

create table if not exists public.pauta_members (
  id uuid primary key default gen_random_uuid(),

  pauta_id uuid not null
    references public.pautas(id)
    on delete cascade,

  client_id uuid not null
    references public.clients(id)
    on delete restrict,

  main_work_item_id uuid
    references public.work_items(id)
    on delete set null,

  membership_status text not null
    default 'active',

  source text not null
    default 'added',

  added_by uuid
    references public.profiles(id)
    on delete set null,

  added_at timestamptz not null
    default now(),

  removed_by uuid
    references public.profiles(id)
    on delete set null,

  removed_at timestamptz,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now()
);

alter table public.pauta_members
  add column if not exists pauta_id uuid,
  add column if not exists client_id uuid,
  add column if not exists main_work_item_id uuid,
  add column if not exists membership_status text default 'active',
  add column if not exists source text default 'added',
  add column if not exists added_by uuid,
  add column if not exists added_at timestamptz default now(),
  add column if not exists removed_by uuid,
  add column if not exists removed_at timestamptz,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.pauta_members
set
  membership_status = coalesce(
    nullif(trim(membership_status), ''),
    'active'
  ),
  source = coalesce(
    nullif(trim(source), ''),
    'added'
  ),
  added_at = coalesce(added_at, created_at, now()),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, created_at, now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_pauta_fk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_pauta_fk
      foreign key (pauta_id)
      references public.pautas(id)
      on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_client_fk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_client_fk
      foreign key (client_id)
      references public.clients(id)
      on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_main_work_item_fk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_main_work_item_fk
      foreign key (main_work_item_id)
      references public.work_items(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_added_by_fk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_added_by_fk
      foreign key (added_by)
      references public.profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_removed_by_fk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_removed_by_fk
      foreign key (removed_by)
      references public.profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_status_chk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_status_chk
      check (
        membership_status in (
          'active',
          'removed'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_source_chk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_source_chk
      check (
        source in (
          'opened',
          'added',
          'legacy_adopted',
          'backfill',
          'restored'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_members_removed_state_chk'
      and conrelid = 'public.pauta_members'::regclass
  ) then
    alter table public.pauta_members
      add constraint pauta_members_removed_state_chk
      check (
        (
          membership_status = 'active'
          and removed_at is null
        )
        or
        (
          membership_status = 'removed'
          and removed_at is not null
        )
      );
  end if;
end;
$$;

alter table public.pauta_members
  alter column pauta_id set not null,
  alter column client_id set not null,
  alter column membership_status set not null,
  alter column membership_status set default 'active',
  alter column source set not null,
  alter column source set default 'added',
  alter column added_at set not null,
  alter column added_at set default now(),
  alter column metadata set not null,
  alter column metadata set default '{}'::jsonb,
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now();

create unique index if not exists
  pauta_members_active_client_uidx
on public.pauta_members (
  pauta_id,
  client_id
)
where membership_status = 'active';

create unique index if not exists
  pauta_members_active_main_work_item_uidx
on public.pauta_members (
  main_work_item_id
)
where
  membership_status = 'active'
  and main_work_item_id is not null;

create index if not exists pauta_members_pauta_status_idx
on public.pauta_members (
  pauta_id,
  membership_status
);

create index if not exists pauta_members_client_status_idx
on public.pauta_members (
  client_id,
  membership_status
);

create index if not exists pauta_members_added_at_idx
on public.pauta_members (
  added_at desc
);

comment on table public.pauta_members is
  'Participação explícita e histórica de clientes em Pautas mensais.';

comment on column public.pauta_members.main_work_item_id is
  'Card mensal principal canônico do cliente dentro da Pauta.';

comment on column public.pauta_members.source is
  'Origem da participação: abertura, inclusão, adoção legada, backfill ou restauração.';

-- =====================================================================
-- 3. TABELA PAUTA_EVENTS
-- =====================================================================

create table if not exists public.pauta_events (
  id uuid primary key default gen_random_uuid(),

  pauta_id uuid
    references public.pautas(id)
    on delete set null,

  board_id uuid
    references public.boards(id)
    on delete set null,

  actor_id uuid
    references public.profiles(id)
    on delete set null,

  action text not null,

  target_type text not null
    default 'pauta',

  target_id uuid,

  old_values jsonb not null
    default '{}'::jsonb,

  new_values jsonb not null
    default '{}'::jsonb,

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now()
);

alter table public.pauta_events
  add column if not exists pauta_id uuid,
  add column if not exists board_id uuid,
  add column if not exists actor_id uuid,
  add column if not exists action text,
  add column if not exists target_type text default 'pauta',
  add column if not exists target_id uuid,
  add column if not exists old_values jsonb default '{}'::jsonb,
  add column if not exists new_values jsonb default '{}'::jsonb,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now();

update public.pauta_events
set
  target_type = coalesce(
    nullif(trim(target_type), ''),
    'pauta'
  ),
  old_values = coalesce(old_values, '{}'::jsonb),
  new_values = coalesce(new_values, '{}'::jsonb),
  metadata = coalesce(metadata, '{}'::jsonb),
  created_at = coalesce(created_at, now())
where
  target_type is null
  or old_values is null
  or new_values is null
  or metadata is null
  or created_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_events_pauta_fk'
      and conrelid = 'public.pauta_events'::regclass
  ) then
    alter table public.pauta_events
      add constraint pauta_events_pauta_fk
      foreign key (pauta_id)
      references public.pautas(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_events_board_fk'
      and conrelid = 'public.pauta_events'::regclass
  ) then
    alter table public.pauta_events
      add constraint pauta_events_board_fk
      foreign key (board_id)
      references public.boards(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_events_actor_fk'
      and conrelid = 'public.pauta_events'::regclass
  ) then
    alter table public.pauta_events
      add constraint pauta_events_actor_fk
      foreign key (actor_id)
      references public.profiles(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_events_action_chk'
      and conrelid = 'public.pauta_events'::regclass
  ) then
    alter table public.pauta_events
      add constraint pauta_events_action_chk
      check (
        char_length(trim(action)) between 2 and 80
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pauta_events_target_type_chk'
      and conrelid = 'public.pauta_events'::regclass
  ) then
    alter table public.pauta_events
      add constraint pauta_events_target_type_chk
      check (
        target_type in (
          'pauta',
          'client',
          'work_item',
          'member',
          'board'
        )
      );
  end if;
end;
$$;

alter table public.pauta_events
  alter column action set not null,
  alter column target_type set not null,
  alter column target_type set default 'pauta',
  alter column old_values set not null,
  alter column old_values set default '{}'::jsonb,
  alter column new_values set not null,
  alter column new_values set default '{}'::jsonb,
  alter column metadata set not null,
  alter column metadata set default '{}'::jsonb,
  alter column created_at set not null,
  alter column created_at set default now();

create index if not exists pauta_events_pauta_created_idx
on public.pauta_events (
  pauta_id,
  created_at desc
);

create index if not exists pauta_events_board_created_idx
on public.pauta_events (
  board_id,
  created_at desc
);

create index if not exists pauta_events_actor_created_idx
on public.pauta_events (
  actor_id,
  created_at desc
);

create index if not exists pauta_events_action_created_idx
on public.pauta_events (
  action,
  created_at desc
);

create index if not exists pauta_events_target_idx
on public.pauta_events (
  target_type,
  target_id
);

comment on table public.pauta_events is
  'Auditoria imutável das ações estruturais e operacionais relevantes executadas em Pautas.';

-- =====================================================================
-- 4. TRIGGER DE UPDATED_AT PARA PAUTA_MEMBERS
-- =====================================================================

create or replace function public.touch_pauta_members_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_pauta_members_touch_updated_at
on public.pauta_members;

create trigger trg_pauta_members_touch_updated_at
before update on public.pauta_members
for each row
execute function public.touch_pauta_members_updated_at();

-- =====================================================================
-- 5. BACKFILL SOMENTE DOS CARDS QUE JÁ PERTENCEM A UMA PAUTA
--
-- IMPORTANTE:
-- - não altera work_items;
-- - não adota registros com pauta_id nulo;
-- - não toca nos 35 cards legados;
-- - apenas cria a representação explícita de participações já existentes.
-- =====================================================================

insert into public.pauta_members (
  pauta_id,
  client_id,
  main_work_item_id,
  membership_status,
  source,
  added_by,
  added_at,
  metadata
)
select
  item.pauta_id,
  item.client_id,
  item.id,
  'active',
  'backfill',
  coalesce(
    item.created_by,
    pauta.created_by
  ),
  coalesce(
    item.created_at,
    pauta.created_at,
    now()
  ),
  jsonb_build_object(
    'migration',
    'V7-A3.4C.2A-R1',
    'reason',
    'existing_main_pauta_card'
  )
from public.work_items as item
join public.pautas as pauta
  on pauta.id = item.pauta_id
where item.pauta_id is not null
  and item.client_id is not null
  and item.is_pauta_card = true
  and not exists (
    select 1
    from public.pauta_members as member
    where member.pauta_id = item.pauta_id
      and member.client_id = item.client_id
      and member.membership_status = 'active'
  );

-- =====================================================================
-- 6. RLS E BLOQUEIO DE ESCRITA DIRETA
-- =====================================================================

alter table public.pauta_members
  enable row level security;

alter table public.pauta_events
  enable row level security;

drop policy if exists pauta_members_select_active_users
on public.pauta_members;

create policy pauta_members_select_active_users
on public.pauta_members
for select
to authenticated
using (
  public.app_is_active_user()
);

drop policy if exists pauta_events_select_active_users
on public.pauta_events;

create policy pauta_events_select_active_users
on public.pauta_events
for select
to authenticated
using (
  public.app_is_active_user()
);

revoke all
on table public.pauta_members
from public;

revoke all
on table public.pauta_events
from public;

revoke insert, update, delete
on table public.pauta_members
from authenticated;

revoke insert, update, delete
on table public.pauta_events
from authenticated;

grant select
on table public.pauta_members
to authenticated;

grant select
on table public.pauta_events
to authenticated;

-- Remove as políticas antigas de escrita estrutural direta em Pautas.

drop policy if exists pautas_insert_total_access
on public.pautas;

drop policy if exists pautas_update_total_access
on public.pautas;

drop policy if exists pautas_delete_total_access
on public.pautas;

revoke insert, update, delete
on table public.pautas
from authenticated;

grant select
on table public.pautas
to authenticated;

-- Garante que a leitura previamente existente permaneça.

drop policy if exists pautas_select_active_users
on public.pautas;

create policy pautas_select_active_users
on public.pautas
for select
to authenticated
using (
  public.app_is_active_user()
);

-- =====================================================================
-- 7. HELPERS INTERNOS DE AUTENTICAÇÃO E AUDITORIA
-- =====================================================================

create or replace function public.pauta_current_active_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception
      'Sessão inválida ou expirada.';
  end if;

  if not public.app_is_active_user() then
    raise exception
      'Usuário inativo ou sem autorização operacional.';
  end if;

  return v_actor;
end;
$function$;

create or replace function public.pauta_management_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
begin
  v_actor := public.pauta_current_active_actor();

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem alterar a estrutura da Pauta.';
  end if;

  return v_actor;
end;
$function$;

create or replace function public.pauta_log_event(
  p_pauta_id uuid,
  p_board_id uuid,
  p_actor_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_old_values jsonb,
  p_new_values jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_event_id uuid;
  v_action text := trim(coalesce(p_action, ''));
  v_target_type text := coalesce(
    nullif(trim(p_target_type), ''),
    'pauta'
  );
begin
  if length(v_action) not between 2 and 80 then
    raise exception
      'Ação inválida para o histórico da Pauta.';
  end if;

  if v_target_type not in (
    'pauta',
    'client',
    'work_item',
    'member',
    'board'
  ) then
    raise exception
      'Tipo de alvo inválido para o histórico da Pauta.';
  end if;

  insert into public.pauta_events (
    pauta_id,
    board_id,
    actor_id,
    action,
    target_type,
    target_id,
    old_values,
    new_values,
    metadata
  )
  values (
    p_pauta_id,
    p_board_id,
    p_actor_id,
    v_action,
    v_target_type,
    p_target_id,
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$function$;

revoke all
on function public.pauta_current_active_actor()
from public, authenticated;

revoke all
on function public.pauta_management_actor()
from public, authenticated;

revoke all
on function public.pauta_log_event(
  uuid,
  uuid,
  uuid,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb
)
from public, authenticated;

-- =====================================================================
-- 8. RESUMO DE DEPENDÊNCIAS
-- =====================================================================

create or replace function public.pauta_dependency_summary(
  p_pauta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;

  v_active_members integer := 0;
  v_removed_members integer := 0;
  v_main_cards integer := 0;
  v_extra_demands integer := 0;
  v_active_items integer := 0;
  v_calendar_events integer := 0;
  v_schedule_requirements integer := 0;
  v_internal_messages integer := 0;
  v_notices integer := 0;
  v_blocking_events integer := 0;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  select
    count(*) filter (
      where membership_status = 'active'
    ),
    count(*) filter (
      where membership_status = 'removed'
    )
  into
    v_active_members,
    v_removed_members
  from public.pauta_members
  where pauta_id = p_pauta_id;

  select
    count(*) filter (
      where is_pauta_card = true
    ),
    count(*) filter (
      where is_pauta_card = false
    ),
    count(*) filter (
      where status not in (
        'archived',
        'cancelled',
        'done',
        'delivered',
        'approved'
      )
    )
  into
    v_main_cards,
    v_extra_demands,
    v_active_items
  from public.work_items
  where pauta_id = p_pauta_id;

  select count(*)
  into v_calendar_events
  from public.calendar_events
  where pauta_id = p_pauta_id;

  select count(*)
  into v_schedule_requirements
  from public.work_item_schedule_requirements as requirement
  join public.work_items as item
    on item.id = requirement.work_item_id
  where item.pauta_id = p_pauta_id;

  if to_regclass('public.internal_messages') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'internal_messages'
         and column_name = 'context_type'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'internal_messages'
         and column_name = 'context_id'
     )
  then
    execute
      $sql$
        select count(*)
        from public.internal_messages
        where context_type = 'pauta'
          and context_id = $1
      $sql$
    into v_internal_messages
    using p_pauta_id;
  end if;

  if to_regclass('public.avisos') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'avisos'
         and column_name = 'work_item_id'
     )
  then
    execute
      $sql$
        select count(*)
        from public.avisos as aviso
        where aviso.work_item_id in (
          select item.id
          from public.work_items as item
          where item.pauta_id = $1
        )
      $sql$
    into v_notices
    using p_pauta_id;
  end if;

  select count(*)
  into v_blocking_events
  from public.pauta_events
  where pauta_id = p_pauta_id
    and action not in (
      'pauta_created'
    );

  return jsonb_build_object(
    'pauta_id', v_pauta.id,
    'board_id', v_pauta.board_id,
    'name', v_pauta.name,
    'lifecycle_status', v_pauta.lifecycle_status,
    'active_members', v_active_members,
    'removed_members', v_removed_members,
    'main_cards', v_main_cards,
    'extra_demands', v_extra_demands,
    'active_items', v_active_items,
    'calendar_events', v_calendar_events,
    'schedule_requirements', v_schedule_requirements,
    'internal_messages', v_internal_messages,
    'notices', v_notices,
    'blocking_events', v_blocking_events,
    'can_delete',
      v_active_members = 0
      and v_main_cards = 0
      and v_extra_demands = 0
      and v_calendar_events = 0
      and v_schedule_requirements = 0
      and v_internal_messages = 0
      and v_notices = 0
      and v_blocking_events = 0,
    'requested_by', v_actor
  );
end;
$function$;

-- =====================================================================
-- 9. HELPER INTERNO PARA CRIAR CARD PRINCIPAL SEM DUPLICIDADE
-- =====================================================================
-- =====================================================================
-- PRÉVIA DOS CARDS LEGADOS CANDIDATOS À IMPORTAÇÃO
--
-- Esta função é somente leitura.
-- Não altera work_items, Pautas, memberships ou eventos.
-- Não adota cards automaticamente.
-- =====================================================================

create or replace function
public.preview_legacy_pauta_import(
  p_pauta_id uuid
)
returns table (
  work_item_id uuid,
  client_id uuid,
  client_name text,
  column_id uuid,
  status text,
  internal_deadline date,
  final_deadline date,
  responsible_id uuid,
  service_id uuid,
  candidate_role text,
  blocker text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
begin
  v_actor :=
    public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception
      'Pauta obrigatória.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception
      'Pauta não encontrada.';
  end if;

  return query
  with candidates as (
    select
      item.id as work_item_id,
      item.client_id,
      client.name as client_name,
      item.board_column_id as column_id,
      item.status::text as item_status,
      item.internal_deadline,
      item.final_deadline,
      item.responsible_id,
      item.client_service_id as service_id,
      client.status::text as client_status,

      count(*) over (
        partition by item.client_id
      ) as client_candidate_count,

      exists (
        select 1
        from public.pauta_members as member
        where member.pauta_id = p_pauta_id
          and member.client_id = item.client_id
          and member.membership_status = 'active'
      ) as already_in_pauta,

      exists (
        select 1
        from public.work_items as existing_main
        where existing_main.pauta_id = p_pauta_id
          and existing_main.client_id = item.client_id
          and existing_main.is_pauta_card = true
      ) as main_card_already_exists,

      (
        item.board_column_id is not null
        and column_row.id is not null
        and column_row.board_id = v_pauta.board_id
      ) as valid_column

    from public.work_items as item

    left join public.clients as client
      on client.id = item.client_id

    left join public.board_columns as column_row
      on column_row.id = item.board_column_id

    where item.board_id = v_pauta.board_id
      and item.pauta_id is null
      and item.is_pauta_card = false
      and item.pauta_card_id is null
      and item.status::text not in (
        'archived',
        'cancelled'
      )
  ),

  classified as (
    select
      candidate.*,

      nullif(
        concat_ws(
          '; ',

          case
            when candidate.client_id is null
              then 'WORK_ITEM_WITHOUT_CLIENT'
          end,

          case
            when candidate.client_id is not null
              and candidate.client_name is null
              then 'CLIENT_NOT_FOUND'
          end,

          case
            when candidate.client_name is not null
              and candidate.client_status
                is distinct from 'active'
              then 'INACTIVE_CLIENT'
          end,

          case
            when not candidate.valid_column
              then 'INVALID_BOARD_COLUMN'
          end,

          case
            when candidate.already_in_pauta
              then 'ALREADY_IN_PAUTA'
          end,

          case
            when candidate.main_card_already_exists
              then 'MAIN_CARD_ALREADY_EXISTS'
          end,

          case
            when candidate.client_candidate_count > 1
              then 'MULTIPLE_LEGACY_CANDIDATES'
          end,

          case
            when candidate.responsible_id is null
              then 'WARNING_MISSING_RESPONSIBLE'
          end,

          case
            when candidate.service_id is null
              then 'WARNING_MISSING_SERVICE'
          end
        ),
        ''
      ) as candidate_blocker

    from candidates as candidate
  )

  select
    classified.work_item_id,
    classified.client_id,
    classified.client_name,
    classified.column_id,
    classified.item_status,
    classified.internal_deadline,
    classified.final_deadline,
    classified.responsible_id,
    classified.service_id,

    case
      when classified.client_id is null
        or classified.client_name is null
        or classified.client_status
          is distinct from 'active'
        or not classified.valid_column
        or classified.already_in_pauta
        or classified.main_card_already_exists
        then 'BLOCKED'

      when classified.client_candidate_count > 1
        then 'REVIEW_REQUIRED'

      when classified.responsible_id is null
        or classified.service_id is null
        then 'MAIN_CANDIDATE_WITH_WARNINGS'

      else 'MAIN_CANDIDATE'
    end as candidate_role,

    classified.candidate_blocker

  from classified

  order by
    classified.client_name nulls last,
    classified.internal_deadline nulls last,
    classified.work_item_id;
end;
$function$;
create or replace function public.pauta_create_main_card_core(
  p_pauta_id uuid,
  p_client_id uuid,
  p_actor_id uuid,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_pauta public.pautas%rowtype;
  v_board public.boards%rowtype;
  v_alignment public.board_columns%rowtype;
  v_client public.clients%rowtype;
  v_existing_member public.pauta_members%rowtype;

  v_work_item_id uuid;
  v_existing_main_id uuid;

  v_requires_alignment boolean := false;
  v_requires_capture boolean := false;
  v_capture_type text;
  v_title text;
  v_source text := trim(coalesce(p_source, 'added'));
begin
  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  if p_actor_id is null then
    raise exception 'Autor obrigatório.';
  end if;

  if v_source not in (
    'opened',
    'added',
    'legacy_adopted',
    'backfill',
    'restored'
  ) then
    raise exception 'Origem de participação inválida.';
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
      'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  select *
  into v_board
  from public.boards
  where id = v_pauta.board_id
    and status = 'active'
    and board_kind = 'pauta';

  if not found then
    raise exception
      'O Quadro operacional da Pauta está inválido ou inativo.';
  end if;

  select *
  into v_client
  from public.clients
  where id = p_client_id
    and status = 'active';

  if not found then
    raise exception
      'Cliente não encontrado ou inativo.';
  end if;

  select *
  into v_existing_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'created', false,
      'membership_created', false,
      'work_item_id', v_existing_member.main_work_item_id,
      'client_id', p_client_id,
      'reason', 'ALREADY_IN_PAUTA'
    );
  end if;

  select id
  into v_existing_main_id
  from public.work_items
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and is_pauta_card = true
  order by created_at
  limit 1
  for update;

  if found then
    insert into public.pauta_members (
      pauta_id,
      client_id,
      main_work_item_id,
      membership_status,
      source,
      added_by,
      added_at,
      metadata
    )
    values (
      p_pauta_id,
      p_client_id,
      v_existing_main_id,
      'active',
      'restored',
      p_actor_id,
      now(),
      jsonb_build_object(
        'reason',
        'existing_main_card_without_active_membership'
      )
    );

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      p_actor_id,
      'client_membership_restored',
      'client',
      p_client_id,
      '{}'::jsonb,
      jsonb_build_object(
        'main_work_item_id',
        v_existing_main_id
      ),
      '{}'::jsonb
    );

    return jsonb_build_object(
      'success', true,
      'created', false,
      'membership_created', true,
      'work_item_id', v_existing_main_id,
      'client_id', p_client_id,
      'reason', 'MEMBERSHIP_RESTORED'
    );
  end if;

  select *
  into v_alignment
  from public.board_columns
  where board_id = v_pauta.board_id
    and automation_role = 'alignment'
  order by position, created_at
  limit 1;

  if not found then
    raise exception
      'O Quadro não possui a coluna Reunião de Alinhamento configurada.';
  end if;

  v_title :=
    upper(trim(v_client.name)) ||
    ' - ' ||
    to_char(v_pauta.reference_month, 'MM/YYYY');

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
    'Planejamento',
    'planned',
    'quadro',
    coalesce(
      v_alignment.operational_status,
      'not_started'
    ),
    'normal',
    v_client.id,
    null,
    v_client.responsible_id,
    v_pauta.board_id,
    v_alignment.id,
    v_pauta.magic_number_date,
    v_pauta.magic_number_date,
    v_client.drive_folder_url,
    null,
    null,
    p_actor_id,
    null,
    p_pauta_id,
    true,
    null,
    null
  )
  returning id
  into v_work_item_id;

  select
    coalesce(
      bool_or(service.requires_alignment_meeting),
      false
    ),
    coalesce(
      bool_or(service.requires_capture),
      false
    ),
    case
      when count(
        distinct service.default_capture_type
      ) filter (
        where service.default_capture_type is not null
      ) = 1
      then max(
        service.default_capture_type
      ) filter (
        where service.default_capture_type is not null
      )
      else null
    end
  into
    v_requires_alignment,
    v_requires_capture,
    v_capture_type
  from public.client_services as service
  where service.client_id = v_client.id
    and service.status = 'active';

  if v_requires_alignment then
    insert into public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_type,
      created_by
    )
    values (
      v_work_item_id,
      'alignment_meeting',
      'pending',
      'reu_a',
      p_actor_id
    )
    on conflict (
      work_item_id,
      requirement_type
    )
    do nothing;
  end if;

  if v_requires_capture then
    insert into public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_type,
      created_by
    )
    values (
      v_work_item_id,
      'capture',
      'pending',
      v_capture_type,
      p_actor_id
    )
    on conflict (
      work_item_id,
      requirement_type
    )
    do nothing;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_work_item_id,
    p_actor_id,
    case
      when v_source = 'opened'
        then 'pauta_opened'
      else 'pauta_client_added'
    end,
    null,
    p_pauta_id::text
  );

  insert into public.pauta_members (
    pauta_id,
    client_id,
    main_work_item_id,
    membership_status,
    source,
    added_by,
    added_at,
    metadata
  )
  values (
    p_pauta_id,
    p_client_id,
    v_work_item_id,
    'active',
    v_source,
    p_actor_id,
    now(),
    jsonb_build_object(
      'main_card_created',
      true
    )
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    p_actor_id,
    'client_added',
    'client',
    p_client_id,
    '{}'::jsonb,
    jsonb_build_object(
      'main_work_item_id',
      v_work_item_id,
      'source',
      v_source
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'created', true,
    'membership_created', true,
    'work_item_id', v_work_item_id,
    'client_id', p_client_id,
    'reason', 'MAIN_CARD_CREATED'
  );
end;
$function$;

revoke all
on function public.pauta_create_main_card_core(
  uuid,
  uuid,
  uuid,
  text
)
from public, authenticated;

-- =====================================================================
-- 10. GET_PAUTA_MANAGEMENT_SNAPSHOT
-- =====================================================================

create or replace function public.get_pauta_management_snapshot(
  p_pauta_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
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

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

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
              'programming_covered_until',
                item.programming_covered_until
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
  from public.pauta_members as member
  join public.clients as client
    on client.id = member.client_id
  left join public.work_items as item
    on item.id = member.main_work_item_id
  where member.pauta_id = p_pauta_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'pauta_card_id', item.pauta_card_id,
        'status', item.status,
        'priority', item.priority,
        'board_id', item.board_id,
        'board_column_id', item.board_column_id,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'completed_at', item.completed_at
      )
      order by item.created_at desc
    ),
    '[]'::jsonb
  )
  into v_extra_demands
  from public.work_items as item
  where item.pauta_id = p_pauta_id
    and item.is_pauta_card = false;

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
  from public.work_items as item
  join public.clients as client
    on client.id = item.client_id
  where item.board_id = v_pauta.board_id
    and item.pauta_id is null
    and item.is_pauta_card = false
    and item.status not in (
      'archived',
      'cancelled'
    )
    and not exists (
      select 1
      from public.pauta_members as member
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
    limit 200
  ) as event;

  v_dependencies :=
    public.pauta_dependency_summary(
      p_pauta_id
    );

  return jsonb_build_object(
    'pauta', to_jsonb(v_pauta),
    'members', v_members,
    'extra_demands', v_extra_demands,
    'legacy_candidates', v_legacy_candidates,
    'events', v_events,
    'dependency_summary', v_dependencies,
    'permissions', jsonb_build_object(
      'can_manage',
      public.app_has_total_access(),
      'can_operate',
      true
    ),
    'requested_by', v_actor
  );
end;
$function$;

-- =====================================================================
-- 11. UPDATE_PAUTA_SETTINGS
-- =====================================================================

create or replace function public.update_pauta_settings(
  p_pauta_id uuid,
  p_name text,
  p_magic_number_date date,
  p_scheduled_until_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old_values jsonb;
  v_new_values jsonb;
  v_updated_cards integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
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

  if p_scheduled_until_date < v_pauta.reference_month then
    raise exception
      'A data Programado até precisa alcançar o mês de referência.';
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

  update public.work_items
  set
    internal_deadline = p_magic_number_date,
    final_deadline = p_magic_number_date,
    updated_at = now()
  where pauta_id = p_pauta_id
    and is_pauta_card = true
    and status not in (
      'archived',
      'cancelled'
    );

  get diagnostics v_updated_cards = row_count;

  v_new_values := jsonb_build_object(
    'name', v_name,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  select
    item.id,
    v_actor,
    'pauta_settings_updated',
    v_old_values::text,
    v_new_values::text
  from public.work_items as item
  where item.pauta_id = p_pauta_id
    and item.is_pauta_card = true;

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
      'main_cards_updated',
      v_updated_cards
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'cards_updated', v_updated_cards,
    'settings', v_new_values
  );
end;
$function$;

-- =====================================================================
-- 12. PREVIEW_PAUTA_CLIENT_ADDITIONS
-- =====================================================================

create or replace function public.preview_pauta_client_additions(
  p_pauta_id uuid,
  p_client_ids uuid[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_clients jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_current_active_actor();

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

-- =====================================================================
-- 13. ADD_CLIENTS_TO_PAUTA
-- =====================================================================

create or replace function public.add_clients_to_pauta(
  p_pauta_id uuid,
  p_client_ids uuid[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_client_id uuid;
  v_result jsonb;
  v_added integer := 0;
  v_already_present integer := 0;
  v_without_services integer := 0;
  v_legacy_conflicts integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADICIONAR CLIENTES' then
    raise exception
      'Confirmação inválida. Digite ADICIONAR CLIENTES.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'É permitido incluir no máximo 300 clientes por operação.';
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
      'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    left join public.clients as client
      on client.id = selected.client_id
    where client.id is null
       or client.status <> 'active'
  ) then
    raise exception
      'Um ou mais clientes selecionados não existem ou estão inativos.';
  end if;

  select count(*)
  into v_legacy_conflicts
  from unnest(p_client_ids) as selected(client_id)
  where not exists (
    select 1
    from public.pauta_members as member
    where member.pauta_id = p_pauta_id
      and member.client_id = selected.client_id
      and member.membership_status = 'active'
  )
  and exists (
    select 1
    from public.work_items as legacy
    where legacy.board_id = v_pauta.board_id
      and legacy.pauta_id is null
      and legacy.client_id = selected.client_id
      and legacy.is_pauta_card = false
      and legacy.status not in (
        'archived',
        'cancelled'
      )
  );

  if v_legacy_conflicts > 0 then
    raise exception
      'A seleção possui % cliente(s) com card legado. Use a adoção de cards legados para evitar duplicidade.',
      v_legacy_conflicts;
  end if;

  for v_client_id in
    select distinct selected.client_id
    from unnest(p_client_ids) as selected(client_id)
  loop
    if exists (
      select 1
      from public.pauta_members as member
      where member.pauta_id = p_pauta_id
        and member.client_id = v_client_id
        and member.membership_status = 'active'
    ) then
      v_already_present := v_already_present + 1;
      continue;
    end if;

    if not exists (
      select 1
      from public.client_services as service
      where service.client_id = v_client_id
        and service.status = 'active'
    ) then
      v_without_services := v_without_services + 1;
    end if;

    v_result :=
      public.pauta_create_main_card_core(
        p_pauta_id,
        v_client_id,
        v_actor,
        'added'
      );

    if coalesce(
      (v_result ->> 'membership_created')::boolean,
      false
    ) then
      v_added := v_added + 1;
    else
      v_already_present := v_already_present + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_added', v_added,
    'clients_already_present', v_already_present,
    'clients_without_active_service', v_without_services,
    'legacy_conflicts', 0
  );
end;
$function$;

-- =====================================================================
-- 14. ADOPT_LEGACY_CARDS_TO_PAUTA
--
-- p_mapping:
-- [
--   {
--     "client_id": "uuid",
--     "main_work_item_id": "uuid",
--     "extra_work_item_ids": ["uuid", "uuid"]
--   }
-- ]
-- =====================================================================

create or replace function public.adopt_legacy_cards_to_pauta(
  p_pauta_id uuid,
  p_mapping jsonb,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;

  v_entry jsonb;
  v_client_id uuid;
  v_main_work_item_id uuid;
  v_extra_ids jsonb;

  v_main_item public.work_items%rowtype;
  v_extra_item public.work_items%rowtype;

  v_extra_id uuid;
  v_member_id uuid;

  v_clients_adopted integer := 0;
  v_main_cards_adopted integer := 0;
  v_extra_demands_adopted integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADOTAR LEGADO' then
    raise exception
      'Confirmação inválida. Digite ADOTAR LEGADO.';
  end if;

  if p_mapping is null
     or jsonb_typeof(p_mapping) <> 'array'
     or jsonb_array_length(p_mapping) = 0
  then
    raise exception
      'Informe um mapping não vazio em formato de array JSON.';
  end if;

  if jsonb_array_length(p_mapping) > 300 then
    raise exception
      'É permitido adotar no máximo 300 clientes por operação.';
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
      'Somente Pautas abertas ou em rascunho podem adotar cards legados.';
  end if;

  if exists (
    select 1
    from (
      select
        entry ->> 'client_id' as client_id,
        count(*) as total
      from jsonb_array_elements(p_mapping) as mapping(entry)
      group by entry ->> 'client_id'
      having count(*) > 1
    ) as duplicated
  ) then
    raise exception
      'O mapping contém o mesmo cliente mais de uma vez.';
  end if;

  if exists (
    select 1
    from (
      select
        entry ->> 'main_work_item_id' as work_item_id,
        count(*) as total
      from jsonb_array_elements(p_mapping) as mapping(entry)
      group by entry ->> 'main_work_item_id'
      having count(*) > 1
    ) as duplicated
  ) then
    raise exception
      'O mapping contém o mesmo card principal mais de uma vez.';
  end if;

  -- Toda validação ocorre dentro da mesma função/transação.
  -- Qualquer exceção reverte todas as adoções da chamada.

  for v_entry in
    select entry
    from jsonb_array_elements(p_mapping) as mapping(entry)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception
        'Cada item do mapping deve ser um objeto JSON.';
    end if;

    begin
      v_client_id :=
        nullif(
          trim(v_entry ->> 'client_id'),
          ''
        )::uuid;

      v_main_work_item_id :=
        nullif(
          trim(v_entry ->> 'main_work_item_id'),
          ''
        )::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'O mapping contém UUID inválido.';
    end;

    if v_client_id is null
       or v_main_work_item_id is null
    then
      raise exception
        'client_id e main_work_item_id são obrigatórios.';
    end if;

    v_extra_ids := coalesce(
      v_entry -> 'extra_work_item_ids',
      '[]'::jsonb
    );

    if jsonb_typeof(v_extra_ids) <> 'array' then
      raise exception
        'extra_work_item_ids deve ser um array JSON.';
    end if;

    if not exists (
      select 1
      from public.clients
      where id = v_client_id
        and status = 'active'
    ) then
      raise exception
        'Cliente % não existe ou está inativo.',
        v_client_id;
    end if;

    if exists (
      select 1
      from public.pauta_members
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and membership_status = 'active'
    ) then
      raise exception
        'O cliente % já participa da Pauta.',
        v_client_id;
    end if;

    if exists (
      select 1
      from public.work_items
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and is_pauta_card = true
    ) then
      raise exception
        'O cliente % já possui card principal nesta Pauta.',
        v_client_id;
    end if;

    select *
    into v_main_item
    from public.work_items
    where id = v_main_work_item_id
    for update;

    if not found then
      raise exception
        'Card principal legado % não encontrado.',
        v_main_work_item_id;
    end if;

    if v_main_item.client_id is distinct from v_client_id then
      raise exception
        'O card principal % não pertence ao cliente informado.',
        v_main_work_item_id;
    end if;

    if v_main_item.board_id is distinct from v_pauta.board_id then
      raise exception
        'O card principal % não pertence ao Quadro da Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.pauta_id is not null then
      raise exception
        'O card principal % já pertence a outra Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.is_pauta_card = true
       or v_main_item.pauta_card_id is not null
    then
      raise exception
        'O card principal % já possui contexto de Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.status in (
      'archived',
      'cancelled'
    ) then
      raise exception
        'O card principal % está arquivado ou cancelado.',
        v_main_work_item_id;
    end if;

    if v_main_item.board_column_id is null
       or not exists (
         select 1
         from public.board_columns as column_row
         where column_row.id = v_main_item.board_column_id
           and column_row.board_id = v_pauta.board_id
       )
    then
      raise exception
        'O card principal % não possui coluna válida no Quadro da Pauta.',
        v_main_work_item_id;
    end if;

    if exists (
      select 1
      from (
        select
          value::text as extra_id,
          count(*) as total
        from jsonb_array_elements_text(v_extra_ids)
        group by value::text
        having count(*) > 1
      ) as duplicate_extra
    ) then
      raise exception
        'A lista de extras do cliente % contém UUID repetido.',
        v_client_id;
    end if;

    for v_extra_id in
      select value::uuid
      from jsonb_array_elements_text(v_extra_ids)
    loop
      if v_extra_id = v_main_work_item_id then
        raise exception
          'O card principal não pode aparecer como demanda extra.';
      end if;

      select *
      into v_extra_item
      from public.work_items
      where id = v_extra_id
      for update;

      if not found then
        raise exception
          'Demanda extra legada % não encontrada.',
          v_extra_id;
      end if;

      if v_extra_item.client_id is distinct from v_client_id then
        raise exception
          'A demanda extra % não pertence ao cliente informado.',
          v_extra_id;
      end if;

      if v_extra_item.board_id is distinct from v_pauta.board_id then
        raise exception
          'A demanda extra % não pertence ao Quadro da Pauta.',
          v_extra_id;
      end if;

      if v_extra_item.pauta_id is not null
         or v_extra_item.is_pauta_card = true
         or v_extra_item.pauta_card_id is not null
      then
        raise exception
          'A demanda extra % já possui contexto de Pauta.',
          v_extra_id;
      end if;

      if v_extra_item.status in (
        'archived',
        'cancelled'
      ) then
        raise exception
          'A demanda extra % está arquivada ou cancelada.',
          v_extra_id;
      end if;

      if v_extra_item.board_column_id is null
         or not exists (
           select 1
           from public.board_columns as column_row
           where column_row.id = v_extra_item.board_column_id
             and column_row.board_id = v_pauta.board_id
         )
      then
        raise exception
          'A demanda extra % não possui coluna válida no Quadro da Pauta.',
          v_extra_id;
      end if;
    end loop;

    update public.work_items
    set
      pauta_id = p_pauta_id,
      is_pauta_card = true,
      pauta_card_id = null,
      updated_at = now()
    where id = v_main_work_item_id;

    insert into public.pauta_members (
      pauta_id,
      client_id,
      main_work_item_id,
      membership_status,
      source,
      added_by,
      added_at,
      metadata
    )
    values (
      p_pauta_id,
      v_client_id,
      v_main_work_item_id,
      'active',
      'legacy_adopted',
      v_actor,
      now(),
      jsonb_build_object(
        'migration',
        'V7-A3.4C.2A-R1',
        'preserved_column',
        v_main_item.board_column_id,
        'preserved_status',
        v_main_item.status,
        'preserved_internal_deadline',
        v_main_item.internal_deadline,
        'preserved_final_deadline',
        v_main_item.final_deadline
      )
    )
    returning id
    into v_member_id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_main_work_item_id,
      v_actor,
      'legacy_card_adopted',
      jsonb_build_object(
        'pauta_id', null,
        'is_pauta_card', false,
        'pauta_card_id', null
      )::text,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'is_pauta_card', true,
        'pauta_card_id', null
      )::text
    );

    update public.calendar_events
    set
      pauta_id = p_pauta_id,
      updated_at = now()
    where work_item_id = v_main_work_item_id;

    for v_extra_id in
      select value::uuid
      from jsonb_array_elements_text(v_extra_ids)
    loop
      update public.work_items
      set
        pauta_id = p_pauta_id,
        is_pauta_card = false,
        pauta_card_id = v_main_work_item_id,
        updated_at = now()
      where id = v_extra_id;

      update public.calendar_events
      set
        pauta_id = p_pauta_id,
        updated_at = now()
      where work_item_id = v_extra_id;

      insert into public.work_item_history (
        work_item_id,
        actor_id,
        field_changed,
        old_value,
        new_value
      )
      values (
        v_extra_id,
        v_actor,
        'legacy_demand_adopted',
        jsonb_build_object(
          'pauta_id', null,
          'pauta_card_id', null
        )::text,
        jsonb_build_object(
          'pauta_id', p_pauta_id,
          'pauta_card_id', v_main_work_item_id
        )::text
      );

      v_extra_demands_adopted :=
        v_extra_demands_adopted + 1;
    end loop;

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'legacy_card_adopted',
      'client',
      v_client_id,
      jsonb_build_object(
        'main_work_item_id',
        v_main_work_item_id,
        'pauta_id',
        null
      ),
      jsonb_build_object(
        'member_id',
        v_member_id,
        'main_work_item_id',
        v_main_work_item_id,
        'pauta_id',
        p_pauta_id,
        'extra_work_item_ids',
        v_extra_ids
      ),
      jsonb_build_object(
        'preserved_work_item_ids',
        true,
        'preserved_columns',
        true,
        'preserved_deadlines',
        true,
        'preserved_statuses',
        true
      )
    );

    v_clients_adopted :=
      v_clients_adopted + 1;

    v_main_cards_adopted :=
      v_main_cards_adopted + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_adopted', v_clients_adopted,
    'main_cards_adopted', v_main_cards_adopted,
    'extra_demands_adopted', v_extra_demands_adopted,
    'work_items_duplicated', 0
  );
end;
$function$;

-- =====================================================================
-- 15. CREATE_PAUTA_DEMAND
-- =====================================================================

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
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_column public.board_columns%rowtype;
  v_work_item_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_priority text := trim(coalesce(p_priority, 'normal'));
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
    'manual',
    'quadro',
    coalesce(
      v_column.operational_status,
      'not_started'
    ),
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
      'board_column_id', p_board_column_id
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
      'responsible_id', p_responsible_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', v_work_item_id,
    'pauta_card_id', v_member.main_work_item_id
  );
end;
$function$;

-- =====================================================================
-- 16. DETACH_PAUTA_DEMAND
-- =====================================================================

create or replace function public.detach_pauta_demand(
  p_pauta_id uuid,
  p_work_item_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_item public.work_items%rowtype;
  v_old_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR DEMANDA' then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDA.';
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
      'Somente Pautas abertas ou em rascunho podem retirar demandas.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
    and pauta_id = p_pauta_id
  for update;

  if not found then
    raise exception
      'Demanda não encontrada dentro desta Pauta.';
  end if;

  if v_item.is_pauta_card = true then
    raise exception
      'O card mensal principal deve ser tratado pela ação Retirar cliente.';
  end if;

  v_old_values := jsonb_build_object(
    'pauta_id', v_item.pauta_id,
    'pauta_card_id', v_item.pauta_card_id,
    'board_id', v_item.board_id,
    'board_column_id', v_item.board_column_id,
    'destino', v_item.destino
  );

  update public.calendar_events
  set
    pauta_id = null,
    updated_at = now()
  where work_item_id = p_work_item_id
    and pauta_id = p_pauta_id;

  update public.work_items
  set
    pauta_id = null,
    pauta_card_id = null,
    is_pauta_card = false,
    board_id = null,
    board_column_id = null,
    destino = 'avulsa',
    updated_at = now()
  where id = p_work_item_id;

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
    'removed_from_pauta',
    v_old_values::text,
    jsonb_build_object(
      'pauta_id', null,
      'pauta_card_id', null,
      'board_id', null,
      'board_column_id', null,
      'destino', 'avulsa'
    )::text
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'demand_detached',
    'work_item',
    p_work_item_id,
    v_old_values,
    jsonb_build_object(
      'preserved_as_extra', true,
      'destino', 'avulsa'
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', p_work_item_id,
    'preserved_as_extra', true
  );
end;
$function$;

-- =====================================================================
-- 17. REMOVE_CLIENT_FROM_PAUTA
-- =====================================================================

create or replace function public.remove_client_from_pauta(
  p_pauta_id uuid,
  p_client_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_client_name text;
  v_item record;
  v_detached integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR CLIENTE' then
    raise exception
      'Confirmação inválida. Digite RETIRAR CLIENTE.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
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
      'Somente Pautas abertas ou em rascunho podem retirar clientes.';
  end if;

  select name
  into v_client_name
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1
  for update;

  if not found then
    raise exception
      'O cliente não possui participação ativa nesta Pauta.';
  end if;

  update public.calendar_events as event
  set
    pauta_id = null,
    updated_at = now()
  where event.pauta_id = p_pauta_id
    and (
      event.client_id = p_client_id
      or event.work_item_id in (
        select item.id
        from public.work_items as item
        where item.pauta_id = p_pauta_id
          and (
            item.client_id = p_client_id
            or item.pauta_card_id = v_member.main_work_item_id
            or item.id = v_member.main_work_item_id
          )
      )
    );

  for v_item in
    select
      item.id,
      item.is_pauta_card,
      item.pauta_card_id,
      item.board_id,
      item.board_column_id,
      item.destino
    from public.work_items as item
    where item.pauta_id = p_pauta_id
      and (
        item.client_id = p_client_id
        or item.pauta_card_id = v_member.main_work_item_id
        or item.id = v_member.main_work_item_id
      )
    for update
  loop
    update public.work_items
    set
      pauta_id = null,
      pauta_card_id = null,
      is_pauta_card = false,
      board_id = null,
      board_column_id = null,
      destino = 'avulsa',
      updated_at = now()
    where id = v_item.id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_item.id,
      v_actor,
      case
        when v_item.is_pauta_card
          then 'client_removed_from_pauta'
        else 'removed_from_pauta'
      end,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'is_pauta_card', v_item.is_pauta_card,
        'pauta_card_id', v_item.pauta_card_id,
        'board_id', v_item.board_id,
        'board_column_id', v_item.board_column_id,
        'destino', v_item.destino
      )::text,
      jsonb_build_object(
        'pauta_id', null,
        'is_pauta_card', false,
        'pauta_card_id', null,
        'board_id', null,
        'board_column_id', null,
        'destino', 'avulsa'
      )::text
    );

    v_detached := v_detached + 1;
  end loop;

  update public.pauta_members
  set
    membership_status = 'removed',
    removed_by = v_actor,
    removed_at = now(),
    metadata =
      coalesce(metadata, '{}'::jsonb)
      ||
      jsonb_build_object(
        'items_preserved_as_extra',
        v_detached,
        'removed_from_pauta_at',
        now()
      )
  where id = v_member.id;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'client_removed',
    'client',
    p_client_id,
    jsonb_build_object(
      'member_id', v_member.id,
      'main_work_item_id', v_member.main_work_item_id,
      'client_name', v_client_name
    ),
    jsonb_build_object(
      'membership_status', 'removed',
      'items_preserved_as_extra', v_detached
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'client_id', p_client_id,
    'member_id', v_member.id,
    'items_preserved_as_extra', v_detached
  );
end;
$function$;

-- =====================================================================
-- 18. CHANGE_PAUTA_LIFECYCLE
-- =====================================================================

create or replace function public.change_pauta_lifecycle(
  p_pauta_id uuid,
  p_action text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_action text := lower(
    trim(coalesce(p_action, ''))
  );
  v_expected_confirmation text;
  v_next_status text;
  v_pending_main_cards integer := 0;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if v_action not in (
    'close',
    'reopen',
    'archive'
  ) then
    raise exception
      'Ação de ciclo de vida inválida.';
  end if;

  v_expected_confirmation :=
    case v_action
      when 'close'
        then 'CONCLUIR PAUTA'
      when 'reopen'
        then 'REABRIR PAUTA'
      when 'archive'
        then 'ARQUIVAR PAUTA'
    end;

  if trim(coalesce(p_confirmation, ''))
     <> v_expected_confirmation
  then
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
    if v_pauta.lifecycle_status not in (
      'draft',
      'open'
    ) then
      raise exception
        'Somente Pautas abertas ou em rascunho podem ser concluídas.';
    end if;

    select count(*)
    into v_pending_main_cards
    from public.pauta_members as member
    join public.work_items as item
      on item.id = member.main_work_item_id
    where member.pauta_id = p_pauta_id
      and member.membership_status = 'active'
      and item.is_pauta_card = true
      and item.pauta_id = p_pauta_id
      and item.completed_at is null
      and item.status not in (
        'done',
        'delivered',
        'approved'
      );

    if v_pending_main_cards > 0 then
      raise exception
        'A Pauta ainda possui % card(s) mensal(is) não concluído(s).',
        v_pending_main_cards;
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
    if v_pauta.lifecycle_status not in (
      'closed',
      'archived'
    ) then
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
      raise exception
        'A Pauta já está arquivada.';
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
  from public.pautas as pauta
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
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'previous_status', v_pauta.lifecycle_status,
    'lifecycle_status', v_next_status
  );
end;
$function$;

-- =====================================================================
-- 19. DELETE_EMPTY_PAUTA
-- =====================================================================

create or replace function public.delete_empty_pauta(
  p_pauta_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_dependencies jsonb;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'EXCLUIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite EXCLUIR PAUTA.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  v_dependencies :=
    public.pauta_dependency_summary(
      p_pauta_id
    );

  if not coalesce(
    (v_dependencies ->> 'can_delete')::boolean,
    false
  ) then
    raise exception
      'A Pauta possui dependências e não pode ser excluída. Resumo: %.',
      v_dependencies::text;
  end if;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'pauta_deleted',
    'pauta',
    p_pauta_id,
    to_jsonb(v_pauta),
    jsonb_build_object(
      'deleted_at',
      now()
    ),
    jsonb_build_object(
      'dependency_summary',
      v_dependencies
    )
  );

  delete from public.pautas
  where id = p_pauta_id;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'deleted', true
  );
end;
$function$;

-- =====================================================================
-- 20. OPEN_MONTHLY_PAUTA REVISADA
--
-- Mesma assinatura pública.
-- Agora:
-- - detecta Pauta existente e retorna código explícito;
-- - cria pauta_members;
-- - registra pauta_events;
-- - usa o helper central sem duplicar cards.
-- =====================================================================

create or replace function public.open_monthly_pauta(
  p_board_id uuid,
  p_name text,
  p_reference_month date,
  p_magic_number_date date,
  p_scheduled_until_date date,
  p_client_ids uuid[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_existing_pauta public.pautas%rowtype;
  v_pauta_id uuid;
  v_client_id uuid;
  v_result jsonb;

  v_selected_count integer := 0;
  v_unique_count integer := 0;
  v_active_count integer := 0;
  v_cards_created integer := 0;
  v_memberships_created integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ABRIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite ABRIR PAUTA.';
  end if;

  if p_board_id is null then
    raise exception 'Quadro obrigatório.';
  end if;

  if length(trim(coalesce(p_name, ''))) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if p_reference_month is null
     or p_reference_month <>
        date_trunc(
          'month',
          p_reference_month
        )::date
  then
    raise exception
      'O mês de referência deve utilizar o primeiro dia do mês.';
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

  if p_scheduled_until_date < p_reference_month then
    raise exception
      'A data Programado até precisa alcançar o mês de referência.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente ativo.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'A Pauta aceita no máximo 300 clientes por abertura.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  select
    count(*),
    count(distinct selected.client_id)
  into
    v_selected_count,
    v_unique_count
  from unnest(p_client_ids) as selected(client_id);

  if v_selected_count <> v_unique_count then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_board
  from public.boards
  where id = p_board_id
    and status = 'active'
    and board_kind = 'pauta'
  for update;

  if not found then
    raise exception
      'A Pauta deve ser aberta em um Quadro ativo do tipo Pauta.';
  end if;

  select *
  into v_existing_pauta
  from public.pautas
  where board_id = p_board_id
    and reference_month = p_reference_month
  limit 1;

  if found then
    return jsonb_build_object(
      'success', false,
      'code', 'PAUTA_EXISTS',
      'existing_pauta_unchanged', true,
      'message', 'Já existe uma Pauta para este mês.',
      'pauta_id', v_existing_pauta.id,
      'pauta_name', v_existing_pauta.name,
      'reference_month', v_existing_pauta.reference_month,
      'lifecycle_status', v_existing_pauta.lifecycle_status,
      'cards_created', 0
    );
  end if;

  select count(*)
  into v_active_count
  from public.clients
  where id = any(p_client_ids)
    and status = 'active';

  if v_active_count <> v_unique_count then
    raise exception
      'Um ou mais clientes selecionados não existem ou estão inativos.';
  end if;

  insert into public.pautas (
    board_id,
    name,
    reference_month,
    magic_number_date,
    scheduled_until_date,
    lifecycle_status,
    opened_at,
    created_by
  )
  values (
    p_board_id,
    trim(p_name),
    p_reference_month,
    p_magic_number_date,
    p_scheduled_until_date,
    'open',
    now(),
    v_actor
  )
  returning id
  into v_pauta_id;

  for v_client_id in
    select client.id
    from public.clients as client
    where client.id = any(p_client_ids)
      and client.status = 'active'
    order by client.name
  loop
    v_result :=
      public.pauta_create_main_card_core(
        v_pauta_id,
        v_client_id,
        v_actor,
        'opened'
      );

    if coalesce(
      (v_result ->> 'created')::boolean,
      false
    ) then
      v_cards_created :=
        v_cards_created + 1;
    end if;

    if coalesce(
      (v_result ->> 'membership_created')::boolean,
      false
    ) then
      v_memberships_created :=
        v_memberships_created + 1;
    end if;
  end loop;

  perform public.pauta_log_event(
    v_pauta_id,
    p_board_id,
    v_actor,
    'pauta_created',
    'pauta',
    v_pauta_id,
    '{}'::jsonb,
    jsonb_build_object(
      'name', trim(p_name),
      'reference_month', p_reference_month,
      'magic_number_date', p_magic_number_date,
      'scheduled_until_date', p_scheduled_until_date,
      'cards_created', v_cards_created,
      'memberships_created', v_memberships_created
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'code', 'PAUTA_CREATED',
    'pauta_id', v_pauta_id,
    'cards_created', v_cards_created,
    'memberships_created', v_memberships_created,
    'reference_month', p_reference_month,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );
end;
$function$;

-- =====================================================================
-- 21. PERMISSÕES DAS RPCS
-- =====================================================================

revoke all
on function public.pauta_dependency_summary(uuid)
from public;

revoke all
on function public.get_pauta_management_snapshot(uuid)
from public;

revoke all
on function public.update_pauta_settings(
  uuid,
  text,
  date,
  date
)
from public;

revoke all
on function public.preview_pauta_client_additions(
  uuid,
  uuid[]
)
from public;

revoke all
on function public.add_clients_to_pauta(
  uuid,
  uuid[],
  text
)
from public;

revoke all
on function public.adopt_legacy_cards_to_pauta(
  uuid,
  jsonb,
  text
)
from public;

revoke all
on function public.create_pauta_demand(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  date,
  date,
  text,
  text
)
from public;

revoke all
on function public.detach_pauta_demand(
  uuid,
  uuid,
  text
)
from public;

revoke all
on function public.remove_client_from_pauta(
  uuid,
  uuid,
  text
)
from public;

revoke all
on function public.change_pauta_lifecycle(
  uuid,
  text,
  text
)
from public;

revoke all
on function public.delete_empty_pauta(
  uuid,
  text
)
from public;

revoke all
on function public.open_monthly_pauta(
  uuid,
  text,
  date,
  date,
  date,
  uuid[],
  text
)
from public;

grant execute
on function public.pauta_dependency_summary(uuid)
to authenticated;

grant execute
on function public.get_pauta_management_snapshot(uuid)
to authenticated;

grant execute
on function public.update_pauta_settings(
  uuid,
  text,
  date,
  date
)
to authenticated;

grant execute
on function public.preview_pauta_client_additions(
  uuid,
  uuid[]
)
to authenticated;

grant execute
on function public.add_clients_to_pauta(
  uuid,
  uuid[],
  text
)
to authenticated;

grant execute
on function public.adopt_legacy_cards_to_pauta(
  uuid,
  jsonb,
  text
)
to authenticated;

grant execute
on function public.create_pauta_demand(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  date,
  date,
  text,
  text
)
to authenticated;

grant execute
on function public.detach_pauta_demand(
  uuid,
  uuid,
  text
)
to authenticated;

grant execute
on function public.remove_client_from_pauta(
  uuid,
  uuid,
  text
)
to authenticated;

grant execute
on function public.change_pauta_lifecycle(
  uuid,
  text,
  text
)
to authenticated;

grant execute
on function public.delete_empty_pauta(
  uuid,
  text
)
to authenticated;

grant execute
on function public.open_monthly_pauta(
  uuid,
  text,
  date,
  date,
  date,
  uuid[],
  text
)
to authenticated;

comment on function public.get_pauta_management_snapshot(uuid) is
  'Retorna Pauta, participantes, demandas, legado, histórico, dependências e permissões.';

comment on function public.update_pauta_settings(
  uuid,
  text,
  date,
  date
) is
  'Edita nome, Magic Number e Programado até e sincroniza somente os cards principais.';

comment on function public.preview_pauta_client_additions(
  uuid,
  uuid[]
) is
  'Classifica clientes antes de inclusão ou adoção para impedir cards duplicados.';

comment on function public.add_clients_to_pauta(
  uuid,
  uuid[],
  text
) is
  'Cria cards novos apenas para clientes sem card legado disponível.';

comment on function public.adopt_legacy_cards_to_pauta(
  uuid,
  jsonb,
  text
) is
  'Adota work_items existentes por mapping explícito, preservando UUID, coluna, status e datas.';

comment on function public.create_pauta_demand(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  date,
  date,
  text,
  text
) is
  'Cria uma demanda canônica vinculada ao card principal do cliente na Pauta.';

comment on function public.detach_pauta_demand(
  uuid,
  uuid,
  text
) is
  'Retira uma demanda da Pauta e preserva o mesmo work_item como Extra.';

comment on function public.remove_client_from_pauta(
  uuid,
  uuid,
  text
) is
  'Retira um participante e preserva todos os work_items relacionados como Extras.';

comment on function public.change_pauta_lifecycle(
  uuid,
  text,
  text
) is
  'Conclui, reabre ou arquiva uma Pauta sem apagar work_items.';

comment on function public.delete_empty_pauta(
  uuid,
  text
) is
  'Exclui definitivamente somente uma Pauta sem dependências bloqueadoras.';

comment on function public.open_monthly_pauta(
  uuid,
  text,
  date,
  date,
  date,
  uuid[],
  text
) is
  'Abre Pauta mensal, cria memberships e cards principais e retorna PAUTA_EXISTS quando o mês já existe.';
revoke all
on function
  public.preview_legacy_pauta_import(uuid)
from public, authenticated;

grant execute
on function
  public.preview_legacy_pauta_import(uuid)
to authenticated;

comment on function
  public.preview_legacy_pauta_import(uuid) is
  'Lista candidatos legados de uma Pauta sem alterar ou adotar work_items.';
commit;
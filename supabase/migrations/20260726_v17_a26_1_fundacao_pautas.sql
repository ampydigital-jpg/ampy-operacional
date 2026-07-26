-- ============================================================
-- V17-A26.1 — FUNDAÇÃO DE PAUTAS MENSAIS E MAGIC NUMBER
-- Projeto: Gerenciador de Demandas Ampy
-- Regra oficial: Pauta mensal, nunca "Ciclo" na interface.
-- ============================================================

begin;

create table if not exists public.pautas (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete restrict,
  name text not null,
  reference_month date not null,
  magic_number_date date not null,
  scheduled_until_date date not null,
  lifecycle_status text not null default 'draft',
  opened_at timestamptz,
  closed_at timestamptz,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pautas_reference_month_chk'
      and conrelid = 'public.pautas'::regclass
  ) then
    alter table public.pautas
      add constraint pautas_reference_month_chk
      check (
        reference_month =
        date_trunc('month', reference_month)::date
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pautas_dates_chk'
      and conrelid = 'public.pautas'::regclass
  ) then
    alter table public.pautas
      add constraint pautas_dates_chk
      check (
        magic_number_date <= scheduled_until_date
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pautas_lifecycle_status_chk'
      and conrelid = 'public.pautas'::regclass
  ) then
    alter table public.pautas
      add constraint pautas_lifecycle_status_chk
      check (
        lifecycle_status in (
          'draft',
          'open',
          'closed',
          'archived'
        )
      );
  end if;
end;
$$;

create unique index if not exists pautas_board_reference_month_uidx
  on public.pautas (board_id, reference_month);

create index if not exists pautas_magic_number_idx
  on public.pautas (magic_number_date)
  where archived_at is null;

create index if not exists pautas_scheduled_until_idx
  on public.pautas (scheduled_until_date)
  where archived_at is null;

create index if not exists pautas_lifecycle_status_idx
  on public.pautas (lifecycle_status);

create or replace function public.touch_pautas_updated_at()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists trg_pautas_touch_updated_at
  on public.pautas;

create trigger trg_pautas_touch_updated_at
before update on public.pautas
for each row
execute function public.touch_pautas_updated_at();

alter table public.work_items
  add column if not exists pauta_id uuid
    references public.pautas(id)
    on delete set null,
  add column if not exists is_pauta_card boolean
    not null
    default false,
  add column if not exists pauta_card_id uuid
    references public.work_items(id)
    on delete set null,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid,
  add column if not exists completion_magic_number_snapshot date,
  add column if not exists completion_delay_days integer,
  add column if not exists content_finalized_at timestamptz,
  add column if not exists content_finalized_by uuid,
  add column if not exists approvals_resolved_at timestamptz,
  add column if not exists approvals_resolved_by uuid,
  add column if not exists programming_covered_until date,
  add column if not exists programming_verified_at timestamptz,
  add column if not exists programming_verified_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'work_items_pauta_card_requires_context_chk'
      and conrelid = 'public.work_items'::regclass
  ) then
    alter table public.work_items
      add constraint work_items_pauta_card_requires_context_chk
      check (
        is_pauta_card = false
        or (
          pauta_id is not null
          and client_id is not null
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'work_items_pauta_card_not_self_chk'
      and conrelid = 'public.work_items'::regclass
  ) then
    alter table public.work_items
      add constraint work_items_pauta_card_not_self_chk
      check (
        pauta_card_id is null
        or pauta_card_id <> id
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'work_items_completion_delay_days_chk'
      and conrelid = 'public.work_items'::regclass
  ) then
    alter table public.work_items
      add constraint work_items_completion_delay_days_chk
      check (
        completion_delay_days is null
        or completion_delay_days >= 0
      );
  end if;
end;
$$;

create unique index if not exists work_items_pauta_client_card_uidx
  on public.work_items (pauta_id, client_id)
  where is_pauta_card = true;

create index if not exists work_items_pauta_id_idx
  on public.work_items (pauta_id);

create index if not exists work_items_pauta_card_id_idx
  on public.work_items (pauta_card_id);

create index if not exists work_items_pauta_progress_idx
  on public.work_items (
    pauta_id,
    is_pauta_card,
    board_column_id,
    completed_at
  );

update public.board_columns
set position = 107
where automation_role = 'legacy_metrics';

update public.board_columns
set position = 108
where automation_role = 'completed';

update public.board_columns
set name = 'Organização da Grade'
where automation_role = 'organization';

update public.board_columns
set position = 7
where automation_role = 'legacy_metrics';

update public.board_columns
set position = 8
where automation_role = 'completed';

alter table public.pautas enable row level security;

drop policy if exists pautas_select_active_users
  on public.pautas;

create policy pautas_select_active_users
on public.pautas
for select
to authenticated
using (public.app_is_active_user());

drop policy if exists pautas_insert_total_access
  on public.pautas;

create policy pautas_insert_total_access
on public.pautas
for insert
to authenticated
with check (public.app_has_total_access());

drop policy if exists pautas_update_total_access
  on public.pautas;

create policy pautas_update_total_access
on public.pautas
for update
to authenticated
using (public.app_has_total_access())
with check (public.app_has_total_access());

drop policy if exists pautas_delete_total_access
  on public.pautas;

create policy pautas_delete_total_access
on public.pautas
for delete
to authenticated
using (public.app_has_total_access());

grant select, insert, update, delete
  on public.pautas
  to authenticated;

comment on table public.pautas is
  'Referência operacional mensal com Magic Number e data Programado até.';

comment on column public.work_items.pauta_id is
  'Pauta mensal à qual o card ou demanda pertence.';

comment on column public.work_items.is_pauta_card is
  'Identifica o card mensal principal do cliente dentro da Pauta.';

comment on column public.work_items.pauta_card_id is
  'Card mensal de origem para demandas vinculadas à mesma Pauta.';

comment on column public.work_items.completed_at is
  'Data e hora real em que o card mensal chegou a Concluído.';

comment on column public.work_items.programming_covered_until is
  'Data até a qual a programação do cliente está garantida.';

commit;

select
  'V17-A26.1 aplicada com sucesso' as resultado,

  to_regclass('public.pautas') is not null
    as pautas_table_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'pauta_id'
  ) as pauta_id_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'completed_at'
  ) as completed_at_ok,

  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'work_items_pauta_client_card_uidx'
  ) as unique_card_per_client_ok,

  (
    select count(*)
    from public.board_columns
    where automation_role = 'legacy_metrics'
      and position = 7
  ) as metrics_columns_positioned,

  (
    select count(*)
    from public.board_columns
    where automation_role = 'completed'
      and position = 8
  ) as completed_columns_positioned;

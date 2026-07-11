create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  message text not null,

  category text not null default 'operational',
  priority text not null default 'medium',
  status text not null default 'active',

  source_module text,
  source_table text,
  source_id uuid,
  source_url text,
  action_label text,

  related_entity_type text,
  related_entity_id uuid,

  dedupe_key text unique,

  client_id uuid references public.clients(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  feed_board_id uuid references public.feed_boards(id) on delete set null,
  feed_board_item_id uuid references public.feed_board_items(id) on delete set null,
  feed_board_event_id uuid references public.feed_board_events(id) on delete set null,

  due_at timestamptz,
  reminder_at timestamptz,

  read_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,
  completed_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,

  is_auto boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.avisos
add column if not exists source_module text;

alter table public.avisos
add column if not exists source_table text;

alter table public.avisos
add column if not exists source_id uuid;

alter table public.avisos
add column if not exists source_url text;

alter table public.avisos
add column if not exists action_label text;

alter table public.avisos
add column if not exists related_entity_type text;

alter table public.avisos
add column if not exists related_entity_id uuid;

alter table public.avisos
add column if not exists due_at timestamptz;

alter table public.avisos
add column if not exists reminder_at timestamptz;

alter table public.avisos
add column if not exists read_at timestamptz;

alter table public.avisos
add column if not exists archived_at timestamptz;

alter table public.avisos
add column if not exists deleted_at timestamptz;

alter table public.avisos
add column if not exists completed_at timestamptz;

alter table public.avisos
add column if not exists is_auto boolean not null default true;

alter table public.avisos
add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'avisos_priority_check'
  ) then
    alter table public.avisos
    add constraint avisos_priority_check
    check (priority in ('low', 'medium', 'high', 'urgent'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'avisos_status_check'
  ) then
    alter table public.avisos
    add constraint avisos_status_check
    check (status in ('active', 'read', 'archived', 'deleted', 'done'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'avisos_category_check'
  ) then
    alter table public.avisos
    add constraint avisos_category_check
    check (category in (
      'approval',
      'adjustment',
      'demand',
      'planning',
      'agenda',
      'client',
      'project',
      'board',
      'communication',
      'manual',
      'operational'
    ));
  end if;
end $$;

create index if not exists idx_avisos_status on public.avisos(status);
create index if not exists idx_avisos_category on public.avisos(category);
create index if not exists idx_avisos_priority on public.avisos(priority);
create index if not exists idx_avisos_client_id on public.avisos(client_id);
create index if not exists idx_avisos_work_item_id on public.avisos(work_item_id);
create index if not exists idx_avisos_feed_board_id on public.avisos(feed_board_id);
create index if not exists idx_avisos_feed_board_item_id on public.avisos(feed_board_item_id);
create index if not exists idx_avisos_due_at on public.avisos(due_at);
create index if not exists idx_avisos_reminder_at on public.avisos(reminder_at);
create index if not exists idx_avisos_deleted_at on public.avisos(deleted_at);
create index if not exists idx_avisos_archived_at on public.avisos(archived_at);
create index if not exists idx_avisos_related_entity on public.avisos(related_entity_type, related_entity_id);

create or replace function public.set_avisos_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_avisos_updated_at on public.avisos;

create trigger trg_avisos_updated_at
before update on public.avisos
for each row
execute function public.set_avisos_updated_at();

alter table public.avisos enable row level security;

drop policy if exists "avisos_select_authenticated" on public.avisos;
create policy "avisos_select_authenticated"
on public.avisos
for select
to authenticated
using (true);

drop policy if exists "avisos_insert_authenticated" on public.avisos;
create policy "avisos_insert_authenticated"
on public.avisos
for insert
to authenticated
with check (true);

drop policy if exists "avisos_update_authenticated" on public.avisos;
create policy "avisos_update_authenticated"
on public.avisos
for update
to authenticated
using (true)
with check (true);

drop policy if exists "avisos_delete_authenticated" on public.avisos;
create policy "avisos_delete_authenticated"
on public.avisos
for delete
to authenticated
using (true);

select 'V15E-J.1 avisos canonicos aplicada com sucesso' as status;
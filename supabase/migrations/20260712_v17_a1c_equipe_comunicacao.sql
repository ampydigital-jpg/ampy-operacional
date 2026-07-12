create extension if not exists pgcrypto;

-- =========================================================
-- V17-A1C — Equipe operacional, acessos simples e comunicação
-- profiles é tabela de usuário real/autenticado.
-- Equipe operacional fica em team_members.
-- =========================================================

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid references public.profiles(id) on delete set null,

  full_name text not null,
  email text not null,
  job_title text not null,

  access_type text not null default 'operacional',
  operational_area text not null,

  avatar_initials text,
  avatar_color text default '#FFFFFF',
  avatar_bg text default '#3A3D43',

  is_active boolean not null default true,
  receives_internal_alerts boolean not null default true,

  display_order integer,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists team_members_email_lower_unique
on public.team_members (lower(email));

create index if not exists idx_team_members_profile_id
on public.team_members (profile_id);

create index if not exists idx_team_members_area
on public.team_members (operational_area);

create index if not exists idx_team_members_access_type
on public.team_members (access_type);

create index if not exists idx_team_members_active
on public.team_members (is_active);

insert into public.team_members (
  full_name,
  email,
  job_title,
  access_type,
  operational_area,
  avatar_initials,
  avatar_color,
  avatar_bg,
  is_active,
  receives_internal_alerts,
  display_order,
  updated_at
)
values
  ('ampydigital', 'ampydigital@gmail.com', 'Gestor Operacional', 'total', 'gestao_operacional', 'AM', '#FFFFFF', '#111318', true, true, 1, now()),
  ('admampydigital', 'admampydigital@gmail.com', 'Gestor Administrativo', 'total', 'gestao_administrativa', 'AD', '#FFFFFF', '#25282D', true, true, 2, now()),
  ('ampycaptacao', 'ampycaptacao@gmail.com', 'Videomaker', 'operacional', 'captacao', 'CA', '#FFFFFF', '#3A3D43', true, true, 3, now()),
  ('ampyedicao', 'ampyedicao@gmail.com', 'Editor', 'operacional', 'edicao', 'ED', '#FFFFFF', '#3A3D43', true, true, 4, now()),
  ('ampyprogramacao', 'ampyprogramacao@gmail.com', 'Operações', 'operacional', 'operacoes', 'OP', '#FFFFFF', '#3A3D43', true, true, 5, now()),
  ('ampyplanejamento', 'ampyplanejamento@gmail.com', 'Planejamento', 'operacional', 'planejamento', 'PL', '#FFFFFF', '#3A3D43', true, true, 6, now()),
  ('ampydesign', 'ampydesign@gmail.com', 'Designer', 'operacional', 'design', 'DS', '#FFFFFF', '#3A3D43', true, true, 7, now()),
  ('ampyperformance', 'ampyperformance@gmail.com', 'Performance', 'operacional', 'performance', 'PF', '#FFFFFF', '#3A3D43', true, true, 8, now())
on conflict (lower(email))
do update set
  full_name = excluded.full_name,
  job_title = excluded.job_title,
  access_type = excluded.access_type,
  operational_area = excluded.operational_area,
  avatar_initials = excluded.avatar_initials,
  avatar_color = excluded.avatar_color,
  avatar_bg = excluded.avatar_bg,
  is_active = excluded.is_active,
  receives_internal_alerts = excluded.receives_internal_alerts,
  display_order = excluded.display_order,
  updated_at = now();

alter table public.avisos
add column if not exists assigned_team_member_id uuid references public.team_members(id) on delete set null;

alter table public.avisos
add column if not exists assigned_email text;

alter table public.avisos
add column if not exists assigned_area text;

alter table public.avisos
add column if not exists assigned_role text;

alter table public.avisos
add column if not exists notify_by_email boolean not null default false;

alter table public.avisos
add column if not exists email_notified_at timestamptz;

create index if not exists idx_avisos_assigned_team_member
on public.avisos (assigned_team_member_id);

create index if not exists idx_avisos_assigned_email
on public.avisos (assigned_email);

create index if not exists idx_avisos_assigned_area
on public.avisos (assigned_area);

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),

  body text not null,

  context_type text not null default 'general',
  context_id uuid,

  client_id uuid references public.clients(id) on delete set null,
  work_item_id uuid references public.work_items(id) on delete set null,
  feed_board_id uuid references public.feed_boards(id) on delete set null,
  feed_board_item_id uuid references public.feed_board_items(id) on delete set null,
  aviso_id uuid references public.avisos(id) on delete set null,

  drive_url text,
  attachment_title text,

  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_by_team_member_id uuid references public.team_members(id) on delete set null,
  created_by_email text,

  is_resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by_profile_id uuid references public.profiles(id) on delete set null,
  resolved_by_team_member_id uuid references public.team_members(id) on delete set null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_internal_messages_context
on public.internal_messages (context_type, context_id);

create index if not exists idx_internal_messages_client
on public.internal_messages (client_id);

create index if not exists idx_internal_messages_work_item
on public.internal_messages (work_item_id);

create index if not exists idx_internal_messages_feed_board
on public.internal_messages (feed_board_id);

create index if not exists idx_internal_messages_created_team_member
on public.internal_messages (created_by_team_member_id);

create index if not exists idx_internal_messages_created_email
on public.internal_messages (created_by_email);

create table if not exists public.internal_message_mentions (
  id uuid primary key default gen_random_uuid(),

  message_id uuid not null references public.internal_messages(id) on delete cascade,

  mentioned_profile_id uuid references public.profiles(id) on delete cascade,
  mentioned_team_member_id uuid references public.team_members(id) on delete cascade,

  mentioned_email text,
  mentioned_area text,
  mentioned_role text,

  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_internal_message_mentions_message
on public.internal_message_mentions (message_id);

create index if not exists idx_internal_message_mentions_profile
on public.internal_message_mentions (mentioned_profile_id);

create index if not exists idx_internal_message_mentions_team_member
on public.internal_message_mentions (mentioned_team_member_id);

create index if not exists idx_internal_message_mentions_email
on public.internal_message_mentions (mentioned_email);

create index if not exists idx_internal_message_mentions_area
on public.internal_message_mentions (mentioned_area);

create or replace function public.set_team_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_team_members_updated_at on public.team_members;

create trigger trg_team_members_updated_at
before update on public.team_members
for each row
execute function public.set_team_members_updated_at();

create or replace function public.set_internal_messages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_internal_messages_updated_at on public.internal_messages;

create trigger trg_internal_messages_updated_at
before update on public.internal_messages
for each row
execute function public.set_internal_messages_updated_at();

alter table public.team_members enable row level security;
alter table public.internal_messages enable row level security;
alter table public.internal_message_mentions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname = 'team_members_select_authenticated'
  ) then
    create policy team_members_select_authenticated
    on public.team_members
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname = 'team_members_insert_authenticated'
  ) then
    create policy team_members_insert_authenticated
    on public.team_members
    for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname = 'team_members_update_authenticated'
  ) then
    create policy team_members_update_authenticated
    on public.team_members
    for update
    to authenticated
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_messages'
      and policyname = 'internal_messages_select_authenticated'
  ) then
    create policy internal_messages_select_authenticated
    on public.internal_messages
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_messages'
      and policyname = 'internal_messages_insert_authenticated'
  ) then
    create policy internal_messages_insert_authenticated
    on public.internal_messages
    for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_messages'
      and policyname = 'internal_messages_update_authenticated'
  ) then
    create policy internal_messages_update_authenticated
    on public.internal_messages
    for update
    to authenticated
    using (true)
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_message_mentions'
      and policyname = 'internal_message_mentions_select_authenticated'
  ) then
    create policy internal_message_mentions_select_authenticated
    on public.internal_message_mentions
    for select
    to authenticated
    using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_message_mentions'
      and policyname = 'internal_message_mentions_insert_authenticated'
  ) then
    create policy internal_message_mentions_insert_authenticated
    on public.internal_message_mentions
    for insert
    to authenticated
    with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'internal_message_mentions'
      and policyname = 'internal_message_mentions_update_authenticated'
  ) then
    create policy internal_message_mentions_update_authenticated
    on public.internal_message_mentions
    for update
    to authenticated
    using (true)
    with check (true);
  end if;
end $$;

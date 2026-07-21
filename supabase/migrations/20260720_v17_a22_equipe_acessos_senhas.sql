begin;

alter table public.team_members
  add column if not exists must_change_password boolean
  not null default false;

alter table public.team_members
  add column if not exists last_password_change_at timestamptz;

alter table public.team_members
  add column if not exists last_access_change_at timestamptz;

alter table public.team_members
  add column if not exists last_access_changed_by uuid
  references public.profiles(id)
  on delete set null;

alter table public.team_members
  drop constraint if exists team_members_access_type_check;

alter table public.team_members
  add constraint team_members_access_type_check
  check (
    access_type in (
      'total',
      'operacional'
    )
  );

create unique index if not exists
  team_members_email_unique_lower
on public.team_members (
  lower(email)
);

create unique index if not exists
  team_members_profile_unique
on public.team_members (
  profile_id
)
where profile_id is not null;

create table if not exists public.team_access_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid
    references public.profiles(id)
    on delete set null,
  target_profile_id uuid
    references public.profiles(id)
    on delete set null,
  target_email text not null,
  action text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.team_members
  enable row level security;

alter table public.team_access_audit
  enable row level security;

drop policy if exists
  "team_members_insert_authenticated"
on public.team_members;

drop policy if exists
  "team_members_update_authenticated"
on public.team_members;

drop policy if exists
  "team_members_select_authenticated"
on public.team_members;

drop policy if exists
  "team_members_select_active"
on public.team_members;

drop policy if exists
  "team_members_insert_total"
on public.team_members;

drop policy if exists
  "team_members_update_total"
on public.team_members;

drop policy if exists
  "team_members_delete_total"
on public.team_members;

create policy
  "team_members_select_active"
on public.team_members
for select
to authenticated
using (
  public.app_is_active_user()
);

create policy
  "team_members_insert_total"
on public.team_members
for insert
to authenticated
with check (
  public.has_total_access()
);

create policy
  "team_members_update_total"
on public.team_members
for update
to authenticated
using (
  public.has_total_access()
)
with check (
  public.has_total_access()
);

create policy
  "team_members_delete_total"
on public.team_members
for delete
to authenticated
using (
  public.has_total_access()
);

drop policy if exists
  "team_access_audit_select_total"
on public.team_access_audit;

drop policy if exists
  "team_access_audit_insert_total"
on public.team_access_audit;

create policy
  "team_access_audit_select_total"
on public.team_access_audit
for select
to authenticated
using (
  public.has_total_access()
);

create policy
  "team_access_audit_insert_total"
on public.team_access_audit
for insert
to authenticated
with check (
  public.has_total_access()
);

commit;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'must_change_password'
  ) as must_change_password_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'last_password_change_at'
  ) as password_change_date_ok,

  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'team_access_audit'
  ) as access_audit_ok,

  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname in (
        'team_members_select_active',
        'team_members_insert_total',
        'team_members_update_total',
        'team_members_delete_total'
      )
  ) as secure_team_policies_ok,

  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname in (
        'team_members_insert_authenticated',
        'team_members_update_authenticated'
      )
  ) as insecure_team_policies_remaining,

  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_access_audit'
      and policyname in (
        'team_access_audit_select_total',
        'team_access_audit_insert_total'
      )
  ) as audit_policies_ok,

  to_regprocedure(
    'public.has_total_access()'
  ) is not null
    as total_access_function_ok;

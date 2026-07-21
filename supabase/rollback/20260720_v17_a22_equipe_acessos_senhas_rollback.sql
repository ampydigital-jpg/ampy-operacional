begin;

do $$
begin
  if exists (
    select 1
    from public.team_access_audit
  ) then
    raise exception
      'Rollback bloqueado: já existem registros de auditoria de acesso.';
  end if;

  if exists (
    select 1
    from public.team_members
    where must_change_password is true
       or last_password_change_at is not null
       or last_access_change_at is not null
       or last_access_changed_by is not null
  ) then
    raise exception
      'Rollback bloqueado: os novos campos de acesso já foram utilizados.';
  end if;
end
$$;

drop policy if exists
  "team_access_audit_select_total"
on public.team_access_audit;

drop policy if exists
  "team_access_audit_insert_total"
on public.team_access_audit;

drop table if exists
  public.team_access_audit;

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
  "team_members_select_authenticated"
on public.team_members
for select
to authenticated
using (true);

create policy
  "team_members_insert_authenticated"
on public.team_members
for insert
to authenticated
with check (true);

create policy
  "team_members_update_authenticated"
on public.team_members
for update
to authenticated
using (true)
with check (true);

drop index if exists
  public.team_members_email_unique_lower;

drop index if exists
  public.team_members_profile_unique;

alter table public.team_members
  drop constraint if exists team_members_access_type_check;

alter table public.team_members
  drop column if exists last_access_changed_by;

alter table public.team_members
  drop column if exists last_access_change_at;

alter table public.team_members
  drop column if exists last_password_change_at;

alter table public.team_members
  drop column if exists must_change_password;

commit;

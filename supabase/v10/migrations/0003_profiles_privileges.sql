-- PENDENTE DE APROVACAO. NAO EXECUTADA.
-- Aplicar apos 0001/0002; roles administrativas passam a ser escritas pelo servidor.
begin;

-- O trigger atual cria todos como admin ativo. Cadastro nunca concede acesso.
-- createTeamMemberAction define papel/ativacao posteriormente com service role.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $function$
begin
  insert into public.profiles (
    id, full_name, email, role, avatar_initials, avatar_color, avatar_bg,
    is_active, created_at, updated_at
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email, 'collaborator',
    upper(left(split_part(new.email, '@', 1), 2)),
    '#CC8800', '#1A1200', false, now(), now()
  ) on conflict (id) do nothing;
  return new;
end;
$function$;

revoke all privileges on table public.profiles from anon, public;
revoke insert, update, delete on table public.profiles from authenticated;
-- PostgreSQL preserva grants por coluna quando o grant da tabela e revogado.
revoke all privileges (id, full_name, email, role, avatar_initials, avatar_color,
  avatar_bg, is_active, created_at, updated_at, team_area, job_title, display_name,
  avatar_url) on table public.profiles from anon, authenticated, public;
grant select on table public.profiles to authenticated;
grant update (display_name, avatar_url, avatar_initials, avatar_color, avatar_bg)
  on table public.profiles to authenticated;

create or replace function public.app_has_total_access()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $function$
  select exists (
    select 1 from public.team_members tm
    join public.profiles p on p.id = tm.profile_id
    where p.id = auth.uid() and p.is_active = true
      and tm.is_active = true and tm.access_type = 'total'
  );
$function$;

create or replace function public.has_total_access()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $function$
  select public.app_has_total_access();
$function$;

-- Defesa adicional contra reintroducao acidental de grants amplos.
create or replace function public.guard_profiles_privileged_fields()
returns trigger language plpgsql set search_path = public, pg_temp
as $function$
begin
  if auth.role() in ('anon', 'authenticated') and (
    new.id is distinct from old.id or new.role is distinct from old.role
    or new.email is distinct from old.email or new.is_active is distinct from old.is_active
    or new.team_area is distinct from old.team_area or new.job_title is distinct from old.job_title
    or new.full_name is distinct from old.full_name or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Campos de acesso do perfil so podem ser alterados pelo servidor.';
  end if;
  return new;
end;
$function$;

create trigger eyxo_guard_profiles_privileged_fields
before update on public.profiles
for each row execute function public.guard_profiles_privileged_fields();
revoke execute on function public.guard_profiles_privileged_fields() from public, anon, authenticated;

-- A policy administrativa baseada no role do proprio perfil nao concede edicao direta.
alter policy profiles_manage_admin on public.profiles
  using (false) with check (false);
alter policy profiles_update_own on public.profiles
  using (auth.uid() = id and public.app_is_active_user())
  with check (auth.uid() = id and public.app_is_active_user());

commit;

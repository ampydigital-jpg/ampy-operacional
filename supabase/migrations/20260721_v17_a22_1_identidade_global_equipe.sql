begin;

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text;

alter table public.team_members
  add column if not exists display_name text,
  add column if not exists avatar_url text;

update public.profiles
set display_name = full_name
where nullif(trim(display_name), '') is null;

update public.team_members
set display_name = full_name
where nullif(trim(display_name), '') is null;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'team-avatars',
  'team-avatars',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id)
do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists
  "team avatars authenticated read"
on storage.objects;

drop policy if exists
  "team avatars own or total insert"
on storage.objects;

drop policy if exists
  "team avatars own or total update"
on storage.objects;

drop policy if exists
  "team avatars own or total delete"
on storage.objects;

create policy
  "team avatars authenticated read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'team-avatars'
);

create policy
  "team avatars own or total insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'team-avatars'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.has_total_access()
  )
);

create policy
  "team avatars own or total update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'team-avatars'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.has_total_access()
  )
)
with check (
  bucket_id = 'team-avatars'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.has_total_access()
  )
);

create policy
  "team avatars own or total delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'team-avatars'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.has_total_access()
  )
);

commit;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'display_name'
  ) as profile_display_name_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'avatar_url'
  ) as profile_avatar_url_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'display_name'
  ) as member_display_name_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'avatar_url'
  ) as member_avatar_url_ok,

  exists (
    select 1
    from storage.buckets
    where id = 'team-avatars'
      and public is true
      and file_size_limit = 5242880
  ) as team_avatars_bucket_ok,

  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'team avatars authenticated read',
        'team avatars own or total insert',
        'team avatars own or total update',
        'team avatars own or total delete'
      )
  ) as team_avatar_policies_ok,

  not exists (
    select 1
    from public.profiles
    where nullif(trim(display_name), '') is null
  ) as profile_names_backfilled_ok,

  not exists (
    select 1
    from public.team_members
    where nullif(trim(display_name), '') is null
  ) as member_names_backfilled_ok;

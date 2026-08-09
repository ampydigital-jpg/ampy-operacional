begin;

do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise exception 'public.handle_new_user() nao existe';
  end if;

  if to_regprocedure('public.has_total_access()') is null then
    raise exception 'public.has_total_access() nao existe';
  end if;
end
$$;

drop trigger if exists
  on_auth_user_created
on auth.users;

create trigger
  on_auth_user_created
after insert
on auth.users
for each row
execute function public.handle_new_user();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
(
  'client-logos',
  'client-logos',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
),
(
  'feed-preview',
  'feed-preview',
  true,
  10485760,
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]::text[]
),
(
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
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists
  "client logos authenticated delete"
on storage.objects;

create policy
  "client logos authenticated delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-logos'
  and public.has_total_access()
);

drop policy if exists
  "client logos authenticated insert"
on storage.objects;

create policy
  "client logos authenticated insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-logos'
  and public.has_total_access()
);

drop policy if exists
  "client logos authenticated update"
on storage.objects;

create policy
  "client logos authenticated update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-logos'
  and public.has_total_access()
)
with check (
  bucket_id = 'client-logos'
  and public.has_total_access()
);

drop policy if exists
  "client logos public read"
on storage.objects;

create policy
  "client logos public read"
on storage.objects
for select
to public
using (
  bucket_id = 'client-logos'
);

drop policy if exists
  "feed_preview_objects_delete_authenticated"
on storage.objects;

create policy
  "feed_preview_objects_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'feed-preview'
);

drop policy if exists
  "feed_preview_objects_insert_authenticated"
on storage.objects;

create policy
  "feed_preview_objects_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feed-preview'
);

drop policy if exists
  "feed_preview_objects_read_authenticated"
on storage.objects;

create policy
  "feed_preview_objects_read_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'feed-preview'
);

drop policy if exists
  "feed_preview_objects_update_authenticated"
on storage.objects;

create policy
  "feed_preview_objects_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'feed-preview'
)
with check (
  bucket_id = 'feed-preview'
);

drop policy if exists
  "team avatars authenticated read"
on storage.objects;

create policy
  "team avatars authenticated read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'team-avatars'
);

drop policy if exists
  "team avatars own or total delete"
on storage.objects;

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

drop policy if exists
  "team avatars own or total insert"
on storage.objects;

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

drop policy if exists
  "team avatars own or total update"
on storage.objects;

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

commit;
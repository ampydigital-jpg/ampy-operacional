
begin;

alter table
  public.clients
add column if not exists
  logo_url text;

alter table
  public.clients
add column if not exists
  logo_storage_path text;

alter table
  public.clients
add column if not exists
  strategic_map_url text;

alter table
  public.clients
add column if not exists
  operation_model text
  not null
  default 'monthly';

alter table
  public.clients
drop constraint if exists
  clients_operation_model_check;

alter table
  public.clients
add constraint
  clients_operation_model_check
check (
  operation_model in (
    'monthly',
    'parallel',
    'not_applicable'
  )
);

update
  public.clients
set
  operation_model =
    'monthly'
where
  operation_model is null
  or operation_model not in (
    'monthly',
    'parallel',
    'not_applicable'
  );

update
  public.clients
set
  strategic_map_url =
    briefing_url
where
  strategic_map_url is null
  and briefing_url is not null
  and trim(briefing_url) <> '';

update
  public.clients
set
  avatar_color =
    '#475569',
  avatar_bg =
    '#F1F5F9'
where
  logo_url is null;

insert into
  storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
values (
  'client-logos',
  'client-logos',
  true,
  5242880,
  array[
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
on conflict (id)
do update set
  name =
    excluded.name,
  public =
    excluded.public,
  file_size_limit =
    excluded.file_size_limit,
  allowed_mime_types =
    excluded.allowed_mime_types;

drop policy if exists
  "client logos public read"
on storage.objects;

drop policy if exists
  "client logos authenticated insert"
on storage.objects;

drop policy if exists
  "client logos authenticated update"
on storage.objects;

drop policy if exists
  "client logos authenticated delete"
on storage.objects;

create or replace function
  public.has_total_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members tm
    where tm.profile_id = auth.uid()
      and tm.is_active is true
      and tm.access_type = 'total'
  );
$$;

revoke all
on function
  public.has_total_access()
from public;

grant execute
on function
  public.has_total_access()
to authenticated;

create policy
  "client logos public read"
on storage.objects
for select
using (
  bucket_id =
    'client-logos'
);

create policy
  "client logos authenticated insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id =
    'client-logos'
  and public.has_total_access()
);

create policy
  "client logos authenticated update"
on storage.objects
for update
to authenticated
using (
  bucket_id =
    'client-logos'
  and public.has_total_access()
)
with check (
  bucket_id =
    'client-logos'
  and public.has_total_access()
);

create policy
  "client logos authenticated delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id =
    'client-logos'
  and public.has_total_access()
);

commit;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'clients'
      and column_name =
        'logo_url'
  ) as logo_url_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'clients'
      and column_name =
        'strategic_map_url'
  ) as strategic_map_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema =
      'public'
      and table_name =
        'clients'
      and column_name =
        'operation_model'
  ) as operation_model_ok,

  exists (
    select 1
    from storage.buckets
    where id =
      'client-logos'
      and public is true
  ) as client_logos_bucket_ok,

  (
    select count(*)
    from pg_policies
    where schemaname =
      'storage'
      and tablename =
        'objects'
      and policyname in (
        'client logos public read',
        'client logos authenticated insert',
        'client logos authenticated update',
        'client logos authenticated delete'
      )
  ) as storage_policies_ok,

  (
    select count(*)
    from pg_policies
    where schemaname =
      'storage'
      and tablename =
        'objects'
      and policyname in (
        'client logos authenticated insert',
        'client logos authenticated update',
        'client logos authenticated delete'
      )
      and (
        coalesce(
          qual,
          ''
        ) ||
        coalesce(
          with_check,
          ''
        )
      ) like
        '%has_total_access%'
  ) as restricted_write_policies_ok,

  to_regprocedure(
    'public.has_total_access()'
  ) is not null
    as total_access_function_ok;

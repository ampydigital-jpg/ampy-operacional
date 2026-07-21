begin;

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

delete from storage.objects
where bucket_id = 'team-avatars';

delete from storage.buckets
where id = 'team-avatars';

alter table public.team_members
  drop column if exists avatar_url,
  drop column if exists display_name;

alter table public.profiles
  drop column if exists avatar_url,
  drop column if exists display_name;

commit;


-- ATENÇÃO:
-- este rollback é bloqueado se já existirem logos
-- ou clientes classificados como Paralelo/Não aplicável.

begin;

do $$
begin
  if exists (
    select 1
    from storage.objects
    where bucket_id =
      'client-logos'
  ) then
    raise exception
      'Rollback bloqueado: existem logos no bucket client-logos.';
  end if;

  if exists (
    select 1
    from public.clients
    where operation_model in (
      'parallel',
      'not_applicable'
    )
  ) then
    raise exception
      'Rollback bloqueado: existem clientes classificados como Paralelo ou Não aplicável.';
  end if;
end
$$;

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

drop function if exists
  public.has_total_access();

delete from
  storage.buckets
where id =
  'client-logos';

alter table
  public.clients
drop constraint if exists
  clients_operation_model_check;

alter table
  public.clients
drop column if exists
  operation_model;

alter table
  public.clients
drop column if exists
  strategic_map_url;

alter table
  public.clients
drop column if exists
  logo_storage_path;

alter table
  public.clients
drop column if exists
  logo_url;

commit;

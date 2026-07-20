-- Este rollback é bloqueado caso já existam clientes
-- arquivados ou removidos da operação.

begin;

do $$
begin
  if exists (
    select 1
    from public.clients
    where status in (
      'archived',
      'inactive'
    )
  ) then
    raise exception
      'Rollback bloqueado: existem clientes archived ou inactive.';
  end if;
end
$$;

alter table public.clients
  drop constraint if exists clients_status_check;

alter table public.clients
  add constraint clients_status_check
  check (
    status in (
      'active',
      'cancelled',
      'onboarding',
      'paused'
    )
  );

commit;
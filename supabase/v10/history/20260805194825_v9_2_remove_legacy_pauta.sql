-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

begin;

set local lock_timeout = '10s';

set local statement_timeout = '120s';

lock table public.work_items
  in share row exclusive mode;

lock table public.work_item_board_assignments
  in share row exclusive mode;

lock table public.work_item_history
  in row exclusive mode;

lock table public.calendar_events
  in access share mode;

alter table public.work_item_history
  alter column actor_id drop not null;

create temporary table v9_2_scope_snapshot
on commit drop
as
select
  (select count(*) from public.calendar_events) as calendar_total,
  (select count(*) from public.calendar_events where pauta_id is null) as calendar_not_applicable,
  (
    select count(*)
    from public.work_items as work_item
    join public.boards as board on board.id = work_item.board_id
    where board.board_kind = 'custom'
      and work_item.pauta_id is null
      and work_item.status not in ('archived','cancelled')
  ) as active_custom_without_pauta,
  (select count(*) from public.pautas) as pautas_total,
  (
    select md5(coalesce(string_agg(concat_ws('|',pauta.id::text,pauta.lifecycle_status,coalesce(pauta.closed_at::text,''),coalesce(pauta.archived_at::text,'')),',' order by pauta.id),''))
    from public.pautas as pauta
  ) as pautas_state_hash;

create temporary table v9_2_legacy_pauta_targets
on commit drop
as
select
  work_item.id,
  work_item.status as previous_status,
  work_item.closed_at as previous_closed_at,
  work_item.completed_at as previous_completed_at,
  work_item.completed_by as previous_completed_by,
  work_item.board_id,
  work_item.board_column_id,
  work_item.client_id,
  work_item.responsible_id
from public.work_items as work_item
join public.boards as board on board.id = work_item.board_id
where board.board_kind = 'pauta'
  and work_item.pauta_id is null
  and work_item.status not in ('archived','cancelled');

create or replace function public.guard_active_pauta_work_item_requires_pauta()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_board_kind text;
begin
  if new.board_id is null then
    return new;
  end if;

  select board_kind into v_board_kind
  from public.boards
  where id = new.board_id;

  if v_board_kind = 'pauta'
     and new.pauta_id is null
     and new.status not in ('archived','cancelled')
  then
    raise exception 'Demandas ativas do Quadro operacional precisam pertencer a uma Pauta.';
  end if;

  return new;
end;
$function$;

drop trigger if exists guard_active_pauta_work_item_requires_pauta on public.work_items;

create trigger guard_active_pauta_work_item_requires_pauta
before insert or update of board_id,pauta_id,status
on public.work_items
for each row
execute function public.guard_active_pauta_work_item_requires_pauta();

comment on function public.guard_active_pauta_work_item_requires_pauta()
is 'Impede work_items ativos ligados diretamente ao Quadro de Pautas sem pauta_id. Não afeta Agenda nem Quadros personalizados.';

commit;

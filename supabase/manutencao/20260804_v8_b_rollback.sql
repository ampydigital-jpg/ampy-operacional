-- ============================================================
-- V8-B — ROLLBACK CONDICIONADO
-- Bloqueia a remoção se a estrutura já tiver uso multiquadro real.
-- ============================================================

begin;

do $v8_b_down$
declare
  v_real_distributions bigint;
  v_new_events bigint;
begin
  select count(*)
  into v_real_distributions
  from public.work_item_board_assignments
  where coalesce(metadata ->> 'source','') not in (
    'legacy_backfill',
    'legacy_dual_write'
  );

  select count(*)
  into v_new_events
  from public.work_item_board_assignment_events;

  if v_real_distributions > 0 or v_new_events > 0 then
    raise exception
      'V8-B DOWN bloqueado: existem % distribuições novas e % eventos operacionais. Reverta apenas o código e preserve os dados.',
      v_real_distributions,
      v_new_events;
  end if;
end;
$v8_b_down$;

drop trigger if exists work_items_sync_assignment_trg on public.work_items;
drop trigger if exists work_item_board_assignments_recalculate_trg on public.work_item_board_assignments;

drop function if exists public.move_work_item_board_assignment(uuid,uuid);
drop function if exists public.create_and_distribute_pauta_demands(uuid,jsonb,jsonb,text);
drop function if exists public.remove_pauta_demands_batch(uuid,uuid[],text);
drop function if exists public.remove_pauta_clients_batch(uuid,uuid[],text);
drop function if exists public.update_pauta_member_target_date(uuid,date);
drop function if exists public.add_clients_to_pauta_v8(uuid,jsonb,text);
drop function if exists public.v8_log_assignment_event(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb);
drop function if exists public.v8_sync_assignment_from_work_item();
drop function if exists public.v8_assignment_after_change();
drop function if exists public.recalculate_work_item_global_status(uuid);
drop function if exists public.v8_assignment_is_complete(text);

drop table if exists public.work_item_board_assignment_events;
drop table if exists public.work_item_board_assignments;

drop index if exists public.pauta_members_target_date_idx;

alter table public.pauta_members
  drop constraint if exists pauta_members_target_date_updated_by_fkey,
  drop column if exists target_date_updated_by,
  drop column if exists target_date_updated_at,
  drop column if exists target_date;

alter table public.board_columns
  drop constraint if exists board_columns_board_id_id_key;

commit;

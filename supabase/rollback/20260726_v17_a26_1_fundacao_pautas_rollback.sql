-- ============================================================
-- ROLLBACK V17-A26.1 — FUNDAÇÃO DE PAUTAS
-- Executar somente antes da criação de qualquer Pauta real.
-- ============================================================

begin;

do $$
declare
  v_pautas_count bigint := 0;
  v_linked_items_count bigint := 0;
begin
  if to_regclass('public.pautas') is not null then
    execute 'select count(*) from public.pautas'
      into v_pautas_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'pauta_id'
  ) then
    execute '
      select count(*)
      from public.work_items
      where pauta_id is not null
         or is_pauta_card = true
         or pauta_card_id is not null
         or completed_at is not null
         or content_finalized_at is not null
         or approvals_resolved_at is not null
         or programming_covered_until is not null
    '
    into v_linked_items_count;
  end if;

  if v_pautas_count > 0
     or v_linked_items_count > 0 then
    raise exception
      'Rollback bloqueado: existem Pautas ou work_items já vinculados. Pautas: %, work_items: %.',
      v_pautas_count,
      v_linked_items_count;
  end if;
end;
$$;

drop policy if exists pautas_select_active_users
  on public.pautas;

drop policy if exists pautas_insert_total_access
  on public.pautas;

drop policy if exists pautas_update_total_access
  on public.pautas;

drop policy if exists pautas_delete_total_access
  on public.pautas;

drop trigger if exists trg_pautas_touch_updated_at
  on public.pautas;

drop function if exists public.touch_pautas_updated_at();

drop index if exists public.work_items_pauta_progress_idx;
drop index if exists public.work_items_pauta_card_id_idx;
drop index if exists public.work_items_pauta_id_idx;
drop index if exists public.work_items_pauta_client_card_uidx;

alter table public.work_items
  drop constraint if exists work_items_completion_delay_days_chk,
  drop constraint if exists work_items_pauta_card_not_self_chk,
  drop constraint if exists work_items_pauta_card_requires_context_chk;

alter table public.work_items
  drop column if exists programming_verified_by,
  drop column if exists programming_verified_at,
  drop column if exists programming_covered_until,
  drop column if exists approvals_resolved_by,
  drop column if exists approvals_resolved_at,
  drop column if exists content_finalized_by,
  drop column if exists content_finalized_at,
  drop column if exists completion_delay_days,
  drop column if exists completion_magic_number_snapshot,
  drop column if exists completed_by,
  drop column if exists completed_at,
  drop column if exists pauta_card_id,
  drop column if exists is_pauta_card,
  drop column if exists pauta_id;

drop table if exists public.pautas;

update public.board_columns
set position = 107
where automation_role = 'completed';

update public.board_columns
set position = 108
where automation_role = 'legacy_metrics';

update public.board_columns
set name = 'Organização do Feed'
where automation_role = 'organization';

update public.board_columns
set position = 7
where automation_role = 'completed';

update public.board_columns
set position = 8
where automation_role = 'legacy_metrics';

commit;

select
  'Rollback V17-A26.1 aplicado com sucesso'
    as resultado;

-- ============================================================
-- ROLLBACK V17-A26.2B — REFINO DA ABERTURA DE PAUTAS
-- ============================================================

begin;

alter table public.pautas
  drop constraint if exists pautas_scheduled_until_reference_month_chk;

commit;

select
  'Rollback V17-A26.2B aplicado com sucesso'
    as resultado;

-- ============================================================
-- ROLLBACK V17-A26.2 — ABERTURA ATÔMICA DE PAUTAS
-- Remove somente a função de abertura.
-- Não apaga Pautas nem cards já existentes.
-- ============================================================

begin;

drop function if exists
  public.open_monthly_pauta(
    uuid,
    text,
    date,
    date,
    date,
    uuid[],
    text
  );

commit;

select
  'Rollback V17-A26.2 aplicado com sucesso'
    as resultado;

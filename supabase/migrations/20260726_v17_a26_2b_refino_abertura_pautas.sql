-- ============================================================
-- V17-A26.2B — REFINO DA ABERTURA DE PAUTAS
-- Garante que "Programado até" alcance o mês de referência.
-- ============================================================

begin;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pautas_scheduled_until_reference_month_chk'
      and conrelid = 'public.pautas'::regclass
  ) then
    alter table public.pautas
      add constraint pautas_scheduled_until_reference_month_chk
      check (
        scheduled_until_date >= reference_month
      );
  end if;
end;
$$;

comment on constraint pautas_scheduled_until_reference_month_chk
  on public.pautas is
  'A cobertura Programado até precisa alcançar o mês de referência da Pauta.';

commit;

select
  'V17-A26.2B aplicada com sucesso' as resultado,

  exists (
    select 1
    from pg_constraint
    where conname = 'pautas_scheduled_until_reference_month_chk'
      and conrelid = 'public.pautas'::regclass
  ) as cobertura_minima_ok;

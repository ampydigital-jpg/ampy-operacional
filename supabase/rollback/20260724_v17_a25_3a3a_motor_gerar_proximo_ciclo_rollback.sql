-- =========================================================
-- ROLLBACK V17-A25.3A3A
-- =========================================================

begin;

do $$
begin
  if exists (
    select 1
    from public.work_items
    where generated_from_cycle_id is not null
  ) then
    raise exception
      'Rollback bloqueado: já existem ciclos gerados.';
  end if;
end
$$;

drop function if exists
  public.generate_next_work_item_cycle(
    uuid,
    uuid,
    date,
    date,
    boolean,
    text
  );

alter table public.work_item_schedule_requirements
  drop constraint if exists
    work_item_schedule_requirements_calendar_type_check;

alter table public.work_item_schedule_requirements
  drop column if exists calendar_type;

commit;

select
  'Rollback V17-A25.3A3A aplicado' as resultado;
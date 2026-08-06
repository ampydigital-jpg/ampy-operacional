-- =========================================================
-- V9.2C-A2.1 — PAUTAS: CARDS PRINCIPAIS + QUADROS
-- Aplicada em produção antes do versionamento.
-- =========================================================

begin;

do $migration$
declare
  v_function_oid oid;
  v_definition text;
  v_patched_definition text;
  v_occurrences integer;
begin
  v_function_oid :=
    to_regprocedure(
      'public.distribute_existing_pauta_demands(uuid,jsonb,jsonb,text)'
    );

  if v_function_oid is null then
    raise exception
      'Função distribute_existing_pauta_demands não encontrada.';
  end if;

  v_definition :=
    pg_get_functiondef(
      v_function_oid
    );

  if position(
    'and coalesce(is_pauta_card, false) in (false, true)'
    in v_definition
  ) > 0
  then
    raise exception
      'A migration V9.2C-A2.1 já está aplicada.';
  end if;

  select count(*)
  into v_occurrences
  from regexp_matches(
    v_definition,
    'and is_pauta_card = false',
    'g'
  );

  if v_occurrences <> 1 then
    raise exception
      'Proteção esperada divergente. Ocorrências encontradas: %',
      v_occurrences;
  end if;

  v_patched_definition :=
    replace(
      v_definition,
      'and is_pauta_card = false',
      'and coalesce(is_pauta_card, false) in (false, true)'
    );

  execute v_patched_definition;
end;
$migration$;

create or replace function
  public.remove_pauta_extra_demands_v92c(
    p_pauta_id uuid,
    p_work_item_ids uuid[],
    p_confirmation text
  )
returns jsonb
language plpgsql
security definer
set search_path to
  'public',
  'pg_temp'
as $function$
declare
  v_invalid_count integer;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para retirar demandas.';
  end if;

  if trim(
    coalesce(
      p_confirmation,
      ''
    )
  ) <> 'RETIRAR DEMANDAS'
  then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDAS.';
  end if;

  if
    p_work_item_ids is null
    or cardinality(
      p_work_item_ids
    ) = 0
  then
    raise exception
      'Selecione pelo menos uma demanda adicional.';
  end if;

  select count(*)
  into v_invalid_count
  from unnest(
    p_work_item_ids
  ) as selected(
    work_item_id
  )
  left join public.work_items item
    on item.id =
      selected.work_item_id
  where
    item.id is null
    or item.pauta_id
      is distinct from
      p_pauta_id
    or coalesce(
      item.is_pauta_card,
      false
    ) = true
    or item.status in (
      'archived',
      'cancelled'
    );

  if v_invalid_count > 0 then
    raise exception
      'A remoção aceita apenas demandas adicionais ativas da Pauta. Cards principais não podem ser retirados por esta ação.';
  end if;

  return
    public.remove_pauta_demands_batch(
      p_pauta_id,
      p_work_item_ids,
      p_confirmation
    );
end;
$function$;

revoke all
on function
  public.remove_pauta_extra_demands_v92c(
    uuid,
    uuid[],
    text
  )
from public;

grant execute
on function
  public.remove_pauta_extra_demands_v92c(
    uuid,
    uuid[],
    text
  )
to authenticated;

grant execute
on function
  public.remove_pauta_extra_demands_v92c(
    uuid,
    uuid[],
    text
  )
to service_role;

comment on function
  public.remove_pauta_extra_demands_v92c(
    uuid,
    uuid[],
    text
  )
is
  'V9.2C: remove somente demandas adicionais; protege cards principais da Pauta.';

commit;

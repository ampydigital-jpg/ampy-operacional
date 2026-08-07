-- =========================================================
-- V9.2C-A2.3 — P0.2F: TARGET COMPLETO NA DISTRIBUIÇÃO
-- Não cria associações e não altera demandas existentes.
-- =========================================================

begin;

do $migration$
declare
  v_function_oid oid;
  v_definition text;
  v_patched_definition text;
  v_anchor text :=
$anchor$    v_board_id := (v_target ->> 'board_id')::uuid;
    v_column_id := (v_target ->> 'board_column_id')::uuid;$anchor$;
  v_replacement text :=
$replacement$    if nullif(
      trim(
        coalesce(
          v_target ->> 'board_id',
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'O Quadro de destino não foi informado.';
    end if;

    if nullif(
      trim(
        coalesce(
          v_target ->> 'board_column_id',
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'A coluna do Quadro de destino não foi informada.';
    end if;

    v_board_id := (v_target ->> 'board_id')::uuid;
    v_column_id := (v_target ->> 'board_column_id')::uuid;$replacement$;
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
    'A coluna do Quadro de destino não foi informada.'
    in v_definition
  ) > 0
  then
    raise exception
      'A migration V9.2C-A2.3 já está aplicada.';
  end if;

  v_occurrences :=
    (
      length(v_definition) -
      length(
        replace(
          v_definition,
          v_anchor,
          ''
        )
      )
    ) /
    nullif(
      length(v_anchor),
      0
    );

  if v_occurrences <> 1 then
    raise exception
      'Trecho esperado da RPC divergente. Ocorrências encontradas: %',
      v_occurrences;
  end if;

  v_patched_definition :=
    replace(
      v_definition,
      v_anchor,
      v_replacement
    );

  execute v_patched_definition;
end;
$migration$;

do $verify$
declare
  v_definition text;
begin
  v_definition :=
    pg_get_functiondef(
      'public.distribute_existing_pauta_demands(uuid,jsonb,jsonb,text)'
        ::regprocedure
    );

  if position(
    'O Quadro de destino não foi informado.'
    in v_definition
  ) = 0
  then
    raise exception
      'Validação explícita de Quadro não encontrada.';
  end if;

  if position(
    'A coluna do Quadro de destino não foi informada.'
    in v_definition
  ) = 0
  then
    raise exception
      'Validação explícita de coluna não encontrada.';
  end if;
end;
$verify$;

comment on function
  public.distribute_existing_pauta_demands(
    uuid,
    jsonb,
    jsonb,
    text
  )
is
  'V9.2C-A2.3: exige Quadro e coluna explícitos antes de distribuir demandas.';

commit;

-- ============================================================
-- V8-A2 — ROLLBACK CONDICIONADO
-- ============================================================

begin;

do $v8_a2_down$
declare
  v_signature text :=
    'public.create_pauta_demand(uuid,uuid,uuid,text,uuid,uuid,text,date,date,text,text)';

  v_oid oid;
  v_definition text;
  v_normalized text;

  v_needle text :=
    E'\n    ''planned'',\n    ''quadro'',';

  v_replacement text :=
    E'\n    ''manual'',\n    ''quadro'',';

  v_occurrences integer;
  v_additional_pauta_demands bigint;
begin
  select count(*)
  into v_additional_pauta_demands
  from public.work_items
  where
    pauta_id is not null
    and is_pauta_card is false;

  if v_additional_pauta_demands > 0 then
    raise exception
      'V8-A2 DOWN bloqueado: existem % demandas adicionais de Pauta.',
      v_additional_pauta_demands;
  end if;

  select
    to_regprocedure(
      v_signature
    )::oid
  into v_oid;

  if v_oid is null then
    raise exception
      'V8-A2 DOWN: função create_pauta_demand não encontrada.';
  end if;

  select
    pg_get_functiondef(
      v_oid
    )
  into v_definition;

  v_normalized :=
    replace(
      v_definition,
      E'\r\n',
      E'\n'
    );

  v_occurrences :=
    (
      length(
        v_normalized
      ) -
      length(
        replace(
          v_normalized,
          v_needle,
          ''
        )
      )
    ) /
    nullif(
      length(
        v_needle
      ),
      0
    );

  if v_occurrences <> 1 then
    raise exception
      'V8-A2 DOWN: esperado 1 uso estrutural de origin=planned; encontrado %.',
      v_occurrences;
  end if;

  execute replace(
    v_normalized,
    v_needle,
    v_replacement
  );
end;
$v8_a2_down$;

grant execute
on function public.delete_empty_pauta(
  uuid,
  text
)
to
  public,
  anon,
  authenticated;

comment on function public.create_pauta_demand(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  uuid,
  text,
  date,
  date,
  text,
  text
) is null;

comment on function public.delete_empty_pauta(
  uuid,
  text
) is null;

commit;

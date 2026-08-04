-- ============================================================
-- V8-A2 — CORREÇÃO BLOQUEANTE E PROTEÇÃO DE PAUTAS
-- Projeto: ampy-operacional
-- Base: 6a4d52428bf9e6e4a16fdc83a472570af9b4ba9d
-- ============================================================

begin;

do $v8_a2$
declare
  v_signature text :=
    'public.create_pauta_demand(uuid,uuid,uuid,text,uuid,uuid,text,date,date,text,text)';

  v_oid oid;
  v_definition text;
  v_normalized text;

  v_needle text :=
    E'\n    ''manual'',\n    ''quadro'',';

  v_replacement text :=
    E'\n    ''planned'',\n    ''quadro'',';

  v_occurrences integer;
begin
  select
    to_regprocedure(
      v_signature
    )::oid
  into v_oid;

  if v_oid is null then
    raise exception
      'V8-A2: função create_pauta_demand não encontrada com a assinatura esperada.';
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
      'V8-A2: esperado 1 uso estrutural de origin=manual; encontrado %.',
      v_occurrences;
  end if;

  execute replace(
    v_normalized,
    v_needle,
    v_replacement
  );
end;
$v8_a2$;

revoke execute
on function public.delete_empty_pauta(
  uuid,
  text
)
from
  public,
  anon,
  authenticated;

grant execute
on function public.delete_empty_pauta(
  uuid,
  text
)
to service_role;

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
) is
  'V8-A2: cria demanda planejada de Pauta; origin=planned.';

comment on function public.delete_empty_pauta(
  uuid,
  text
) is
  'V8-A2: função técnica preservada, sem execução por usuários da aplicação.';

commit;

-- ============================================================
-- V8-A2 — VERIFICAÇÃO SOMENTE LEITURA
-- ============================================================

with fn as (
  select
    replace(
      pg_get_functiondef(
        'public.create_pauta_demand(uuid,uuid,uuid,text,uuid,uuid,text,date,date,text,text)'::regprocedure
      ),
      E'\r\n',
      E'\n'
    ) as definition
),

checks as (
  select
    jsonb_build_object(
      'origin_planned_ok',

        position(
          E'\n    ''planned'',\n    ''quadro'','
          in definition
        ) > 0,

      'origin_manual_absent',

        position(
          E'\n    ''manual'',\n    ''quadro'','
          in definition
        ) = 0,

      'authenticated_cannot_execute_delete',

        not has_function_privilege(
          'authenticated',
          'public.delete_empty_pauta(uuid,text)',
          'EXECUTE'
        ),

      'anon_cannot_execute_delete',

        not has_function_privilege(
          'anon',
          'public.delete_empty_pauta(uuid,text)',
          'EXECUTE'
        ),

      'service_role_can_execute_delete',

        has_function_privilege(
          'service_role',
          'public.delete_empty_pauta(uuid,text)',
          'EXECUTE'
        ),

      'work_items_total',

        (
          select count(*)
          from public.work_items
        ),

      'pauta_members_total',

        (
          select count(*)
          from public.pauta_members
        ),

      'pauta_events_total',

        (
          select count(*)
          from public.pauta_events
        ),

      'additional_pauta_demands',

        (
          select count(*)
          from public.work_items
          where
            pauta_id is not null
            and is_pauta_card is false
        ),

      'legacy_candidates_untouched',

        (
          select count(*)
          from public.work_items wi

          join public.boards b
            on b.id = wi.board_id

          where
            b.board_kind = 'pauta'
            and wi.pauta_id is null
            and wi.is_pauta_card is false
            and wi.status not in (
              'archived',
              'cancelled'
            )
        )
    ) as result

  from fn
)

select
  jsonb_pretty(
    result
  ) as v8_a2_verification
from checks;

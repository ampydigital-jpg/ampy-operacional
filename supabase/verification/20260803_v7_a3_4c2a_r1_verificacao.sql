with function_definitions as (
  select
    pg_get_functiondef(
      'public.open_monthly_pauta(uuid,text,date,date,date,uuid[],text)'::regprocedure
    ) as open_monthly_definition,

    pg_get_functiondef(
      'public.pauta_create_main_card_core(uuid,uuid,uuid,text)'::regprocedure
    ) as main_card_core_definition
)
select
  'V7-A3.4C.2A-R1 aplicada com sucesso'
    as resultado,

  to_regclass(
    'public.pauta_members'
  ) is not null
    as pauta_members_ok,

  to_regclass(
    'public.pauta_events'
  ) is not null
    as pauta_events_ok,

  to_regprocedure(
    'public.get_pauta_management_snapshot(uuid)'
  ) is not null
    as management_snapshot_ok,

  to_regprocedure(
    'public.pauta_dependency_summary(uuid)'
  ) is not null
    as dependency_summary_ok,

  to_regprocedure(
    'public.preview_legacy_pauta_import(uuid)'
  ) is not null
    as preview_legacy_ok,

  to_regprocedure(
    'public.update_pauta_settings(uuid,text,date,date)'
  ) is not null
    as update_settings_ok,

  to_regprocedure(
    'public.preview_pauta_client_additions(uuid,uuid[])'
  ) is not null
    as preview_additions_ok,

  to_regprocedure(
    'public.add_clients_to_pauta(uuid,uuid[],text)'
  ) is not null
    as add_clients_ok,

  to_regprocedure(
    'public.adopt_legacy_cards_to_pauta(uuid,jsonb,text)'
  ) is not null
    as adopt_legacy_ok,

  to_regprocedure(
    'public.create_pauta_demand(uuid,uuid,uuid,text,uuid,uuid,text,date,date,text,text)'
  ) is not null
    as create_pauta_demand_ok,

  to_regprocedure(
    'public.detach_pauta_demand(uuid,uuid,text)'
  ) is not null
    as detach_demand_ok,

  to_regprocedure(
    'public.remove_client_from_pauta(uuid,uuid,text)'
  ) is not null
    as remove_client_ok,

  to_regprocedure(
    'public.change_pauta_lifecycle(uuid,text,text)'
  ) is not null
    as lifecycle_ok,

  to_regprocedure(
    'public.delete_empty_pauta(uuid,text)'
  ) is not null
    as delete_empty_ok,

  to_regprocedure(
    'public.open_monthly_pauta(uuid,text,date,date,date,uuid[],text)'
  ) is not null
    as open_monthly_pauta_preserved_ok,

  has_function_privilege(
    'authenticated',
    'public.open_monthly_pauta(uuid,text,date,date,date,uuid[],text)',
    'EXECUTE'
  )
    as open_monthly_pauta_execute_ok,

  has_function_privilege(
    'authenticated',
    'public.preview_legacy_pauta_import(uuid)',
    'EXECUTE'
  )
    as preview_legacy_execute_ok,

  has_function_privilege(
    'authenticated',
    'public.adopt_legacy_cards_to_pauta(uuid,jsonb,text)',
    'EXECUTE'
  )
    as adopt_legacy_execute_ok,

  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pautas'
      and policyname = 'pautas_select_active_users'
      and cmd = 'SELECT'
  )
    as select_policy_preserved_ok,

  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pautas'
      and policyname in (
        'pautas_insert_total_access',
        'pautas_update_total_access',
        'pautas_delete_total_access'
      )
  )
    as direct_write_policies_removed_ok,

  not has_table_privilege(
    'authenticated',
    'public.pautas',
    'INSERT'
  )
    as direct_insert_grant_removed_ok,

  not has_table_privilege(
    'authenticated',
    'public.pautas',
    'UPDATE'
  )
    as direct_update_grant_removed_ok,

  not has_table_privilege(
    'authenticated',
    'public.pautas',
    'DELETE'
  )
    as direct_delete_grant_removed_ok,

  has_table_privilege(
    'authenticated',
    'public.pautas',
    'SELECT'
  )
    as pauta_select_grant_ok,

  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pauta_members'
      and policyname = 'pauta_members_select_active_users'
      and cmd = 'SELECT'
  )
    as pauta_members_select_policy_ok,

  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pauta_events'
      and policyname = 'pauta_events_select_active_users'
      and cmd = 'SELECT'
  )
    as pauta_events_select_policy_ok,

  not exists (
    select 1
    from public.pauta_members as member
    left join public.work_items as item
      on item.id = member.main_work_item_id
    where member.membership_status = 'active'
      and (
        item.id is null
        or item.pauta_id is distinct from member.pauta_id
        or item.client_id is distinct from member.client_id
        or item.is_pauta_card is distinct from true
      )
  )
    as active_members_consistent_ok,

  not exists (
    select 1
    from public.work_items as item
    where item.pauta_id is null
      and item.is_pauta_card = true
  )
    as no_orphan_main_pauta_cards_ok,

  (
    position(
      '''code'', ''PAUTA_EXISTS'''
      in function_definitions.open_monthly_definition
    ) > 0
    or position(
      '''PAUTA_EXISTS'''
      in function_definitions.open_monthly_definition
    ) > 0
  )
    as pauta_exists_contract_ok,

  position(
    'existing_pauta_unchanged'
    in function_definitions.open_monthly_definition
  ) > 0
    as existing_pauta_no_side_effect_contract_ok,

  position(
    'MEMBERSHIP_RESTORED'
    in function_definitions.main_card_core_definition
  ) > 0
    as orphan_membership_restore_path_ok,

      (
    position(
      'membership_restored'
      in lower(
        function_definitions.main_card_core_definition
      )
    ) > 0
    and position(
      'insert into public.pauta_members'
      in lower(
        function_definitions.main_card_core_definition
      )
    ) > 0
    and position(
      'update public.work_items'
      in lower(
        function_definitions.main_card_core_definition
      )
    ) = 0
  )
    as orphan_work_item_preservation_contract_ok,

  (
    select count(*)
    from public.work_items
    where pauta_id is null
  )
    as legacy_work_items_preserved,

  (
    select count(*)
    from public.pauta_members
    where source = 'backfill'
      and coalesce(
        metadata ->> 'migration',
        ''
      ) = 'V7-A3.4C.2A-R1'
  )
    as memberships_backfilled,

  (
    select count(*)
    from public.preview_legacy_pauta_import(
      '26938134-de74-454a-b15e-b98cd17dbf7e'::uuid
    )
  )
    as september_legacy_candidates_found

from function_definitions;
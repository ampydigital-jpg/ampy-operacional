\set ON_ERROR_STOP on
\pset pager off

select
  'V10.0-A1 - CAMADA 1 E SEGURANCA SQL' as teste;

do $$
declare
  v_fingerprint text;
  v_event_trigger integer;
  v_bad_grants integer;
  v_service_grants integer;
  v_profile_policy text;
begin
  select concat_ws(
    '|',
    (
      select count(*)
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    ),
    (
      select count(*)
      from pg_proc p
      join pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname = 'public'
    ),
    (
      select count(*)
      from pg_trigger t
      join pg_class c
        on c.oid = t.tgrelid
      join pg_namespace n
        on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not t.tgisinternal
    ),
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
    )
  )
  into v_fingerprint;

  if v_fingerprint <> '36|61|26|85' then
    raise exception
      'Fingerprint divergente: %',
      v_fingerprint;
  end if;

  select count(*)
  into v_event_trigger
  from pg_event_trigger
  where evtname = 'rls_auto_enable';

  if v_event_trigger <> 1 then
    raise exception
      'rls_auto_enable esperado=1 atual=%',
      v_event_trigger;
  end if;

  select count(*)
  into v_bad_grants
  from (
    values
      ('pautas'),
      ('pauta_members'),
      ('pauta_events'),
      ('work_item_board_assignments'),
      ('work_item_board_assignment_events'),
      ('calendar_event_history')
  ) as critical(table_name)
  where
    has_table_privilege(
      'authenticated',
      'public.' || critical.table_name,
      'INSERT'
    )
    or has_table_privilege(
      'authenticated',
      'public.' || critical.table_name,
      'UPDATE'
    )
    or has_table_privilege(
      'authenticated',
      'public.' || critical.table_name,
      'DELETE'
    );

  if v_bad_grants <> 0 then
    raise exception
      'Authenticated ainda possui DML direto em % tabela(s) criticas.',
      v_bad_grants;
  end if;

  select count(*)
  into v_service_grants
  from (
    values
      ('pautas'),
      ('pauta_members'),
      ('pauta_events'),
      ('work_item_board_assignments'),
      ('work_item_board_assignment_events'),
      ('calendar_event_history')
  ) as critical(table_name)
  where
    has_table_privilege(
      'service_role',
      'public.' || critical.table_name,
      'INSERT'
    )
    and has_table_privilege(
      'service_role',
      'public.' || critical.table_name,
      'UPDATE'
    )
    and has_table_privilege(
      'service_role',
      'public.' || critical.table_name,
      'DELETE'
    );

  if v_service_grants <> 6 then
    raise exception
      'Service role sem DML completo. esperado=6 atual=%',
      v_service_grants;
  end if;

  select with_check
  into v_profile_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'profiles'
    and policyname = 'profiles_update_own';

  if v_profile_policy not ilike '%auth.jwt%'
     or v_profile_policy not ilike '%app_current_role%'
  then
    raise exception
      'profiles_update_own nao possui protecao esperada.';
  end if;
end
$$;

select
  'fingerprint_public' as teste,
  '36|61|26|85' as esperado,
  concat_ws(
    '|',
    (
      select count(*)
      from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
    ),
    (
      select count(*)
      from pg_proc p
      join pg_namespace n
        on n.oid = p.pronamespace
      where n.nspname = 'public'
    ),
    (
      select count(*)
      from pg_trigger t
      join pg_class c
        on c.oid = t.tgrelid
      join pg_namespace n
        on n.oid = c.relnamespace
      where n.nspname = 'public'
        and not t.tgisinternal
    ),
    (
      select count(*)
      from pg_policies
      where schemaname = 'public'
    )
  ) as atual,
  'PASS' as resultado;

select
  'rls_auto_enable' as teste,
  1 as esperado,
  count(*) as atual,
  case
    when count(*) = 1 then 'PASS'
    else 'FAIL'
  end as resultado
from pg_event_trigger
where evtname = 'rls_auto_enable';

select
  'authenticated_sem_dml_nas_6_criticas' as teste,
  case
    when count(*) = 0 then 'PASS'
    else 'FAIL'
  end as resultado
from (
  values
    ('pautas'),
    ('pauta_members'),
    ('pauta_events'),
    ('work_item_board_assignments'),
    ('work_item_board_assignment_events'),
    ('calendar_event_history')
) as critical(table_name)
where
  has_table_privilege(
    'authenticated',
    'public.' || critical.table_name,
    'INSERT'
  )
  or has_table_privilege(
    'authenticated',
    'public.' || critical.table_name,
    'UPDATE'
  )
  or has_table_privilege(
    'authenticated',
    'public.' || critical.table_name,
    'DELETE'
  );

select
  tablename,
  policyname,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and (
    (
      tablename = 'work_items'
      and policyname in (
        'demands_read_authenticated',
        'demands_create_authenticated',
        'demands_update_operational'
      )
    )
    or (
      tablename = 'profiles'
      and policyname in (
        'authenticated_read_profiles',
        'profiles_read_authenticated',
        'profiles_update_own'
      )
    )
    or (
      tablename = 'work_item_history'
      and policyname in (
        'authenticated_read_history',
        'history_read_authenticated',
        'history_insert_authenticated'
      )
    )
  )
order by
  tablename,
  policyname;

select
  'V10.0-A1 SQL - PASS' as resultado;
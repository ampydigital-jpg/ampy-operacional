-- Executar somente em instancia isolada DEPOIS das migrations 0001-0005.
-- Checagens de catalogo; nao cria nem altera registros.
do $test$
declare f record; t record;
begin
  if has_table_privilege('anon', 'public.profiles', 'SELECT')
     or has_any_column_privilege('anon', 'public.profiles', 'SELECT')
     or has_any_column_privilege('anon', 'public.profiles', 'INSERT')
     or has_any_column_privilege('anon', 'public.profiles', 'UPDATE') then
    raise exception 'anon ainda tem acesso a profiles';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'is_active', 'UPDATE') then
    raise exception 'authenticated pode alterar campos de acesso';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') then
    raise exception 'edicao visual propria deixou de funcionar';
  end if;
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public','extensions') and p.proname in (
      'pauta_log_event','v8_log_assignment_event','pauta_create_main_card_core',
      'handle_new_user','rls_auto_enable','v10_rls_auto_enable','seed_board_default_columns',
      'seed_project_step_statuses_for_work_item','sync_calendar_event_pauta',
      'sync_cycle_schedule_requirement_from_calendar_event',
      'guard_active_pauta_work_item_requires_pauta','v8_assignment_after_change',
      'v8_sync_assignment_from_work_item','guard_profiles_privileged_fields'
    )
  loop
    if has_function_privilege('anon', f.oid, 'EXECUTE')
       or has_function_privilege('authenticated', f.oid, 'EXECUTE') then
      raise exception 'RPC interna exposta: %', f.proname;
    end if;
  end loop;
  for t in
    select c.oid, c.relname, c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and (c.relname ~ '^(meta_|traffic_|trafego_|comercial_)' or c.relname = 'ampy_agentes')
  loop
    if not t.relrowsecurity or exists (select 1 from pg_policy where polrelid = t.oid) then
      raise exception 'Tabela de integracao com acesso aberto: %', t.relname;
    end if;
  end loop;
end;
$test$;

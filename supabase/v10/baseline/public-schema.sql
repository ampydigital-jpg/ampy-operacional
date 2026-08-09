


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_client_id uuid;
  v_result jsonb;
  v_added integer := 0;
  v_already_present integer := 0;
  v_without_services integer := 0;
  v_legacy_conflicts integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADICIONAR CLIENTES' then
    raise exception
      'Confirmação inválida. Digite ADICIONAR CLIENTES.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'É permitido incluir no máximo 300 clientes por operação.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  if (
    select count(*)
    from unnest(p_client_ids)
  ) <> (
    select count(distinct client_id)
    from unnest(p_client_ids) as selected(client_id)
  ) then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    left join public.clients as client
      on client.id = selected.client_id
    where client.id is null
       or client.status <> 'active'
  ) then
    raise exception
      'Um ou mais clientes selecionados não existem ou estão inativos.';
  end if;

  select count(*)
  into v_legacy_conflicts
  from unnest(p_client_ids) as selected(client_id)
  where not exists (
    select 1
    from public.pauta_members as member
    where member.pauta_id = p_pauta_id
      and member.client_id = selected.client_id
      and member.membership_status = 'active'
  )
  and exists (
    select 1
    from public.work_items as legacy
    where legacy.board_id = v_pauta.board_id
      and legacy.pauta_id is null
      and legacy.client_id = selected.client_id
      and legacy.is_pauta_card = false
      and legacy.status not in (
        'archived',
        'cancelled'
      )
  );

  if v_legacy_conflicts > 0 then
    raise exception
      'A seleção possui % cliente(s) com card legado. Use a adoção de cards legados para evitar duplicidade.',
      v_legacy_conflicts;
  end if;

  for v_client_id in
    select distinct selected.client_id
    from unnest(p_client_ids) as selected(client_id)
  loop
    if exists (
      select 1
      from public.pauta_members as member
      where member.pauta_id = p_pauta_id
        and member.client_id = v_client_id
        and member.membership_status = 'active'
    ) then
      v_already_present := v_already_present + 1;
      continue;
    end if;

    if not exists (
      select 1
      from public.client_services as service
      where service.client_id = v_client_id
        and service.status = 'active'
    ) then
      v_without_services := v_without_services + 1;
    end if;

    v_result :=
      public.pauta_create_main_card_core(
        p_pauta_id,
        v_client_id,
        v_actor,
        'added'
      );

    if coalesce(
      (v_result ->> 'membership_created')::boolean,
      false
    ) then
      v_added := v_added + 1;
    else
      v_already_present := v_already_present + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_added', v_added,
    'clients_already_present', v_already_present,
    'clients_without_active_service', v_without_services,
    'legacy_conflicts', 0
  );
end;
$$;


ALTER FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") IS 'Cria cards novos apenas para clientes sem card legado disponível.';



CREATE OR REPLACE FUNCTION "public"."add_clients_to_pauta_v8"("p_pauta_id" "uuid", "p_clients" "jsonb", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_row jsonb;
  v_client_id uuid;
  v_target_date date;
  v_member public.pauta_members%rowtype;
  v_result jsonb;
  v_added integer := 0;
  v_already_present integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADICIONAR CLIENTES' then
    raise exception 'Confirmação inválida. Digite ADICIONAR CLIENTES.';
  end if;

  if p_clients is null
     or jsonb_typeof(p_clients) <> 'array'
     or jsonb_array_length(p_clients) = 0
  then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  if jsonb_array_length(p_clients) > 300 then
    raise exception 'É permitido incluir no máximo 300 clientes por operação.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception 'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  for v_row in
    select value from jsonb_array_elements(p_clients)
  loop
    begin
      v_client_id := (v_row ->> 'client_id')::uuid;
    exception when others then
      raise exception 'A seleção contém cliente inválido.';
    end;

    if not exists (
      select 1 from public.clients
      where id = v_client_id and status = 'active'
    ) then
      raise exception 'Um dos clientes não existe ou está inativo.';
    end if;

    v_target_date := coalesce(
      nullif(v_row ->> 'target_date', '')::date,
      v_pauta.scheduled_until_date
    );

    select *
    into v_member
    from public.pauta_members
    where pauta_id = p_pauta_id
      and client_id = v_client_id
      and membership_status = 'active'
    order by added_at desc
    limit 1
    for update;

    if not found then
      v_result := public.pauta_create_main_card_core(
        p_pauta_id,
        v_client_id,
        v_actor,
        'added'
      );

      select *
      into v_member
      from public.pauta_members
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and membership_status = 'active'
      order by added_at desc
      limit 1
      for update;

      if not found then
        raise exception 'Não foi possível criar a participação do cliente.';
      end if;

      v_added := v_added + 1;
    else
      v_already_present := v_already_present + 1;
    end if;

    update public.pauta_members
    set
      target_date = v_target_date,
      target_date_updated_at = now(),
      target_date_updated_by = v_actor,
      updated_at = now()
    where id = v_member.id;

    update public.work_items
    set
      internal_deadline = v_pauta.magic_number_date,
      final_deadline = v_target_date,
      updated_at = now()
    where id = v_member.main_work_item_id;

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      case when v_result is null then 'client_target_date_updated' else 'client_added' end,
      'member',
      v_member.id,
      jsonb_build_object('target_date', v_member.target_date),
      jsonb_build_object(
        'target_date', v_target_date,
        'client_id', v_client_id,
        'legacy_cards_preserved', true
      ),
      '{}'::jsonb
    );

    v_result := null;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_added', v_added,
    'clients_already_present', v_already_present,
    'legacy_cards_adopted', 0
  );
end;
$$;


ALTER FUNCTION "public"."add_clients_to_pauta_v8"("p_pauta_id" "uuid", "p_clients" "jsonb", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;

  v_entry jsonb;
  v_client_id uuid;
  v_main_work_item_id uuid;
  v_extra_ids jsonb;

  v_main_item public.work_items%rowtype;
  v_extra_item public.work_items%rowtype;

  v_extra_id uuid;
  v_member_id uuid;

  v_clients_adopted integer := 0;
  v_main_cards_adopted integer := 0;
  v_extra_demands_adopted integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ADOTAR LEGADO' then
    raise exception
      'Confirmação inválida. Digite ADOTAR LEGADO.';
  end if;

  if p_mapping is null
     or jsonb_typeof(p_mapping) <> 'array'
     or jsonb_array_length(p_mapping) = 0
  then
    raise exception
      'Informe um mapping não vazio em formato de array JSON.';
  end if;

  if jsonb_array_length(p_mapping) > 300 then
    raise exception
      'É permitido adotar no máximo 300 clientes por operação.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem adotar cards legados.';
  end if;

  if exists (
    select 1
    from (
      select
        entry ->> 'client_id' as client_id,
        count(*) as total
      from jsonb_array_elements(p_mapping) as mapping(entry)
      group by entry ->> 'client_id'
      having count(*) > 1
    ) as duplicated
  ) then
    raise exception
      'O mapping contém o mesmo cliente mais de uma vez.';
  end if;

  if exists (
    select 1
    from (
      select
        entry ->> 'main_work_item_id' as work_item_id,
        count(*) as total
      from jsonb_array_elements(p_mapping) as mapping(entry)
      group by entry ->> 'main_work_item_id'
      having count(*) > 1
    ) as duplicated
  ) then
    raise exception
      'O mapping contém o mesmo card principal mais de uma vez.';
  end if;

  -- Toda validação ocorre dentro da mesma função/transação.
  -- Qualquer exceção reverte todas as adoções da chamada.

  for v_entry in
    select entry
    from jsonb_array_elements(p_mapping) as mapping(entry)
  loop
    if jsonb_typeof(v_entry) <> 'object' then
      raise exception
        'Cada item do mapping deve ser um objeto JSON.';
    end if;

    begin
      v_client_id :=
        nullif(
          trim(v_entry ->> 'client_id'),
          ''
        )::uuid;

      v_main_work_item_id :=
        nullif(
          trim(v_entry ->> 'main_work_item_id'),
          ''
        )::uuid;
    exception
      when invalid_text_representation then
        raise exception
          'O mapping contém UUID inválido.';
    end;

    if v_client_id is null
       or v_main_work_item_id is null
    then
      raise exception
        'client_id e main_work_item_id são obrigatórios.';
    end if;

    v_extra_ids := coalesce(
      v_entry -> 'extra_work_item_ids',
      '[]'::jsonb
    );

    if jsonb_typeof(v_extra_ids) <> 'array' then
      raise exception
        'extra_work_item_ids deve ser um array JSON.';
    end if;

    if not exists (
      select 1
      from public.clients
      where id = v_client_id
        and status = 'active'
    ) then
      raise exception
        'Cliente % não existe ou está inativo.',
        v_client_id;
    end if;

    if exists (
      select 1
      from public.pauta_members
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and membership_status = 'active'
    ) then
      raise exception
        'O cliente % já participa da Pauta.',
        v_client_id;
    end if;

    if exists (
      select 1
      from public.work_items
      where pauta_id = p_pauta_id
        and client_id = v_client_id
        and is_pauta_card = true
    ) then
      raise exception
        'O cliente % já possui card principal nesta Pauta.',
        v_client_id;
    end if;

    select *
    into v_main_item
    from public.work_items
    where id = v_main_work_item_id
    for update;

    if not found then
      raise exception
        'Card principal legado % não encontrado.',
        v_main_work_item_id;
    end if;

    if v_main_item.client_id is distinct from v_client_id then
      raise exception
        'O card principal % não pertence ao cliente informado.',
        v_main_work_item_id;
    end if;

    if v_main_item.board_id is distinct from v_pauta.board_id then
      raise exception
        'O card principal % não pertence ao Quadro da Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.pauta_id is not null then
      raise exception
        'O card principal % já pertence a outra Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.is_pauta_card = true
       or v_main_item.pauta_card_id is not null
    then
      raise exception
        'O card principal % já possui contexto de Pauta.',
        v_main_work_item_id;
    end if;

    if v_main_item.status in (
      'archived',
      'cancelled'
    ) then
      raise exception
        'O card principal % está arquivado ou cancelado.',
        v_main_work_item_id;
    end if;

    if v_main_item.board_column_id is null
       or not exists (
         select 1
         from public.board_columns as column_row
         where column_row.id = v_main_item.board_column_id
           and column_row.board_id = v_pauta.board_id
       )
    then
      raise exception
        'O card principal % não possui coluna válida no Quadro da Pauta.',
        v_main_work_item_id;
    end if;

    if exists (
      select 1
      from (
        select
          value::text as extra_id,
          count(*) as total
        from jsonb_array_elements_text(v_extra_ids)
        group by value::text
        having count(*) > 1
      ) as duplicate_extra
    ) then
      raise exception
        'A lista de extras do cliente % contém UUID repetido.',
        v_client_id;
    end if;

    for v_extra_id in
      select value::uuid
      from jsonb_array_elements_text(v_extra_ids)
    loop
      if v_extra_id = v_main_work_item_id then
        raise exception
          'O card principal não pode aparecer como demanda extra.';
      end if;

      select *
      into v_extra_item
      from public.work_items
      where id = v_extra_id
      for update;

      if not found then
        raise exception
          'Demanda extra legada % não encontrada.',
          v_extra_id;
      end if;

      if v_extra_item.client_id is distinct from v_client_id then
        raise exception
          'A demanda extra % não pertence ao cliente informado.',
          v_extra_id;
      end if;

      if v_extra_item.board_id is distinct from v_pauta.board_id then
        raise exception
          'A demanda extra % não pertence ao Quadro da Pauta.',
          v_extra_id;
      end if;

      if v_extra_item.pauta_id is not null
         or v_extra_item.is_pauta_card = true
         or v_extra_item.pauta_card_id is not null
      then
        raise exception
          'A demanda extra % já possui contexto de Pauta.',
          v_extra_id;
      end if;

      if v_extra_item.status in (
        'archived',
        'cancelled'
      ) then
        raise exception
          'A demanda extra % está arquivada ou cancelada.',
          v_extra_id;
      end if;

      if v_extra_item.board_column_id is null
         or not exists (
           select 1
           from public.board_columns as column_row
           where column_row.id = v_extra_item.board_column_id
             and column_row.board_id = v_pauta.board_id
         )
      then
        raise exception
          'A demanda extra % não possui coluna válida no Quadro da Pauta.',
          v_extra_id;
      end if;
    end loop;

    update public.work_items
    set
      pauta_id = p_pauta_id,
      is_pauta_card = true,
      pauta_card_id = null,
      updated_at = now()
    where id = v_main_work_item_id;

    insert into public.pauta_members (
      pauta_id,
      client_id,
      main_work_item_id,
      membership_status,
      source,
      added_by,
      added_at,
      metadata
    )
    values (
      p_pauta_id,
      v_client_id,
      v_main_work_item_id,
      'active',
      'legacy_adopted',
      v_actor,
      now(),
      jsonb_build_object(
        'migration',
        'V7-A3.4C.2A-R1',
        'preserved_column',
        v_main_item.board_column_id,
        'preserved_status',
        v_main_item.status,
        'preserved_internal_deadline',
        v_main_item.internal_deadline,
        'preserved_final_deadline',
        v_main_item.final_deadline
      )
    )
    returning id
    into v_member_id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_main_work_item_id,
      v_actor,
      'legacy_card_adopted',
      jsonb_build_object(
        'pauta_id', null,
        'is_pauta_card', false,
        'pauta_card_id', null
      )::text,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'is_pauta_card', true,
        'pauta_card_id', null
      )::text
    );

    update public.calendar_events
    set
      pauta_id = p_pauta_id,
      updated_at = now()
    where work_item_id = v_main_work_item_id;

    for v_extra_id in
      select value::uuid
      from jsonb_array_elements_text(v_extra_ids)
    loop
      update public.work_items
      set
        pauta_id = p_pauta_id,
        is_pauta_card = false,
        pauta_card_id = v_main_work_item_id,
        updated_at = now()
      where id = v_extra_id;

      update public.calendar_events
      set
        pauta_id = p_pauta_id,
        updated_at = now()
      where work_item_id = v_extra_id;

      insert into public.work_item_history (
        work_item_id,
        actor_id,
        field_changed,
        old_value,
        new_value
      )
      values (
        v_extra_id,
        v_actor,
        'legacy_demand_adopted',
        jsonb_build_object(
          'pauta_id', null,
          'pauta_card_id', null
        )::text,
        jsonb_build_object(
          'pauta_id', p_pauta_id,
          'pauta_card_id', v_main_work_item_id
        )::text
      );

      v_extra_demands_adopted :=
        v_extra_demands_adopted + 1;
    end loop;

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'legacy_card_adopted',
      'client',
      v_client_id,
      jsonb_build_object(
        'main_work_item_id',
        v_main_work_item_id,
        'pauta_id',
        null
      ),
      jsonb_build_object(
        'member_id',
        v_member_id,
        'main_work_item_id',
        v_main_work_item_id,
        'pauta_id',
        p_pauta_id,
        'extra_work_item_ids',
        v_extra_ids
      ),
      jsonb_build_object(
        'preserved_work_item_ids',
        true,
        'preserved_columns',
        true,
        'preserved_deadlines',
        true,
        'preserved_statuses',
        true
      )
    );

    v_clients_adopted :=
      v_clients_adopted + 1;

    v_main_cards_adopted :=
      v_main_cards_adopted + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'clients_adopted', v_clients_adopted,
    'main_cards_adopted', v_main_cards_adopted,
    'extra_demands_adopted', v_extra_demands_adopted,
    'work_items_duplicated', 0
  );
end;
$$;


ALTER FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") IS 'Adota work_items existentes por mapping explícito, preservando UUID, coluna, status e datas.';



CREATE OR REPLACE FUNCTION "public"."app_current_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT role FROM profiles WHERE id = auth.uid() AND is_active = true $$;


ALTER FUNCTION "public"."app_current_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_has_total_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    LEFT JOIN public.profiles p
      ON p.id = auth.uid()
    WHERE tm.is_active = true
      AND tm.access_type = 'total'
      AND (
        tm.profile_id = auth.uid()
        OR (
          p.email IS NOT NULL
          AND lower(tm.email) = lower(p.email)
        )
      )
  );
$$;


ALTER FUNCTION "public"."app_has_total_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_is_active_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_active = true) $$;


ALTER FUNCTION "public"."app_is_active_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT COALESCE(app_current_role() IN ('admin','director'), false) $$;


ALTER FUNCTION "public"."app_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_is_manager"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT COALESCE(app_current_role() IN ('admin','director','manager','team_lead'), false) $$;


ALTER FUNCTION "public"."app_is_manager"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_log_feed_board_created"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO feed_board_events (
    board_id,
    actor_type,
    actor_id,
    actor_name,
    event_type,
    message
  )
  VALUES (
    NEW.id,
    'internal',
    NEW.created_by,
    'Ampy Digital',
    'board_created',
    'Ampy Digital criou o documento de aprovação.'
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."app_log_feed_board_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_validate_calendar_links"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE demand_client UUID;
BEGIN
  IF NEW.work_item_id IS NOT NULL THEN
    SELECT client_id INTO demand_client FROM work_items WHERE id = NEW.work_item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Demanda vinculada ao evento não encontrada.';
    END IF;
    IF NEW.client_id IS NOT NULL AND demand_client IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Cliente do evento não corresponde ao cliente da demanda.';
    END IF;
    IF NEW.client_id IS NULL AND demand_client IS NOT NULL THEN
      NEW.client_id := demand_client;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."app_validate_calendar_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."app_validate_work_item_links"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE service_client UUID;
BEGIN
  IF NEW.client_service_id IS NOT NULL THEN
    IF NEW.client_id IS NULL THEN
      RAISE EXCEPTION 'Serviço vinculado exige cliente na demanda.';
    END IF;
    SELECT client_id INTO service_client FROM client_services WHERE id = NEW.client_service_id;
    IF service_client IS NULL THEN
      RAISE EXCEPTION 'Serviço vinculado não encontrado.';
    END IF;
    IF service_client <> NEW.client_id THEN
      RAISE EXCEPTION 'Serviço vinculado não pertence ao cliente da demanda.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."app_validate_work_item_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_expected_confirmation text;
  v_next_status text;
  v_pending_main_cards integer := 0;
  v_pending_assignments integer := 0;
  v_old_values jsonb;
  v_new_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if v_action not in ('close', 'reopen', 'archive') then
    raise exception 'Ação de ciclo de vida inválida.';
  end if;

  v_expected_confirmation :=
    case v_action
      when 'close' then 'CONCLUIR PAUTA'
      when 'reopen' then 'REABRIR PAUTA'
      when 'archive' then 'ARQUIVAR PAUTA'
    end;

  if trim(coalesce(p_confirmation, '')) <> v_expected_confirmation then
    raise exception
      'Confirmação inválida. Digite %.',
      v_expected_confirmation;
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  v_old_values := jsonb_build_object(
    'lifecycle_status', v_pauta.lifecycle_status,
    'opened_at', v_pauta.opened_at,
    'closed_at', v_pauta.closed_at,
    'archived_at', v_pauta.archived_at
  );

  if v_action = 'close' then
    if v_pauta.lifecycle_status not in ('draft', 'open') then
      raise exception
        'Somente Pautas abertas ou em rascunho podem ser concluídas.';
    end if;

    select count(*)
    into v_pending_main_cards
    from public.pauta_members member
    join public.work_items item
      on item.id = member.main_work_item_id
    where member.pauta_id = p_pauta_id
      and member.membership_status = 'active'
      and item.is_pauta_card = true
      and item.completed_at is null
      and item.status not in ('done', 'delivered', 'approved');

    select count(*)
    into v_pending_assignments
    from public.work_item_board_assignments assignment
    join public.work_items item
      on item.id = assignment.work_item_id
    where item.pauta_id = p_pauta_id
      and item.is_pauta_card = false
      and assignment.assignment_status = 'active'
      and assignment.is_required = true
      and not public.v8_assignment_is_complete(
        assignment.operational_status
      );

    if v_pending_main_cards > 0
       or v_pending_assignments > 0
    then
      raise exception
        'A Pauta ainda possui % card(s) mensal(is) e % distribuição(ões) obrigatória(s) pendente(s).',
        v_pending_main_cards,
        v_pending_assignments;
    end if;

    v_next_status := 'closed';

    update public.pautas
    set
      lifecycle_status = 'closed',
      closed_at = now(),
      archived_at = null,
      updated_at = now()
    where id = p_pauta_id;

  elsif v_action = 'reopen' then
    if v_pauta.lifecycle_status not in ('closed', 'archived') then
      raise exception
        'Somente Pautas concluídas ou arquivadas podem ser reabertas.';
    end if;

    v_next_status := 'open';

    update public.pautas
    set
      lifecycle_status = 'open',
      opened_at = coalesce(opened_at, now()),
      closed_at = null,
      archived_at = null,
      updated_at = now()
    where id = p_pauta_id;

  else
    if v_pauta.lifecycle_status = 'archived' then
      raise exception 'A Pauta já está arquivada.';
    end if;

    v_next_status := 'archived';

    update public.pautas
    set
      lifecycle_status = 'archived',
      archived_at = now(),
      updated_at = now()
    where id = p_pauta_id;
  end if;

  select jsonb_build_object(
    'lifecycle_status', pauta.lifecycle_status,
    'opened_at', pauta.opened_at,
    'closed_at', pauta.closed_at,
    'archived_at', pauta.archived_at
  )
  into v_new_values
  from public.pautas pauta
  where pauta.id = p_pauta_id;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'lifecycle_' || v_action,
    'pauta',
    p_pauta_id,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'pending_main_cards', v_pending_main_cards,
      'pending_required_assignments', v_pending_assignments
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'previous_status', v_pauta.lifecycle_status,
    'lifecycle_status', v_next_status
  );
end;
$$;


ALTER FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") IS 'Conclui, reabre ou arquiva uma Pauta sem apagar work_items.';



CREATE OR REPLACE FUNCTION "public"."create_and_distribute_pauta_demands"("p_pauta_id" "uuid", "p_rows" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_row jsonb;
  v_target jsonb;
  v_member public.pauta_members%rowtype;
  v_client public.clients%rowtype;
  v_client_id uuid;
  v_service_id uuid;
  v_responsible_id uuid;
  v_start_date date;
  v_final_date date;
  v_priority text;
  v_title text;
  v_drive_link text;
  v_notes text;
  v_card_tag text;
  v_card_tag_color text;
  v_work_item_id uuid;
  v_board_id uuid;
  v_column_id uuid;
  v_column public.board_columns%rowtype;
  v_assignment_id uuid;
  v_is_required boolean;
  v_created jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'CRIAR E DISTRIBUIR' then
    raise exception
      'Confirmação inválida. Digite CRIAR E DISTRIBUIR.';
  end if;

  if p_rows is null
     or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0
  then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) = 0
  then
    raise exception 'Selecione pelo menos um Quadro de destino.';
  end if;

  if jsonb_array_length(p_rows) > 100 then
    raise exception
      'É permitido criar no máximo 100 demandas por operação.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber demandas.';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(p_targets)
  loop
    v_board_id := (v_target ->> 'board_id')::uuid;
    v_column_id := (v_target ->> 'board_column_id')::uuid;

    select column_row.*
    into v_column
    from public.board_columns column_row
    join public.boards board_row
      on board_row.id = column_row.board_id
    where column_row.id = v_column_id
      and column_row.board_id = v_board_id
      and board_row.board_kind = 'custom'
      and board_row.status = 'active';

    if not found then
      raise exception
        'Um dos Quadros ou colunas de destino é inválido.';
    end if;
  end loop;

  for v_row in
    select value
    from jsonb_array_elements(p_rows)
  loop
    v_client_id := (v_row ->> 'client_id')::uuid;
    v_service_id := (v_row ->> 'client_service_id')::uuid;
    v_responsible_id := (v_row ->> 'responsible_id')::uuid;
    v_start_date := (v_row ->> 'internal_deadline')::date;
    v_final_date := (v_row ->> 'final_deadline')::date;
    v_priority := coalesce(nullif(v_row ->> 'priority', ''), 'normal');
    v_drive_link := nullif(trim(coalesce(v_row ->> 'drive_link', '')), '');
    v_notes := nullif(trim(coalesce(v_row ->> 'notes', '')), '');
    v_card_tag := nullif(
      upper(
        left(
          regexp_replace(
            trim(coalesce(v_row ->> 'card_tag', '')),
            '\s+',
            ' ',
            'g'
          ),
          16
        )
      ),
      ''
    );
    v_card_tag_color := coalesce(
      nullif(v_row ->> 'card_tag_color', ''),
      'slate'
    );

    if v_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'Prioridade inválida.';
    end if;

    if v_card_tag_color not in (
      'slate',
      'blue',
      'purple',
      'yellow',
      'red',
      'green'
    ) then
      v_card_tag_color := 'slate';
    end if;

    if v_start_date is null
       or v_final_date is null
       or v_start_date > v_final_date
    then
      raise exception
        'Informe um período válido para todas as demandas.';
    end if;

    select *
    into v_member
    from public.pauta_members
    where pauta_id = p_pauta_id
      and client_id = v_client_id
      and membership_status = 'active'
    order by added_at desc
    limit 1;

    if not found or v_member.main_work_item_id is null then
      raise exception
        'Um dos clientes não participa ativamente desta Pauta.';
    end if;

    select *
    into v_client
    from public.clients
    where id = v_client_id
      and status = 'active';

    if not found then
      raise exception 'Cliente não encontrado ou inativo.';
    end if;

    if not exists (
      select 1
      from public.client_services
      where id = v_service_id
        and client_id = v_client_id
        and status = 'active'
    ) then
      raise exception
        'Um dos serviços não está ativo ou não pertence ao cliente.';
    end if;

    if not exists (
      select 1
      from public.profiles
      where id = v_responsible_id
        and is_active = true
    ) then
      raise exception
        'Responsável não encontrado ou inativo.';
    end if;

    v_title :=
      upper(v_client.name)
      || ' - '
      || to_char(v_start_date, 'DD/MM')
      || ' - '
      || to_char(v_final_date, 'DD/MM');

    insert into public.work_items (
      title,
      description,
      type,
      origin,
      destino,
      status,
      priority,
      client_id,
      client_service_id,
      responsible_id,
      board_id,
      board_column_id,
      internal_deadline,
      final_deadline,
      drive_link,
      notes,
      created_by,
      pauta_id,
      is_pauta_card,
      pauta_card_id,
      card_tag,
      card_tag_color
    )
    values (
      v_title,
      null,
      'Operação',
      'planned',
      'quadro',
      'not_started',
      v_priority,
      v_client_id,
      v_service_id,
      v_responsible_id,
      null,
      null,
      v_start_date,
      v_final_date,
      v_drive_link,
      v_notes,
      v_actor,
      p_pauta_id,
      false,
      v_member.main_work_item_id,
      v_card_tag,
      v_card_tag_color
    )
    returning id
    into v_work_item_id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_work_item_id,
      v_actor,
      'pauta_demand_created_multiboard',
      null,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'client_id', v_client_id,
        'targets', p_targets
      )::text
    );

    for v_target in
      select value
      from jsonb_array_elements(p_targets)
    loop
      v_board_id := (v_target ->> 'board_id')::uuid;
      v_column_id := (v_target ->> 'board_column_id')::uuid;
      v_is_required := coalesce(
        (v_target ->> 'is_required')::boolean,
        true
      );

      select *
      into v_column
      from public.board_columns
      where id = v_column_id
        and board_id = v_board_id;

      insert into public.work_item_board_assignments (
        work_item_id,
        board_id,
        board_column_id,
        operational_status,
        is_required,
        assignment_status,
        position,
        assigned_by,
        assigned_at,
        completed_by,
        completed_at,
        metadata
      )
      values (
        v_work_item_id,
        v_board_id,
        v_column_id,
        v_column.operational_status,
        v_is_required,
        'active',
        coalesce(
          (
            select max(position) + 1
            from public.work_item_board_assignments
            where board_id = v_board_id
              and board_column_id = v_column_id
              and assignment_status = 'active'
          ),
          0
        ),
        v_actor,
        now(),
        case
          when public.v8_assignment_is_complete(
            v_column.operational_status
          )
            then v_actor
          else null
        end,
        case
          when public.v8_assignment_is_complete(
            v_column.operational_status
          )
            then now()
          else null
        end,
        jsonb_build_object(
          'source', 'pauta_distribution',
          'pauta_id', p_pauta_id
        )
      )
      returning id
      into v_assignment_id;

      perform public.v8_log_assignment_event(
        v_assignment_id,
        v_work_item_id,
        p_pauta_id,
        v_board_id,
        v_column_id,
        v_actor,
        'assignment_created',
        '{}'::jsonb,
        jsonb_build_object(
          'board_id', v_board_id,
          'board_column_id', v_column_id,
          'operational_status', v_column.operational_status,
          'is_required', v_is_required
        ),
        '{}'::jsonb
      );
    end loop;

    perform public.recalculate_work_item_global_status(
      v_work_item_id
    );

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'demand_created_multiboard',
      'work_item',
      v_work_item_id,
      '{}'::jsonb,
      jsonb_build_object(
        'client_id', v_client_id,
        'pauta_card_id', v_member.main_work_item_id,
        'targets', p_targets
      ),
      '{}'::jsonb
    );

    v_created :=
      v_created ||
      jsonb_build_array(
        jsonb_build_object(
          'work_item_id', v_work_item_id,
          'client_id', v_client_id,
          'title', v_title
        )
      );

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'demands_created', v_count,
    'items', v_created
  );
end;
$$;


ALTER FUNCTION "public"."create_and_distribute_pauta_demands"("p_pauta_id" "uuid", "p_rows" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_column public.board_columns%rowtype;
  v_work_item_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_priority text := trim(coalesce(p_priority, 'normal'));
  v_initial_status text;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  if p_board_column_id is null then
    raise exception 'Coluna obrigatória.';
  end if;

  if length(v_title) not between 2 and 180 then
    raise exception
      'O título deve possuir entre 2 e 180 caracteres.';
  end if;

  if v_priority not in (
    'low',
    'normal',
    'high',
    'urgent'
  ) then
    raise exception 'Prioridade inválida.';
  end if;

  if p_responsible_id is null then
    raise exception 'Responsável obrigatório.';
  end if;

  if p_internal_deadline is null
     or p_final_deadline is null
  then
    raise exception
      'Início e prazo final são obrigatórios.';
  end if;

  if p_internal_deadline > p_final_deadline then
    raise exception
      'A data inicial não pode ser posterior ao prazo final.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber demandas.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1;

  if not found
     or v_member.main_work_item_id is null
  then
    raise exception
      'O cliente não possui participação ativa e card principal nesta Pauta.';
  end if;

  if not exists (
    select 1
    from public.work_items
    where id = v_member.main_work_item_id
      and pauta_id = p_pauta_id
      and client_id = p_client_id
      and is_pauta_card = true
  ) then
    raise exception
      'O card principal do cliente está inconsistente.';
  end if;

  select *
  into v_column
  from public.board_columns
  where id = p_board_column_id
    and board_id = v_pauta.board_id;

  if not found then
    raise exception
      'A coluna selecionada não pertence ao Quadro da Pauta.';
  end if;

  v_initial_status :=
    case
      when coalesce(v_column.operational_status, '') in (
        'done',
        'delivered',
        'approved'
      ) then 'not_started'
      else coalesce(
        v_column.operational_status,
        'not_started'
      )
    end;

  if not exists (
    select 1
    from public.profiles
    where id = p_responsible_id
      and is_active = true
  ) then
    raise exception
      'Responsável não encontrado ou inativo.';
  end if;

  if p_client_service_id is null then
    raise exception
      'Demandas operacionais de cliente precisam de um serviço ativo.';
  end if;

  if not exists (
    select 1
    from public.client_services
    where id = p_client_service_id
      and client_id = p_client_id
      and status = 'active'
  ) then
    raise exception
      'O serviço não está ativo ou não pertence ao cliente.';
  end if;

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,
    client_id,
    client_service_id,
    responsible_id,
    board_id,
    board_column_id,
    internal_deadline,
    final_deadline,
    drive_link,
    notes,
    blocked_reason,
    created_by,
    closed_at,
    pauta_id,
    is_pauta_card,
    pauta_card_id,
    completed_at
  )
  values (
    v_title,
    null,
    'Operação',
    'planned',
    'quadro',
    v_initial_status,
    v_priority,
    p_client_id,
    p_client_service_id,
    p_responsible_id,
    v_pauta.board_id,
    p_board_column_id,
    p_internal_deadline,
    p_final_deadline,
    nullif(trim(coalesce(p_drive_link, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    null,
    v_actor,
    null,
    p_pauta_id,
    false,
    v_member.main_work_item_id,
    null
  )
  returning id
  into v_work_item_id;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_work_item_id,
    v_actor,
    'pauta_demand_created',
    null,
    jsonb_build_object(
      'pauta_id', p_pauta_id,
      'pauta_card_id', v_member.main_work_item_id,
      'board_column_id', p_board_column_id,
      'status', v_initial_status,
      'completion_requires_explicit_action', true
    )::text
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'demand_created',
    'work_item',
    v_work_item_id,
    '{}'::jsonb,
    jsonb_build_object(
      'client_id', p_client_id,
      'main_work_item_id', v_member.main_work_item_id,
      'board_column_id', p_board_column_id,
      'client_service_id', p_client_service_id,
      'responsible_id', p_responsible_id,
      'status', v_initial_status,
      'completion_requires_explicit_action', true
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', v_work_item_id,
    'pauta_card_id', v_member.main_work_item_id,
    'status', v_initial_status,
    'completion_requires_explicit_action', true
  );
end;
$$;


ALTER FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") IS 'V8-A2: cria demanda planejada de Pauta; origin=planned.';



CREATE OR REPLACE FUNCTION "public"."delete_board_column_move_cards"("p_column_id" "uuid", "p_target_column_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_board_id uuid;
  v_column_name text;
  v_target_board_id uuid;
  v_target_status text;
  v_columns_count integer;
  v_legacy_cards_count integer;
  v_assignments_count integer;
  v_cards_moved integer := 0;
  v_assignments_moved integer := 0;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para excluir colunas.';
  end if;

  select board_id, name
  into v_board_id, v_column_name
  from public.board_columns
  where id = p_column_id
  for update;

  if v_board_id is null then
    raise exception 'Coluna não encontrada.';
  end if;

  select count(*)
  into v_columns_count
  from public.board_columns
  where board_id = v_board_id;

  if v_columns_count <= 1 then
    raise exception
      'Não é possível excluir a última coluna do Quadro.';
  end if;

  select count(*)
  into v_legacy_cards_count
  from public.work_items
  where board_column_id = p_column_id
    and status not in ('archived', 'cancelled');

  select count(*)
  into v_assignments_count
  from public.work_item_board_assignments
  where board_column_id = p_column_id
    and assignment_status = 'active';

  if v_legacy_cards_count > 0 or v_assignments_count > 0 then
    if p_target_column_id is null then
      raise exception
        'Escolha uma coluna de destino para os cards existentes.';
    end if;

    select board_id, operational_status
    into v_target_board_id, v_target_status
    from public.board_columns
    where id = p_target_column_id
    for update;

    if v_target_board_id is null
       or v_target_board_id <> v_board_id
       or p_target_column_id = p_column_id
    then
      raise exception
        'A coluna de destino deve pertencer ao mesmo Quadro.';
    end if;

    update public.work_item_board_assignments
    set
      board_column_id = p_target_column_id,
      operational_status = v_target_status,
      completed_at =
        case
          when public.v8_assignment_is_complete(v_target_status)
            then coalesce(completed_at, now())
          else null
        end,
      completed_by =
        case
          when public.v8_assignment_is_complete(v_target_status)
            then coalesce(auth.uid(), completed_by)
          else null
        end,
      updated_at = now()
    where board_column_id = p_column_id
      and assignment_status = 'active';

    get diagnostics v_assignments_moved = row_count;

    update public.work_items
    set
      board_column_id = p_target_column_id,
      board_id = v_board_id,
      status = v_target_status,
      updated_at = now()
    where board_column_id = p_column_id;

    get diagnostics v_cards_moved = row_count;
  end if;

  delete from public.board_columns
  where id = p_column_id;

  with ordered as (
    select
      id,
      row_number() over (
        order by position, created_at, id
      ) - 1 as next_position
    from public.board_columns
    where board_id = v_board_id
  )
  update public.board_columns column_row
  set
    position = ordered.next_position,
    updated_at = now()
  from ordered
  where column_row.id = ordered.id;

  return jsonb_build_object(
    'success', true,
    'column', v_column_name,
    'cards_moved', v_cards_moved,
    'assignments_moved', v_assignments_moved
  );
end;
$$;


ALTER FUNCTION "public"."delete_board_column_move_cards"("p_column_id" "uuid", "p_target_column_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_board_preserve_demands"("p_board_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_demands_preserved integer := 0;
  v_assignments_removed integer := 0;
begin
  if not public.app_has_total_access() then
    raise exception
      'Acesso Total é obrigatório para excluir Quadros.';
  end if;

  v_actor := public.pauta_current_active_actor();

  select *
  into v_board
  from public.boards
  where id = p_board_id
  for update;

  if not found then
    raise exception 'Quadro não encontrado.';
  end if;

  if v_board.board_kind = 'pauta' then
    raise exception
      'A estrutura de Pautas não pode ser excluída.';
  end if;

  update public.work_item_board_assignments
  set
    assignment_status = 'removed',
    removed_at = now(),
    removed_by = v_actor,
    updated_at = now(),
    metadata =
      metadata ||
      jsonb_build_object(
        'board_archived', true
      )
  where board_id = p_board_id
    and assignment_status = 'active';

  get diagnostics v_assignments_removed = row_count;

  update public.work_items
  set
    board_id = null,
    board_column_id = null,
    updated_at = now()
  where board_id = p_board_id;

  get diagnostics v_demands_preserved = row_count;

  update public.boards
  set
    status = 'archived',
    updated_at = now()
  where id = p_board_id;

  return jsonb_build_object(
    'success', true,
    'board', v_board.name,
    'board_archived', true,
    'demands_preserved', v_demands_preserved,
    'assignments_removed', v_assignments_removed
  );
end;
$$;


ALTER FUNCTION "public"."delete_board_preserve_demands"("p_board_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_empty_pauta"("p_pauta_id" "uuid", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_dependencies jsonb;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'EXCLUIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite EXCLUIR PAUTA.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  v_dependencies :=
    public.pauta_dependency_summary(
      p_pauta_id
    );

  if not coalesce(
    (v_dependencies ->> 'can_delete')::boolean,
    false
  ) then
    raise exception
      'A Pauta possui dependências e não pode ser excluída. Resumo: %.',
      v_dependencies::text;
  end if;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'pauta_deleted',
    'pauta',
    p_pauta_id,
    to_jsonb(v_pauta),
    jsonb_build_object(
      'deleted_at',
      now()
    ),
    jsonb_build_object(
      'dependency_summary',
      v_dependencies
    )
  );

  delete from public.pautas
  where id = p_pauta_id;

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'deleted', true
  );
end;
$$;


ALTER FUNCTION "public"."delete_empty_pauta"("p_pauta_id" "uuid", "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."delete_empty_pauta"("p_pauta_id" "uuid", "p_confirmation" "text") IS 'V8-A2: função técnica preservada, sem execução por usuários da aplicação.';



CREATE OR REPLACE FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_item public.work_items%rowtype;
  v_old_values jsonb;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR DEMANDA' then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDA.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem retirar demandas.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
    and pauta_id = p_pauta_id
  for update;

  if not found then
    raise exception
      'Demanda não encontrada dentro desta Pauta.';
  end if;

  if v_item.is_pauta_card = true then
    raise exception
      'O card mensal principal deve ser tratado pela ação Retirar cliente.';
  end if;

  v_old_values := jsonb_build_object(
    'pauta_id', v_item.pauta_id,
    'pauta_card_id', v_item.pauta_card_id,
    'board_id', v_item.board_id,
    'board_column_id', v_item.board_column_id,
    'destino', v_item.destino
  );

  update public.calendar_events
  set
    pauta_id = null,
    updated_at = now()
  where work_item_id = p_work_item_id
    and pauta_id = p_pauta_id;

  update public.work_items
  set
    pauta_id = null,
    pauta_card_id = null,
    is_pauta_card = false,
    board_id = null,
    board_column_id = null,
    destino = 'avulsa',
    updated_at = now()
  where id = p_work_item_id;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    p_work_item_id,
    v_actor,
    'removed_from_pauta',
    v_old_values::text,
    jsonb_build_object(
      'pauta_id', null,
      'pauta_card_id', null,
      'board_id', null,
      'board_column_id', null,
      'destino', 'avulsa'
    )::text
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'demand_detached',
    'work_item',
    p_work_item_id,
    v_old_values,
    jsonb_build_object(
      'preserved_as_extra', true,
      'destino', 'avulsa'
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'work_item_id', p_work_item_id,
    'preserved_as_extra', true
  );
end;
$$;


ALTER FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") IS 'Retira uma demanda da Pauta e preserva o mesmo work_item como Extra.';



CREATE OR REPLACE FUNCTION "public"."distribute_existing_pauta_demands"("p_pauta_id" "uuid", "p_work_item_ids" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_work_item_id uuid;
  v_item public.work_items%rowtype;
  v_target jsonb;
  v_board_id uuid;
  v_column_id uuid;
  v_is_required boolean;
  v_column public.board_columns%rowtype;
  v_assignment public.work_item_board_assignments%rowtype;
  v_count integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
begin
  v_actor := public.pauta_current_active_actor();

  if not public.app_has_total_access() then
    raise exception 'Acesso Total é obrigatório para distribuir demandas.';
  end if;

  if trim(coalesce(p_confirmation, '')) <> 'DISTRIBUIR DEMANDAS' then
    raise exception 'Confirmação inválida. Digite DISTRIBUIR DEMANDAS.';
  end if;

  if p_work_item_ids is null
     or jsonb_typeof(p_work_item_ids) <> 'array'
     or jsonb_array_length(p_work_item_ids) = 0
  then
    raise exception 'Selecione pelo menos uma demanda.';
  end if;

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) = 0
  then
    raise exception 'Selecione pelo menos um Quadro de destino.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception 'Somente Pautas abertas ou em rascunho podem distribuir demandas.';
  end if;

  for v_target in
    select value
    from jsonb_array_elements(p_targets)
  loop
    if nullif(
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
    v_column_id := (v_target ->> 'board_column_id')::uuid;

    select column_row.*
    into v_column
    from public.board_columns column_row
    join public.boards board_row
      on board_row.id = column_row.board_id
    where column_row.id = v_column_id
      and column_row.board_id = v_board_id
      and board_row.board_kind = 'custom'
      and board_row.status = 'active';

    if not found then
      raise exception 'Um dos Quadros ou colunas de destino é inválido.';
    end if;
  end loop;

  for v_work_item_id in
    select value::uuid
    from jsonb_array_elements_text(p_work_item_ids) as ids(value)
  loop
    select *
    into v_item
    from public.work_items
    where id = v_work_item_id
      and pauta_id = p_pauta_id
      and coalesce(is_pauta_card, false) in (false, true)
      and status not in ('archived', 'cancelled')
    for update;

    if not found then
      raise exception 'Uma das demandas não pertence à Pauta ou não está ativa.';
    end if;

    for v_target in
      select value
      from jsonb_array_elements(p_targets)
    loop
      v_board_id := (v_target ->> 'board_id')::uuid;
      v_column_id := (v_target ->> 'board_column_id')::uuid;
      v_is_required := coalesce((v_target ->> 'is_required')::boolean, true);

      select *
      into v_column
      from public.board_columns
      where id = v_column_id
        and board_id = v_board_id;

      select *
      into v_assignment
      from public.work_item_board_assignments
      where work_item_id = v_work_item_id
        and board_id = v_board_id
        and assignment_status = 'active'
      for update;

      if found then
        update public.work_item_board_assignments
        set
          board_column_id = v_column_id,
          operational_status = v_column.operational_status,
          is_required = v_is_required,
          metadata = coalesce(metadata, '{}'::jsonb)
            || jsonb_build_object(
              'source', 'pauta_existing_distribution',
              'pauta_id', p_pauta_id,
              'display_mode', 'simple',
              'card_scope', 'sector'
            ),
          completed_at = case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then coalesce(completed_at, now())
            else null
          end,
          completed_by = case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then coalesce(completed_by, v_actor)
            else null
          end,
          updated_at = now()
        where id = v_assignment.id;

        v_updated := v_updated + 1;
      else
        insert into public.work_item_board_assignments (
          work_item_id,
          board_id,
          board_column_id,
          operational_status,
          is_required,
          assignment_status,
          position,
          assigned_by,
          assigned_at,
          completed_by,
          completed_at,
          metadata
        )
        values (
          v_work_item_id,
          v_board_id,
          v_column_id,
          v_column.operational_status,
          v_is_required,
          'active',
          coalesce(
            (
              select max(position) + 1
              from public.work_item_board_assignments
              where board_id = v_board_id
                and board_column_id = v_column_id
                and assignment_status = 'active'
            ),
            0
          ),
          v_actor,
          now(),
          case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then v_actor
            else null
          end,
          case
            when public.v8_assignment_is_complete(v_column.operational_status)
              then now()
            else null
          end,
          jsonb_build_object(
            'source', 'pauta_existing_distribution',
            'pauta_id', p_pauta_id,
            'display_mode', 'simple',
            'card_scope', 'sector'
          )
        )
        returning *
        into v_assignment;

        v_created := v_created + 1;
      end if;

      perform public.v8_log_assignment_event(
        v_assignment.id,
        v_work_item_id,
        p_pauta_id,
        v_board_id,
        v_column_id,
        v_actor,
        'assignment_distributed',
        '{}'::jsonb,
        jsonb_build_object(
          'board_id', v_board_id,
          'board_column_id', v_column_id,
          'is_required', v_is_required,
          'display_mode', 'simple'
        ),
        jsonb_build_object('source', 'pauta_management')
      );

      v_count := v_count + 1;
    end loop;

    perform public.recalculate_work_item_global_status(v_work_item_id);

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      v_actor,
      'demand_distributed_multiboard',
      'work_item',
      v_work_item_id,
      '{}'::jsonb,
      jsonb_build_object('targets', p_targets),
      jsonb_build_object('display_mode', 'simple')
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'assignments_processed', v_count,
    'assignments_created', v_created,
    'assignments_updated', v_updated
  );
end;
$$;


ALTER FUNCTION "public"."distribute_existing_pauta_demands"("p_pauta_id" "uuid", "p_work_item_ids" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."distribute_existing_pauta_demands"("p_pauta_id" "uuid", "p_work_item_ids" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") IS 'V9.2C-A2.3: exige Quadro e coluna explícitos antes de distribuir demandas.';



CREATE OR REPLACE FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid := auth.uid();

  v_source
    public.work_items%rowtype;

  v_source_column
    public.board_columns%rowtype;

  v_target_column
    public.board_columns%rowtype;

  v_service
    public.client_services%rowtype;

  v_client
    public.clients%rowtype;

  v_existing_successor uuid;
  v_new_id uuid;
  v_next_cycle_number integer;
  v_duration integer;
  v_title text;
  v_drive_link text;
  v_requirement_count integer := 0;
begin
  if v_actor is null then
    raise exception
      'Sessão inválida ou expirada.';
  end if;

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem gerar ciclos.';
  end if;

  if coalesce(trim(p_confirmation), '') <> 'GERAR CICLO' then
    raise exception
      'Confirmação de segurança inválida.';
  end if;

  if coalesce(p_programming_verified, false) is not true then
    raise exception
      'Confirme que a programação do ciclo foi concluída.';
  end if;

  if p_source_id is null then
    raise exception
      'Card de origem não informado.';
  end if;

  if p_client_service_id is null then
    raise exception
      'Selecione o serviço que define o próximo ciclo.';
  end if;

  if p_start_date is null or p_end_date is null then
    raise exception
      'Informe as datas do próximo ciclo.';
  end if;

  if p_end_date <= p_start_date then
    raise exception
      'A data final precisa ser posterior à data inicial.';
  end if;

  v_duration :=
    p_end_date - p_start_date;

  if v_duration < 1 or v_duration > 365 then
    raise exception
      'A duração do ciclo precisa estar entre 1 e 365 dias.';
  end if;

  select *
    into v_source
  from public.work_items
  where id = p_source_id
  for update;

  if not found then
    raise exception
      'Card de origem não encontrado.';
  end if;

  if v_source.board_id is null
     or v_source.board_column_id is null then
    raise exception
      'O card não está vinculado a um Quadro e coluna válidos.';
  end if;

  select *
    into v_source_column
  from public.board_columns
  where id = v_source.board_column_id
    and board_id = v_source.board_id;

  if not found then
    raise exception
      'Coluna atual do card não encontrada.';
  end if;

  if v_source_column.automation_role <> 'completed' then
    raise exception
      'Somente cards da coluna Concluído podem gerar o próximo ciclo.';
  end if;

  if v_source.status not in ('done', 'delivered') then
    raise exception
      'O card precisa estar concluído antes de gerar o próximo ciclo.';
  end if;

  if v_source.client_id is null then
    raise exception
      'O card concluído não possui cliente vinculado.';
  end if;

  select id
    into v_existing_successor
  from public.work_items
  where generated_from_cycle_id = v_source.id
  limit 1;

  if v_existing_successor is not null then
    raise exception
      'Este card já gerou um próximo ciclo.';
  end if;

  select *
    into v_service
  from public.client_services
  where id = p_client_service_id
    and client_id = v_source.client_id
    and status = 'active'
  for update;

  if not found then
    raise exception
      'O serviço selecionado não pertence ao cliente ou não está ativo.';
  end if;

  if v_service.cycle_duration_days is null then
    raise exception
      'Configure a duração do ciclo neste serviço antes de continuar.';
  end if;

  select *
    into v_client
  from public.clients
  where id = v_source.client_id
    and status = 'active';

  if not found then
    raise exception
      'Cliente não encontrado ou fora da operação.';
  end if;

  select *
    into v_target_column
  from public.board_columns
  where board_id = v_source.board_id
    and automation_role = 'alignment'
  limit 1;

  if not found then
    raise exception
      'A coluna técnica Reunião de Alinhamento não foi encontrada.';
  end if;

  if v_source.cycle_number is null then
    update public.work_items
    set
      cycle_number = 1,
      updated_at = now()
    where id = v_source.id;

    v_source.cycle_number := 1;
  end if;

  v_next_cycle_number :=
    v_source.cycle_number + 1;

  v_title :=
    trim(v_client.name)
    || ' — '
    || to_char(p_start_date, 'DD/MM')
    || '–'
    || to_char(p_end_date, 'DD/MM');

  v_drive_link :=
    coalesce(
      nullif(
        trim(v_source.drive_link),
        ''
      ),
      nullif(
        trim(v_client.drive_folder_url),
        ''
      )
    );

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,

    client_id,
    client_service_id,
    responsible_id,

    board_id,
    board_column_id,

    internal_deadline,
    final_deadline,

    drive_link,
    notes,
    blocked_reason,

    created_by,
    closed_at,

    generated_from_cycle_id,
    cycle_number,
    cycle_duration_days_snapshot,
    generated_at,
    generated_by
  )
  values (
    v_title,
    null,
    coalesce(
      v_source.type,
      'Planejamento'
    ),
    coalesce(
      v_source.origin,
      'planned'
    ),
    'quadro',
    v_target_column.operational_status,
    coalesce(
      v_source.priority,
      'normal'
    ),

    v_source.client_id,
    v_service.id,
    v_source.responsible_id,

    v_source.board_id,
    v_target_column.id,

    p_start_date,
    p_end_date,

    v_drive_link,
    null,
    null,

    v_actor,
    null,

    v_source.id,
    v_next_cycle_number,
    v_duration,
    now(),
    v_actor
  )
  returning id
    into v_new_id;

  if v_service.requires_alignment_meeting then
    insert into
      public.work_item_schedule_requirements (
        work_item_id,
        requirement_type,
        status,
        calendar_type,
        created_by
      )
    values (
      v_new_id,
      'alignment_meeting',
      'pending',
      'reu_a',
      v_actor
    );

    v_requirement_count :=
      v_requirement_count + 1;
  end if;

  if v_service.requires_capture then
    insert into
      public.work_item_schedule_requirements (
        work_item_id,
        requirement_type,
        status,
        calendar_type,
        created_by
      )
    values (
      v_new_id,
      'capture',
      'pending',
      v_service.default_capture_type,
      v_actor
    );

    v_requirement_count :=
      v_requirement_count + 1;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_source.id,
    v_actor,
    'cycle_generated',
    null,
    v_new_id::text
  );

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_new_id,
    v_actor,
    'generated_from_cycle',
    v_source.id::text,
    v_title
  );

  return jsonb_build_object(
    'success',
    true,

    'source_id',
    v_source.id,

    'new_id',
    v_new_id,

    'title',
    v_title,

    'cycle_number',
    v_next_cycle_number,

    'start_date',
    p_start_date,

    'end_date',
    p_end_date,

    'duration_days',
    v_duration,

    'configured_duration_days',
    v_service.cycle_duration_days,

    'requirements_created',
    v_requirement_count,

    'drive_link',
    v_drive_link
  );

exception
  when unique_violation then
    raise exception
      'Este card já gerou um próximo ciclo.';
end;
$$;


ALTER FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") IS 'Gera atomicamente um novo ciclo a partir de um card concluído.';



CREATE OR REPLACE FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_members jsonb := '[]'::jsonb;
  v_extra_demands jsonb := '[]'::jsonb;
  v_legacy_candidates jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_dependencies jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'member_id', member.id,
        'membership_status', member.membership_status,
        'source', member.source,
        'target_date', member.target_date,
        'target_date_updated_at', member.target_date_updated_at,
        'target_date_updated_by', member.target_date_updated_by,
        'added_by', member.added_by,
        'added_at', member.added_at,
        'removed_by', member.removed_by,
        'removed_at', member.removed_at,
        'metadata', member.metadata,
        'client', jsonb_build_object(
          'id', client.id,
          'name', client.name,
          'status', client.status,
          'responsible_id', client.responsible_id,
          'drive_folder_url', client.drive_folder_url
        ),
        'main_work_item',
          case
            when item.id is null then null
            else jsonb_build_object(
              'id', item.id,
              'title', item.title,
              'status', item.status,
              'priority', item.priority,
              'board_id', item.board_id,
              'board_column_id', item.board_column_id,
              'responsible_id', item.responsible_id,
              'client_service_id', item.client_service_id,
              'internal_deadline', item.internal_deadline,
              'final_deadline', item.final_deadline,
              'completed_at', item.completed_at,
              'programming_covered_until', item.programming_covered_until
            )
          end
      )
      order by
        member.membership_status,
        client.name,
        member.added_at
    ),
    '[]'::jsonb
  )
  into v_members
  from public.pauta_members member
  join public.clients client
    on client.id = member.client_id
  left join public.work_items item
    on item.id = member.main_work_item_id
  where member.pauta_id = p_pauta_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'client_name', client.name,
        'pauta_card_id', item.pauta_card_id,
        'status', item.status,
        'priority', item.priority,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'drive_link', item.drive_link,
        'notes', item.notes,
        'card_tag', item.card_tag,
        'card_tag_color', item.card_tag_color,
        'completed_at', item.completed_at,
        'assignments', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', assignment.id,
                'board_id', assignment.board_id,
                'board_name', board_row.name,
                'board_color', board_row.color,
                'board_column_id', assignment.board_column_id,
                'board_column_name', column_row.name,
                'board_column_color', column_row.color,
                'operational_status', assignment.operational_status,
                'is_required', assignment.is_required,
                'completed_at', assignment.completed_at,
                'assigned_at', assignment.assigned_at
              )
              order by board_row.name
            )
            from public.work_item_board_assignments assignment
            join public.boards board_row
              on board_row.id = assignment.board_id
            join public.board_columns column_row
              on column_row.id = assignment.board_column_id
            where assignment.work_item_id = item.id
              and assignment.assignment_status = 'active'
          ),
          '[]'::jsonb
        )
      )
      order by client.name, item.created_at desc
    ),
    '[]'::jsonb
  )
  into v_extra_demands
  from public.work_items item
  left join public.clients client
    on client.id = item.client_id
  where item.pauta_id = p_pauta_id
    and item.is_pauta_card = false
    and item.status not in ('archived', 'cancelled');

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'work_item_id', item.id,
        'title', item.title,
        'client_id', item.client_id,
        'client_name', client.name,
        'client_status', client.status,
        'status', item.status,
        'priority', item.priority,
        'board_id', item.board_id,
        'board_column_id', item.board_column_id,
        'responsible_id', item.responsible_id,
        'client_service_id', item.client_service_id,
        'internal_deadline', item.internal_deadline,
        'final_deadline', item.final_deadline,
        'created_at', item.created_at
      )
      order by client.name, item.created_at
    ),
    '[]'::jsonb
  )
  into v_legacy_candidates
  from public.work_items item
  join public.clients client
    on client.id = item.client_id
  where item.board_id = v_pauta.board_id
    and item.pauta_id is null
    and item.is_pauta_card = false
    and item.status not in ('archived', 'cancelled')
    and not exists (
      select 1
      from public.pauta_members member
      where member.pauta_id = p_pauta_id
        and member.client_id = item.client_id
        and member.membership_status = 'active'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', event.id,
        'action', event.action,
        'target_type', event.target_type,
        'target_id', event.target_id,
        'actor_id', event.actor_id,
        'actor',
          case
            when actor.id is null then null
            else jsonb_build_object(
              'id', actor.id,
              'full_name', actor.full_name,
              'display_name', actor.display_name,
              'avatar_url', actor.avatar_url
            )
          end,
        'old_values', event.old_values,
        'new_values', event.new_values,
        'metadata', event.metadata,
        'created_at', event.created_at
      )
      order by event.created_at desc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select *
    from public.pauta_events
    where pauta_id = p_pauta_id
    order by created_at desc
    limit 300
  ) event
  left join public.profiles actor
    on actor.id = event.actor_id;

  v_dependencies :=
    public.pauta_dependency_summary(p_pauta_id)
    ||
    jsonb_build_object(
      'active_assignments',
        (
          select count(*)
          from public.work_item_board_assignments assignment
          join public.work_items item
            on item.id = assignment.work_item_id
          where item.pauta_id = p_pauta_id
            and assignment.assignment_status = 'active'
        ),
      'pending_required_assignments',
        (
          select count(*)
          from public.work_item_board_assignments assignment
          join public.work_items item
            on item.id = assignment.work_item_id
          where item.pauta_id = p_pauta_id
            and assignment.assignment_status = 'active'
            and assignment.is_required = true
            and not public.v8_assignment_is_complete(
              assignment.operational_status
            )
        )
    );

  return jsonb_build_object(
    'pauta', to_jsonb(v_pauta),
    'members', v_members,
    'extra_demands', v_extra_demands,
    'legacy_candidates', v_legacy_candidates,
    'events', v_events,
    'dependency_summary', v_dependencies,
    'permissions', jsonb_build_object(
      'can_manage', public.app_has_total_access(),
      'can_operate', true
    ),
    'requested_by', v_actor
  );
end;
$$;


ALTER FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") IS 'Retorna Pauta, participantes, demandas, legado, histórico, dependências e permissões.';



CREATE OR REPLACE FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_board_kind text;
begin
  if new.board_id is null then
    return new;
  end if;

  select board_kind into v_board_kind
  from public.boards
  where id = new.board_id;

  if v_board_kind = 'pauta'
     and new.pauta_id is null
     and new.status not in ('archived','cancelled')
  then
    raise exception 'Demandas ativas do Quadro operacional precisam pertencer a uma Pauta.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"() IS 'Impede work_items ativos ligados diretamente ao Quadro de Pautas sem pauta_id. Não afeta Agenda nem Quadros personalizados.';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    role,
    avatar_initials,
    avatar_color,
    avatar_bg,
    is_active,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'admin',
    UPPER(LEFT(split_part(NEW.email, '@', 1), 2)),
    '#CC8800',
    '#1A1200',
    true,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_total_access"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.team_members tm
    where tm.profile_id = auth.uid()
      and tm.is_active is true
      and tm.access_type = 'total'
  );
$$;


ALTER FUNCTION "public"."has_total_access"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."move_work_item_board_assignment"("p_assignment_id" "uuid", "p_target_column_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old_values jsonb;
  v_new_values jsonb;
  v_next_operational_status text;
begin
  v_actor := public.pauta_current_active_actor();

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception
      'Você não possui permissão para movimentar esta demanda.';
  end if;

  select *
  into v_target
  from public.board_columns
  where id = p_target_column_id
    and board_id = v_assignment.board_id;

  if not found then
    raise exception
      'A coluna de destino deve pertencer ao mesmo Quadro.';
  end if;

  v_next_operational_status :=
    case
      when public.v8_assignment_is_complete(v_target.operational_status)
        then v_assignment.operational_status
      else v_target.operational_status
    end;

  v_old_values := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  update public.work_item_board_assignments
  set
    board_column_id = p_target_column_id,
    operational_status = v_next_operational_status,
    updated_at = now()
  where id = p_assignment_id;

  v_new_values := jsonb_build_object(
    'board_column_id', p_target_column_id,
    'operational_status', v_next_operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  perform public.v8_log_assignment_event(
    p_assignment_id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    p_target_column_id,
    v_actor,
    'assignment_moved',
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'completion_requires_explicit_action', true
    )
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      'assignment_moved',
      'work_item',
      v_item.id,
      v_old_values,
      v_new_values,
      jsonb_build_object(
        'assignment_id', p_assignment_id,
        'completion_requires_explicit_action', true
      )
    );
  end if;

  perform public.recalculate_work_item_global_status(
    v_assignment.work_item_id
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'work_item_id', v_assignment.work_item_id,
    'board_column_id', p_target_column_id,
    'operational_status', v_next_operational_status,
    'completed', v_assignment.completed_at is not null
  );
end;
$$;


ALTER FUNCTION "public"."move_work_item_board_assignment"("p_assignment_id" "uuid", "p_target_column_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_existing_pauta public.pautas%rowtype;
  v_pauta_id uuid;
  v_client_id uuid;
  v_result jsonb;

  v_selected_count integer := 0;
  v_unique_count integer := 0;
  v_active_count integer := 0;
  v_cards_created integer := 0;
  v_memberships_created integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'ABRIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite ABRIR PAUTA.';
  end if;

  if p_board_id is null then
    raise exception 'Quadro obrigatório.';
  end if;

  if length(trim(coalesce(p_name, ''))) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if p_reference_month is null
     or p_reference_month <>
        date_trunc(
          'month',
          p_reference_month
        )::date
  then
    raise exception
      'O mês de referência deve utilizar o primeiro dia do mês.';
  end if;

  if p_magic_number_date is null
     or p_scheduled_until_date is null
  then
    raise exception
      'Magic Number e Programado até são obrigatórios.';
  end if;

  if p_magic_number_date > p_scheduled_until_date then
    raise exception
      'O Magic Number não pode ser posterior à data Programado até.';
  end if;

  if p_scheduled_until_date < p_reference_month then
    raise exception
      'A data Programado até precisa alcançar o mês de referência.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente ativo.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'A Pauta aceita no máximo 300 clientes por abertura.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  select
    count(*),
    count(distinct selected.client_id)
  into
    v_selected_count,
    v_unique_count
  from unnest(p_client_ids) as selected(client_id);

  if v_selected_count <> v_unique_count then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_board
  from public.boards
  where id = p_board_id
    and status = 'active'
    and board_kind = 'pauta'
  for update;

  if not found then
    raise exception
      'A Pauta deve ser aberta em um Quadro ativo do tipo Pauta.';
  end if;

  select *
  into v_existing_pauta
  from public.pautas
  where board_id = p_board_id
    and reference_month = p_reference_month
  limit 1;

  if found then
    return jsonb_build_object(
      'success', false,
      'code', 'PAUTA_EXISTS',
      'existing_pauta_unchanged', true,
      'message', 'Já existe uma Pauta para este mês.',
      'pauta_id', v_existing_pauta.id,
      'pauta_name', v_existing_pauta.name,
      'reference_month', v_existing_pauta.reference_month,
      'lifecycle_status', v_existing_pauta.lifecycle_status,
      'cards_created', 0
    );
  end if;

  select count(*)
  into v_active_count
  from public.clients
  where id = any(p_client_ids)
    and status = 'active';

  if v_active_count <> v_unique_count then
    raise exception
      'Um ou mais clientes selecionados não existem ou estão inativos.';
  end if;

  insert into public.pautas (
    board_id,
    name,
    reference_month,
    magic_number_date,
    scheduled_until_date,
    lifecycle_status,
    opened_at,
    created_by
  )
  values (
    p_board_id,
    trim(p_name),
    p_reference_month,
    p_magic_number_date,
    p_scheduled_until_date,
    'open',
    now(),
    v_actor
  )
  returning id
  into v_pauta_id;

  for v_client_id in
    select client.id
    from public.clients as client
    where client.id = any(p_client_ids)
      and client.status = 'active'
    order by client.name
  loop
    v_result :=
      public.pauta_create_main_card_core(
        v_pauta_id,
        v_client_id,
        v_actor,
        'opened'
      );

    if coalesce(
      (v_result ->> 'created')::boolean,
      false
    ) then
      v_cards_created :=
        v_cards_created + 1;
    end if;

    if coalesce(
      (v_result ->> 'membership_created')::boolean,
      false
    ) then
      v_memberships_created :=
        v_memberships_created + 1;
    end if;
  end loop;

  perform public.pauta_log_event(
    v_pauta_id,
    p_board_id,
    v_actor,
    'pauta_created',
    'pauta',
    v_pauta_id,
    '{}'::jsonb,
    jsonb_build_object(
      'name', trim(p_name),
      'reference_month', p_reference_month,
      'magic_number_date', p_magic_number_date,
      'scheduled_until_date', p_scheduled_until_date,
      'cards_created', v_cards_created,
      'memberships_created', v_memberships_created
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'code', 'PAUTA_CREATED',
    'pauta_id', v_pauta_id,
    'cards_created', v_cards_created,
    'memberships_created', v_memberships_created,
    'reference_month', p_reference_month,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );
end;
$$;


ALTER FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") IS 'Abre Pauta mensal, cria memberships e cards principais e retorna PAUTA_EXISTS quando o mês já existe.';



CREATE OR REPLACE FUNCTION "public"."pauta_create_main_card_core"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_actor_id" "uuid", "p_source" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_pauta public.pautas%rowtype;
  v_board public.boards%rowtype;
  v_alignment public.board_columns%rowtype;
  v_client public.clients%rowtype;
  v_existing_member public.pauta_members%rowtype;

  v_work_item_id uuid;
  v_existing_main_id uuid;

  v_requires_alignment boolean := false;
  v_requires_capture boolean := false;
  v_capture_type text;
  v_title text;
  v_source text := trim(coalesce(p_source, 'added'));
begin
  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  if p_actor_id is null then
    raise exception 'Autor obrigatório.';
  end if;

  if v_source not in (
    'opened',
    'added',
    'legacy_adopted',
    'backfill',
    'restored'
  ) then
    raise exception 'Origem de participação inválida.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem receber clientes.';
  end if;

  select *
  into v_board
  from public.boards
  where id = v_pauta.board_id
    and status = 'active'
    and board_kind = 'pauta';

  if not found then
    raise exception
      'O Quadro operacional da Pauta está inválido ou inativo.';
  end if;

  select *
  into v_client
  from public.clients
  where id = p_client_id
    and status = 'active';

  if not found then
    raise exception
      'Cliente não encontrado ou inativo.';
  end if;

  select *
  into v_existing_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'created', false,
      'membership_created', false,
      'work_item_id', v_existing_member.main_work_item_id,
      'client_id', p_client_id,
      'reason', 'ALREADY_IN_PAUTA'
    );
  end if;

  select id
  into v_existing_main_id
  from public.work_items
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and is_pauta_card = true
  order by created_at
  limit 1
  for update;

  if found then
    insert into public.pauta_members (
      pauta_id,
      client_id,
      main_work_item_id,
      membership_status,
      source,
      added_by,
      added_at,
      metadata
    )
    values (
      p_pauta_id,
      p_client_id,
      v_existing_main_id,
      'active',
      'restored',
      p_actor_id,
      now(),
      jsonb_build_object(
        'reason',
        'existing_main_card_without_active_membership'
      )
    );

    perform public.pauta_log_event(
      p_pauta_id,
      v_pauta.board_id,
      p_actor_id,
      'client_membership_restored',
      'client',
      p_client_id,
      '{}'::jsonb,
      jsonb_build_object(
        'main_work_item_id',
        v_existing_main_id
      ),
      '{}'::jsonb
    );

    return jsonb_build_object(
      'success', true,
      'created', false,
      'membership_created', true,
      'work_item_id', v_existing_main_id,
      'client_id', p_client_id,
      'reason', 'MEMBERSHIP_RESTORED'
    );
  end if;

  select *
  into v_alignment
  from public.board_columns
  where board_id = v_pauta.board_id
    and automation_role = 'alignment'
  order by position, created_at
  limit 1;

  if not found then
    raise exception
      'O Quadro não possui a coluna Reunião de Alinhamento configurada.';
  end if;

  v_title :=
    upper(trim(v_client.name)) ||
    ' - ' ||
    to_char(v_pauta.reference_month, 'MM/YYYY');

  insert into public.work_items (
    title,
    description,
    type,
    origin,
    destino,
    status,
    priority,
    client_id,
    client_service_id,
    responsible_id,
    board_id,
    board_column_id,
    internal_deadline,
    final_deadline,
    drive_link,
    notes,
    blocked_reason,
    created_by,
    closed_at,
    pauta_id,
    is_pauta_card,
    pauta_card_id,
    completed_at
  )
  values (
    v_title,
    null,
    'Planejamento',
    'planned',
    'quadro',
    coalesce(
      v_alignment.operational_status,
      'not_started'
    ),
    'normal',
    v_client.id,
    null,
    v_client.responsible_id,
    v_pauta.board_id,
    v_alignment.id,
    v_pauta.magic_number_date,
    v_pauta.magic_number_date,
    v_client.drive_folder_url,
    null,
    null,
    p_actor_id,
    null,
    p_pauta_id,
    true,
    null,
    null
  )
  returning id
  into v_work_item_id;

  select
    coalesce(
      bool_or(service.requires_alignment_meeting),
      false
    ),
    coalesce(
      bool_or(service.requires_capture),
      false
    ),
    case
      when count(
        distinct service.default_capture_type
      ) filter (
        where service.default_capture_type is not null
      ) = 1
      then max(
        service.default_capture_type
      ) filter (
        where service.default_capture_type is not null
      )
      else null
    end
  into
    v_requires_alignment,
    v_requires_capture,
    v_capture_type
  from public.client_services as service
  where service.client_id = v_client.id
    and service.status = 'active';

  if v_requires_alignment then
    insert into public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_type,
      created_by
    )
    values (
      v_work_item_id,
      'alignment_meeting',
      'pending',
      'reu_a',
      p_actor_id
    )
    on conflict (
      work_item_id,
      requirement_type
    )
    do nothing;
  end if;

  if v_requires_capture then
    insert into public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_type,
      created_by
    )
    values (
      v_work_item_id,
      'capture',
      'pending',
      v_capture_type,
      p_actor_id
    )
    on conflict (
      work_item_id,
      requirement_type
    )
    do nothing;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    v_work_item_id,
    p_actor_id,
    case
      when v_source = 'opened'
        then 'pauta_opened'
      else 'pauta_client_added'
    end,
    null,
    p_pauta_id::text
  );

  insert into public.pauta_members (
    pauta_id,
    client_id,
    main_work_item_id,
    membership_status,
    source,
    added_by,
    added_at,
    metadata
  )
  values (
    p_pauta_id,
    p_client_id,
    v_work_item_id,
    'active',
    v_source,
    p_actor_id,
    now(),
    jsonb_build_object(
      'main_card_created',
      true
    )
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    p_actor_id,
    'client_added',
    'client',
    p_client_id,
    '{}'::jsonb,
    jsonb_build_object(
      'main_work_item_id',
      v_work_item_id,
      'source',
      v_source
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'created', true,
    'membership_created', true,
    'work_item_id', v_work_item_id,
    'client_id', p_client_id,
    'reason', 'MAIN_CARD_CREATED'
  );
end;
$$;


ALTER FUNCTION "public"."pauta_create_main_card_core"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_actor_id" "uuid", "p_source" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pauta_current_active_actor"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception
      'Sessão inválida ou expirada.';
  end if;

  if not public.app_is_active_user() then
    raise exception
      'Usuário inativo ou sem autorização operacional.';
  end if;

  return v_actor;
end;
$$;


ALTER FUNCTION "public"."pauta_current_active_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pauta_dependency_summary"("p_pauta_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;

  v_active_members integer := 0;
  v_removed_members integer := 0;
  v_main_cards integer := 0;
  v_extra_demands integer := 0;
  v_active_items integer := 0;
  v_calendar_events integer := 0;
  v_schedule_requirements integer := 0;
  v_internal_messages integer := 0;
  v_notices integer := 0;
  v_blocking_events integer := 0;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  select
    count(*) filter (
      where membership_status = 'active'
    ),
    count(*) filter (
      where membership_status = 'removed'
    )
  into
    v_active_members,
    v_removed_members
  from public.pauta_members
  where pauta_id = p_pauta_id;

  select
    count(*) filter (
      where is_pauta_card = true
    ),
    count(*) filter (
      where is_pauta_card = false
    ),
    count(*) filter (
      where status not in (
        'archived',
        'cancelled',
        'done',
        'delivered',
        'approved'
      )
    )
  into
    v_main_cards,
    v_extra_demands,
    v_active_items
  from public.work_items
  where pauta_id = p_pauta_id;

  select count(*)
  into v_calendar_events
  from public.calendar_events
  where pauta_id = p_pauta_id;

  select count(*)
  into v_schedule_requirements
  from public.work_item_schedule_requirements as requirement
  join public.work_items as item
    on item.id = requirement.work_item_id
  where item.pauta_id = p_pauta_id;

  if to_regclass('public.internal_messages') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'internal_messages'
         and column_name = 'context_type'
     )
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'internal_messages'
         and column_name = 'context_id'
     )
  then
    execute
      $sql$
        select count(*)
        from public.internal_messages
        where context_type = 'pauta'
          and context_id = $1
      $sql$
    into v_internal_messages
    using p_pauta_id;
  end if;

  if to_regclass('public.avisos') is not null
     and exists (
       select 1
       from information_schema.columns
       where table_schema = 'public'
         and table_name = 'avisos'
         and column_name = 'work_item_id'
     )
  then
    execute
      $sql$
        select count(*)
        from public.avisos as aviso
        where aviso.work_item_id in (
          select item.id
          from public.work_items as item
          where item.pauta_id = $1
        )
      $sql$
    into v_notices
    using p_pauta_id;
  end if;

  select count(*)
  into v_blocking_events
  from public.pauta_events
  where pauta_id = p_pauta_id
    and action not in (
      'pauta_created'
    );

  return jsonb_build_object(
    'pauta_id', v_pauta.id,
    'board_id', v_pauta.board_id,
    'name', v_pauta.name,
    'lifecycle_status', v_pauta.lifecycle_status,
    'active_members', v_active_members,
    'removed_members', v_removed_members,
    'main_cards', v_main_cards,
    'extra_demands', v_extra_demands,
    'active_items', v_active_items,
    'calendar_events', v_calendar_events,
    'schedule_requirements', v_schedule_requirements,
    'internal_messages', v_internal_messages,
    'notices', v_notices,
    'blocking_events', v_blocking_events,
    'can_delete',
      v_active_members = 0
      and v_main_cards = 0
      and v_extra_demands = 0
      and v_calendar_events = 0
      and v_schedule_requirements = 0
      and v_internal_messages = 0
      and v_notices = 0
      and v_blocking_events = 0,
    'requested_by', v_actor
  );
end;
$_$;


ALTER FUNCTION "public"."pauta_dependency_summary"("p_pauta_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pauta_log_event"("p_pauta_id" "uuid", "p_board_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_target_type" "text", "p_target_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_event_id uuid;
  v_action text := trim(coalesce(p_action, ''));
  v_target_type text := coalesce(
    nullif(trim(p_target_type), ''),
    'pauta'
  );
begin
  if length(v_action) not between 2 and 80 then
    raise exception
      'Ação inválida para o histórico da Pauta.';
  end if;

  if v_target_type not in (
    'pauta',
    'client',
    'work_item',
    'member',
    'board'
  ) then
    raise exception
      'Tipo de alvo inválido para o histórico da Pauta.';
  end if;

  insert into public.pauta_events (
    pauta_id,
    board_id,
    actor_id,
    action,
    target_type,
    target_id,
    old_values,
    new_values,
    metadata
  )
  values (
    p_pauta_id,
    p_board_id,
    p_actor_id,
    v_action,
    v_target_type,
    p_target_id,
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."pauta_log_event"("p_pauta_id" "uuid", "p_board_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_target_type" "text", "p_target_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."pauta_management_actor"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
begin
  v_actor := public.pauta_current_active_actor();

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem alterar a estrutura da Pauta.';
  end if;

  return v_actor;
end;
$$;


ALTER FUNCTION "public"."pauta_management_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") RETURNS TABLE("work_item_id" "uuid", "client_id" "uuid", "client_name" "text", "column_id" "uuid", "status" "text", "internal_deadline" "date", "final_deadline" "date", "responsible_id" "uuid", "service_id" "uuid", "candidate_role" "text", "blocker" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
begin
  v_actor :=
    public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception
      'Pauta obrigatória.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception
      'Pauta não encontrada.';
  end if;

  return query
  with candidates as (
    select
      item.id as work_item_id,
      item.client_id,
      client.name as client_name,
      item.board_column_id as column_id,
      item.status::text as item_status,
      item.internal_deadline,
      item.final_deadline,
      item.responsible_id,
      item.client_service_id as service_id,
      client.status::text as client_status,

      count(*) over (
        partition by item.client_id
      ) as client_candidate_count,

      exists (
        select 1
        from public.pauta_members as member
        where member.pauta_id = p_pauta_id
          and member.client_id = item.client_id
          and member.membership_status = 'active'
      ) as already_in_pauta,

      exists (
        select 1
        from public.work_items as existing_main
        where existing_main.pauta_id = p_pauta_id
          and existing_main.client_id = item.client_id
          and existing_main.is_pauta_card = true
      ) as main_card_already_exists,

      (
        item.board_column_id is not null
        and column_row.id is not null
        and column_row.board_id = v_pauta.board_id
      ) as valid_column

    from public.work_items as item

    left join public.clients as client
      on client.id = item.client_id

    left join public.board_columns as column_row
      on column_row.id = item.board_column_id

    where item.board_id = v_pauta.board_id
      and item.pauta_id is null
      and item.is_pauta_card = false
      and item.pauta_card_id is null
      and item.status::text not in (
        'archived',
        'cancelled'
      )
  ),

  classified as (
    select
      candidate.*,

      nullif(
        concat_ws(
          '; ',

          case
            when candidate.client_id is null
              then 'WORK_ITEM_WITHOUT_CLIENT'
          end,

          case
            when candidate.client_id is not null
              and candidate.client_name is null
              then 'CLIENT_NOT_FOUND'
          end,

          case
            when candidate.client_name is not null
              and candidate.client_status
                is distinct from 'active'
              then 'INACTIVE_CLIENT'
          end,

          case
            when not candidate.valid_column
              then 'INVALID_BOARD_COLUMN'
          end,

          case
            when candidate.already_in_pauta
              then 'ALREADY_IN_PAUTA'
          end,

          case
            when candidate.main_card_already_exists
              then 'MAIN_CARD_ALREADY_EXISTS'
          end,

          case
            when candidate.client_candidate_count > 1
              then 'MULTIPLE_LEGACY_CANDIDATES'
          end,

          case
            when candidate.responsible_id is null
              then 'WARNING_MISSING_RESPONSIBLE'
          end,

          case
            when candidate.service_id is null
              then 'WARNING_MISSING_SERVICE'
          end
        ),
        ''
      ) as candidate_blocker

    from candidates as candidate
  )

  select
    classified.work_item_id,
    classified.client_id,
    classified.client_name,
    classified.column_id,
    classified.item_status,
    classified.internal_deadline,
    classified.final_deadline,
    classified.responsible_id,
    classified.service_id,

    case
      when classified.client_id is null
        or classified.client_name is null
        or classified.client_status
          is distinct from 'active'
        or not classified.valid_column
        or classified.already_in_pauta
        or classified.main_card_already_exists
        then 'BLOCKED'

      when classified.client_candidate_count > 1
        then 'REVIEW_REQUIRED'

      when classified.responsible_id is null
        or classified.service_id is null
        then 'MAIN_CANDIDATE_WITH_WARNINGS'

      else 'MAIN_CANDIDATE'
    end as candidate_role,

    classified.candidate_blocker

  from classified

  order by
    classified.client_name nulls last,
    classified.internal_deadline nulls last,
    classified.work_item_id;
end;
$$;


ALTER FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") IS 'Lista candidatos legados de uma Pauta sem alterar ou adotar work_items.';



CREATE OR REPLACE FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_clients jsonb := '[]'::jsonb;
  v_summary jsonb := '{}'::jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  if p_pauta_id is null then
    raise exception 'Pauta obrigatória.';
  end if;

  if p_client_ids is null
     or cardinality(p_client_ids) = 0
  then
    raise exception
      'Selecione pelo menos um cliente.';
  end if;

  if cardinality(p_client_ids) > 300 then
    raise exception
      'É permitido analisar no máximo 300 clientes por operação.';
  end if;

  if exists (
    select 1
    from unnest(p_client_ids) as selected(client_id)
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  if (
    select count(*)
    from unnest(p_client_ids)
  ) <> (
    select count(distinct client_id)
    from unnest(p_client_ids) as selected(client_id)
  ) then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  with selected_clients as (
    select distinct selected.client_id
    from unnest(p_client_ids) as selected(client_id)
  ),
  analyzed as (
    select
      selected.client_id,
      client.name as client_name,
      client.status as client_status,

      exists (
        select 1
        from public.pauta_members as member
        where member.pauta_id = p_pauta_id
          and member.client_id = selected.client_id
          and member.membership_status = 'active'
      ) as already_in_pauta,

      (
        select count(*)
        from public.work_items as item
        where item.board_id = v_pauta.board_id
          and item.pauta_id is null
          and item.client_id = selected.client_id
          and item.is_pauta_card = false
          and item.status not in (
            'archived',
            'cancelled'
          )
      ) as legacy_count,

      (
        select count(*)
        from public.client_services as service
        where service.client_id = selected.client_id
          and service.status = 'active'
      ) as active_service_count,

      (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'work_item_id', item.id,
              'title', item.title,
              'status', item.status,
              'priority', item.priority,
              'board_column_id', item.board_column_id,
              'responsible_id', item.responsible_id,
              'client_service_id', item.client_service_id,
              'internal_deadline', item.internal_deadline,
              'final_deadline', item.final_deadline,
              'created_at', item.created_at
            )
            order by item.created_at
          ),
          '[]'::jsonb
        )
        from public.work_items as item
        where item.board_id = v_pauta.board_id
          and item.pauta_id is null
          and item.client_id = selected.client_id
          and item.is_pauta_card = false
          and item.status not in (
            'archived',
            'cancelled'
          )
      ) as legacy_candidates
    from selected_clients as selected
    left join public.clients as client
      on client.id = selected.client_id
  ),
  classified as (
    select
      analyzed.*,
      case
        when client_name is null
          or client_status <> 'active'
          then 'INACTIVE_CLIENT'

        when already_in_pauta
          then 'ALREADY_IN_PAUTA'

        when legacy_count = 1
          then 'LEGACY_CARD_AVAILABLE'

        when legacy_count > 1
          then 'MULTIPLE_LEGACY_CARDS'

        when active_service_count = 0
          then 'NO_ACTIVE_SERVICE'

        else 'NO_LEGACY_CARD'
      end as classification
    from analyzed
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'client_id', client_id,
          'client_name', client_name,
          'client_status', client_status,
          'classification', classification,
          'already_in_pauta', already_in_pauta,
          'legacy_count', legacy_count,
          'legacy_candidates', legacy_candidates,
          'active_service_count', active_service_count,
          'service_warning',
            active_service_count = 0
        )
        order by client_name nulls last
      ),
      '[]'::jsonb
    ),

    jsonb_build_object(
      'total',
        count(*),

      'already_in_pauta',
        count(*) filter (
          where classification = 'ALREADY_IN_PAUTA'
        ),

      'legacy_card_available',
        count(*) filter (
          where classification = 'LEGACY_CARD_AVAILABLE'
        ),

      'multiple_legacy_cards',
        count(*) filter (
          where classification = 'MULTIPLE_LEGACY_CARDS'
        ),

      'no_legacy_card',
        count(*) filter (
          where classification = 'NO_LEGACY_CARD'
        ),

      'inactive_client',
        count(*) filter (
          where classification = 'INACTIVE_CLIENT'
        ),

      'no_active_service',
        count(*) filter (
          where classification = 'NO_ACTIVE_SERVICE'
        )
    )
  into
    v_clients,
    v_summary
  from classified;

  return jsonb_build_object(
    'pauta_id', p_pauta_id,
    'board_id', v_pauta.board_id,
    'clients', v_clients,
    'summary', v_summary,
    'requested_by', v_actor
  );
end;
$$;


ALTER FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) IS 'Classifica clientes antes de inclusão ou adoção para impedir cards duplicados.';



CREATE OR REPLACE FUNCTION "public"."recalculate_work_item_global_status"("p_work_item_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_item public.work_items%rowtype;
  v_active_count integer := 0;
  v_required_count integer := 0;
  v_all_complete boolean := false;
  v_next_status text := 'not_started';
  v_completed_at timestamptz;
  v_completed_by uuid;
  v_single_board_id uuid;
  v_single_column_id uuid;
begin
  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'WORK_ITEM_NOT_FOUND'
    );
  end if;

  select
    count(*),
    count(*) filter (where is_required)
  into
    v_active_count,
    v_required_count
  from public.work_item_board_assignments
  where work_item_id = p_work_item_id
    and assignment_status = 'active';

  if v_active_count = 0 then
    return jsonb_build_object(
      'success', true,
      'work_item_id', p_work_item_id,
      'assignments', 0,
      'status', v_item.status
    );
  end if;

  with effective as (
    select *
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
      and (
        v_required_count = 0
        or is_required = true
      )
  )
  select
    bool_and(public.v8_assignment_is_complete(operational_status)),
    max(completed_at),
    (
      array_agg(
        completed_by
        order by completed_at desc nulls last
      )
    )[1]
  into
    v_all_complete,
    v_completed_at,
    v_completed_by
  from effective;

  if coalesce(v_all_complete, false) then
    v_next_status := 'done';
  else
    with effective as (
      select *
      from public.work_item_board_assignments
      where work_item_id = p_work_item_id
        and assignment_status = 'active'
        and (
          v_required_count = 0
          or is_required = true
        )
    )
    select operational_status
    into v_next_status
    from effective
    where not public.v8_assignment_is_complete(operational_status)
    order by
      case operational_status
        when 'blocked' then 1
        when 'waiting' then 2
        when 'awaiting_approval' then 3
        when 'in_review' then 4
        when 'in_progress' then 5
        when 'scheduled' then 6
        when 'not_started' then 7
        else 8
      end,
      updated_at desc
    limit 1;

    v_next_status := coalesce(v_next_status, 'not_started');
    v_completed_at := null;
    v_completed_by := null;
  end if;

  if v_item.pauta_id is not null then
    select pauta_row.board_id
    into v_single_board_id
    from public.pautas pauta_row
    where pauta_row.id = v_item.pauta_id;

    v_single_column_id := v_item.board_column_id;
  elsif v_active_count = 1 then
    select board_id, board_column_id
    into v_single_board_id, v_single_column_id
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
    limit 1;
  else
    v_single_board_id := null;
    v_single_column_id := null;
  end if;

  update public.work_items
  set
    status = v_next_status,
    completed_at =
      case
        when v_next_status = 'done'
          then coalesce(v_completed_at, now())
        else null
      end,
    completed_by =
      case
        when v_next_status = 'done'
          then v_completed_by
        else null
      end,
    closed_at =
      case
        when v_next_status = 'done'
          then coalesce(v_completed_at, now())
        else null
      end,
    board_id = v_single_board_id,
    board_column_id = v_single_column_id,
    updated_at = now()
  where id = p_work_item_id;

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'assignments', v_active_count,
    'required_assignments', v_required_count,
    'status', v_next_status
  );
end;
$$;


ALTER FUNCTION "public"."recalculate_work_item_global_status"("p_work_item_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_member public.pauta_members%rowtype;
  v_client_name text;
  v_item record;
  v_detached integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR CLIENTE' then
    raise exception
      'Confirmação inválida. Digite RETIRAR CLIENTE.';
  end if;

  if p_client_id is null then
    raise exception 'Cliente obrigatório.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in (
    'draft',
    'open'
  ) then
    raise exception
      'Somente Pautas abertas ou em rascunho podem retirar clientes.';
  end if;

  select name
  into v_client_name
  from public.clients
  where id = p_client_id;

  if not found then
    raise exception 'Cliente não encontrado.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where pauta_id = p_pauta_id
    and client_id = p_client_id
    and membership_status = 'active'
  order by added_at desc
  limit 1
  for update;

  if not found then
    raise exception
      'O cliente não possui participação ativa nesta Pauta.';
  end if;

  update public.calendar_events as event
  set
    pauta_id = null,
    updated_at = now()
  where event.pauta_id = p_pauta_id
    and (
      event.client_id = p_client_id
      or event.work_item_id in (
        select item.id
        from public.work_items as item
        where item.pauta_id = p_pauta_id
          and (
            item.client_id = p_client_id
            or item.pauta_card_id = v_member.main_work_item_id
            or item.id = v_member.main_work_item_id
          )
      )
    );

  for v_item in
    select
      item.id,
      item.is_pauta_card,
      item.pauta_card_id,
      item.board_id,
      item.board_column_id,
      item.destino
    from public.work_items as item
    where item.pauta_id = p_pauta_id
      and (
        item.client_id = p_client_id
        or item.pauta_card_id = v_member.main_work_item_id
        or item.id = v_member.main_work_item_id
      )
    for update
  loop
    update public.work_items
    set
      pauta_id = null,
      pauta_card_id = null,
      is_pauta_card = false,
      board_id = null,
      board_column_id = null,
      destino = 'avulsa',
      updated_at = now()
    where id = v_item.id;

    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_item.id,
      v_actor,
      case
        when v_item.is_pauta_card
          then 'client_removed_from_pauta'
        else 'removed_from_pauta'
      end,
      jsonb_build_object(
        'pauta_id', p_pauta_id,
        'is_pauta_card', v_item.is_pauta_card,
        'pauta_card_id', v_item.pauta_card_id,
        'board_id', v_item.board_id,
        'board_column_id', v_item.board_column_id,
        'destino', v_item.destino
      )::text,
      jsonb_build_object(
        'pauta_id', null,
        'is_pauta_card', false,
        'pauta_card_id', null,
        'board_id', null,
        'board_column_id', null,
        'destino', 'avulsa'
      )::text
    );

    v_detached := v_detached + 1;
  end loop;

  update public.pauta_members
  set
    membership_status = 'removed',
    removed_by = v_actor,
    removed_at = now(),
    metadata =
      coalesce(metadata, '{}'::jsonb)
      ||
      jsonb_build_object(
        'items_preserved_as_extra',
        v_detached,
        'removed_from_pauta_at',
        now()
      )
  where id = v_member.id;

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'client_removed',
    'client',
    p_client_id,
    jsonb_build_object(
      'member_id', v_member.id,
      'main_work_item_id', v_member.main_work_item_id,
      'client_name', v_client_name
    ),
    jsonb_build_object(
      'membership_status', 'removed',
      'items_preserved_as_extra', v_detached
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'client_id', p_client_id,
    'member_id', v_member.id,
    'items_preserved_as_extra', v_detached
  );
end;
$$;


ALTER FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") IS 'Retira um participante e preserva todos os work_items relacionados como Extras.';



CREATE OR REPLACE FUNCTION "public"."remove_pauta_clients_batch"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_client_id uuid;
  v_removed integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR CLIENTES' then
    raise exception
      'Confirmação inválida. Digite RETIRAR CLIENTES.';
  end if;

  if p_client_ids is null or cardinality(p_client_ids) = 0 then
    raise exception 'Selecione pelo menos um cliente.';
  end if;

  for v_client_id in
    select distinct unnest(p_client_ids)
  loop
    perform public.remove_client_from_pauta(
      p_pauta_id,
      v_client_id,
      'RETIRAR CLIENTE'
    );

    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'clients_removed', v_removed,
    'actor_id', v_actor
  );
end;
$$;


ALTER FUNCTION "public"."remove_pauta_clients_batch"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_pauta_demands_batch"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_work_item_id uuid;
  v_removed integer := 0;
begin
  v_actor := public.pauta_management_actor();

  if trim(coalesce(p_confirmation, '')) <> 'RETIRAR DEMANDAS' then
    raise exception
      'Confirmação inválida. Digite RETIRAR DEMANDAS.';
  end if;

  if p_work_item_ids is null or cardinality(p_work_item_ids) = 0 then
    raise exception 'Selecione pelo menos uma demanda.';
  end if;

  for v_work_item_id in
    select distinct unnest(p_work_item_ids)
  loop
    perform public.detach_pauta_demand(
      p_pauta_id,
      v_work_item_id,
      'RETIRAR DEMANDA'
    );

    v_removed := v_removed + 1;
  end loop;

  return jsonb_build_object(
    'success', true,
    'demands_removed', v_removed,
    'actor_id', v_actor
  );
end;
$$;


ALTER FUNCTION "public"."remove_pauta_demands_batch"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
$$;


ALTER FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") IS 'V9.2C: remove somente demandas adicionais; protege cards principais da Pauta.';



CREATE OR REPLACE FUNCTION "public"."remove_work_item_board_assignment"("p_assignment_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_role text;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para remover esta associação.';
  end if;

  v_old := jsonb_build_object(
    'assignment_status', v_assignment.assignment_status,
    'board_id', v_assignment.board_id,
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at
  );

  update public.work_item_board_assignments
  set
    assignment_status = 'removed',
    removed_at = now(),
    removed_by = v_actor,
    completed_at = null,
    completed_by = null,
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object(
        'removal_note',
        nullif(trim(coalesce(p_note, '')), '')
      ),
    updated_at = now()
  where id = p_assignment_id
  returning *
  into v_assignment;

  v_new := jsonb_build_object(
    'assignment_status', v_assignment.assignment_status,
    'board_id', v_assignment.board_id,
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'removed_at', v_assignment.removed_at,
    'removed_by', v_assignment.removed_by
  );

  perform public.v8_log_assignment_event(
    v_assignment.id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    v_assignment.board_column_id,
    v_actor,
    'assignment_removed',
    v_old,
    v_new,
    jsonb_build_object(
      'note',
      nullif(trim(coalesce(p_note, '')), '')
    )
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      'assignment_removed',
      'work_item',
      v_item.id,
      v_old,
      v_new,
      jsonb_build_object(
        'assignment_id', v_assignment.id,
        'note', nullif(trim(coalesce(p_note, '')), '')
      )
    );
  end if;

  perform public.recalculate_work_item_global_status(
    v_assignment.work_item_id
  );

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'work_item_id', v_assignment.work_item_id,
    'board_id', v_assignment.board_id,
    'removed', true
  );
end;
$$;


ALTER FUNCTION "public"."remove_work_item_board_assignment"("p_assignment_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_board_default_columns"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.board_columns (
    board_id,
    name,
    color,
    operational_status,
    position
  )
  VALUES
    (NEW.id, 'A fazer', '#64748B', 'not_started', 0),
    (NEW.id, 'Em andamento', '#2563EB', 'in_progress', 1),
    (NEW.id, 'Aguardando', '#CA8A04', 'waiting', 2),
    (NEW.id, 'Em revisão', '#7C3AED', 'in_review', 3),
    (NEW.id, 'Concluído', '#16A34A', 'done', 4)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."seed_board_default_columns"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_project_step_statuses_for_work_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.destino IN ('projeto', 'ambos')
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_step_statuses existing
      WHERE existing.work_item_id = NEW.id
        AND existing.is_archived = false
    )
  THEN
    INSERT INTO public.project_step_statuses (
      work_item_id,
      name,
      color,
      behavior,
      position
    )
    VALUES
      (
        NEW.id,
        'A fazer',
        '#64748B',
        'pending',
        0
      ),
      (
        NEW.id,
        'Em andamento',
        '#7C3AED',
        'active',
        1
      ),
      (
        NEW.id,
        'Aguardando',
        '#D97706',
        'blocked',
        2
      ),
      (
        NEW.id,
        'Concluído',
        '#16A34A',
        'done',
        3
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."seed_project_step_statuses_for_work_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_avisos_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_avisos_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_calendar_event_completion"("p_event_id" "uuid", "p_completed" boolean, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_role text;
  v_event public.calendar_events%rowtype;
  v_old jsonb;
  v_new jsonb;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_event
  from public.calendar_events
  where id = p_event_id
  for update;

  if not found then
    raise exception 'Agenda não encontrada.';
  end if;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_event.responsible_id is distinct from v_actor
     and v_event.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta agenda.';
  end if;

  v_old := jsonb_build_object(
    'completion_status', v_event.completion_status,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by,
    'completion_note', v_event.completion_note
  );

  update public.calendar_events
  set
    completion_status = case when p_completed then 'completed' else 'open' end,
    completed_at = case when p_completed then now() else null end,
    completed_by = case when p_completed then v_actor else null end,
    completion_note = case
      when p_completed then nullif(trim(coalesce(p_note, '')), '')
      else null
    end,
    updated_at = now()
  where id = p_event_id
  returning *
  into v_event;

  v_new := jsonb_build_object(
    'completion_status', v_event.completion_status,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by,
    'completion_note', v_event.completion_note
  );

  insert into public.calendar_event_history (
    event_id,
    actor_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_event_id,
    v_actor,
    case when p_completed then 'completed' else 'reopened' end,
    v_old,
    v_new,
    jsonb_build_object('work_item_id', v_event.work_item_id)
  );

  if v_event.work_item_id is not null then
    insert into public.work_item_history (
      work_item_id,
      actor_id,
      field_changed,
      old_value,
      new_value
    )
    values (
      v_event.work_item_id,
      v_actor,
      case
        when p_completed then 'calendar_event_completed'
        else 'calendar_event_reopened'
      end,
      v_old::text,
      v_new::text
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'event_id', p_event_id,
    'completed', p_completed,
    'completed_at', v_event.completed_at,
    'completed_by', v_event.completed_by
  );
end;
$$;


ALTER FUNCTION "public"."set_calendar_event_completion"("p_event_id" "uuid", "p_completed" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_internal_messages_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_internal_messages_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_team_members_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_team_members_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_work_item_board_assignment_completion"("p_assignment_id" "uuid", "p_completed" boolean, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_role text;
  v_assignment public.work_item_board_assignments%rowtype;
  v_item public.work_items%rowtype;
  v_target public.board_columns%rowtype;
  v_old jsonb;
  v_new jsonb;
  v_action text;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_assignment
  from public.work_item_board_assignments
  where id = p_assignment_id
    and assignment_status = 'active'
  for update;

  if not found then
    raise exception 'Distribuição ativa não encontrada.';
  end if;

  select *
  into v_item
  from public.work_items
  where id = v_assignment.work_item_id
  for update;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta etapa.';
  end if;

  v_old := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  if p_completed then
    select *
    into v_target
    from public.board_columns
    where board_id = v_assignment.board_id
      and operational_status in ('done', 'delivered', 'approved')
    order by position
    limit 1;

    update public.work_item_board_assignments
    set
      board_column_id = coalesce(v_target.id, board_column_id),
      operational_status = coalesce(v_target.operational_status, 'done'),
      completed_at = now(),
      completed_by = v_actor,
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object('completion_note', nullif(trim(coalesce(p_note, '')), '')),
      updated_at = now()
    where id = p_assignment_id
    returning *
    into v_assignment;

    v_action := 'assignment_completed';
  else
    select *
    into v_target
    from public.board_columns
    where board_id = v_assignment.board_id
      and operational_status not in ('done', 'delivered', 'approved')
    order by position
    limit 1;

    update public.work_item_board_assignments
    set
      board_column_id = coalesce(v_target.id, board_column_id),
      operational_status = coalesce(v_target.operational_status, 'in_progress'),
      completed_at = null,
      completed_by = null,
      metadata = coalesce(metadata, '{}'::jsonb)
        - 'completion_note',
      updated_at = now()
    where id = p_assignment_id
    returning *
    into v_assignment;

    v_action := 'assignment_reopened';
  end if;

  v_new := jsonb_build_object(
    'board_column_id', v_assignment.board_column_id,
    'operational_status', v_assignment.operational_status,
    'completed_at', v_assignment.completed_at,
    'completed_by', v_assignment.completed_by
  );

  perform public.v8_log_assignment_event(
    v_assignment.id,
    v_assignment.work_item_id,
    v_item.pauta_id,
    v_assignment.board_id,
    v_assignment.board_column_id,
    v_actor,
    v_action,
    v_old,
    v_new,
    jsonb_build_object('note', nullif(trim(coalesce(p_note, '')), ''))
  );

  if v_item.pauta_id is not null then
    perform public.pauta_log_event(
      v_item.pauta_id,
      v_assignment.board_id,
      v_actor,
      v_action,
      'work_item',
      v_item.id,
      v_old,
      v_new,
      jsonb_build_object('assignment_id', v_assignment.id)
    );
  end if;

  perform public.recalculate_work_item_global_status(v_assignment.work_item_id);

  return jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'work_item_id', v_assignment.work_item_id,
    'completed', p_completed,
    'completed_at', v_assignment.completed_at
  );
end;
$$;


ALTER FUNCTION "public"."set_work_item_board_assignment_completion"("p_assignment_id" "uuid", "p_completed" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_work_item_completion"("p_work_item_id" "uuid", "p_completed" boolean, "p_complete_assignments" boolean DEFAULT true, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_role text;
  v_item public.work_items%rowtype;
  v_assignment record;
  v_assignment_count integer := 0;
  v_old_status text;
begin
  v_actor := public.pauta_current_active_actor();

  select role
  into v_role
  from public.profiles
  where id = v_actor
    and is_active = true;

  select *
  into v_item
  from public.work_items
  where id = p_work_item_id
  for update;

  if not found then
    raise exception 'Demanda não encontrada.';
  end if;

  if not public.app_has_total_access()
     and coalesce(v_role, '') not in ('admin', 'director', 'manager', 'team_lead')
     and v_item.responsible_id is distinct from v_actor
     and v_item.created_by is distinct from v_actor
  then
    raise exception 'Você não possui permissão para concluir esta demanda.';
  end if;

  v_old_status := v_item.status;

  select count(*)
  into v_assignment_count
  from public.work_item_board_assignments
  where work_item_id = p_work_item_id
    and assignment_status = 'active';

  if v_assignment_count > 0 and not p_complete_assignments then
    raise exception 'Esta demanda possui etapas em Quadros. Conclua as etapas ou confirme a conclusão completa.';
  end if;

  if v_assignment_count > 0 then
    for v_assignment in
      select id
      from public.work_item_board_assignments
      where work_item_id = p_work_item_id
        and assignment_status = 'active'
      order by assigned_at
    loop
      perform public.set_work_item_board_assignment_completion(
        v_assignment.id,
        p_completed,
        p_note
      );
    end loop;
  else
    update public.work_items
    set
      status = case when p_completed then 'done' else 'not_started' end,
      completed_at = case when p_completed then now() else null end,
      completed_by = case when p_completed then v_actor else null end,
      closed_at = case when p_completed then now() else null end,
      close_reason = case
        when p_completed then nullif(trim(coalesce(p_note, '')), '')
        else null
      end,
      updated_at = now()
    where id = p_work_item_id;
  end if;

  insert into public.work_item_history (
    work_item_id,
    actor_id,
    field_changed,
    old_value,
    new_value
  )
  values (
    p_work_item_id,
    v_actor,
    case when p_completed then 'completed' else 'reopened' end,
    v_old_status,
    jsonb_build_object(
      'status', case when p_completed then 'done' else 'not_started' end,
      'note', nullif(trim(coalesce(p_note, '')), ''),
      'assignments', v_assignment_count,
      'explicit_action', true
    )::text
  );

  return jsonb_build_object(
    'success', true,
    'work_item_id', p_work_item_id,
    'completed', p_completed,
    'assignments_updated', v_assignment_count,
    'explicit_action', true
  );
end;
$$;


ALTER FUNCTION "public"."set_work_item_completion"("p_work_item_id" "uuid", "p_completed" boolean, "p_complete_assignments" boolean, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_calendar_event_pauta"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_work_item_pauta_id uuid;
begin
  if new.work_item_id is not null then
    select item.pauta_id
      into v_work_item_pauta_id
    from public.work_items as item
    where item.id = new.work_item_id;

    if not found then
      raise exception
        'Demanda vinculada à agenda não encontrada.';
    end if;

    if new.pauta_id is not null
       and new.pauta_id is distinct from v_work_item_pauta_id then
      raise exception
        'A Pauta da agenda não corresponde à Pauta da demanda vinculada.';
    end if;

    new.pauta_id := v_work_item_pauta_id;
  end if;

  if new.pauta_id is not null
     and not exists (
       select 1
       from public.pautas as pauta
       where pauta.id = new.pauta_id
         and pauta.archived_at is null
     ) then
    raise exception
      'A Pauta vinculada à agenda não está disponível.';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_calendar_event_pauta"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_old_requirement_type text;
  v_new_requirement_type text;

  v_existing_event_id uuid;
  v_actor uuid;
begin
  -- -------------------------------------------------------
  -- Exclusão do evento
  -- -------------------------------------------------------

  if tg_op = 'DELETE' then
    v_old_requirement_type :=
      case
        when old.type = 'reu_a'
          then 'alignment_meeting'

        when old.type in (
          'cap_e',
          'cap_s'
        )
          then 'capture'

        else null
      end;

    if
      old.work_item_id is not null
      and v_old_requirement_type is not null
    then
      update
        public.work_item_schedule_requirements
      set
        status = 'pending',
        calendar_event_id = null,
        scheduled_at = null,
        confirmed_at = null,
        completed_at = null,
        updated_at = now()
      where
        work_item_id = old.work_item_id
        and requirement_type =
          v_old_requirement_type
        and calendar_event_id = old.id;
    end if;

    return old;
  end if;

  -- -------------------------------------------------------
  -- Inserção ou atualização do evento
  -- -------------------------------------------------------

  v_new_requirement_type :=
    case
      when new.type = 'reu_a'
        then 'alignment_meeting'

      when new.type in (
        'cap_e',
        'cap_s'
      )
        then 'capture'

      else null
    end;

  if tg_op = 'UPDATE' then
    v_old_requirement_type :=
      case
        when old.type = 'reu_a'
          then 'alignment_meeting'

        when old.type in (
          'cap_e',
          'cap_s'
        )
          then 'capture'

        else null
      end;

    if
      old.work_item_id is not null
      and v_old_requirement_type is not null
      and (
        new.work_item_id is distinct from
          old.work_item_id

        or v_new_requirement_type is distinct from
          v_old_requirement_type
      )
    then
      update
        public.work_item_schedule_requirements
      set
        status = 'pending',
        calendar_event_id = null,
        scheduled_at = null,
        confirmed_at = null,
        completed_at = null,
        updated_at = now()
      where
        work_item_id = old.work_item_id
        and requirement_type =
          v_old_requirement_type
        and calendar_event_id = old.id;
    end if;
  end if;

  -- Tipos que não representam reunião ou captação
  -- não alteram requisitos operacionais.
  if
    new.work_item_id is null
    or v_new_requirement_type is null
  then
    return new;
  end if;

  select
    calendar_event_id
  into
    v_existing_event_id
  from
    public.work_item_schedule_requirements
  where
    work_item_id = new.work_item_id
    and requirement_type =
      v_new_requirement_type
  for update;

  if
    found
    and v_existing_event_id is not null
    and v_existing_event_id <> new.id
  then
    raise exception
      'Esta demanda já possui uma agenda principal de % vinculada.',
      case
        when v_new_requirement_type =
          'alignment_meeting'
          then 'reunião'

        else 'captação'
      end;
  end if;

  v_actor :=
    coalesce(
      new.created_by,
      auth.uid()
    );

  insert into
    public.work_item_schedule_requirements (
      work_item_id,
      requirement_type,
      status,
      calendar_event_id,
      calendar_type,
      created_by,
      scheduled_at,
      confirmed_at,
      completed_at,
      created_at,
      updated_at
    )
  values (
    new.work_item_id,
    v_new_requirement_type,

    case
      when coalesce(
        new.confirmed,
        false
      )
        then 'confirmed'

      else 'scheduled'
    end,

    new.id,
    new.type,
    v_actor,
    new.starts_at,

    case
      when coalesce(
        new.confirmed,
        false
      )
        then now()

      else null
    end,

    null,
    now(),
    now()
  )
  on conflict (
    work_item_id,
    requirement_type
  )
  do update
  set
    status =
      case
        when coalesce(
          new.confirmed,
          false
        )
          then 'confirmed'

        else 'scheduled'
      end,

    calendar_event_id =
      new.id,

    calendar_type =
      new.type,

    scheduled_at =
      new.starts_at,

    confirmed_at =
      case
        when coalesce(
          new.confirmed,
          false
        )
          then coalesce(
            public
              .work_item_schedule_requirements
              .confirmed_at,
            now()
          )

        else null
      end,

    completed_at =
      null,

    updated_at =
      now();

  return new;
end;
$$;


ALTER FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_pauta_members_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_pauta_members_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_pautas_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."touch_pautas_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_project_step_statuses_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_project_step_statuses_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pauta_member_target_date"("p_member_id" "uuid", "p_target_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_member public.pauta_members%rowtype;
  v_pauta public.pautas%rowtype;
  v_old_date date;
begin
  v_actor := public.pauta_management_actor();

  if p_target_date is null then
    raise exception 'Informe uma data-meta válida.';
  end if;

  select *
  into v_member
  from public.pauta_members
  where id = p_member_id
    and membership_status = 'active'
  for update;

  if not found then
    raise exception 'Participação ativa não encontrada.';
  end if;

  select *
  into v_pauta
  from public.pautas
  where id = v_member.pauta_id
  for update;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem alterar a data-meta.';
  end if;

  v_old_date := v_member.target_date;

  update public.pauta_members
  set
    target_date = p_target_date,
    target_date_updated_at = now(),
    target_date_updated_by = v_actor,
    updated_at = now()
  where id = p_member_id;

  update public.work_items
  set
    final_deadline = p_target_date,
    internal_deadline = v_pauta.magic_number_date,
    updated_at = now()
  where id = v_member.main_work_item_id;

  perform public.pauta_log_event(
    v_member.pauta_id,
    v_pauta.board_id,
    v_actor,
    'client_target_date_updated',
    'member',
    p_member_id,
    jsonb_build_object(
      'target_date', v_old_date
    ),
    jsonb_build_object(
      'target_date', p_target_date,
      'client_id', v_member.client_id
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'target_date', p_target_date
  );
end;
$$;


ALTER FUNCTION "public"."update_pauta_member_target_date"("p_member_id" "uuid", "p_target_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_pauta public.pautas%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_old_values jsonb;
  v_new_values jsonb;
  v_updated_cards integer := 0;
begin
  v_actor := public.pauta_management_actor();

  select *
  into v_pauta
  from public.pautas
  where id = p_pauta_id
  for update;

  if not found then
    raise exception 'Pauta não encontrada.';
  end if;

  if v_pauta.lifecycle_status not in ('draft', 'open') then
    raise exception
      'Somente Pautas abertas ou em rascunho podem ser editadas.';
  end if;

  if length(v_name) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if p_magic_number_date is null
     or p_scheduled_until_date is null
  then
    raise exception
      'Magic Number e Programado até são obrigatórios.';
  end if;

  if p_magic_number_date > p_scheduled_until_date then
    raise exception
      'O Magic Number não pode ser posterior à data Programado até.';
  end if;

  v_old_values := jsonb_build_object(
    'name', v_pauta.name,
    'magic_number_date', v_pauta.magic_number_date,
    'scheduled_until_date', v_pauta.scheduled_until_date
  );

  update public.pautas
  set
    name = v_name,
    magic_number_date = p_magic_number_date,
    scheduled_until_date = p_scheduled_until_date,
    updated_at = now()
  where id = p_pauta_id;

  update public.work_items item
  set
    internal_deadline = p_magic_number_date,
    final_deadline = coalesce(
      member.target_date,
      p_scheduled_until_date
    ),
    updated_at = now()
  from public.pauta_members member
  where member.pauta_id = p_pauta_id
    and member.membership_status = 'active'
    and item.id = member.main_work_item_id
    and item.status not in ('archived', 'cancelled');

  get diagnostics v_updated_cards = row_count;

  v_new_values := jsonb_build_object(
    'name', v_name,
    'magic_number_date', p_magic_number_date,
    'scheduled_until_date', p_scheduled_until_date
  );

  perform public.pauta_log_event(
    p_pauta_id,
    v_pauta.board_id,
    v_actor,
    'settings_updated',
    'pauta',
    p_pauta_id,
    v_old_values,
    v_new_values,
    jsonb_build_object(
      'main_cards_updated', v_updated_cards,
      'individual_target_dates_preserved', true
    )
  );

  return jsonb_build_object(
    'success', true,
    'pauta_id', p_pauta_id,
    'cards_updated', v_updated_cards,
    'settings', v_new_values
  );
end;
$$;


ALTER FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") IS 'Edita nome, Magic Number e Programado até e sincroniza somente os cards principais.';



CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v8_assignment_after_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_work_item_global_status(old.work_item_id);
    return old;
  end if;

  perform public.recalculate_work_item_global_status(new.work_item_id);

  if tg_op = 'UPDATE'
     and old.work_item_id is distinct from new.work_item_id
  then
    perform public.recalculate_work_item_global_status(old.work_item_id);
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."v8_assignment_after_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v8_assignment_is_complete"("p_status" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select coalesce(p_status, '') in ('done', 'delivered', 'approved');
$$;


ALTER FUNCTION "public"."v8_assignment_is_complete"("p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v8_log_assignment_event"("p_assignment_id" "uuid", "p_work_item_id" "uuid", "p_pauta_id" "uuid", "p_board_id" "uuid", "p_board_column_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_event_id uuid;
begin
  insert into public.work_item_board_assignment_events (
    assignment_id,
    work_item_id,
    pauta_id,
    board_id,
    board_column_id,
    actor_id,
    action,
    old_values,
    new_values,
    metadata
  )
  values (
    p_assignment_id,
    p_work_item_id,
    p_pauta_id,
    p_board_id,
    p_board_column_id,
    p_actor_id,
    trim(p_action),
    coalesce(p_old_values, '{}'::jsonb),
    coalesce(p_new_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id
  into v_event_id;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."v8_log_assignment_event"("p_assignment_id" "uuid", "p_work_item_id" "uuid", "p_pauta_id" "uuid", "p_board_id" "uuid", "p_board_column_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v8_sync_assignment_from_work_item"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_actor uuid;
  v_old_custom boolean := false;
  v_new_custom boolean := false;
  v_new_status text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  v_actor := coalesce(
    auth.uid(),
    new.created_by,
    new.responsible_id
  );

  if tg_op = 'UPDATE' and old.board_id is not null then
    select exists(
      select 1
      from public.boards
      where id = old.board_id
        and board_kind = 'custom'
    )
    into v_old_custom;
  end if;

  if new.board_id is not null then
    select exists(
      select 1
      from public.boards
      where id = new.board_id
        and board_kind = 'custom'
        and status = 'active'
    )
    into v_new_custom;
  end if;

  if new.status in ('archived', 'cancelled')
     or (
       tg_op = 'UPDATE'
       and old.pauta_id is not null
       and new.pauta_id is null
     )
  then
    update public.work_item_board_assignments
    set
      assignment_status = 'removed',
      removed_at = now(),
      removed_by = v_actor,
      updated_at = now(),
      metadata =
        metadata ||
        jsonb_build_object(
          'removed_by_work_item_sync', true
        )
    where work_item_id = new.id
      and assignment_status = 'active';

    return new;
  end if;

  if tg_op = 'UPDATE'
     and v_old_custom
     and (
       old.board_id is distinct from new.board_id
       or old.board_column_id is distinct from new.board_column_id
     )
  then
    update public.work_item_board_assignments
    set
      assignment_status = 'removed',
      removed_at = now(),
      removed_by = v_actor,
      updated_at = now()
    where work_item_id = new.id
      and board_id = old.board_id
      and assignment_status = 'active';
  end if;

  if v_new_custom and new.board_column_id is not null then
    select operational_status
    into v_new_status
    from public.board_columns
    where id = new.board_column_id
      and board_id = new.board_id;

    if v_new_status is not null then
      insert into public.work_item_board_assignments (
        work_item_id,
        board_id,
        board_column_id,
        operational_status,
        is_required,
        assignment_status,
        position,
        assigned_by,
        assigned_at,
        completed_by,
        completed_at,
        metadata
      )
      values (
        new.id,
        new.board_id,
        new.board_column_id,
        coalesce(v_new_status, new.status, 'not_started'),
        true,
        'active',
        extract(epoch from now())::bigint,
        v_actor,
        coalesce(new.created_at, now()),
        case
          when public.v8_assignment_is_complete(
            coalesce(v_new_status, new.status)
          )
            then new.completed_by
          else null
        end,
        case
          when public.v8_assignment_is_complete(
            coalesce(v_new_status, new.status)
          )
            then coalesce(new.completed_at, now())
          else null
        end,
        jsonb_build_object(
          'source', 'legacy_dual_write'
        )
      )
      on conflict (work_item_id, board_id)
      where assignment_status = 'active'
      do update set
        board_column_id = excluded.board_column_id,
        operational_status = excluded.operational_status,
        completed_by = excluded.completed_by,
        completed_at = excluded.completed_at,
        updated_at = now();
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."v8_sync_assignment_from_work_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."v9_prepare_simple_assignment_card"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if coalesce(new.metadata ->> 'source', '') in (
    'pauta_distribution',
    'pauta_existing_distribution'
  ) then
    new.metadata :=
      coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'display_mode', 'simple',
        'card_scope', 'sector'
      );
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."v9_prepare_simple_assignment_card"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."approvals" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "sent_by" "uuid",
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deadline" "date",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "feedback" "text",
    "drive_link" "text",
    "responded_at" timestamp with time zone,
    CONSTRAINT "approvals_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'changes_requested'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "before_data" "jsonb",
    "after_data" "jsonb",
    "ip" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."avisos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "category" "text" DEFAULT 'operational'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source_module" "text",
    "source_table" "text",
    "source_id" "uuid",
    "source_url" "text",
    "action_label" "text",
    "related_entity_type" "text",
    "related_entity_id" "uuid",
    "dedupe_key" "text",
    "client_id" "uuid",
    "work_item_id" "uuid",
    "feed_board_id" "uuid",
    "feed_board_item_id" "uuid",
    "feed_board_event_id" "uuid",
    "due_at" timestamp with time zone,
    "reminder_at" timestamp with time zone,
    "read_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_by" "uuid",
    "assigned_to" "uuid",
    "is_auto" boolean DEFAULT true NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_team_member_id" "uuid",
    "assigned_email" "text",
    "assigned_area" "text",
    "assigned_role" "text",
    "notify_by_email" boolean DEFAULT false NOT NULL,
    "email_notified_at" timestamp with time zone,
    CONSTRAINT "avisos_category_check" CHECK (("category" = ANY (ARRAY['approval'::"text", 'adjustment'::"text", 'demand'::"text", 'planning'::"text", 'agenda'::"text", 'client'::"text", 'project'::"text", 'board'::"text", 'communication'::"text", 'manual'::"text", 'operational'::"text"]))),
    CONSTRAINT "avisos_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "avisos_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'read'::"text", 'archived'::"text", 'deleted'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."avisos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."blockers" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "reason" "text" NOT NULL,
    "responsible_id" "uuid",
    "deadline" "date",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "resolution_note" "text",
    "resolved_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "blockers_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'resolved'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."blockers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."board_columns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#2563EB'::"text" NOT NULL,
    "operational_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "automation_role" "text",
    CONSTRAINT "board_columns_automation_role_check" CHECK ((("automation_role" IS NULL) OR ("automation_role" = ANY (ARRAY['alignment'::"text", 'planning'::"text", 'capture'::"text", 'production'::"text", 'organization'::"text", 'approval'::"text", 'programming'::"text", 'completed'::"text", 'legacy_metrics'::"text"])))),
    CONSTRAINT "board_columns_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 60))),
    CONSTRAINT "board_columns_status_check" CHECK (("operational_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'waiting'::"text", 'blocked'::"text", 'in_review'::"text", 'awaiting_approval'::"text", 'approved'::"text", 'scheduled'::"text", 'delivered'::"text", 'done'::"text", 'cancelled'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."board_columns" OWNER TO "postgres";


COMMENT ON COLUMN "public"."board_columns"."automation_role" IS 'Papel técnico usado por automações. O nome visível da coluna continua editável.';



CREATE TABLE IF NOT EXISTS "public"."boards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#2563EB'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "board_kind" "text" DEFAULT 'custom'::"text" NOT NULL,
    CONSTRAINT "boards_board_kind_check" CHECK (("board_kind" = ANY (ARRAY['pauta'::"text", 'custom'::"text"]))),
    CONSTRAINT "boards_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 2) AND ("char_length"(TRIM(BOTH FROM "name")) <= 80))),
    CONSTRAINT "boards_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."boards" OWNER TO "postgres";


COMMENT ON COLUMN "public"."boards"."board_kind" IS 'pauta = quadro operacional mensal; custom = quadro livre/personalizado';



CREATE TABLE IF NOT EXISTS "public"."calendar_event_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "old_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_event_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."calendar_event_history" IS 'Histórico auditável de conclusão e reabertura das agendas.';



CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "type" "text" DEFAULT 'meeting'::"text" NOT NULL,
    "client_id" "uuid",
    "work_item_id" "uuid",
    "responsible_id" "uuid",
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "location" "text",
    "notes" "text",
    "confirmed" boolean DEFAULT false NOT NULL,
    "drive_link" "text",
    "external_url" "text",
    "google_event_id" "text",
    "google_calendar_id" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "all_day" boolean DEFAULT false NOT NULL,
    "color" "text",
    "recurrence_rule" "text",
    "source" "text" DEFAULT 'internal'::"text" NOT NULL,
    "series_id" "uuid",
    "series_sequence" integer DEFAULT 0 NOT NULL,
    "recurrence_until" "date",
    "auto_recurrence" boolean DEFAULT false NOT NULL,
    "custom_name" "text",
    "pauta_id" "uuid",
    "completion_status" "text" DEFAULT 'open'::"text" NOT NULL,
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "completion_note" "text",
    CONSTRAINT "calendar_events_completion_state_chk" CHECK (((("completion_status" = 'completed'::"text") AND ("completed_at" IS NOT NULL)) OR (("completion_status" = 'open'::"text") AND ("completed_at" IS NULL) AND ("completed_by" IS NULL)))),
    CONSTRAINT "calendar_events_completion_status_chk" CHECK (("completion_status" = ANY (ARRAY['open'::"text", 'completed'::"text"]))),
    CONSTRAINT "calendar_events_type_check" CHECK (("type" = ANY (ARRAY['meeting'::"text", 'capture_external'::"text", 'capture_studio'::"text", 'recording'::"text", 'delivery'::"text", 'internal'::"text", 'commercial'::"text", 'reu_a'::"text", 'reu_c'::"text", 'cap_e'::"text", 'cap_s'::"text", 'out_a'::"text"])))
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."calendar_events"."series_id" IS 'Identificador comum das ocorrências de uma agenda recorrente.';



COMMENT ON COLUMN "public"."calendar_events"."series_sequence" IS 'Posição da ocorrência dentro da série recorrente.';



COMMENT ON COLUMN "public"."calendar_events"."recurrence_until" IS 'Data final utilizada para gerar a recorrência.';



COMMENT ON COLUMN "public"."calendar_events"."auto_recurrence" IS 'Indica que as ocorrências foram criadas automaticamente.';



COMMENT ON COLUMN "public"."calendar_events"."custom_name" IS 'Nome personalizado para lead, parceiro ou contato que não possui cadastro de cliente.';



COMMENT ON COLUMN "public"."calendar_events"."pauta_id" IS 'Pauta mensal vinculada diretamente ou herdada da demanda da agenda.';



COMMENT ON COLUMN "public"."calendar_events"."completion_status" IS 'Estado operacional de realização da agenda. Independente de confirmed.';



CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "channel" "text" DEFAULT 'geral'::"text" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "service_catalog_id" "uuid" NOT NULL,
    "responsible_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "started_at" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "monthly_quantity" integer,
    "quantity_unit" "text",
    "delivered_quantity" integer DEFAULT 0 NOT NULL,
    "cycle_duration_days" integer,
    "requires_alignment_meeting" boolean DEFAULT true NOT NULL,
    "requires_capture" boolean DEFAULT true NOT NULL,
    "default_capture_type" "text",
    CONSTRAINT "client_services_capture_configuration_check" CHECK (("requires_capture" OR ("default_capture_type" IS NULL))),
    CONSTRAINT "client_services_cycle_duration_days_check" CHECK ((("cycle_duration_days" IS NULL) OR (("cycle_duration_days" >= 1) AND ("cycle_duration_days" <= 365)))),
    CONSTRAINT "client_services_default_capture_type_check" CHECK ((("default_capture_type" IS NULL) OR ("default_capture_type" = ANY (ARRAY['cap_e'::"text", 'cap_s'::"text"])))),
    CONSTRAINT "client_services_delivered_quantity_check" CHECK (("delivered_quantity" >= 0)),
    CONSTRAINT "client_services_monthly_quantity_check" CHECK ((("monthly_quantity" IS NULL) OR ("monthly_quantity" >= 0))),
    CONSTRAINT "client_services_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."client_services" OWNER TO "postgres";


COMMENT ON COLUMN "public"."client_services"."cycle_duration_days" IS 'Duração padrão sugerida para o próximo ciclo. As datas continuam editáveis.';



COMMENT ON COLUMN "public"."client_services"."requires_alignment_meeting" IS 'Define se novos ciclos criam pendência de reunião de alinhamento.';



COMMENT ON COLUMN "public"."client_services"."requires_capture" IS 'Define se novos ciclos criam pendência de captação.';



COMMENT ON COLUMN "public"."client_services"."default_capture_type" IS 'Tipo padrão de captação: cap_e ou cap_s.';



CREATE TABLE IF NOT EXISTS "public"."clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "segment" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "avatar_initials" "text" DEFAULT 'CL'::"text" NOT NULL,
    "avatar_color" "text" DEFAULT '#888888'::"text" NOT NULL,
    "avatar_bg" "text" DEFAULT '#1A1A1A'::"text" NOT NULL,
    "responsible_id" "uuid",
    "main_contact_name" "text",
    "main_contact_email" "text",
    "main_contact_phone" "text",
    "drive_folder_url" "text",
    "briefing_url" "text",
    "last_report_url" "text",
    "website" "text",
    "instagram" "text",
    "notes" "text",
    "crm_client_id" "text",
    "started_at" "date",
    "ended_at" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cnpj_cpf" "text",
    "cidade" "text",
    "metodo_pagamento" "text",
    "notas_fiscais" "text",
    "valor_mensal" numeric(10,2),
    "dia_vencimento" integer,
    "tempo_contrato" "text",
    "inicio_contrato" "date",
    "fim_contrato" "date",
    "situacao_contrato" "text",
    "observacoes_contrato" "text",
    "logo_url" "text",
    "logo_storage_path" "text",
    "strategic_map_url" "text",
    "operation_model" "text" DEFAULT 'monthly'::"text" NOT NULL,
    CONSTRAINT "clients_operation_model_check" CHECK (("operation_model" = ANY (ARRAY['monthly'::"text", 'parallel'::"text", 'not_applicable'::"text"]))),
    CONSTRAINT "clients_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'cancelled'::"text", 'onboarding'::"text", 'paused'::"text", 'archived'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_board_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "item_id" "uuid",
    "actor_type" "text" DEFAULT 'internal'::"text" NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text" DEFAULT 'Ampy Digital'::"text" NOT NULL,
    "event_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feed_board_events_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['internal'::"text", 'client'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."feed_board_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feed_board_item_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "item_id" "uuid" NOT NULL,
    "asset_type" "text" DEFAULT 'slide'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "title" "text",
    "storage_path" "text",
    "file_url" "text" NOT NULL,
    "mime_type" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feed_board_item_assets_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['slide'::"text", 'cover'::"text", 'video'::"text", 'file'::"text"])))
);


ALTER TABLE "public"."feed_board_item_assets" OWNER TO "postgres";


COMMENT ON TABLE "public"."feed_board_item_assets" IS 'Arquivos/slides adicionais vinculados a um item de aprovação, principalmente carrossel.';



CREATE TABLE IF NOT EXISTS "public"."feed_board_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "work_item_id" "uuid",
    "position" integer DEFAULT 0 NOT NULL,
    "title" "text",
    "cover_url" "text",
    "storage_path" "text",
    "content_url" "text",
    "caption" "text",
    "internal_notes" "text",
    "approval_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "client_feedback" "text",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_file_name" "text",
    "scheduled_date" "date",
    "scheduled_time" time without time zone,
    "content_type" "text" DEFAULT 'post'::"text" NOT NULL,
    "workflow_status" "text" DEFAULT 'awaiting_approval'::"text" NOT NULL,
    CONSTRAINT "feed_board_items_approval_status_check" CHECK (("approval_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'changes_requested'::"text", 'rejected'::"text"]))),
    CONSTRAINT "feed_board_items_content_type_check" CHECK (("content_type" = ANY (ARRAY['post'::"text", 'video'::"text", 'carousel'::"text"]))),
    CONSTRAINT "feed_board_items_position_check" CHECK (("position" >= 0)),
    CONSTRAINT "feed_board_items_workflow_status_check" CHECK (("workflow_status" = ANY (ARRAY['awaiting_approval'::"text", 'approved'::"text", 'changes_requested'::"text", 'scheduled'::"text"])))
);


ALTER TABLE "public"."feed_board_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."feed_board_items"."source_file_name" IS 'Nome/referência manual do arquivo dentro da pasta do Drive, exemplo: Video_1, Capa_1, P01_VIDEO.';



COMMENT ON COLUMN "public"."feed_board_items"."scheduled_date" IS 'Data prevista/manual de postagem do item aprovado.';



COMMENT ON COLUMN "public"."feed_board_items"."scheduled_time" IS 'Hora prevista/manual de postagem do item aprovado.';



COMMENT ON COLUMN "public"."feed_board_items"."content_type" IS 'Tipo do conteúdo da aprovação: post, video ou carousel.';



CREATE TABLE IF NOT EXISTS "public"."feed_boards" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "period_month" "date" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "visual_preset" "text" DEFAULT 'custom'::"text" NOT NULL,
    "share_token" "text" DEFAULT "replace"(("extensions"."uuid_generate_v4"())::"text", '-'::"text", ''::"text") NOT NULL,
    "created_by" "uuid",
    "notes" "text",
    "published_at" timestamp with time zone,
    "last_client_action_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "drive_folder_url" "text",
    CONSTRAINT "feed_boards_period_month_check" CHECK (("period_month" = ("date_trunc"('month'::"text", ("period_month")::timestamp without time zone))::"date")),
    CONSTRAINT "feed_boards_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'in_progress'::"text", 'sent'::"text", 'approved'::"text", 'changes_requested'::"text", 'archived'::"text"]))),
    CONSTRAINT "feed_boards_visual_preset_check" CHECK (("visual_preset" = ANY (ARRAY['custom'::"text", 'standard'::"text", 'minimalist'::"text", 'creative'::"text", 'neutral'::"text", 'bold'::"text"])))
);


ALTER TABLE "public"."feed_boards" OWNER TO "postgres";


COMMENT ON COLUMN "public"."feed_boards"."drive_folder_url" IS 'Link manual da pasta do Google Drive vinculada ao documento de aprovação.';



CREATE TABLE IF NOT EXISTS "public"."feed_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_id" "uuid",
    "title" "text",
    "date" "date",
    "time" "text" DEFAULT '09:00'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "caption" "text",
    "hashtags" "text",
    "drive_link" "text",
    "cover_url" "text",
    "notes" "text",
    "client_feedback" "text",
    "approved_at" timestamp with time zone,
    "position" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."feed_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_message_mentions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "mentioned_profile_id" "uuid",
    "mentioned_team_member_id" "uuid",
    "mentioned_email" "text",
    "mentioned_area" "text",
    "mentioned_role" "text",
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."internal_message_mentions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "body" "text" NOT NULL,
    "context_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "context_id" "uuid",
    "client_id" "uuid",
    "work_item_id" "uuid",
    "feed_board_id" "uuid",
    "feed_board_item_id" "uuid",
    "aviso_id" "uuid",
    "drive_url" "text",
    "attachment_title" "text",
    "created_by_profile_id" "uuid",
    "created_by_team_member_id" "uuid",
    "created_by_email" "text",
    "is_resolved" boolean DEFAULT false NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by_profile_id" "uuid",
    "resolved_by_team_member_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."internal_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pauta_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pauta_id" "uuid",
    "board_id" "uuid",
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "target_type" "text" DEFAULT 'pauta'::"text" NOT NULL,
    "target_id" "uuid",
    "old_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pauta_events_action_chk" CHECK ((("char_length"(TRIM(BOTH FROM "action")) >= 2) AND ("char_length"(TRIM(BOTH FROM "action")) <= 80))),
    CONSTRAINT "pauta_events_target_type_chk" CHECK (("target_type" = ANY (ARRAY['pauta'::"text", 'client'::"text", 'work_item'::"text", 'member'::"text", 'board'::"text"])))
);


ALTER TABLE "public"."pauta_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."pauta_events" IS 'Auditoria imutável das ações estruturais e operacionais relevantes executadas em Pautas.';



CREATE TABLE IF NOT EXISTS "public"."pauta_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pauta_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "main_work_item_id" "uuid",
    "membership_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "source" "text" DEFAULT 'added'::"text" NOT NULL,
    "added_by" "uuid",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_by" "uuid",
    "removed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "target_date" "date",
    "target_date_updated_at" timestamp with time zone,
    "target_date_updated_by" "uuid",
    CONSTRAINT "pauta_members_removed_state_chk" CHECK (((("membership_status" = 'active'::"text") AND ("removed_at" IS NULL)) OR (("membership_status" = 'removed'::"text") AND ("removed_at" IS NOT NULL)))),
    CONSTRAINT "pauta_members_source_chk" CHECK (("source" = ANY (ARRAY['opened'::"text", 'added'::"text", 'legacy_adopted'::"text", 'backfill'::"text", 'restored'::"text"]))),
    CONSTRAINT "pauta_members_status_chk" CHECK (("membership_status" = ANY (ARRAY['active'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."pauta_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."pauta_members" IS 'Participação explícita e histórica de clientes em Pautas mensais.';



COMMENT ON COLUMN "public"."pauta_members"."main_work_item_id" IS 'Card mensal principal canônico do cliente dentro da Pauta.';



COMMENT ON COLUMN "public"."pauta_members"."source" IS 'Origem da participação: abertura, inclusão, adoção legada, backfill ou restauração.';



CREATE TABLE IF NOT EXISTS "public"."pautas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "board_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "reference_month" "date" NOT NULL,
    "magic_number_date" "date" NOT NULL,
    "scheduled_until_date" "date" NOT NULL,
    "lifecycle_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "opened_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pautas_dates_chk" CHECK (("magic_number_date" <= "scheduled_until_date")),
    CONSTRAINT "pautas_lifecycle_status_chk" CHECK (("lifecycle_status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'closed'::"text", 'archived'::"text"]))),
    CONSTRAINT "pautas_reference_month_chk" CHECK (("reference_month" = ("date_trunc"('month'::"text", ("reference_month")::timestamp with time zone))::"date")),
    CONSTRAINT "pautas_scheduled_until_reference_month_chk" CHECK (("scheduled_until_date" >= "reference_month"))
);


ALTER TABLE "public"."pautas" OWNER TO "postgres";


COMMENT ON TABLE "public"."pautas" IS 'Referência operacional mensal com Magic Number e data Programado até.';



COMMENT ON CONSTRAINT "pautas_scheduled_until_reference_month_chk" ON "public"."pautas" IS 'A cobertura Programado até precisa alcançar o mês de referência da Pauta.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" DEFAULT 'collaborator'::"text" NOT NULL,
    "avatar_initials" "text" DEFAULT 'AM'::"text" NOT NULL,
    "avatar_color" "text" DEFAULT '#888888'::"text" NOT NULL,
    "avatar_bg" "text" DEFAULT '#1A1A1A'::"text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "team_area" "text",
    "job_title" "text",
    "display_name" "text",
    "avatar_url" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'director'::"text", 'manager'::"text", 'team_lead'::"text", 'collaborator'::"text", 'freelancer'::"text", 'traffic'::"text", 'financial'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_step_statuses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "color" "text" DEFAULT '#64748B'::"text" NOT NULL,
    "behavior" "text" DEFAULT 'pending'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_step_statuses_behavior_check" CHECK (("behavior" = ANY (ARRAY['pending'::"text", 'active'::"text", 'blocked'::"text", 'done'::"text"]))),
    CONSTRAINT "project_step_statuses_color_check" CHECK (("color" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "project_step_statuses_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 48)))
);


ALTER TABLE "public"."project_step_statuses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "work_item_id" "uuid",
    "title" "text" NOT NULL,
    "responsible_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "status" "text" DEFAULT 'not_started'::"text",
    "position" integer DEFAULT 0,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status_id" "uuid",
    CONSTRAINT "project_steps_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'waiting'::"text", 'blocked'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."project_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" DEFAULT 'recurring'::"text" NOT NULL,
    "client_id" "uuid",
    "responsible_id" "uuid",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "description" "text",
    "started_at" "date",
    "deadline" "date",
    "drive_folder_url" "text",
    "crm_deal_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'at_risk'::"text", 'done'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "projects_type_check" CHECK (("type" = ANY (ARRAY['recurring'::"text", 'project'::"text", 'campaign'::"text", 'internal'::"text", 'traffic'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."resource_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "link_type" "text" DEFAULT 'drive_folder'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."resource_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_catalog" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "default_workflow" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."service_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_access_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "target_profile_id" "uuid",
    "target_email" "text" NOT NULL,
    "action" "text" NOT NULL,
    "old_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_access_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "job_title" "text" NOT NULL,
    "access_type" "text" DEFAULT 'operacional'::"text" NOT NULL,
    "operational_area" "text" NOT NULL,
    "avatar_initials" "text",
    "avatar_color" "text" DEFAULT '#FFFFFF'::"text",
    "avatar_bg" "text" DEFAULT '#3A3D43'::"text",
    "is_active" boolean DEFAULT true NOT NULL,
    "receives_internal_alerts" boolean DEFAULT true NOT NULL,
    "display_order" integer,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "must_change_password" boolean DEFAULT false NOT NULL,
    "last_password_change_at" timestamp with time zone,
    "last_access_change_at" timestamp with time zone,
    "last_access_changed_by" "uuid",
    "display_name" "text",
    "avatar_url" "text",
    CONSTRAINT "team_members_access_type_check" CHECK (("access_type" = ANY (ARRAY['total'::"text", 'operacional'::"text"])))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_item_board_assignment_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assignment_id" "uuid",
    "work_item_id" "uuid" NOT NULL,
    "pauta_id" "uuid",
    "board_id" "uuid",
    "board_column_id" "uuid",
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "old_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "new_values" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_item_board_assignment_events_action_chk" CHECK ((("char_length"(TRIM(BOTH FROM "action")) >= 2) AND ("char_length"(TRIM(BOTH FROM "action")) <= 80)))
);


ALTER TABLE "public"."work_item_board_assignment_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."work_item_board_assignment_events" IS 'V8-B: histórico imutável das distribuições multiquadro.';



CREATE TABLE IF NOT EXISTS "public"."work_item_board_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "board_id" "uuid" NOT NULL,
    "board_column_id" "uuid" NOT NULL,
    "operational_status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "assignment_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "position" bigint DEFAULT 0 NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone,
    "removed_by" "uuid",
    "removed_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "work_item_board_assignments_assignment_status_chk" CHECK (("assignment_status" = ANY (ARRAY['active'::"text", 'removed'::"text"]))),
    CONSTRAINT "work_item_board_assignments_completed_state_chk" CHECK (((("operational_status" = ANY (ARRAY['done'::"text", 'delivered'::"text", 'approved'::"text"])) AND ("completed_at" IS NOT NULL)) OR ("operational_status" <> ALL (ARRAY['done'::"text", 'delivered'::"text", 'approved'::"text"])))),
    CONSTRAINT "work_item_board_assignments_removed_state_chk" CHECK (((("assignment_status" = 'active'::"text") AND ("removed_at" IS NULL)) OR (("assignment_status" = 'removed'::"text") AND ("removed_at" IS NOT NULL)))),
    CONSTRAINT "work_item_board_assignments_status_chk" CHECK (("operational_status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'waiting'::"text", 'blocked'::"text", 'in_review'::"text", 'awaiting_approval'::"text", 'approved'::"text", 'scheduled'::"text", 'delivered'::"text", 'done'::"text", 'cancelled'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."work_item_board_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."work_item_board_assignments" IS 'V8-B: associa uma demanda canônica a um ou mais Quadros com progresso independente.';



CREATE TABLE IF NOT EXISTS "public"."work_item_checklists" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "done_by" "uuid",
    "done_at" timestamp with time zone,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."work_item_checklists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_item_comments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."work_item_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_item_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "field_changed" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."work_item_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_item_schedule_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "work_item_id" "uuid" NOT NULL,
    "requirement_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "calendar_event_id" "uuid",
    "created_by" "uuid",
    "scheduled_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calendar_type" "text",
    CONSTRAINT "work_item_schedule_requirements_calendar_type_check" CHECK ((("calendar_type" IS NULL) OR ("calendar_type" = ANY (ARRAY['reu_a'::"text", 'cap_e'::"text", 'cap_s'::"text"])))),
    CONSTRAINT "work_item_schedule_requirements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'scheduled'::"text", 'confirmed'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "work_item_schedule_requirements_type_check" CHECK (("requirement_type" = ANY (ARRAY['alignment_meeting'::"text", 'capture'::"text"])))
);


ALTER TABLE "public"."work_item_schedule_requirements" OWNER TO "postgres";


COMMENT ON COLUMN "public"."work_item_schedule_requirements"."calendar_type" IS 'Tipo de Agenda sugerido para atender a pendência operacional.';



CREATE TABLE IF NOT EXISTS "public"."work_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "client_id" "uuid",
    "client_service_id" "uuid",
    "project_id" "uuid",
    "type" "text" DEFAULT 'task'::"text" NOT NULL,
    "origin" "text" DEFAULT 'planned'::"text" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "responsible_id" "uuid",
    "created_by" "uuid",
    "internal_deadline" "date",
    "final_deadline" "date",
    "blocked_reason" "text",
    "blocked_at" timestamp with time zone,
    "drive_link" "text",
    "notes" "text",
    "closed_at" timestamp with time zone,
    "close_reason" "text",
    "crm_contract_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "destino" "text" DEFAULT 'kanban'::"text",
    "board_id" "uuid",
    "board_column_id" "uuid",
    "card_tag" "text",
    "card_tag_color" "text" DEFAULT 'slate'::"text",
    "generated_from_cycle_id" "uuid",
    "cycle_number" integer,
    "cycle_duration_days_snapshot" integer,
    "generated_at" timestamp with time zone,
    "generated_by" "uuid",
    "pauta_id" "uuid",
    "is_pauta_card" boolean DEFAULT false NOT NULL,
    "pauta_card_id" "uuid",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "completion_magic_number_snapshot" "date",
    "completion_delay_days" integer,
    "content_finalized_at" timestamp with time zone,
    "content_finalized_by" "uuid",
    "approvals_resolved_at" timestamp with time zone,
    "approvals_resolved_by" "uuid",
    "programming_covered_until" "date",
    "programming_verified_at" timestamp with time zone,
    "programming_verified_by" "uuid",
    "briefing_link" "text",
    "moodboard_link" "text",
    "reference_link" "text",
    CONSTRAINT "work_items_card_tag_color_check" CHECK (("card_tag_color" = ANY (ARRAY['slate'::"text", 'blue'::"text", 'purple'::"text", 'yellow'::"text", 'red'::"text", 'green'::"text"]))),
    CONSTRAINT "work_items_card_tag_length_check" CHECK ((("card_tag" IS NULL) OR ((("char_length"("btrim"("card_tag")) >= 1) AND ("char_length"("btrim"("card_tag")) <= 16)) AND ("card_tag" = "upper"("card_tag"))))),
    CONSTRAINT "work_items_completion_delay_days_chk" CHECK ((("completion_delay_days" IS NULL) OR ("completion_delay_days" >= 0))),
    CONSTRAINT "work_items_cycle_duration_snapshot_check" CHECK ((("cycle_duration_days_snapshot" IS NULL) OR (("cycle_duration_days_snapshot" >= 1) AND ("cycle_duration_days_snapshot" <= 365)))),
    CONSTRAINT "work_items_cycle_number_check" CHECK ((("cycle_number" IS NULL) OR ("cycle_number" >= 1))),
    CONSTRAINT "work_items_destino_check" CHECK (("destino" = ANY (ARRAY['quadro'::"text", 'projeto'::"text", 'ambos'::"text", 'avulsa'::"text"]))),
    CONSTRAINT "work_items_done_requires_completed_at" CHECK ((("status" <> 'done'::"text") OR ("completed_at" IS NOT NULL))),
    CONSTRAINT "work_items_origin_check" CHECK (("origin" = ANY (ARRAY['planned'::"text", 'recurring'::"text", 'extra'::"text", 'adjustment'::"text", 'urgent'::"text", 'internal'::"text"]))),
    CONSTRAINT "work_items_pauta_card_not_self_chk" CHECK ((("pauta_card_id" IS NULL) OR ("pauta_card_id" <> "id"))),
    CONSTRAINT "work_items_pauta_card_requires_context_chk" CHECK ((("is_pauta_card" = false) OR (("pauta_id" IS NOT NULL) AND ("client_id" IS NOT NULL)))),
    CONSTRAINT "work_items_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'normal'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "work_items_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'waiting'::"text", 'blocked'::"text", 'in_review'::"text", 'awaiting_approval'::"text", 'approved'::"text", 'scheduled'::"text", 'delivered'::"text", 'done'::"text", 'cancelled'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."work_items" OWNER TO "postgres";


COMMENT ON COLUMN "public"."work_items"."generated_from_cycle_id" IS 'Ciclo anterior que originou esta demanda. Um ciclo só pode gerar um sucessor.';



COMMENT ON COLUMN "public"."work_items"."cycle_number" IS 'Número sequencial do ciclo dentro do cliente e serviço.';



COMMENT ON COLUMN "public"."work_items"."cycle_duration_days_snapshot" IS 'Duração usada no momento da geração, preservada como histórico.';



COMMENT ON COLUMN "public"."work_items"."pauta_id" IS 'Pauta mensal à qual o card ou demanda pertence.';



COMMENT ON COLUMN "public"."work_items"."is_pauta_card" IS 'Identifica o card mensal principal do cliente dentro da Pauta.';



COMMENT ON COLUMN "public"."work_items"."pauta_card_id" IS 'Card mensal de origem para demandas vinculadas à mesma Pauta.';



COMMENT ON COLUMN "public"."work_items"."completed_at" IS 'Data e hora real em que o card mensal chegou a Concluído.';



COMMENT ON COLUMN "public"."work_items"."programming_covered_until" IS 'Data até a qual a programação do cliente está garantida.';



COMMENT ON COLUMN "public"."work_items"."briefing_link" IS 'Documento ou link de briefing da demanda.';



COMMENT ON COLUMN "public"."work_items"."moodboard_link" IS 'Documento ou link de moodboard da demanda.';



COMMENT ON COLUMN "public"."work_items"."reference_link" IS 'Documento ou material de referência da demanda.';



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_dedupe_key_key" UNIQUE ("dedupe_key");



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blockers"
    ADD CONSTRAINT "blockers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."board_columns"
    ADD CONSTRAINT "board_columns_board_id_id_key" UNIQUE ("board_id", "id");



ALTER TABLE ONLY "public"."board_columns"
    ADD CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_event_history"
    ADD CONSTRAINT "calendar_event_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_services"
    ADD CONSTRAINT "client_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_board_events"
    ADD CONSTRAINT "feed_board_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_board_item_assets"
    ADD CONSTRAINT "feed_board_item_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_board_items"
    ADD CONSTRAINT "feed_board_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_boards"
    ADD CONSTRAINT "feed_boards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feed_boards"
    ADD CONSTRAINT "feed_boards_share_token_unique" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."feed_posts"
    ADD CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_message_mentions"
    ADD CONSTRAINT "internal_message_mentions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pautas"
    ADD CONSTRAINT "pautas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_step_statuses"
    ADD CONSTRAINT "project_step_statuses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_catalog"
    ADD CONSTRAINT "service_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_access_audit"
    ADD CONSTRAINT "team_access_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_item_checklists"
    ADD CONSTRAINT "work_item_checklists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_item_comments"
    ADD CONSTRAINT "work_item_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_item_history"
    ADD CONSTRAINT "work_item_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_item_schedule_requirements"
    ADD CONSTRAINT "work_item_schedule_requirements_item_type_unique" UNIQUE ("work_item_id", "requirement_type");



ALTER TABLE ONLY "public"."work_item_schedule_requirements"
    ADD CONSTRAINT "work_item_schedule_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "board_columns_automation_role_unique" ON "public"."board_columns" USING "btree" ("board_id", "automation_role") WHERE ("automation_role" IS NOT NULL);



CREATE UNIQUE INDEX "board_columns_name_unique" ON "public"."board_columns" USING "btree" ("board_id", "lower"(TRIM(BOTH FROM "name")));



CREATE UNIQUE INDEX "boards_active_name_unique" ON "public"."boards" USING "btree" ("lower"(TRIM(BOTH FROM "name"))) WHERE ("status" = 'active'::"text");



CREATE INDEX "boards_board_kind_status_idx" ON "public"."boards" USING "btree" ("board_kind", "status");



CREATE INDEX "calendar_event_history_event_idx" ON "public"."calendar_event_history" USING "btree" ("event_id", "created_at" DESC);



CREATE INDEX "calendar_events_completion_idx" ON "public"."calendar_events" USING "btree" ("completion_status", "completed_at");



CREATE INDEX "calendar_events_pauta_id_idx" ON "public"."calendar_events" USING "btree" ("pauta_id", "starts_at");



CREATE INDEX "calendar_events_series_id_idx" ON "public"."calendar_events" USING "btree" ("series_id") WHERE ("series_id" IS NOT NULL);



CREATE INDEX "calendar_events_series_start_idx" ON "public"."calendar_events" USING "btree" ("series_id", "starts_at") WHERE ("series_id" IS NOT NULL);



CREATE INDEX "feed_board_item_assets_board_id_idx" ON "public"."feed_board_item_assets" USING "btree" ("board_id");



CREATE INDEX "feed_board_item_assets_item_id_position_idx" ON "public"."feed_board_item_assets" USING "btree" ("item_id", "position");



CREATE INDEX "idx_approvals_status" ON "public"."approvals" USING "btree" ("status");



CREATE INDEX "idx_approvals_work_item" ON "public"."approvals" USING "btree" ("work_item_id");



CREATE INDEX "idx_audit_logs_actor" ON "public"."audit_logs" USING "btree" ("actor_id");



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_avisos_archived_at" ON "public"."avisos" USING "btree" ("archived_at");



CREATE INDEX "idx_avisos_assigned_area" ON "public"."avisos" USING "btree" ("assigned_area");



CREATE INDEX "idx_avisos_assigned_email" ON "public"."avisos" USING "btree" ("assigned_email");



CREATE INDEX "idx_avisos_assigned_team_member" ON "public"."avisos" USING "btree" ("assigned_team_member_id");



CREATE INDEX "idx_avisos_category" ON "public"."avisos" USING "btree" ("category");



CREATE INDEX "idx_avisos_client_id" ON "public"."avisos" USING "btree" ("client_id");



CREATE INDEX "idx_avisos_deleted_at" ON "public"."avisos" USING "btree" ("deleted_at");



CREATE INDEX "idx_avisos_due_at" ON "public"."avisos" USING "btree" ("due_at");



CREATE INDEX "idx_avisos_feed_board_id" ON "public"."avisos" USING "btree" ("feed_board_id");



CREATE INDEX "idx_avisos_feed_board_item_id" ON "public"."avisos" USING "btree" ("feed_board_item_id");



CREATE INDEX "idx_avisos_priority" ON "public"."avisos" USING "btree" ("priority");



CREATE INDEX "idx_avisos_related_entity" ON "public"."avisos" USING "btree" ("related_entity_type", "related_entity_id");



CREATE INDEX "idx_avisos_reminder_at" ON "public"."avisos" USING "btree" ("reminder_at");



CREATE INDEX "idx_avisos_status" ON "public"."avisos" USING "btree" ("status");



CREATE INDEX "idx_avisos_work_item_id" ON "public"."avisos" USING "btree" ("work_item_id");



CREATE INDEX "idx_blockers_work_item" ON "public"."blockers" USING "btree" ("work_item_id");



CREATE INDEX "idx_board_columns_automation_role" ON "public"."board_columns" USING "btree" ("automation_role");



CREATE INDEX "idx_board_columns_board_position" ON "public"."board_columns" USING "btree" ("board_id", "position");



CREATE INDEX "idx_boards_status" ON "public"."boards" USING "btree" ("status");



CREATE INDEX "idx_calendar_events_client" ON "public"."calendar_events" USING "btree" ("client_id");



CREATE INDEX "idx_calendar_events_responsible" ON "public"."calendar_events" USING "btree" ("responsible_id");



CREATE INDEX "idx_calendar_events_starts_at" ON "public"."calendar_events" USING "btree" ("starts_at");



CREATE INDEX "idx_calendar_events_work_item" ON "public"."calendar_events" USING "btree" ("work_item_id");



CREATE INDEX "idx_calendar_events_work_item_type" ON "public"."calendar_events" USING "btree" ("work_item_id", "type") WHERE ("work_item_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_channel" ON "public"."chat_messages" USING "btree" ("channel");



CREATE INDEX "idx_chat_messages_created" ON "public"."chat_messages" USING "btree" ("created_at");



CREATE INDEX "idx_feed_board_events_actor" ON "public"."feed_board_events" USING "btree" ("actor_id");



CREATE INDEX "idx_feed_board_events_board" ON "public"."feed_board_events" USING "btree" ("board_id");



CREATE INDEX "idx_feed_board_events_created_at" ON "public"."feed_board_events" USING "btree" ("created_at");



CREATE INDEX "idx_feed_board_events_item" ON "public"."feed_board_events" USING "btree" ("item_id");



CREATE INDEX "idx_feed_board_items_approval_status" ON "public"."feed_board_items" USING "btree" ("approval_status");



CREATE INDEX "idx_feed_board_items_board" ON "public"."feed_board_items" USING "btree" ("board_id");



CREATE INDEX "idx_feed_board_items_position" ON "public"."feed_board_items" USING "btree" ("board_id", "position");



CREATE INDEX "idx_feed_board_items_work_item" ON "public"."feed_board_items" USING "btree" ("work_item_id");



CREATE INDEX "idx_feed_board_items_workflow_status" ON "public"."feed_board_items" USING "btree" ("workflow_status");



CREATE INDEX "idx_feed_boards_client" ON "public"."feed_boards" USING "btree" ("client_id");



CREATE INDEX "idx_feed_boards_created_by" ON "public"."feed_boards" USING "btree" ("created_by");



CREATE INDEX "idx_feed_boards_period_month" ON "public"."feed_boards" USING "btree" ("period_month");



CREATE INDEX "idx_feed_boards_share_token" ON "public"."feed_boards" USING "btree" ("share_token");



CREATE INDEX "idx_feed_boards_status" ON "public"."feed_boards" USING "btree" ("status");



CREATE INDEX "idx_feed_posts_client" ON "public"."feed_posts" USING "btree" ("client_id");



CREATE INDEX "idx_feed_posts_date" ON "public"."feed_posts" USING "btree" ("date");



CREATE INDEX "idx_internal_message_mentions_area" ON "public"."internal_message_mentions" USING "btree" ("mentioned_area");



CREATE INDEX "idx_internal_message_mentions_email" ON "public"."internal_message_mentions" USING "btree" ("mentioned_email");



CREATE INDEX "idx_internal_message_mentions_message" ON "public"."internal_message_mentions" USING "btree" ("message_id");



CREATE INDEX "idx_internal_message_mentions_profile" ON "public"."internal_message_mentions" USING "btree" ("mentioned_profile_id");



CREATE INDEX "idx_internal_message_mentions_team_member" ON "public"."internal_message_mentions" USING "btree" ("mentioned_team_member_id");



CREATE INDEX "idx_internal_messages_client" ON "public"."internal_messages" USING "btree" ("client_id");



CREATE INDEX "idx_internal_messages_context" ON "public"."internal_messages" USING "btree" ("context_type", "context_id");



CREATE INDEX "idx_internal_messages_created_email" ON "public"."internal_messages" USING "btree" ("created_by_email");



CREATE INDEX "idx_internal_messages_created_team_member" ON "public"."internal_messages" USING "btree" ("created_by_team_member_id");



CREATE INDEX "idx_internal_messages_feed_board" ON "public"."internal_messages" USING "btree" ("feed_board_id");



CREATE INDEX "idx_internal_messages_work_item" ON "public"."internal_messages" USING "btree" ("work_item_id");



CREATE INDEX "idx_profiles_active" ON "public"."profiles" USING "btree" ("is_active");



CREATE INDEX "idx_project_step_statuses_project_position" ON "public"."project_step_statuses" USING "btree" ("work_item_id", "position");



CREATE INDEX "idx_project_steps_end_date" ON "public"."project_steps" USING "btree" ("end_date");



CREATE INDEX "idx_project_steps_status_id" ON "public"."project_steps" USING "btree" ("status_id");



CREATE INDEX "idx_project_steps_work_item" ON "public"."project_steps" USING "btree" ("work_item_id");



CREATE INDEX "idx_team_members_access_type" ON "public"."team_members" USING "btree" ("access_type");



CREATE INDEX "idx_team_members_active" ON "public"."team_members" USING "btree" ("is_active");



CREATE INDEX "idx_team_members_area" ON "public"."team_members" USING "btree" ("operational_area");



CREATE INDEX "idx_team_members_profile_id" ON "public"."team_members" USING "btree" ("profile_id");



CREATE INDEX "idx_work_item_history_actor" ON "public"."work_item_history" USING "btree" ("actor_id");



CREATE INDEX "idx_work_item_history_work_item" ON "public"."work_item_history" USING "btree" ("work_item_id");



CREATE INDEX "idx_work_item_schedule_requirements_item" ON "public"."work_item_schedule_requirements" USING "btree" ("work_item_id");



CREATE INDEX "idx_work_item_schedule_requirements_status" ON "public"."work_item_schedule_requirements" USING "btree" ("status");



CREATE INDEX "idx_work_items_board_column_id" ON "public"."work_items" USING "btree" ("board_column_id");



CREATE INDEX "idx_work_items_board_id" ON "public"."work_items" USING "btree" ("board_id");



CREATE INDEX "idx_work_items_client" ON "public"."work_items" USING "btree" ("client_id");



CREATE INDEX "idx_work_items_client_service" ON "public"."work_items" USING "btree" ("client_service_id");



CREATE INDEX "idx_work_items_cycle_number" ON "public"."work_items" USING "btree" ("client_id", "cycle_number");



CREATE INDEX "idx_work_items_destino" ON "public"."work_items" USING "btree" ("destino");



CREATE INDEX "idx_work_items_final_deadline" ON "public"."work_items" USING "btree" ("final_deadline");



CREATE INDEX "idx_work_items_generated_by" ON "public"."work_items" USING "btree" ("generated_by");



CREATE INDEX "idx_work_items_priority" ON "public"."work_items" USING "btree" ("priority");



CREATE INDEX "idx_work_items_responsible" ON "public"."work_items" USING "btree" ("responsible_id");



CREATE INDEX "idx_work_items_status" ON "public"."work_items" USING "btree" ("status");



CREATE INDEX "pauta_events_action_created_idx" ON "public"."pauta_events" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "pauta_events_actor_created_idx" ON "public"."pauta_events" USING "btree" ("actor_id", "created_at" DESC);



CREATE INDEX "pauta_events_board_created_idx" ON "public"."pauta_events" USING "btree" ("board_id", "created_at" DESC);



CREATE INDEX "pauta_events_pauta_created_idx" ON "public"."pauta_events" USING "btree" ("pauta_id", "created_at" DESC);



CREATE INDEX "pauta_events_target_idx" ON "public"."pauta_events" USING "btree" ("target_type", "target_id");



CREATE UNIQUE INDEX "pauta_members_active_client_uidx" ON "public"."pauta_members" USING "btree" ("pauta_id", "client_id") WHERE ("membership_status" = 'active'::"text");



CREATE UNIQUE INDEX "pauta_members_active_main_work_item_uidx" ON "public"."pauta_members" USING "btree" ("main_work_item_id") WHERE (("membership_status" = 'active'::"text") AND ("main_work_item_id" IS NOT NULL));



CREATE INDEX "pauta_members_added_at_idx" ON "public"."pauta_members" USING "btree" ("added_at" DESC);



CREATE INDEX "pauta_members_client_status_idx" ON "public"."pauta_members" USING "btree" ("client_id", "membership_status");



CREATE INDEX "pauta_members_pauta_status_idx" ON "public"."pauta_members" USING "btree" ("pauta_id", "membership_status");



CREATE INDEX "pauta_members_target_date_idx" ON "public"."pauta_members" USING "btree" ("pauta_id", "target_date") WHERE ("membership_status" = 'active'::"text");



CREATE UNIQUE INDEX "pautas_board_reference_month_uidx" ON "public"."pautas" USING "btree" ("board_id", "reference_month");



CREATE INDEX "pautas_lifecycle_status_idx" ON "public"."pautas" USING "btree" ("lifecycle_status");



CREATE INDEX "pautas_magic_number_idx" ON "public"."pautas" USING "btree" ("magic_number_date") WHERE ("archived_at" IS NULL);



CREATE INDEX "pautas_scheduled_until_idx" ON "public"."pautas" USING "btree" ("scheduled_until_date") WHERE ("archived_at" IS NULL);



CREATE UNIQUE INDEX "project_step_statuses_name_unique" ON "public"."project_step_statuses" USING "btree" ("work_item_id", "lower"(TRIM(BOTH FROM "name"))) WHERE ("is_archived" = false);



CREATE UNIQUE INDEX "team_members_email_lower_unique" ON "public"."team_members" USING "btree" ("lower"("email"));



CREATE UNIQUE INDEX "team_members_email_unique_lower" ON "public"."team_members" USING "btree" ("lower"("email"));



CREATE UNIQUE INDEX "team_members_profile_unique" ON "public"."team_members" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "work_item_board_assignment_events_assignment_created_idx" ON "public"."work_item_board_assignment_events" USING "btree" ("assignment_id", "created_at" DESC);



CREATE INDEX "work_item_board_assignment_events_item_created_idx" ON "public"."work_item_board_assignment_events" USING "btree" ("work_item_id", "created_at" DESC);



CREATE INDEX "work_item_board_assignment_events_pauta_created_idx" ON "public"."work_item_board_assignment_events" USING "btree" ("pauta_id", "created_at" DESC);



CREATE UNIQUE INDEX "work_item_board_assignments_active_uidx" ON "public"."work_item_board_assignments" USING "btree" ("work_item_id", "board_id") WHERE ("assignment_status" = 'active'::"text");



CREATE INDEX "work_item_board_assignments_board_column_idx" ON "public"."work_item_board_assignments" USING "btree" ("board_id", "board_column_id", "assignment_status", "position");



CREATE INDEX "work_item_board_assignments_status_idx" ON "public"."work_item_board_assignments" USING "btree" ("operational_status", "assignment_status");



CREATE INDEX "work_item_board_assignments_work_item_idx" ON "public"."work_item_board_assignments" USING "btree" ("work_item_id", "assignment_status");



CREATE UNIQUE INDEX "work_item_schedule_requirements_event_unique" ON "public"."work_item_schedule_requirements" USING "btree" ("calendar_event_id") WHERE ("calendar_event_id" IS NOT NULL);



CREATE UNIQUE INDEX "work_items_generated_from_cycle_unique" ON "public"."work_items" USING "btree" ("generated_from_cycle_id") WHERE ("generated_from_cycle_id" IS NOT NULL);



CREATE INDEX "work_items_pauta_card_id_idx" ON "public"."work_items" USING "btree" ("pauta_card_id");



CREATE UNIQUE INDEX "work_items_pauta_client_card_uidx" ON "public"."work_items" USING "btree" ("pauta_id", "client_id") WHERE ("is_pauta_card" = true);



CREATE INDEX "work_items_pauta_id_idx" ON "public"."work_items" USING "btree" ("pauta_id");



CREATE INDEX "work_items_pauta_progress_idx" ON "public"."work_items" USING "btree" ("pauta_id", "is_pauta_card", "board_column_id", "completed_at");



CREATE OR REPLACE TRIGGER "guard_active_pauta_work_item_requires_pauta" BEFORE INSERT OR UPDATE OF "board_id", "pauta_id", "status" ON "public"."work_items" FOR EACH ROW EXECUTE FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"();



CREATE OR REPLACE TRIGGER "log_feed_board_created" AFTER INSERT ON "public"."feed_boards" FOR EACH ROW EXECUTE FUNCTION "public"."app_log_feed_board_created"();



CREATE OR REPLACE TRIGGER "set_updated_at_calendar_events" BEFORE UPDATE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_client_services" BEFORE UPDATE ON "public"."client_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_clients" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_feed_board_items" BEFORE UPDATE ON "public"."feed_board_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_feed_boards" BEFORE UPDATE ON "public"."feed_boards" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_project_steps" BEFORE UPDATE ON "public"."project_steps" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_projects" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_work_items" BEFORE UPDATE ON "public"."work_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_avisos_updated_at" BEFORE UPDATE ON "public"."avisos" FOR EACH ROW EXECUTE FUNCTION "public"."set_avisos_updated_at"();



CREATE OR REPLACE TRIGGER "trg_calendar_event_clear_cycle_requirement" BEFORE DELETE ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"();



CREATE OR REPLACE TRIGGER "trg_calendar_event_sync_cycle_requirement" AFTER INSERT OR UPDATE OF "work_item_id", "type", "starts_at", "confirmed" ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"();



CREATE OR REPLACE TRIGGER "trg_calendar_event_sync_pauta" BEFORE INSERT OR UPDATE OF "work_item_id", "pauta_id" ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."sync_calendar_event_pauta"();



CREATE OR REPLACE TRIGGER "trg_internal_messages_updated_at" BEFORE UPDATE ON "public"."internal_messages" FOR EACH ROW EXECUTE FUNCTION "public"."set_internal_messages_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pauta_members_touch_updated_at" BEFORE UPDATE ON "public"."pauta_members" FOR EACH ROW EXECUTE FUNCTION "public"."touch_pauta_members_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pautas_touch_updated_at" BEFORE UPDATE ON "public"."pautas" FOR EACH ROW EXECUTE FUNCTION "public"."touch_pautas_updated_at"();



CREATE OR REPLACE TRIGGER "trg_seed_board_default_columns" AFTER INSERT ON "public"."boards" FOR EACH ROW EXECUTE FUNCTION "public"."seed_board_default_columns"();



CREATE OR REPLACE TRIGGER "trg_seed_project_step_statuses" AFTER INSERT OR UPDATE OF "destino" ON "public"."work_items" FOR EACH ROW EXECUTE FUNCTION "public"."seed_project_step_statuses_for_work_item"();



CREATE OR REPLACE TRIGGER "trg_team_members_updated_at" BEFORE UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_team_members_updated_at"();



CREATE OR REPLACE TRIGGER "trg_touch_project_step_statuses_updated_at" BEFORE UPDATE ON "public"."project_step_statuses" FOR EACH ROW EXECUTE FUNCTION "public"."touch_project_step_statuses_updated_at"();



CREATE OR REPLACE TRIGGER "validate_calendar_links" BEFORE INSERT OR UPDATE OF "client_id", "work_item_id" ON "public"."calendar_events" FOR EACH ROW EXECUTE FUNCTION "public"."app_validate_calendar_links"();



CREATE OR REPLACE TRIGGER "validate_work_item_links" BEFORE INSERT OR UPDATE OF "client_id", "client_service_id" ON "public"."work_items" FOR EACH ROW EXECUTE FUNCTION "public"."app_validate_work_item_links"();



CREATE OR REPLACE TRIGGER "work_item_board_assignments_recalculate_trg" AFTER INSERT OR DELETE OR UPDATE ON "public"."work_item_board_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."v8_assignment_after_change"();



CREATE OR REPLACE TRIGGER "work_item_board_assignments_simple_card_trg" BEFORE INSERT OR UPDATE OF "metadata" ON "public"."work_item_board_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."v9_prepare_simple_assignment_card"();



CREATE OR REPLACE TRIGGER "work_items_sync_assignment_trg" AFTER INSERT OR UPDATE OF "board_id", "board_column_id", "status", "completed_at", "completed_by", "pauta_id" ON "public"."work_items" FOR EACH ROW EXECUTE FUNCTION "public"."v8_sync_assignment_from_work_item"();



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_assigned_team_member_id_fkey" FOREIGN KEY ("assigned_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_feed_board_event_id_fkey" FOREIGN KEY ("feed_board_event_id") REFERENCES "public"."feed_board_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_feed_board_id_fkey" FOREIGN KEY ("feed_board_id") REFERENCES "public"."feed_boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_feed_board_item_id_fkey" FOREIGN KEY ("feed_board_item_id") REFERENCES "public"."feed_board_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."avisos"
    ADD CONSTRAINT "avisos_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."blockers"
    ADD CONSTRAINT "blockers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."blockers"
    ADD CONSTRAINT "blockers_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."blockers"
    ADD CONSTRAINT "blockers_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."board_columns"
    ADD CONSTRAINT "board_columns_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."boards"
    ADD CONSTRAINT "boards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_event_history"
    ADD CONSTRAINT "calendar_event_history_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_event_history"
    ADD CONSTRAINT "calendar_event_history_event_fk" FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_completed_by_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pauta_id_fkey" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."client_services"
    ADD CONSTRAINT "client_services_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_services"
    ADD CONSTRAINT "client_services_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."client_services"
    ADD CONSTRAINT "client_services_service_catalog_id_fkey" FOREIGN KEY ("service_catalog_id") REFERENCES "public"."service_catalog"("id");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."feed_board_events"
    ADD CONSTRAINT "feed_board_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_board_events"
    ADD CONSTRAINT "feed_board_events_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."feed_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_board_events"
    ADD CONSTRAINT "feed_board_events_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."feed_board_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_board_item_assets"
    ADD CONSTRAINT "feed_board_item_assets_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."feed_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_board_item_assets"
    ADD CONSTRAINT "feed_board_item_assets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."feed_board_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_board_items"
    ADD CONSTRAINT "feed_board_items_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."feed_boards"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_board_items"
    ADD CONSTRAINT "feed_board_items_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_boards"
    ADD CONSTRAINT "feed_boards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feed_boards"
    ADD CONSTRAINT "feed_boards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feed_posts"
    ADD CONSTRAINT "feed_posts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_message_mentions"
    ADD CONSTRAINT "internal_message_mentions_mentioned_profile_id_fkey" FOREIGN KEY ("mentioned_profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_message_mentions"
    ADD CONSTRAINT "internal_message_mentions_mentioned_team_member_id_fkey" FOREIGN KEY ("mentioned_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_message_mentions"
    ADD CONSTRAINT "internal_message_mentions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."internal_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "public"."avisos"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_created_by_profile_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_created_by_team_member_id_fkey" FOREIGN KEY ("created_by_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_feed_board_id_fkey" FOREIGN KEY ("feed_board_id") REFERENCES "public"."feed_boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_feed_board_item_id_fkey" FOREIGN KEY ("feed_board_item_id") REFERENCES "public"."feed_board_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_resolved_by_profile_id_fkey" FOREIGN KEY ("resolved_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_resolved_by_team_member_id_fkey" FOREIGN KEY ("resolved_by_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."internal_messages"
    ADD CONSTRAINT "internal_messages_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_board_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_pauta_fk" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_events"
    ADD CONSTRAINT "pauta_events_pauta_id_fkey" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_added_by_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_client_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_main_work_item_fk" FOREIGN KEY ("main_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_main_work_item_id_fkey" FOREIGN KEY ("main_work_item_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_pauta_fk" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_pauta_id_fkey" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_removed_by_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pauta_members"
    ADD CONSTRAINT "pauta_members_target_date_updated_by_fkey" FOREIGN KEY ("target_date_updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pautas"
    ADD CONSTRAINT "pautas_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_step_statuses"
    ADD CONSTRAINT "project_step_statuses_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."project_step_statuses"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."project_steps"
    ADD CONSTRAINT "project_steps_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."resource_links"
    ADD CONSTRAINT "resource_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."team_access_audit"
    ADD CONSTRAINT "team_access_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_access_audit"
    ADD CONSTRAINT "team_access_audit_target_profile_id_fkey" FOREIGN KEY ("target_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_last_access_changed_by_fkey" FOREIGN KEY ("last_access_changed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_actor_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_assignment_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."work_item_board_assignments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_board_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_column_fk" FOREIGN KEY ("board_column_id") REFERENCES "public"."board_columns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_pauta_fk" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignment_events"
    ADD CONSTRAINT "work_item_board_assignment_events_work_item_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_assigned_by_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_board_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_column_fk" FOREIGN KEY ("board_id", "board_column_id") REFERENCES "public"."board_columns"("board_id", "id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_completed_by_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_removed_by_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_board_assignments"
    ADD CONSTRAINT "work_item_board_assignments_work_item_fk" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_item_checklists"
    ADD CONSTRAINT "work_item_checklists_done_by_fkey" FOREIGN KEY ("done_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_item_checklists"
    ADD CONSTRAINT "work_item_checklists_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_item_comments"
    ADD CONSTRAINT "work_item_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_item_comments"
    ADD CONSTRAINT "work_item_comments_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_item_history"
    ADD CONSTRAINT "work_item_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_item_history"
    ADD CONSTRAINT "work_item_history_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_item_schedule_requirements"
    ADD CONSTRAINT "work_item_schedule_requirements_calendar_event_id_fkey" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_schedule_requirements"
    ADD CONSTRAINT "work_item_schedule_requirements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_item_schedule_requirements"
    ADD CONSTRAINT "work_item_schedule_requirements_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "public"."work_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_board_column_id_fkey" FOREIGN KEY ("board_column_id") REFERENCES "public"."board_columns"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id");



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_client_service_id_fkey" FOREIGN KEY ("client_service_id") REFERENCES "public"."client_services"("id");



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_generated_from_cycle_id_fkey" FOREIGN KEY ("generated_from_cycle_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_pauta_card_id_fkey" FOREIGN KEY ("pauta_card_id") REFERENCES "public"."work_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_pauta_id_fkey" FOREIGN KEY ("pauta_id") REFERENCES "public"."pautas"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."work_items"
    ADD CONSTRAINT "work_items_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "public"."profiles"("id");



CREATE POLICY "agenda_create_authenticated" ON "public"."calendar_events" FOR INSERT TO "authenticated" WITH CHECK (("public"."app_is_active_user"() AND (("created_by" = "auth"."uid"()) OR ("created_by" IS NULL))));



CREATE POLICY "agenda_delete_operational" ON "public"."calendar_events" FOR DELETE TO "authenticated" USING (("public"."app_is_manager"() OR ("public"."app_is_active_user"() AND (("responsible_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())))));



CREATE POLICY "agenda_read_authenticated" ON "public"."calendar_events" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "agenda_update_operational" ON "public"."calendar_events" FOR UPDATE TO "authenticated" USING (("public"."app_is_manager"() OR ("public"."app_is_active_user"() AND (("responsible_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()))))) WITH CHECK (("public"."app_is_manager"() OR ("public"."app_is_active_user"() AND (("responsible_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())))));



ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_all_feed" ON "public"."feed_posts" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_approvals" ON "public"."approvals" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_blockers" ON "public"."blockers" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_chat" ON "public"."chat_messages" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_checklists" ON "public"."work_item_checklists" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_comments" ON "public"."work_item_comments" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_projects" ON "public"."projects" TO "authenticated" USING (true);



CREATE POLICY "authenticated_all_resource_links" ON "public"."resource_links" TO "authenticated" USING (true);



CREATE POLICY "authenticated_read_audit_logs" ON "public"."audit_logs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read_history" ON "public"."work_item_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "authenticated_read_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."avisos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "avisos_delete_authenticated" ON "public"."avisos" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "avisos_insert_authenticated" ON "public"."avisos" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "avisos_select_authenticated" ON "public"."avisos" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "avisos_update_authenticated" ON "public"."avisos" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."blockers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."board_columns" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "board_columns_delete_total" ON "public"."board_columns" FOR DELETE TO "authenticated" USING ("public"."app_has_total_access"());



CREATE POLICY "board_columns_insert_total" ON "public"."board_columns" FOR INSERT TO "authenticated" WITH CHECK ("public"."app_has_total_access"());



CREATE POLICY "board_columns_select_authenticated" ON "public"."board_columns" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "board_columns_update_total" ON "public"."board_columns" FOR UPDATE TO "authenticated" USING ("public"."app_has_total_access"()) WITH CHECK ("public"."app_has_total_access"());



ALTER TABLE "public"."boards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "boards_delete_total" ON "public"."boards" FOR DELETE TO "authenticated" USING ("public"."app_has_total_access"());



CREATE POLICY "boards_insert_total" ON "public"."boards" FOR INSERT TO "authenticated" WITH CHECK ("public"."app_has_total_access"());



CREATE POLICY "boards_select_authenticated" ON "public"."boards" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "boards_update_total" ON "public"."boards" FOR UPDATE TO "authenticated" USING ("public"."app_has_total_access"()) WITH CHECK ("public"."app_has_total_access"());



ALTER TABLE "public"."calendar_event_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calendar_event_history_select_authenticated" ON "public"."calendar_event_history" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."calendar_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."client_services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_services_manage_managers" ON "public"."client_services" TO "authenticated" USING ("public"."app_is_manager"()) WITH CHECK ("public"."app_is_manager"());



CREATE POLICY "client_services_read_authenticated" ON "public"."client_services" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_manage_managers" ON "public"."clients" TO "authenticated" USING ("public"."app_is_manager"()) WITH CHECK ("public"."app_is_manager"());



CREATE POLICY "clients_read_authenticated" ON "public"."clients" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "demands_create_authenticated" ON "public"."work_items" FOR INSERT TO "authenticated" WITH CHECK (("public"."app_is_active_user"() AND (("created_by" = "auth"."uid"()) OR ("created_by" IS NULL))));



CREATE POLICY "demands_delete_managers" ON "public"."work_items" FOR DELETE TO "authenticated" USING ("public"."app_is_manager"());



CREATE POLICY "demands_read_authenticated" ON "public"."work_items" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "demands_update_operational" ON "public"."work_items" FOR UPDATE TO "authenticated" USING (("public"."app_is_manager"() OR ("public"."app_is_active_user"() AND (("responsible_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()))))) WITH CHECK (("public"."app_is_manager"() OR ("public"."app_is_active_user"() AND (("responsible_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())))));



ALTER TABLE "public"."feed_board_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_board_events_delete_managers" ON "public"."feed_board_events" FOR DELETE TO "authenticated" USING ("public"."app_is_manager"());



CREATE POLICY "feed_board_events_insert_authenticated" ON "public"."feed_board_events" FOR INSERT TO "authenticated" WITH CHECK ("public"."app_is_active_user"());



CREATE POLICY "feed_board_events_read_authenticated" ON "public"."feed_board_events" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."feed_board_item_assets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_board_item_assets_authenticated_delete" ON "public"."feed_board_item_assets" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "feed_board_item_assets_authenticated_insert" ON "public"."feed_board_item_assets" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "feed_board_item_assets_authenticated_select" ON "public"."feed_board_item_assets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "feed_board_item_assets_authenticated_update" ON "public"."feed_board_item_assets" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."feed_board_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_board_items_delete_authenticated" ON "public"."feed_board_items" FOR DELETE TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "feed_board_items_insert_authenticated" ON "public"."feed_board_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."app_is_active_user"());



CREATE POLICY "feed_board_items_read_authenticated" ON "public"."feed_board_items" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "feed_board_items_update_authenticated" ON "public"."feed_board_items" FOR UPDATE TO "authenticated" USING ("public"."app_is_active_user"()) WITH CHECK ("public"."app_is_active_user"());



ALTER TABLE "public"."feed_boards" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feed_boards_delete_managers" ON "public"."feed_boards" FOR DELETE TO "authenticated" USING ("public"."app_is_manager"());



CREATE POLICY "feed_boards_insert_authenticated" ON "public"."feed_boards" FOR INSERT TO "authenticated" WITH CHECK (("public"."app_is_active_user"() AND (("created_by" = "auth"."uid"()) OR ("created_by" IS NULL))));



CREATE POLICY "feed_boards_read_authenticated" ON "public"."feed_boards" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "feed_boards_update_authenticated" ON "public"."feed_boards" FOR UPDATE TO "authenticated" USING ("public"."app_is_active_user"()) WITH CHECK ("public"."app_is_active_user"());



ALTER TABLE "public"."feed_posts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "history_insert_authenticated" ON "public"."work_item_history" FOR INSERT TO "authenticated" WITH CHECK (("public"."app_is_active_user"() AND (("actor_id" = "auth"."uid"()) OR ("actor_id" IS NULL))));



CREATE POLICY "history_read_authenticated" ON "public"."work_item_history" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."internal_message_mentions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_message_mentions_insert_authenticated" ON "public"."internal_message_mentions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "internal_message_mentions_select_authenticated" ON "public"."internal_message_mentions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "internal_message_mentions_update_authenticated" ON "public"."internal_message_mentions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."internal_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_messages_insert_authenticated" ON "public"."internal_messages" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "internal_messages_select_authenticated" ON "public"."internal_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "internal_messages_update_authenticated" ON "public"."internal_messages" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."pauta_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pauta_events_select_active_users" ON "public"."pauta_events" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."pauta_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pauta_members_select_active_users" ON "public"."pauta_members" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."pautas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pautas_select_active_users" ON "public"."pautas" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_manage_admin" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ("public"."app_is_admin"()) WITH CHECK ("public"."app_is_admin"());



CREATE POLICY "profiles_read_authenticated" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "id") AND "public"."app_is_active_user"())) WITH CHECK ((("auth"."uid"() = "id") AND "public"."app_is_active_user"()));



ALTER TABLE "public"."project_step_statuses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_step_statuses_delete_authenticated" ON "public"."project_step_statuses" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "project_step_statuses_insert_authenticated" ON "public"."project_step_statuses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "project_step_statuses_select_authenticated" ON "public"."project_step_statuses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "project_step_statuses_update_authenticated" ON "public"."project_step_statuses" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."project_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."resource_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_manage_managers" ON "public"."service_catalog" TO "authenticated" USING ("public"."app_is_manager"()) WITH CHECK ("public"."app_is_manager"());



CREATE POLICY "services_read_authenticated" ON "public"."service_catalog" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "steps_operational" ON "public"."project_steps" TO "authenticated" USING (("public"."app_is_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."work_items" "w"
  WHERE (("w"."id" = "project_steps"."work_item_id") AND "public"."app_is_active_user"() AND (("w"."responsible_id" = "auth"."uid"()) OR ("w"."created_by" = "auth"."uid"()))))))) WITH CHECK (("public"."app_is_manager"() OR (EXISTS ( SELECT 1
   FROM "public"."work_items" "w"
  WHERE (("w"."id" = "project_steps"."work_item_id") AND "public"."app_is_active_user"() AND (("w"."responsible_id" = "auth"."uid"()) OR ("w"."created_by" = "auth"."uid"())))))));



CREATE POLICY "steps_read_authenticated" ON "public"."project_steps" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."team_access_audit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_access_audit_insert_total" ON "public"."team_access_audit" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_total_access"());



CREATE POLICY "team_access_audit_select_total" ON "public"."team_access_audit" FOR SELECT TO "authenticated" USING ("public"."has_total_access"());



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_members_delete_total" ON "public"."team_members" FOR DELETE TO "authenticated" USING ("public"."has_total_access"());



CREATE POLICY "team_members_insert_total" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_total_access"());



CREATE POLICY "team_members_select_active" ON "public"."team_members" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "team_members_update_total" ON "public"."team_members" FOR UPDATE TO "authenticated" USING ("public"."has_total_access"()) WITH CHECK ("public"."has_total_access"());



ALTER TABLE "public"."work_item_board_assignment_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_item_board_assignment_events_select_active" ON "public"."work_item_board_assignment_events" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."work_item_board_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_item_board_assignments_select_active" ON "public"."work_item_board_assignments" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



ALTER TABLE "public"."work_item_checklists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_item_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_item_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_item_schedule_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "work_item_schedule_requirements_delete_total" ON "public"."work_item_schedule_requirements" FOR DELETE TO "authenticated" USING ("public"."app_has_total_access"());



CREATE POLICY "work_item_schedule_requirements_insert_authenticated" ON "public"."work_item_schedule_requirements" FOR INSERT TO "authenticated" WITH CHECK ("public"."app_is_active_user"());



CREATE POLICY "work_item_schedule_requirements_read_authenticated" ON "public"."work_item_schedule_requirements" FOR SELECT TO "authenticated" USING ("public"."app_is_active_user"());



CREATE POLICY "work_item_schedule_requirements_update_authenticated" ON "public"."work_item_schedule_requirements" FOR UPDATE TO "authenticated" USING ("public"."app_is_active_user"()) WITH CHECK ("public"."app_is_active_user"());



ALTER TABLE "public"."work_items" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_clients_to_pauta"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_clients_to_pauta_v8"("p_pauta_id" "uuid", "p_clients" "jsonb", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_clients_to_pauta_v8"("p_pauta_id" "uuid", "p_clients" "jsonb", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_clients_to_pauta_v8"("p_pauta_id" "uuid", "p_clients" "jsonb", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."adopt_legacy_cards_to_pauta"("p_pauta_id" "uuid", "p_mapping" "jsonb", "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."app_current_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_current_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_current_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."app_has_total_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."app_has_total_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_has_total_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_has_total_access"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_is_active_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_is_active_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_is_active_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_is_manager"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_is_manager"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_is_manager"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_log_feed_board_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_log_feed_board_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_log_feed_board_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_validate_calendar_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_validate_calendar_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_validate_calendar_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."app_validate_work_item_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."app_validate_work_item_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."app_validate_work_item_links"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."change_pauta_lifecycle"("p_pauta_id" "uuid", "p_action" "text", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_and_distribute_pauta_demands"("p_pauta_id" "uuid", "p_rows" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_and_distribute_pauta_demands"("p_pauta_id" "uuid", "p_rows" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_and_distribute_pauta_demands"("p_pauta_id" "uuid", "p_rows" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_pauta_demand"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_board_column_id" "uuid", "p_title" "text", "p_client_service_id" "uuid", "p_responsible_id" "uuid", "p_priority" "text", "p_internal_deadline" "date", "p_final_deadline" "date", "p_drive_link" "text", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_board_column_move_cards"("p_column_id" "uuid", "p_target_column_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_board_column_move_cards"("p_column_id" "uuid", "p_target_column_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_board_column_move_cards"("p_column_id" "uuid", "p_target_column_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_board_column_move_cards"("p_column_id" "uuid", "p_target_column_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_board_preserve_demands"("p_board_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_board_preserve_demands"("p_board_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_board_preserve_demands"("p_board_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_board_preserve_demands"("p_board_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_empty_pauta"("p_pauta_id" "uuid", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_empty_pauta"("p_pauta_id" "uuid", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detach_pauta_demand"("p_pauta_id" "uuid", "p_work_item_id" "uuid", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."distribute_existing_pauta_demands"("p_pauta_id" "uuid", "p_work_item_ids" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."distribute_existing_pauta_demands"("p_pauta_id" "uuid", "p_work_item_ids" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."distribute_existing_pauta_demands"("p_pauta_id" "uuid", "p_work_item_ids" "jsonb", "p_targets" "jsonb", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_next_work_item_cycle"("p_source_id" "uuid", "p_client_service_id" "uuid", "p_start_date" "date", "p_end_date" "date", "p_programming_verified" boolean, "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pauta_management_snapshot"("p_pauta_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"() TO "anon";
GRANT ALL ON FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."guard_active_pauta_work_item_requires_pauta"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."has_total_access"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."has_total_access"() TO "anon";
GRANT ALL ON FUNCTION "public"."has_total_access"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_total_access"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."move_work_item_board_assignment"("p_assignment_id" "uuid", "p_target_column_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."move_work_item_board_assignment"("p_assignment_id" "uuid", "p_target_column_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."move_work_item_board_assignment"("p_assignment_id" "uuid", "p_target_column_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."open_monthly_pauta"("p_board_id" "uuid", "p_name" "text", "p_reference_month" "date", "p_magic_number_date" "date", "p_scheduled_until_date" "date", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pauta_create_main_card_core"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_actor_id" "uuid", "p_source" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pauta_create_main_card_core"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_actor_id" "uuid", "p_source" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pauta_create_main_card_core"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_actor_id" "uuid", "p_source" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pauta_current_active_actor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pauta_current_active_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."pauta_current_active_actor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."pauta_dependency_summary"("p_pauta_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pauta_dependency_summary"("p_pauta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."pauta_dependency_summary"("p_pauta_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pauta_dependency_summary"("p_pauta_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pauta_log_event"("p_pauta_id" "uuid", "p_board_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_target_type" "text", "p_target_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pauta_log_event"("p_pauta_id" "uuid", "p_board_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_target_type" "text", "p_target_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."pauta_log_event"("p_pauta_id" "uuid", "p_board_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_target_type" "text", "p_target_id" "uuid", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pauta_management_actor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pauta_management_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."pauta_management_actor"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."preview_legacy_pauta_import"("p_pauta_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_pauta_client_additions"("p_pauta_id" "uuid", "p_client_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_work_item_global_status"("p_work_item_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_work_item_global_status"("p_work_item_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_work_item_global_status"("p_work_item_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_client_from_pauta"("p_pauta_id" "uuid", "p_client_id" "uuid", "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_pauta_clients_batch"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_pauta_clients_batch"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_pauta_clients_batch"("p_pauta_id" "uuid", "p_client_ids" "uuid"[], "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_pauta_demands_batch"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_pauta_demands_batch"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_pauta_demands_batch"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_pauta_extra_demands_v92c"("p_pauta_id" "uuid", "p_work_item_ids" "uuid"[], "p_confirmation" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_work_item_board_assignment"("p_assignment_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_work_item_board_assignment"("p_assignment_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_work_item_board_assignment"("p_assignment_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_board_default_columns"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_board_default_columns"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_board_default_columns"() TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_project_step_statuses_for_work_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_project_step_statuses_for_work_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_project_step_statuses_for_work_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_avisos_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_avisos_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_avisos_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_calendar_event_completion"("p_event_id" "uuid", "p_completed" boolean, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_calendar_event_completion"("p_event_id" "uuid", "p_completed" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_calendar_event_completion"("p_event_id" "uuid", "p_completed" boolean, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_internal_messages_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_internal_messages_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_internal_messages_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_team_members_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_team_members_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_team_members_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_work_item_board_assignment_completion"("p_assignment_id" "uuid", "p_completed" boolean, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_work_item_board_assignment_completion"("p_assignment_id" "uuid", "p_completed" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_work_item_board_assignment_completion"("p_assignment_id" "uuid", "p_completed" boolean, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_work_item_completion"("p_work_item_id" "uuid", "p_completed" boolean, "p_complete_assignments" boolean, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_work_item_completion"("p_work_item_id" "uuid", "p_completed" boolean, "p_complete_assignments" boolean, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_work_item_completion"("p_work_item_id" "uuid", "p_completed" boolean, "p_complete_assignments" boolean, "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_calendar_event_pauta"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_calendar_event_pauta"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_calendar_event_pauta"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_cycle_schedule_requirement_from_calendar_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_pauta_members_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_pauta_members_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_pauta_members_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_pautas_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_pautas_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_pautas_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_project_step_statuses_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_project_step_statuses_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_project_step_statuses_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_pauta_member_target_date"("p_member_id" "uuid", "p_target_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_pauta_member_target_date"("p_member_id" "uuid", "p_target_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pauta_member_target_date"("p_member_id" "uuid", "p_target_date" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pauta_settings"("p_pauta_id" "uuid", "p_name" "text", "p_magic_number_date" "date", "p_scheduled_until_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."v8_assignment_after_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."v8_assignment_after_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v8_assignment_after_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."v8_assignment_is_complete"("p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."v8_assignment_is_complete"("p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."v8_assignment_is_complete"("p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."v8_log_assignment_event"("p_assignment_id" "uuid", "p_work_item_id" "uuid", "p_pauta_id" "uuid", "p_board_id" "uuid", "p_board_column_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."v8_log_assignment_event"("p_assignment_id" "uuid", "p_work_item_id" "uuid", "p_pauta_id" "uuid", "p_board_id" "uuid", "p_board_column_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."v8_log_assignment_event"("p_assignment_id" "uuid", "p_work_item_id" "uuid", "p_pauta_id" "uuid", "p_board_id" "uuid", "p_board_column_id" "uuid", "p_actor_id" "uuid", "p_action" "text", "p_old_values" "jsonb", "p_new_values" "jsonb", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."v8_sync_assignment_from_work_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."v8_sync_assignment_from_work_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v8_sync_assignment_from_work_item"() TO "service_role";



GRANT ALL ON FUNCTION "public"."v9_prepare_simple_assignment_card"() TO "anon";
GRANT ALL ON FUNCTION "public"."v9_prepare_simple_assignment_card"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."v9_prepare_simple_assignment_card"() TO "service_role";



GRANT ALL ON TABLE "public"."approvals" TO "anon";
GRANT ALL ON TABLE "public"."approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."approvals" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."avisos" TO "anon";
GRANT ALL ON TABLE "public"."avisos" TO "authenticated";
GRANT ALL ON TABLE "public"."avisos" TO "service_role";



GRANT ALL ON TABLE "public"."blockers" TO "anon";
GRANT ALL ON TABLE "public"."blockers" TO "authenticated";
GRANT ALL ON TABLE "public"."blockers" TO "service_role";



GRANT ALL ON TABLE "public"."board_columns" TO "anon";
GRANT ALL ON TABLE "public"."board_columns" TO "authenticated";
GRANT ALL ON TABLE "public"."board_columns" TO "service_role";



GRANT ALL ON TABLE "public"."boards" TO "anon";
GRANT ALL ON TABLE "public"."boards" TO "authenticated";
GRANT ALL ON TABLE "public"."boards" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calendar_event_history" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."calendar_event_history" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_event_history" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."client_services" TO "anon";
GRANT ALL ON TABLE "public"."client_services" TO "authenticated";
GRANT ALL ON TABLE "public"."client_services" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."feed_board_events" TO "anon";
GRANT ALL ON TABLE "public"."feed_board_events" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_board_events" TO "service_role";



GRANT ALL ON TABLE "public"."feed_board_item_assets" TO "anon";
GRANT ALL ON TABLE "public"."feed_board_item_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_board_item_assets" TO "service_role";



GRANT ALL ON TABLE "public"."feed_board_items" TO "anon";
GRANT ALL ON TABLE "public"."feed_board_items" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_board_items" TO "service_role";



GRANT ALL ON TABLE "public"."feed_boards" TO "anon";
GRANT ALL ON TABLE "public"."feed_boards" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_boards" TO "service_role";



GRANT ALL ON TABLE "public"."feed_posts" TO "anon";
GRANT ALL ON TABLE "public"."feed_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."feed_posts" TO "service_role";



GRANT ALL ON TABLE "public"."internal_message_mentions" TO "anon";
GRANT ALL ON TABLE "public"."internal_message_mentions" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_message_mentions" TO "service_role";



GRANT ALL ON TABLE "public"."internal_messages" TO "anon";
GRANT ALL ON TABLE "public"."internal_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_messages" TO "service_role";



GRANT ALL ON TABLE "public"."pauta_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pauta_events" TO "authenticated";
GRANT ALL ON TABLE "public"."pauta_events" TO "service_role";



GRANT ALL ON TABLE "public"."pauta_members" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pauta_members" TO "authenticated";
GRANT ALL ON TABLE "public"."pauta_members" TO "service_role";



GRANT ALL ON TABLE "public"."pautas" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."pautas" TO "authenticated";
GRANT ALL ON TABLE "public"."pautas" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."project_step_statuses" TO "anon";
GRANT ALL ON TABLE "public"."project_step_statuses" TO "authenticated";
GRANT ALL ON TABLE "public"."project_step_statuses" TO "service_role";



GRANT ALL ON TABLE "public"."project_steps" TO "anon";
GRANT ALL ON TABLE "public"."project_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."project_steps" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."resource_links" TO "anon";
GRANT ALL ON TABLE "public"."resource_links" TO "authenticated";
GRANT ALL ON TABLE "public"."resource_links" TO "service_role";



GRANT ALL ON TABLE "public"."service_catalog" TO "anon";
GRANT ALL ON TABLE "public"."service_catalog" TO "authenticated";
GRANT ALL ON TABLE "public"."service_catalog" TO "service_role";



GRANT ALL ON TABLE "public"."team_access_audit" TO "anon";
GRANT ALL ON TABLE "public"."team_access_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."team_access_audit" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_item_board_assignment_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_item_board_assignment_events" TO "authenticated";
GRANT ALL ON TABLE "public"."work_item_board_assignment_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_item_board_assignments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."work_item_board_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."work_item_board_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."work_item_checklists" TO "anon";
GRANT ALL ON TABLE "public"."work_item_checklists" TO "authenticated";
GRANT ALL ON TABLE "public"."work_item_checklists" TO "service_role";



GRANT ALL ON TABLE "public"."work_item_comments" TO "anon";
GRANT ALL ON TABLE "public"."work_item_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."work_item_comments" TO "service_role";



GRANT ALL ON TABLE "public"."work_item_history" TO "anon";
GRANT ALL ON TABLE "public"."work_item_history" TO "authenticated";
GRANT ALL ON TABLE "public"."work_item_history" TO "service_role";



GRANT ALL ON TABLE "public"."work_item_schedule_requirements" TO "anon";
GRANT ALL ON TABLE "public"."work_item_schedule_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."work_item_schedule_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."work_items" TO "anon";
GRANT ALL ON TABLE "public"."work_items" TO "authenticated";
GRANT ALL ON TABLE "public"."work_items" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








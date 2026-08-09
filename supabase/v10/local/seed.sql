\set ON_ERROR_STOP on

select set_config(
  'v10.user_id',
  :'v10_user_id',
  false
);

select set_config(
  'v10.email',
  :'v10_email',
  false
);

begin;

do $v10$
declare
    v_user_id uuid :=
      current_setting('v10.user_id')::uuid;

    v_email text :=
      current_setting('v10.email');

    v_client_id uuid;

    v_pauta_board_id uuid;
    v_custom_board_id uuid;

    v_pauta_column_id uuid;
    v_custom_column_id uuid;

    v_pauta_id uuid;
    v_work_item_id uuid;

    v_pauta_member_id uuid;
    v_assignment_id uuid;

    v_reference_month date :=
      date_trunc('month', current_date)::date;

begin

    update public.team_members
    set
        profile_id = v_user_id,
        full_name = 'V10 Preview Admin',
        job_title = 'Administrador V10',
        access_type = 'total',
        operational_area = 'V10 QA',
        is_active = true,
        receives_internal_alerts = true,
        metadata =
          '{"synthetic":true,"environment":"v10-local"}'::jsonb,
        must_change_password = false,
        updated_at = now()
    where lower(email)=lower(v_email);

    if not found then

        insert into public.team_members (
            id,
            profile_id,
            full_name,
            email,
            job_title,
            access_type,
            operational_area,
            avatar_initials,
            is_active,
            receives_internal_alerts,
            metadata,
            must_change_password
        )
        values (
            '10000000-0000-4000-8000-000000000001'::uuid,
            v_user_id,
            'V10 Preview Admin',
            v_email,
            'Administrador V10',
            'total',
            'V10 QA',
            'V10',
            true,
            true,
            '{"synthetic":true,"environment":"v10-local"}'::jsonb,
            false
        );

    end if;

    select id
    into v_client_id
    from public.clients
    where
        id='10000000-0000-4000-8000-000000000010'::uuid
        or name='[V10 TEST] Cliente Sintetico'
    order by
        (
          id='10000000-0000-4000-8000-000000000010'::uuid
        ) desc
    limit 1;

    if v_client_id is null then

        insert into public.clients (
            id,
            name,
            segment,
            status,
            avatar_initials,
            avatar_color,
            avatar_bg,
            responsible_id,
            main_contact_name,
            main_contact_email,
            notes,
            operation_model
        )
        values (
            '10000000-0000-4000-8000-000000000010'::uuid,
            '[V10 TEST] Cliente Sintetico',
            'Ambiente de Teste',
            'active',
            'V10',
            '#2563EB',
            '#EFF6FF',
            v_user_id,
            'Contato V10',
            'cliente-v10@ampydigital.test',
            'Registro exclusivamente sintetico do laboratorio V10.',
            'monthly'
        )
        returning id into v_client_id;

    else

        update public.clients
        set
            name='[V10 TEST] Cliente Sintetico',
            segment='Ambiente de Teste',
            status='active',
            responsible_id=v_user_id,
            notes=
              'Registro exclusivamente sintetico do laboratorio V10.',
            operation_model='monthly',
            updated_at=now()
        where id=v_client_id;

    end if;

    select id
    into v_pauta_board_id
    from public.boards
    where
        id='10000000-0000-4000-8000-000000000020'::uuid
        or name='[V10 TEST] Pauta Operacional'
    order by
        (
          id='10000000-0000-4000-8000-000000000020'::uuid
        ) desc
    limit 1;

    if v_pauta_board_id is null then

        insert into public.boards (
            id,
            name,
            description,
            color,
            status,
            created_by,
            board_kind
        )
        values (
            '10000000-0000-4000-8000-000000000020'::uuid,
            '[V10 TEST] Pauta Operacional',
            'Pipeline sintetica da Pauta V10.',
            '#2563EB',
            'active',
            v_user_id,
            'pauta'
        )
        returning id into v_pauta_board_id;

    else

        update public.boards
        set
            name='[V10 TEST] Pauta Operacional',
            description='Pipeline sintetica da Pauta V10.',
            status='active',
            created_by=v_user_id,
            board_kind='pauta',
            updated_at=now()
        where id=v_pauta_board_id;

    end if;

    select id
    into v_custom_board_id
    from public.boards
    where
        id='10000000-0000-4000-8000-000000000030'::uuid
        or name='[V10 TEST] Quadro QA'
    order by
        (
          id='10000000-0000-4000-8000-000000000030'::uuid
        ) desc
    limit 1;

    if v_custom_board_id is null then

        insert into public.boards (
            id,
            name,
            description,
            color,
            status,
            created_by,
            board_kind
        )
        values (
            '10000000-0000-4000-8000-000000000030'::uuid,
            '[V10 TEST] Quadro QA',
            'Quadro personalizado sintetico.',
            '#7C3AED',
            'active',
            v_user_id,
            'custom'
        )
        returning id into v_custom_board_id;

    else

        update public.boards
        set
            name='[V10 TEST] Quadro QA',
            description='Quadro personalizado sintetico.',
            status='active',
            created_by=v_user_id,
            board_kind='custom',
            updated_at=now()
        where id=v_custom_board_id;

    end if;

    select id
    into v_pauta_column_id
    from public.board_columns
    where
        board_id=v_pauta_board_id
        and lower(btrim(name))=lower(btrim('A fazer'))
    limit 1;

    if v_pauta_column_id is null then

        insert into public.board_columns (
            id,
            board_id,
            name,
            color,
            operational_status,
            position
        )
        values (
            '10000000-0000-4000-8000-000000000021'::uuid,
            v_pauta_board_id,
            'A fazer',
            '#2563EB',
            'not_started',
            0
        )
        returning id into v_pauta_column_id;

    end if;

    select id
    into v_custom_column_id
    from public.board_columns
    where
        board_id=v_custom_board_id
        and lower(btrim(name))=lower(btrim('Entrada'))
    limit 1;

    if v_custom_column_id is null then

        insert into public.board_columns (
            id,
            board_id,
            name,
            color,
            operational_status,
            position
        )
        values (
            '10000000-0000-4000-8000-000000000031'::uuid,
            v_custom_board_id,
            'Entrada',
            '#7C3AED',
            'not_started',
            0
        )
        returning id into v_custom_column_id;

    end if;

    select id
    into v_pauta_id
    from public.pautas
    where
        id='10000000-0000-4000-8000-000000000040'::uuid
        or (
            board_id=v_pauta_board_id
            and reference_month=v_reference_month
        )
    order by
        (
          id='10000000-0000-4000-8000-000000000040'::uuid
        ) desc
    limit 1;

    if v_pauta_id is null then

        insert into public.pautas (
            id,
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
            '10000000-0000-4000-8000-000000000040'::uuid,
            v_pauta_board_id,
            '[V10 TEST] Pauta Sintetica',
            v_reference_month,
            v_reference_month + 19,
            v_reference_month + 34,
            'open',
            now(),
            v_user_id
        )
        returning id into v_pauta_id;

    else

        update public.pautas
        set
            board_id=v_pauta_board_id,
            name='[V10 TEST] Pauta Sintetica',
            reference_month=v_reference_month,
            magic_number_date=v_reference_month + 19,
            scheduled_until_date=v_reference_month + 34,
            lifecycle_status='open',
            created_by=v_user_id,
            updated_at=now()
        where id=v_pauta_id;

    end if;

    select id
    into v_work_item_id
    from public.work_items
    where
        id='10000000-0000-4000-8000-000000000050'::uuid
        or (
            pauta_id=v_pauta_id
            and client_id=v_client_id
            and is_pauta_card=true
        )
    order by
        (
          id='10000000-0000-4000-8000-000000000050'::uuid
        ) desc
    limit 1;

    if v_work_item_id is null then

        insert into public.work_items (
            id,
            title,
            description,
            client_id,
            type,
            origin,
            status,
            priority,
            responsible_id,
            created_by,
            internal_deadline,
            final_deadline,
            notes,
            destino,
            board_id,
            board_column_id,
            card_tag,
            card_tag_color,
            pauta_id,
            is_pauta_card
        )
        values (
            '10000000-0000-4000-8000-000000000050'::uuid,
            '[V10 TEST] Demanda Sintetica',
            'Demanda canonica exclusivamente sintetica.',
            v_client_id,
            'task',
            'planned',
            'not_started',
            'normal',
            v_user_id,
            v_user_id,
            current_date + 7,
            current_date + 14,
            'Seed operacional V10.',
            'quadro',
            v_pauta_board_id,
            v_pauta_column_id,
            'V10',
            'blue',
            v_pauta_id,
            true
        )
        returning id into v_work_item_id;

    else

        update public.work_items
        set
            title='[V10 TEST] Demanda Sintetica',
            description=
              'Demanda canonica exclusivamente sintetica.',
            client_id=v_client_id,
            status='not_started',
            priority='normal',
            responsible_id=v_user_id,
            created_by=v_user_id,
            internal_deadline=current_date + 7,
            final_deadline=current_date + 14,
            notes='Seed operacional V10.',
            destino='quadro',
            board_id=v_pauta_board_id,
            board_column_id=v_pauta_column_id,
            card_tag='V10',
            card_tag_color='blue',
            pauta_id=v_pauta_id,
            is_pauta_card=true,
            completed_at=null,
            completed_by=null,
            updated_at=now()
        where id=v_work_item_id;

    end if;

    select id
    into v_pauta_member_id
    from public.pauta_members
    where
        id='10000000-0000-4000-8000-000000000060'::uuid
        or (
            pauta_id=v_pauta_id
            and client_id=v_client_id
        )
    order by
        (
          id='10000000-0000-4000-8000-000000000060'::uuid
        ) desc
    limit 1;

    if v_pauta_member_id is null then

        insert into public.pauta_members (
            id,
            pauta_id,
            client_id,
            main_work_item_id,
            membership_status,
            source,
            added_by,
            metadata,
            target_date
        )
        values (
            '10000000-0000-4000-8000-000000000060'::uuid,
            v_pauta_id,
            v_client_id,
            v_work_item_id,
            'active',
            'added',
            v_user_id,
            '{"synthetic":true,"environment":"v10-local"}'::jsonb,
            current_date + 7
        )
        returning id into v_pauta_member_id;

    else

        update public.pauta_members
        set
            pauta_id=v_pauta_id,
            client_id=v_client_id,
            main_work_item_id=v_work_item_id,
            membership_status='active',
            source='added',
            added_by=v_user_id,
            removed_by=null,
            removed_at=null,
            metadata=
              '{"synthetic":true,"environment":"v10-local"}'::jsonb,
            target_date=current_date + 7,
            updated_at=now()
        where id=v_pauta_member_id;

    end if;

    select id
    into v_assignment_id
    from public.work_item_board_assignments
    where
        id='10000000-0000-4000-8000-000000000070'::uuid
        or (
            work_item_id=v_work_item_id
            and board_id=v_custom_board_id
            and assignment_status='active'
        )
    order by
        (
          id='10000000-0000-4000-8000-000000000070'::uuid
        ) desc
    limit 1;

    if v_assignment_id is null then

        insert into public.work_item_board_assignments (
            id,
            work_item_id,
            board_id,
            board_column_id,
            operational_status,
            is_required,
            assignment_status,
            position,
            assigned_by,
            metadata
        )
        values (
            '10000000-0000-4000-8000-000000000070'::uuid,
            v_work_item_id,
            v_custom_board_id,
            v_custom_column_id,
            'not_started',
            true,
            'active',
            0,
            v_user_id,
            '{"synthetic":true,"environment":"v10-local"}'::jsonb
        )
        returning id into v_assignment_id;

    else

        update public.work_item_board_assignments
        set
            work_item_id=v_work_item_id,
            board_id=v_custom_board_id,
            board_column_id=v_custom_column_id,
            operational_status='not_started',
            is_required=true,
            assignment_status='active',
            position=0,
            assigned_by=v_user_id,
            completed_by=null,
            completed_at=null,
            removed_by=null,
            removed_at=null,
            metadata=
              '{"synthetic":true,"environment":"v10-local"}'::jsonb,
            updated_at=now()
        where id=v_assignment_id;

    end if;

end;
$v10$;

commit;
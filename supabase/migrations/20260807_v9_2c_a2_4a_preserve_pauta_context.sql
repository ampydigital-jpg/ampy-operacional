-- =========================================================
-- V9.2C-A2.4A
-- Preserva contexto de Pauta ao distribuir demandas.
-- Esta migration já foi aplicada e validada no Supabase.
-- =========================================================

do $patch$
declare
  v_oid oid;
  v_definition text;

  v_anchor text :=
$anchor$  if v_item.pauta_id is null and v_active_count = 1 then
    select board_id, board_column_id
    into v_single_board_id, v_single_column_id
    from public.work_item_board_assignments
    where work_item_id = p_work_item_id
      and assignment_status = 'active'
    limit 1;
  else
    v_single_board_id := null;
    v_single_column_id := null;
  end if;$anchor$;

  v_replacement text :=
$replacement$  if v_item.pauta_id is not null then
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

  end if;$replacement$;

begin

  v_oid :=
    to_regprocedure(
      'public.recalculate_work_item_global_status(uuid)'
    );

  if v_oid is null then
    raise exception
      'Função recalculate_work_item_global_status não encontrada.';
  end if;

  v_definition :=
    pg_get_functiondef(
      v_oid
    );

  if position(
    'if v_item.pauta_id is not null then'
    in v_definition
  ) = 0
  then

    if position(
      v_anchor
      in v_definition
    ) = 0
    then
      raise exception
        'Trecho esperado de recalculate_work_item_global_status divergiu.';
    end if;

    execute replace(
      v_definition,
      v_anchor,
      v_replacement
    );

  end if;

end;
$patch$;


do $repair$
declare
  r record;
  v_history_column uuid;
  v_peer_column uuid;
  v_resolved_column uuid;

begin

  for r in

    select
      wi.id,
      wi.title,
      wi.pauta_id,
      wi.board_id as old_board_id,
      wi.board_column_id
        as old_column_id,
      wi.created_at,
      p.board_id
        as pauta_board_id

    from public.work_items wi

    join public.pautas p
      on p.id = wi.pauta_id

    where
      coalesce(
        wi.is_pauta_card,
        false
      ) = true

      and wi.status not in (
        'archived',
        'cancelled'
      )

      and (
        wi.board_id is null
        or wi.board_column_id is null
      )

    for update of wi

  loop

    v_history_column := null;
    v_peer_column := null;
    v_resolved_column := null;

    select bc.id
    into v_history_column

    from public.work_item_history h

    join public.board_columns bc
      on bc.id::text = h.new_value
     and bc.board_id =
       r.pauta_board_id

    where
      h.work_item_id = r.id
      and h.field_changed =
        'board_column'
      and h.new_value is not null

    order by h.created_at desc
    limit 1;


    if v_history_column is null then

      select
        case
          when count(
            distinct
            peer.board_column_id
          ) = 1
          then
            min(
              peer.board_column_id::text
            )::uuid
          else null
        end

      into v_peer_column

      from public.work_items peer

      where
        peer.pauta_id = r.pauta_id

        and coalesce(
          peer.is_pauta_card,
          false
        ) = true

        and peer.status not in (
          'archived',
          'cancelled'
        )

        and peer.created_at =
          r.created_at

        and peer.board_id =
          r.pauta_board_id

        and peer.board_column_id
          is not null;

    end if;


    v_resolved_column :=
      coalesce(
        v_history_column,
        v_peer_column
      );


    if v_resolved_column is null then

      raise exception
        'Não foi possível restaurar com evidência a coluna da demanda % (%).',
        r.title,
        r.id;

    end if;


    if not exists (

      select 1

      from public.board_columns bc

      where
        bc.id =
          v_resolved_column

        and bc.board_id =
          r.pauta_board_id

    ) then

      raise exception
        'Coluna restaurada não pertence ao Quadro da Pauta para %. ',
        r.id;

    end if;


    update public.work_items

    set
      board_id =
        r.pauta_board_id,

      board_column_id =
        v_resolved_column,

      updated_at =
        now()

    where id = r.id;


    insert into
      public.work_item_history(
        work_item_id,
        actor_id,
        field_changed,
        old_value,
        new_value,
        created_at
      )

    values (
      r.id,
      null,

      'board_context_repaired_v9_2c_a2_4a',

      jsonb_build_object(
        'board_id',
        r.old_board_id,
        'board_column_id',
        r.old_column_id
      )::text,

      jsonb_build_object(
        'board_id',
        r.pauta_board_id,
        'board_column_id',
        v_resolved_column,
        'source',
        case
          when v_history_column
            is not null
          then
            'work_item_history'
          else
            'same_creation_batch'
        end
      )::text,

      now()
    );

  end loop;

end;
$repair$;

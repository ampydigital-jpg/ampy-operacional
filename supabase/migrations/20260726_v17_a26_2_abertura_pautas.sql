-- ============================================================
-- V17-A26.2 — ABERTURA ATÔMICA DE PAUTAS MENSAIS
-- Cria a Pauta e um card mensal por cliente em uma transação.
-- ============================================================

begin;

create or replace function public.open_monthly_pauta(
  p_board_id uuid,
  p_name text,
  p_reference_month date,
  p_magic_number_date date,
  p_scheduled_until_date date,
  p_client_ids uuid[],
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid;
  v_board public.boards%rowtype;
  v_alignment public.board_columns%rowtype;
  v_pauta_id uuid;
  v_client record;
  v_work_item_id uuid;
  v_selected_count integer;
  v_unique_count integer;
  v_active_count integer;
  v_cards_created integer := 0;
  v_requires_alignment boolean;
  v_requires_capture boolean;
  v_capture_type text;
  v_title text;
begin
  v_actor := auth.uid();

  if v_actor is null then
    raise exception
      'Sessão inválida.';
  end if;

  if not public.app_has_total_access() then
    raise exception
      'Somente usuários com Acesso Total podem abrir Pautas.';
  end if;

  if trim(
    coalesce(
      p_confirmation,
      ''
    )
  ) <> 'ABRIR PAUTA' then
    raise exception
      'Confirmação inválida. Digite ABRIR PAUTA.';
  end if;

  if p_board_id is null then
    raise exception
      'Quadro obrigatório.';
  end if;

  if length(
    trim(
      coalesce(
        p_name,
        ''
      )
    )
  ) not between 3 and 120 then
    raise exception
      'O nome da Pauta deve possuir entre 3 e 120 caracteres.';
  end if;

  if
    p_reference_month is null
    or p_reference_month <>
      date_trunc(
        'month',
        p_reference_month
      )::date
  then
    raise exception
      'O mês de referência deve utilizar o primeiro dia do mês.';
  end if;

  if
    p_magic_number_date is null
    or p_scheduled_until_date is null
  then
    raise exception
      'Magic Number e Programado até são obrigatórios.';
  end if;

  if
    p_magic_number_date >
    p_scheduled_until_date
  then
    raise exception
      'O Magic Number não pode ser posterior à data Programado até.';
  end if;

  if
    p_client_ids is null
    or cardinality(
      p_client_ids
    ) = 0
  then
    raise exception
      'Selecione pelo menos um cliente ativo.';
  end if;

  if cardinality(
    p_client_ids
  ) > 300 then
    raise exception
      'A Pauta aceita no máximo 300 clientes por abertura.';
  end if;

  if exists (
    select 1
    from unnest(
      p_client_ids
    ) as selected(
      client_id
    )
    where selected.client_id is null
  ) then
    raise exception
      'A seleção contém cliente inválido.';
  end if;

  select
    count(*),
    count(
      distinct
      selected.client_id
    )
  into
    v_selected_count,
    v_unique_count
  from unnest(
    p_client_ids
  ) as selected(
    client_id
  );

  if
    v_selected_count <>
    v_unique_count
  then
    raise exception
      'A seleção contém clientes duplicados.';
  end if;

  select *
  into v_board
  from public.boards
  where id = p_board_id
    and status = 'active'
  for update;

  if not found then
    raise exception
      'Quadro inválido ou inativo.';
  end if;

  select *
  into v_alignment
  from public.board_columns
  where board_id =
    p_board_id
    and automation_role =
      'alignment'
  order by
    position,
    created_at
  limit 1;

  if not found then
    raise exception
      'O Quadro não possui uma coluna de Reunião de Alinhamento configurada.';
  end if;

  if exists (
    select 1
    from public.pautas
    where board_id =
      p_board_id
      and reference_month =
        p_reference_month
  ) then
    raise exception
      'Já existe uma Pauta neste Quadro para o mês informado.';
  end if;

  select count(*)
  into v_active_count
  from public.clients
  where id = any(
    p_client_ids
  )
    and status = 'active';

  if
    v_active_count <>
    v_unique_count
  then
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

  for v_client in
    select
      client.id,
      client.name,
      client.responsible_id,
      client.drive_folder_url
    from public.clients
      as client
    where client.id = any(
      p_client_ids
    )
      and client.status =
        'active'
    order by
      client.name
  loop
    v_title :=
      upper(
        trim(
          v_client.name
        )
      ) ||
      ' - ' ||
      to_char(
        p_reference_month,
        'MM/YYYY'
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
        v_alignment
          .operational_status,
        'not_started'
      ),
      'normal',
      v_client.id,
      null,
      v_client.responsible_id,
      p_board_id,
      v_alignment.id,
      p_magic_number_date,
      p_magic_number_date,
      v_client.drive_folder_url,
      null,
      null,
      v_actor,
      null,
      v_pauta_id,
      true,
      null,
      null
    )
    returning id
    into v_work_item_id;

    select
      coalesce(
        bool_or(
          service
            .requires_alignment_meeting
        ),
        false
      ),

      coalesce(
        bool_or(
          service
            .requires_capture
        ),
        false
      ),

      case
        when count(
          distinct
          service
            .default_capture_type
        ) filter (
          where service
            .default_capture_type
            is not null
        ) = 1
          then max(
            service
              .default_capture_type
          ) filter (
            where service
              .default_capture_type
              is not null
          )

        else null
      end
    into
      v_requires_alignment,
      v_requires_capture,
      v_capture_type
    from public.client_services
      as service
    where service.client_id =
      v_client.id
      and service.status =
        'active';

    if v_requires_alignment then
      insert into
        public
          .work_item_schedule_requirements (
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
        v_actor
      )
      on conflict (
        work_item_id,
        requirement_type
      )
      do nothing;
    end if;

    if v_requires_capture then
      insert into
        public
          .work_item_schedule_requirements (
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
        v_actor
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
      v_actor,
      'pauta_opened',
      null,
      v_pauta_id::text
    );

    v_cards_created :=
      v_cards_created + 1;
  end loop;

  return jsonb_build_object(
    'success',
    true,
    'pauta_id',
    v_pauta_id,
    'cards_created',
    v_cards_created,
    'reference_month',
    p_reference_month,
    'magic_number_date',
    p_magic_number_date,
    'scheduled_until_date',
    p_scheduled_until_date
  );
end;
$function$;

revoke all
on function public.open_monthly_pauta(
  uuid,
  text,
  date,
  date,
  date,
  uuid[],
  text
)
from public;

grant execute
on function public.open_monthly_pauta(
  uuid,
  text,
  date,
  date,
  date,
  uuid[],
  text
)
to authenticated;

comment on function public.open_monthly_pauta(
  uuid,
  text,
  date,
  date,
  date,
  uuid[],
  text
) is
  'Abre uma Pauta mensal e cria atomicamente um card principal por cliente ativo selecionado.';

commit;

select
  'V17-A26.2 aplicada com sucesso'
    as resultado,

  to_regprocedure(
    'public.open_monthly_pauta(uuid,text,date,date,date,uuid[],text)'
  ) is not null
    as open_monthly_pauta_ok,

  has_function_privilege(
    'authenticated',
    'public.open_monthly_pauta(uuid,text,date,date,date,uuid[],text)',
    'EXECUTE'
  ) as authenticated_execute_ok,

  (
    select count(*)
    from public.pautas
  ) as pautas_existentes,

  (
    select count(*)
    from public.work_items
    where is_pauta_card = true
  ) as cards_mensais_existentes;

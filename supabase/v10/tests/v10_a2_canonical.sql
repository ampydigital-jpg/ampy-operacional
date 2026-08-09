\set ON_ERROR_STOP on

begin;

create temp table v10_a2_results (
  ordem integer,
  teste text,
  ok boolean,
  detalhe text
);

-- ============================================================
-- IDENTIFICAR O AMBIENTE SINTETICO
-- ============================================================

select id as actor_id
from auth.users
where lower(email) = lower('v10-preview@ampydigital.test')
limit 1
\gset

select
  id as work_item_id,
  pauta_id as pauta_id
from public.work_items
where title = '[V10 TEST] Demanda Sintetica'
limit 1
\gset

select id as qa_board_id
from public.boards
where name = '[V10 TEST] Quadro QA'
  and board_kind = 'custom'
limit 1
\gset

select id as qa_entry_id
from public.board_columns
where board_id = :'qa_board_id'::uuid
  and lower(trim(name)) = 'entrada'
limit 1
\gset

insert into v10_a2_results
select
  1,
  'Demanda canonica existe',
  count(*) = 1,
  'work_item=' || :'work_item_id'
from public.work_items
where id = :'work_item_id'::uuid;

insert into v10_a2_results
select
  2,
  'Demanda possui Pauta',
  pauta_id = :'pauta_id'::uuid,
  'pauta=' || pauta_id::text
from public.work_items
where id = :'work_item_id'::uuid;

-- ============================================================
-- CRIAR DESTINOS TEMPORARIOS
-- Tudo sera ROLLBACK no final.
-- ============================================================

insert into public.board_columns (
  id,
  board_id,
  name,
  color,
  operational_status,
  position
)
values (
  gen_random_uuid(),
  :'qa_board_id'::uuid,
  '[V10 TX] Em execucao',
  '#2563EB',
  'in_progress',
  900
)
returning id as qa_exec_id
\gset

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
  gen_random_uuid(),
  '[V10 TX] Quadro Secundario',
  'Quadro temporario do teste canonico V10-A2.',
  '#7C3AED',
  'active',
  :'actor_id'::uuid,
  'custom'
)
returning id as second_board_id
\gset

insert into public.board_columns (
  id,
  board_id,
  name,
  color,
  operational_status,
  position
)
values (
  gen_random_uuid(),
  :'second_board_id'::uuid,
  '[V10 TX] Entrada',
  '#64748B',
  'not_started',
  0
)
returning id as second_column_id
\gset

-- ============================================================
-- SIMULAR USUARIO AUTENTICADO
-- ============================================================

select set_config(
  'request.jwt.claim.sub',
  :'actor_id',
  true
);

select set_config(
  'request.jwt.claim.role',
  'authenticated',
  true
);

-- ============================================================
-- 1. DISTRIBUIR A MESMA DEMANDA PARA DOIS QUADROS
-- ============================================================

set local role authenticated;

select public.distribute_existing_pauta_demands(
  :'pauta_id'::uuid,
  jsonb_build_array(
    :'work_item_id'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'board_id',
      :'qa_board_id',
      'board_column_id',
      :'qa_entry_id',
      'is_required',
      true
    ),
    jsonb_build_object(
      'board_id',
      :'second_board_id',
      'board_column_id',
      :'second_column_id',
      'is_required',
      true
    )
  ),
  'DISTRIBUIR DEMANDAS'
);

reset role;

insert into v10_a2_results
select
  3,
  'Multiquadro possui 2 vinculos ativos',
  count(*) = 2,
  'ativos=' || count(*)::text
from public.work_item_board_assignments
where work_item_id = :'work_item_id'::uuid
  and assignment_status = 'active';

insert into v10_a2_results
select
  4,
  'Distribuicao preservou pauta_id',
  pauta_id = :'pauta_id'::uuid,
  'pauta=' || pauta_id::text
from public.work_items
where id = :'work_item_id'::uuid;

select id as first_assignment_id
from public.work_item_board_assignments
where work_item_id = :'work_item_id'::uuid
  and board_id = :'qa_board_id'::uuid
  and assignment_status = 'active'
limit 1
\gset

select id as second_assignment_id
from public.work_item_board_assignments
where work_item_id = :'work_item_id'::uuid
  and board_id = :'second_board_id'::uuid
  and assignment_status = 'active'
limit 1
\gset

-- ============================================================
-- 2. MOVER SOMENTE O PRIMEIRO VINCULO
-- ============================================================

set local role authenticated;

select public.move_work_item_board_assignment(
  :'first_assignment_id'::uuid,
  :'qa_exec_id'::uuid
);

reset role;

insert into v10_a2_results
select
  5,
  'Mover no Quadro altera somente o vinculo local',
  (
    select board_column_id = :'qa_exec_id'::uuid
    from public.work_item_board_assignments
    where id = :'first_assignment_id'::uuid
  )
  and
  (
    select board_column_id = :'second_column_id'::uuid
    from public.work_item_board_assignments
    where id = :'second_assignment_id'::uuid
  ),
  'Quadro 1 movido / Quadro 2 preservado';

insert into v10_a2_results
select
  6,
  'Movimento preservou origem Pauta',
  pauta_id = :'pauta_id'::uuid,
  'pauta=' || pauta_id::text
from public.work_items
where id = :'work_item_id'::uuid;

-- ============================================================
-- 3. CONCLUIR APENAS UM QUADRO
-- ============================================================

set local role authenticated;

select public.set_work_item_board_assignment_completion(
  :'first_assignment_id'::uuid,
  true,
  'V10-A2 conclusao parcial'
);

reset role;

insert into v10_a2_results
select
  7,
  'Conclusao parcial concluiu somente primeiro vinculo',
  (
    select completed_at is not null
    from public.work_item_board_assignments
    where id = :'first_assignment_id'::uuid
  )
  and
  (
    select completed_at is null
    from public.work_item_board_assignments
    where id = :'second_assignment_id'::uuid
  ),
  'primeiro=concluido / segundo=aberto';

insert into v10_a2_results
select
  8,
  'Global permanece aberto com vinculo obrigatorio pendente',
  status <> 'done'
    and completed_at is null,
  'status=' || status
from public.work_items
where id = :'work_item_id'::uuid;

-- ============================================================
-- 4. CONCLUIR TODOS OS VINCULOS OBRIGATORIOS
-- ============================================================

set local role authenticated;

select public.set_work_item_board_assignment_completion(
  :'second_assignment_id'::uuid,
  true,
  'V10-A2 conclusao total'
);

reset role;

insert into v10_a2_results
select
  9,
  'Global conclui quando todos obrigatorios concluem',
  status = 'done'
    and completed_at is not null,
  'status=' || status
from public.work_items
where id = :'work_item_id'::uuid;

-- ============================================================
-- 5. REABRIR UM VINCULO
-- ============================================================

set local role authenticated;

select public.set_work_item_board_assignment_completion(
  :'first_assignment_id'::uuid,
  false,
  'V10-A2 reabertura'
);

reset role;

insert into v10_a2_results
select
  10,
  'Reabrir vinculo reabre status global',
  status <> 'done'
    and completed_at is null,
  'status=' || status
from public.work_items
where id = :'work_item_id'::uuid;

-- ============================================================
-- 6. REMOVER SOMENTE O SEGUNDO QUADRO
-- ============================================================

set local role authenticated;

select public.remove_work_item_board_assignment(
  :'second_assignment_id'::uuid,
  'V10-A2 remover associacao'
);

reset role;

insert into v10_a2_results
select
  11,
  'Remover do Quadro remove somente associacao',
  count(*) = 1,
  'vinculos ativos=' || count(*)::text
from public.work_item_board_assignments
where work_item_id = :'work_item_id'::uuid
  and assignment_status = 'active';

insert into v10_a2_results
select
  12,
  'Remocao nao apaga Demanda',
  count(*) = 1,
  'work_item preservado'
from public.work_items
where id = :'work_item_id'::uuid;

insert into v10_a2_results
select
  13,
  'Remocao nao tira Demanda da Pauta',
  pauta_id = :'pauta_id'::uuid,
  'pauta=' || pauta_id::text
from public.work_items
where id = :'work_item_id'::uuid;

-- ============================================================
-- 7. REDISTRIBUIR AO QUADRO REMOVIDO
-- ============================================================

set local role authenticated;

select public.distribute_existing_pauta_demands(
  :'pauta_id'::uuid,
  jsonb_build_array(
    :'work_item_id'
  ),
  jsonb_build_array(
    jsonb_build_object(
      'board_id',
      :'second_board_id',
      'board_column_id',
      :'second_column_id',
      'is_required',
      true
    )
  ),
  'DISTRIBUIR DEMANDAS'
);

reset role;

insert into v10_a2_results
select
  14,
  'Demanda pode ser redistribuida sem duplicar work_item',
  (
    select count(*)
    from public.work_items
    where id = :'work_item_id'::uuid
  ) = 1
  and
  (
    select count(*)
    from public.work_item_board_assignments
    where work_item_id = :'work_item_id'::uuid
      and assignment_status = 'active'
  ) = 2,
  '1 work_item / 2 vinculos ativos';

-- ============================================================
-- RESULTADO
-- ============================================================

select
  ordem,
  case when ok then 'PASS' else 'FAIL' end as resultado,
  teste,
  detalhe
from v10_a2_results
order by ordem;

select
  case
    when bool_and(ok)
      then 'V10-A2 TESTE CANONICO — PASS'
    else 'V10-A2 TESTE CANONICO — FAIL'
  end as resultado_final
from v10_a2_results;

rollback;
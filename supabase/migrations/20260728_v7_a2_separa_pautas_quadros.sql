-- V7-A2 — separa Pautas de Quadros livres
-- Não apaga boards, pautas, colunas, cards ou work_items.

begin;

alter table public.boards
  add column if not exists board_kind text;

update public.boards
set board_kind = 'pauta'
where exists (
  select 1
  from public.pautas
  where public.pautas.board_id = public.boards.id
);

update public.boards
set board_kind = 'pauta'
where coalesce(board_kind, '') = ''
  and lower(trim(name)) in (
    'quadro geral',
    'operações',
    'operacoes',
    'pautas'
  );

update public.boards
set board_kind = 'custom'
where coalesce(board_kind, '') = '';

alter table public.boards
  alter column board_kind set default 'custom';

alter table public.boards
  alter column board_kind set not null;

alter table public.boards
  drop constraint if exists boards_board_kind_check;

alter table public.boards
  add constraint boards_board_kind_check
  check (board_kind in ('pauta', 'custom'));

create index if not exists boards_board_kind_status_idx
  on public.boards (board_kind, status);

comment on column public.boards.board_kind is
  'pauta = quadro operacional mensal; custom = quadro livre/personalizado';

commit;

select
  board_kind,
  count(*) as total
from public.boards
group by board_kind
order by board_kind;

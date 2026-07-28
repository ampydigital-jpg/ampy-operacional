-- Rollback V7-A2 — execute somente após restaurar o código anterior.

begin;

drop index if exists public.boards_board_kind_status_idx;

alter table public.boards
  drop constraint if exists boards_board_kind_check;

alter table public.boards
  drop column if exists board_kind;

commit;

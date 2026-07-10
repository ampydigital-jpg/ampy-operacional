-- Hotfix 15D.1 — Aprovações: pasta Drive, arquivo manual, data e hora por post

alter table public.feed_boards
  add column if not exists drive_folder_url text;

alter table public.feed_board_items
  add column if not exists source_file_name text,
  add column if not exists scheduled_date date,
  add column if not exists scheduled_time time;

comment on column public.feed_boards.drive_folder_url is
  'Link manual da pasta do Google Drive vinculada ao documento de aprovação.';

comment on column public.feed_board_items.source_file_name is
  'Nome/referência manual do arquivo dentro da pasta do Drive, exemplo: Video_1, Capa_1, P01_VIDEO.';

comment on column public.feed_board_items.scheduled_date is
  'Data prevista/manual de postagem do item aprovado.';

comment on column public.feed_board_items.scheduled_time is
  'Hora prevista/manual de postagem do item aprovado.';

select 'Hotfix 15D.1 Aprovações Drive/programação aplicada com sucesso' as status;

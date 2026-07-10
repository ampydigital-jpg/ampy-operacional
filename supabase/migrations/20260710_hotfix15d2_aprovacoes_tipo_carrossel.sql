-- Hotfix 15D.2 — Aprovações: tipo de conteúdo e assets de carrossel

alter table public.feed_board_items
  add column if not exists content_type text not null default 'post';

alter table public.feed_board_items
  drop constraint if exists feed_board_items_content_type_check;

alter table public.feed_board_items
  add constraint feed_board_items_content_type_check
  check (content_type in ('post', 'video', 'carousel'));

create table if not exists public.feed_board_item_assets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.feed_boards(id) on delete cascade,
  item_id uuid not null references public.feed_board_items(id) on delete cascade,
  asset_type text not null default 'slide',
  position integer not null default 0,
  title text,
  storage_path text,
  file_url text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint feed_board_item_assets_asset_type_check
  check (asset_type in ('slide', 'cover', 'video', 'file'))
);

create index if not exists feed_board_item_assets_board_id_idx
  on public.feed_board_item_assets(board_id);

create index if not exists feed_board_item_assets_item_id_position_idx
  on public.feed_board_item_assets(item_id, position);

alter table public.feed_board_item_assets enable row level security;

drop policy if exists "feed_board_item_assets_authenticated_select" on public.feed_board_item_assets;
drop policy if exists "feed_board_item_assets_authenticated_insert" on public.feed_board_item_assets;
drop policy if exists "feed_board_item_assets_authenticated_update" on public.feed_board_item_assets;
drop policy if exists "feed_board_item_assets_authenticated_delete" on public.feed_board_item_assets;

create policy "feed_board_item_assets_authenticated_select"
on public.feed_board_item_assets
for select
to authenticated
using (true);

create policy "feed_board_item_assets_authenticated_insert"
on public.feed_board_item_assets
for insert
to authenticated
with check (true);

create policy "feed_board_item_assets_authenticated_update"
on public.feed_board_item_assets
for update
to authenticated
using (true)
with check (true);

create policy "feed_board_item_assets_authenticated_delete"
on public.feed_board_item_assets
for delete
to authenticated
using (true);

comment on column public.feed_board_items.content_type is
  'Tipo do conteúdo da aprovação: post, video ou carousel.';

comment on table public.feed_board_item_assets is
  'Arquivos/slides adicionais vinculados a um item de aprovação, principalmente carrossel.';

select 'Hotfix 15D.2 Aprovações tipo/carrossel aplicada com sucesso' as status;

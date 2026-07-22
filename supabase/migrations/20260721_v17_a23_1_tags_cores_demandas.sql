-- V17-A23.1 — TAGS E CORES DAS DEMANDAS
-- Migration aditiva: não altera demandas existentes.

alter table public.work_items
  add column if not exists card_tag text,
  add column if not exists card_tag_color text default 'slate';

alter table public.work_items
  drop constraint if exists work_items_card_tag_length_check;

alter table public.work_items
  add constraint work_items_card_tag_length_check
  check (
    card_tag is null
    or (
      char_length(
        btrim(card_tag)
      ) between 1 and 16
      and card_tag = upper(card_tag)
    )
  );

alter table public.work_items
  drop constraint if exists work_items_card_tag_color_check;

alter table public.work_items
  add constraint work_items_card_tag_color_check
  check (
    card_tag_color in (
      'slate',
      'blue',
      'purple',
      'yellow',
      'red',
      'green'
    )
  );

update public.work_items
set card_tag_color = 'slate'
where card_tag_color is null;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'card_tag'
  ) as card_tag_ok,

  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'work_items'
      and column_name = 'card_tag_color'
  ) as card_tag_color_ok,

  (
    select count(*)
    from pg_constraint
    where conrelid =
      'public.work_items'::regclass
      and conname in (
        'work_items_card_tag_length_check',
        'work_items_card_tag_color_check'
      )
  ) as tag_constraints_ok,

  not exists (
    select 1
    from public.work_items
    where card_tag is not null
      and char_length(
        btrim(card_tag)
      ) > 16
  ) as existing_tags_valid_ok;

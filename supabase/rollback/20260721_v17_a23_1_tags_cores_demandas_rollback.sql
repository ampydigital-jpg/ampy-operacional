-- ROLLBACK V17-A23.1 — TAGS E CORES DAS DEMANDAS
-- Atenção: remove todas as tags salvas após a migration.

alter table public.work_items
  drop constraint if exists work_items_card_tag_length_check,
  drop constraint if exists work_items_card_tag_color_check;

alter table public.work_items
  drop column if exists card_tag,
  drop column if exists card_tag_color;

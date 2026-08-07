-- ROLLBACK V9.3-A1
-- Usar somente antes de existir informação real nesses campos.

alter table public.work_items
  drop column if exists reference_link,
  drop column if exists moodboard_link,
  drop column if exists briefing_link;

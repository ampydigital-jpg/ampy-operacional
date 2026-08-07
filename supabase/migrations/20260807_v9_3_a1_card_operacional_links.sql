-- V9.3-A1 — links estruturados da demanda
-- Planejamento continua usando drive_link.

alter table public.work_items
  add column if not exists briefing_link text,
  add column if not exists moodboard_link text,
  add column if not exists reference_link text;

comment on column public.work_items.briefing_link is
  'Documento ou link de briefing da demanda.';

comment on column public.work_items.moodboard_link is
  'Documento ou link de moodboard da demanda.';

comment on column public.work_items.reference_link is
  'Documento ou material de referência da demanda.';

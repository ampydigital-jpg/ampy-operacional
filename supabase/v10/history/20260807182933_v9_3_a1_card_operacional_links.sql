-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

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

-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

comment on function
  public.distribute_existing_pauta_demands(
    uuid,
    jsonb,
    jsonb,
    text
  )
is
  'V9.2C-A2.3: exige Quadro e coluna explícitos antes de distribuir demandas.';

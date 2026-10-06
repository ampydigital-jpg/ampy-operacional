-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

comment on function public.traffic_weekly_report(date,date,text[]) is '[tráfego] Consolidado da semana por conta. no_spend traz meta_account_id para o n8n atualizar conta por conta.';

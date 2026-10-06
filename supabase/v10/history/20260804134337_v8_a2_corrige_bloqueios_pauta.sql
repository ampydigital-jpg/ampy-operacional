-- HISTORICO JA APLICADO. NAO EXECUTAR EM PRODUCAO.
-- Fonte: supabase_migrations.schema_migrations; comandos de dados/DO omitidos.

revoke execute
on function public.delete_empty_pauta(uuid, text)
from public, anon, authenticated;

grant execute
on function public.delete_empty_pauta(uuid, text)
to service_role;

comment on function public.create_pauta_demand(
  uuid, uuid, uuid, text, uuid, uuid, text, date, date, text, text
) is 'V8-A2: cria demanda planejada de Pauta; origin=planned.';

comment on function public.delete_empty_pauta(uuid, text)
is 'V8-A2: função técnica preservada, sem execução por usuários da aplicação.';

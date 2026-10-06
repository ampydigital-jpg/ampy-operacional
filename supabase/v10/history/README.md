# Histórico do banco — não executar

67 registros consultados em `supabase_migrations.schema_migrations` em 06/10/2026.
Os arquivos preservam DDL, funções e privilégios das versões aplicadas. Não são
migrations pendentes: não reaplicar nem copiar para a pasta de execução.

Comandos de dados e blocos DO foram omitidos para evitar publicar registros,
segredos e executar efeitos novamente. O manifest registra hash do SQL original
e de cada comando omitido. O snapshot `../baseline/schema-20261006.sql`
captura o estado resultante, incluindo alterações produzidas pelos blocos DO.
Não inclui dados nem valores de Vault. Não serve como instalador automático:
dependências de Auth, Storage, extensões e sequência de funções exigem ambiente
local controlado. A baseline anterior de agosto continua preservada.

As 23 tabelas de integrações continuam com RLS e sem políticas de cliente.
Nenhuma política foi criada para abrir essas tabelas.

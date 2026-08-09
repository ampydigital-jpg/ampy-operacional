# Migrations V10

Esta pasta e a unica esteira de migrations criada durante a estabilizacao V10.

## Regra

Nao adicionar novas migrations da V10 em `supabase/migrations`.

A pasta historica `supabase/migrations` permanece congelada com 38 arquivos SQL.

## Nomenclatura

Use:

`0001_nome_da_migration.sql`
`0002_nome_da_migration.sql`
`0003_nome_da_migration.sql`

Cada migration deve conter apenas alteracao forward.

Dry-run, verificacao e rollback ficam fora desta pasta.

## Producao

Na promocao final, somente os arquivos desta pasta sao candidatos a execucao no banco de producao, em ordem crescente.

Nunca executar a cadeia historica de 38 SQLs como bootstrap de producao ou de ambiente vazio.
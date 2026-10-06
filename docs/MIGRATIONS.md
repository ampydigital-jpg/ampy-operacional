# Migrations para aprovação — nenhuma executada

| Ordem | Arquivo em supabase/v10/migrations | Finalidade |
| --- | --- | --- |
| 1 | 0001_fix_remove_completed_board_assignment.sql | Correção existente da V10: retirar distribuição já concluída. |
| 2 | 0002_security_baseline_core.sql | Segurança existente da V10: perfil ativo, DML estrutural, escopo operacional e profile. |
| 3 | 0003_profiles_privileges.sql | Revogar anon/PUBLIC, impedir alteração direta de role/email/is_active, exigir vínculo ativo para Acesso Total. |
| 4 | 0004_internal_rpc_privileges.sql | Fechar EXECUTE dos helpers/triggers e autorizar três RPCs de pauta. |
| 5 | 0005_operation_policy_scopes.sql | Guard ativo/escopo da operação; comunicação escrita pelo servidor; integrações permanecem fechadas. |

0001/0002 já estavam na stabilization. 0003–0005 complementam a proteção para o
catálogo de outubro. A ordem é relevante: 0004 também revoga o EXECUTE da função
de event trigger criada pela 0002. Aprovação de código não autoriza executar SQL.

Antes de produção: aplicar em instância descartável, confirmar grants,
anon/operacional/gestão/total/inativo, usuário responsável versus outro usuário,
RPC direta e funcionamento das triggers pelo proprietário das funções. O arquivo
tests/eyxo_security_catalog.sql contém checagens de catálogo pós-aplicação.
Nesta sessão foi feita análise sintática, sem aplicação em qualquer Supabase.

Os 67 arquivos em history já foram aplicados remotamente e não devem ser
executados de novo. Baselines são snapshots documentais. Comandos de dados/DO
omitidos constam no manifest com hashes, não são migrations pendentes.

Alteração de Edge Function exige decisão separada: o guard preparado para
meta-discover-ad-accounts não será publicado com o preview Next.js.

Não criar políticas permissivas para as 23 tabelas de tráfego/comercial.
Rollback do frontend não reverte SQL. Não se propõe rollback que reabra privilégios
de profiles/RPCs; qualquer reversão de banco precisa de revisão específica.

# Auditoria de segurança — 06/10/2026

## profiles: escalada confirmada no desenho das permissões

A policy `profiles_update_own` tem USING e WITH CHECK:
`auth.uid() = id AND app_is_active_user()`. Ela restringe a linha, mas não
as colunas. UPDATE de tabela/colunas concede alteração de `role`, `email`
e `is_active`. Não existe trigger de proteção desses campos no schema capturado.
`profiles_manage_admin` usa `app_is_admin()`, baseado no role alterável;
depois da autopromoção amplia a escrita em outros perfis.

`anon` tem SELECT/INSERT/UPDATE/REFERENCES nas 14 colunas (inclusive grants
herdados da tabela). Grants não equivalem a autorização RLS: não afirmamos que
anon lê todas as linhas hoje. Eles são desnecessários e serão revogados.

`app_has_total_access()` também compara team_members.email com profiles.email.
Trocar o email do perfil pode herdar Acesso Total. A proposta remove essa
comparação e exige profile_id, perfil ativo e membro ativo. Confirmado por
SELECT: os três membros ativos de Acesso Total já têm profile_id; zero sem vínculo.

Proposta em 0003: revogar privilégios de anon/PUBLIC e escrita ampla de
authenticated, liberar UPDATE somente de cinco campos visuais, proteger campos
privilegiados por trigger e desabilitar a policy administrativa de escrita direta.
Administração de pessoas continua pelo servidor, validando o vínculo da equipe.

**O banco não foi corrigido. A vulnerabilidade de Data API continua até aprovação,
validação em ambiente isolado e aplicação das migrations. Preview de código não
corrige RLS nem RPC do banco compartilhado.**

Outra causa confirmada: o trigger handle_new_user insere literalmente role='admin'
e is_active=true para qualquer novo usuário de Auth. A migration 0003 substitui
esse padrão por collaborator e is_active=false. Nenhum perfil existente é
alterado; a liberação fica no fluxo administrativo autorizado de equipe.

## RPCs usadas pelo app

23 nomes literais encontrados em app/lib. Todas são SECURITY DEFINER. As
definições foram consultadas no catálogo atual, incluindo os helpers abaixo.
`pauta_current_active_actor()` valida auth.uid e usuário ativo;
`pauta_management_actor()` acrescenta Acesso Total. Estas funções de permissão
também dependem da proteção de profiles em 0003.

| Função | Checagem interna atual | Proposta |
| --- | --- | --- |
| `add_clients_to_pauta` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `add_clients_to_pauta_v8` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `change_pauta_lifecycle` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `create_and_distribute_pauta_demands` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `create_pauta_demand` | Somente usuário ativo; **sem permissão de contexto**. | 0004: Acesso Total ou cliente sob sua responsabilidade e responsável igual ao ator. |
| `delete_board_column_move_cards` | app_has_total_access; algumas também validam usuário ativo explicitamente. | Preservar, com profiles/helper corrigidos. |
| `delete_board_preserve_demands` | app_has_total_access; algumas também validam usuário ativo explicitamente. | Preservar, com profiles/helper corrigidos. |
| `detach_pauta_demand` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `distribute_existing_pauta_demands` | app_has_total_access; algumas também validam usuário ativo explicitamente. | Preservar, com profiles/helper corrigidos. |
| `generate_next_work_item_cycle` | app_has_total_access; algumas também validam usuário ativo explicitamente. | Preservar, com profiles/helper corrigidos. |
| `get_pauta_management_snapshot` | Somente usuário ativo; **sem permissão de contexto**. | 0004: exigir pauta_management_actor (Acesso Total). |
| `move_work_item_board_assignment` | Usuário ativo + Acesso Total ou responsável/criador da demanda. | Preservar, com profiles/helper corrigidos. |
| `open_monthly_pauta` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `preview_pauta_client_additions` | Somente usuário ativo; **sem permissão de contexto**. | 0004: exigir pauta_management_actor (Acesso Total). |
| `remove_client_from_pauta` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `remove_pauta_clients_batch` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `remove_pauta_extra_demands_v92c` | app_has_total_access; algumas também validam usuário ativo explicitamente. | Preservar, com profiles/helper corrigidos. |
| `remove_work_item_board_assignment` | Usuário ativo + Acesso Total/gestão ou responsável/criador do alvo. | Preservar, com profiles/helper corrigidos. |
| `set_calendar_event_completion` | Usuário ativo + Acesso Total/gestão ou responsável/criador do alvo. | Preservar, com profiles/helper corrigidos. |
| `set_work_item_board_assignment_completion` | Usuário ativo + Acesso Total ou responsável/criador da demanda. | Preservar, com profiles/helper corrigidos. |
| `set_work_item_completion` | Usuário ativo + Acesso Total/gestão ou responsável/criador do alvo. | Preservar, com profiles/helper corrigidos. |
| `update_pauta_member_target_date` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |
| `update_pauta_settings` | pauta_management_actor: usuário ativo + Acesso Total. | Preservar, com profiles/helper corrigidos. |

Nenhuma das 23 é totalmente sem autenticação. As três marcadas fazem somente
checagem de usuário ativo, insuficiente para o escopo que expõem. Não basta
proteger o botão ou a server action: PostgREST permite chamada direta por RPC.

## Helpers internos e triggers

Confirmado por busca de todas as chamadas .rpc em app/lib e código das Edge
Functions: nenhuma chamada direta às três rotinas internas ou às nove triggers
listadas abaixo. As chamadas SQL internas por funções/trigger continuam funcionando
com o proprietário da função após revogar EXECUTE dos papéis de cliente.

0004 revoga EXECUTE de PUBLIC, anon e authenticated nas assinaturas reais de:
pauta_log_event, v8_log_assignment_event, pauta_create_main_card_core,
handle_new_user, rls_auto_enable (schema public), seed_board_default_columns,
seed_project_step_statuses_for_work_item, sync_calendar_event_pauta,
sync_cycle_schedule_requirement_from_calendar_event,
guard_active_pauta_work_item_requires_pauta, v8_assignment_after_change,
v8_sync_assignment_from_work_item. Todas as sobrecargas existentes foram incluídas.
PUBLIC também é revogado para não preservar uma concessão herdada.

## Ações com cliente administrativo

| Superfície | Autorização após correção no código |
| --- | --- |
| Criar/editar membro e redefinir senha (team-access-actions) | requireTotalActor; sessão validada, profile ativo e membro ativo com Acesso Total. |
| Convite antigo e updateMemberAccessAction | Mesma autorização por equipe, sem confiar em profile.role. |
| Identidade e senha próprias | requireActiveActor, alvo fixo no auth.uid, confirmação da senha atual para trocar senha. |
| Criar mensagem geral | requireActiveActor; contexto permitido e cada vínculo enviado passa requireContextAccess. Autor deriva da sessão, sem fallback de e-mail da agência. |
| Mensagem da demanda | Mesma autorização, incluindo permissão sobre workItemId. |
| Resolver mensagem | Autor/Acesso Total ou permissão da demanda; vínculo entre mensagem e demanda é conferido. |
| Aprovação pública por token | Exceção intencional: token deve corresponder a documento publicado e não arquivado; item deve pertencer ao documento. Evento registrado como cliente, sem atribuir perfil interno. |
| Páginas administrativas/equipe/configurações | Guards no carregamento próprio; não dependem somente do layout ancestral. |
| Comunicação: leituras | Cliente de sessão com RLS; cadastro compartilhado da equipe só após guard ativo. |

O endpoint legado /api/aprovacao valida sessão ativa, status permitido e
autorização no cliente do post. Não aceitar UUID de cliente como credencial pública.
As telas antigas ainda existem por compatibilidade.

## Políticas abertas

0002 existente estreita demandas, filhos, clientes, agenda, pautas e distribuições.
0005 acrescenta políticas RESTRICTIVE de usuário ativo nas 36 tabelas operacionais
e escopo em projetos, recursos, aprovações/feed, avisos e comunicação. Políticas
restritivas são combinadas com as permissivas existentes, inclusive duplicatas.
Escrita de internal_messages/internal_message_mentions passa a ser somente servidor
autorizado; o app não usa escrita direta do navegador nessas tabelas.

Não há novas políticas em meta_*, traffic_*, trafego_*, comercial_* ou ampy_agentes.
As 23 tabelas permanecem RLS sem política de cliente, acessíveis pelo service role.

## Edge Functions

As nove funções sem verify_jwt conferem x-api-key ou x-sync-secret no código.
meta-discover-ad-accounts tem verify_jwt=true, mas a versão publicada não checa
Acesso Total antes de executar escrita com service role. A branch acrescenta
autorização por service key ou Auth válido + perfil/membro ativo de Acesso Total.
**Essa correção de Edge Function não foi publicada**; requer decisão separada,
assim como qualquer outra atualização das funções copiadas.

## Verificação e limites

Build Next e tsc passaram localmente. Testes cobrem perfil/ equipe inativos,
requisição anônima, role de admin adulterado, contexto de outro usuário e demanda
diferente na resolução de mensagem. SQL passou por parser PostgreSQL pglast.
Nenhum teste criou usuário, card, mensagem ou outro dado no banco real.

Ainda é necessária execução das migrations em Supabase isolado com matriz
anon/operacional/gestão/total/inativo e testes de RPC direta e de triggers.
Não houve Docker/PostgreSQL local disponível nesta sessão; análise sintática e
testes de código não substituem essa validação.

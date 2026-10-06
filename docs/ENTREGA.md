# Entrega Eyxo — 06/10/2026

Código das quatro etapas concluído na branch eyxo/organizacao. Validação remota do
preview continua bloqueada. Nenhum merge/push na main, migration executada,
Edge Function publicada ou alteração de variável/configuração da Vercel.

## Estado de publicação

Produção continua na main, commit 47b0c2643e27b9d353d1fefc10396df7c8227011:
código operacional de agosto (parent 9e082b0), com a identificação Eyxo.
As correções da stabilization/eyxo não foram para produção.
Deploy atual: dpl_227V6FAEERPFddNLk7rVr2KmSH1Y (READY).

Branch criada de stabilization/v10-canonical, commit 5ce9ed53, com as alterações
47b0c26 aplicadas no primeiro commit de nome e9580b1. Não houve merge da main.
Os commits foram enviados pela conexão GitHub e suas árvores conferidas com as
locais. Git local inicialmente não tinha credencial de push; agora o worktree
está alinhado à branch remota.

## Validação

| Checagem | Resultado |
| --- | --- |
| npm run build | PASS local, Next 14.2.35; compilação, lint e tipos incluídos. |
| npm run typecheck | PASS local. |
| npm test | 7 testes passando: coorte/denominador, sessão, equipe/perfil ativos, role adulterado, contexto e mensagem. |
| Parser PostgreSQL pglast | 75 arquivos SQL passando; não executados no banco. |
| Baseline agosto | Blob idêntico ao da stabilization de origem; checksum do manifest reconciliado com UTF-8/LF, preservando o valor anterior. |
| Preview Vercel | NÃO validado; não existe link funcional entregue nesta sessão. |
| RLS/RPC/trigger em Supabase isolado | Pendente. Não há PostgreSQL/Docker local configurado nesta sessão. |
| Edge Functions | Dez copiadas; runtime Deno separado; não foram invocadas nem publicadas. |

### Preview bloqueado

O deploy automático dpl_2ZCmVBxccBxx5kLn4XJepGLT3DUB e o manual Git
[dpl_9Th9zhtXytgQ8Nbzy8hDURZ4iNrP](https://vercel.com/ampydigital-4046s-projects/ampy-operacional/9Th9zhtXytgQ8Nbzy8hDURZ4iNrP)
foram CANCELED por Ignored Build Step, antes de compilar. O manual usou target
staging (preview na API), nunca production. A tentativa por arquivos do mesmo
commit e2d638a foi rejeitada pela aprovação da ferramenta, que retornou
"user rejected MCP tool call" sem motivo detalhado. Nenhuma configuração foi
alterada para contornar o bloqueio. Os endereços desses deploys cancelados não
são apresentados como preview funcional. Validação no preview fica pendente.

## Achados e alterações

- MAPA.md: rotas, áreas do banco, integrações e divergências Git/banco.
- Identidade Eyxo com E nos ícones, manifest/favicons, APP_NAME constante. Variável
  NEXT_PUBLIC_APP_NAME existente não foi alterada; nomes técnicos mantidos.
- 67 versões SQL arquivadas com hashes e omissões documentadas. Snapshot atual
  com 59 tabelas, 90 funções e 85 políticas, incluindo bases anteriores a 04/08.
- Dez Edge Functions no repositório. Nenhuma publicada. Guard adicional preparado
  para meta-discover-ad-accounts, que hoje aceita JWT sem exigir Acesso Total.
- Login duplicado e quatro componentes sem uso removidos (LIMPEZA.md).
  Detalhe da demanda criado e segmento da comunicação unificado.
- Textos de integrações corrigidos para distinguir backend funcionando de painel
  ainda sem métricas. Google Ads continua sem integração confirmada.
- Guards administrativos pela sessão/perfil/equipe ativos, Acesso Total e alvo;
  autoria de mensagem vem da sessão; aprovação pública é limitada ao token do
  documento publicado e registra evento de cliente.
- Agenda já usava prazo final na stabilization. Quadro agora mantém concluídos;
  comunicação filtra avisos ativos/lidos antes do limite; dashboards compartilham
  denominador por prazo final e o painel diário não duplica demandas urgentes.
- Profiles: UPDATE próprio permite adulterar role/email/is_active. Trigger
  handle_new_user também cria todos como admin ativo. Correções em SQL, não aplicadas.
- RPCs: helpers internos expostos com p_actor_id serão fechados. Três RPCs chamadas
  pelo app só validam ativo, sem escopo; listadas e corrigidas em SEGURANCA.md.
- 23 tabelas de integrações continuam RLS sem políticas de cliente. Nenhuma política
  permissiva foi adicionada a tráfego/comercial. Nenhum dado apagado.

## Migrations que exigem sua aprovação

Arquivos em supabase/v10/migrations, na ordem:

1. 0001_fix_remove_completed_board_assignment.sql (já existente na V10).
2. 0002_security_baseline_core.sql (já existente na V10).
3. 0003_profiles_privileges.sql (anon, colunas privilegiadas, Acesso Total e cadastro seguro).
4. 0004_internal_rpc_privileges.sql (helpers/triggers e permissões das três RPCs).
5. 0005_operation_policy_scopes.sql (guard ativo e escopo da operação).

Detalhes em MIGRATIONS.md e SEGURANCA.md. São propostas; histórico/baselines não
são fila para reaplicar. A vulnerabilidade do banco **permanece em produção** até
aprovação, testes em ambiente isolado e aplicação dessas correções.

## Como voltar à produção anterior, se decidir

Deploy anterior elegível: dpl_EZs4YrKVNv4Q9EPvcCc4Ueq91jvC, commit
9e082b0c8c86b131c790ae25cb43f2ef022be5e9, branch main.
[Detalhes do deploy anterior](https://vercel.com/ampydigital-4046s-projects/ampy-operacional/EZs4YrKVNv4Q9EPvcCc4Ueq91jvC).

1. Abra o projeto ampy-operacional na Vercel e o cartão Production Deployment.
2. Clique Instant Rollback e selecione o deploy anterior identificado acima.
3. Clique Continue e confira commit e os domínios que serão redirecionados.
4. Clique Confirm Rollback somente se decidir executar a reversão.
5. Confira o site/login. Essa versão anterior retira a identificação Eyxo;
   não aplica nem desfaz migrations de Supabase.

Após rollback, a Vercel desativa auto-assignment de domínios de produção. Para
reativar, use Undo Rollback e escolha explicitamente o deploy que será promovido.
[Procedimento oficial](https://vercel.com/docs/instant-rollback).
Nenhum rollback, promoção ou publicação de produção foi feito nesta execução.

## Pendentes

- Liberar/criar e validar preview funcional sem alterar configurações/env.
- Testar permissões e triggers em Supabase isolado antes de autorizar SQL real.
- Decidir aprovação das cinco migrations e eventual publicação da Edge Function.
- Smoke test autenticado das telas privadas: não foram enviados formulários ao
  banco compartilhado nem realizado login com conta real nesta sessão.
- Nenhuma limpeza de dados de teste pendente. Google Ads e painel de indicadores
  de tráfego permanecem funcionalidades futuras, sem métricas fictícias.

## Commits da implementação

Lista anterior ao commit deste relatório; o histórico remoto inclui também sua
finalização. Conteúdo e árvores dos commits foram conferidos na sincronização.

| Commit | Assunto |
| --- | --- |
| e9580b1 | chore: identifica o sistema operacional como Eyxo |
| 2fdc7ab | docs: mapeia rotas banco integracoes e diferencas do Eyxo |
| f488e39 | feat: completa identidade Eyxo com icones e nome centralizado |
| 2689359 | chore: versiona 67 migrations historicas e snapshot do schema |
| d692c9f | chore: importa dez Edge Functions sem publicar |
| 26416b5 | fix: restaura detalhe de demanda e unifica segmento da comunicacao |
| 9ecea6c | refactor: remove login duplicado e componentes sem uso |
| 9ae3ec0 | fix: distingue integracoes do backend e runtime das Edge Functions |
| d2eeb70 | chore: atualiza Next e eslint-config-next para 14.2.35 |
| f381088 | fix: autoriza acesso administrativo por sessao e equipe ativa |
| 8d9d253 | security: prepara bloqueio de autoelevacao e acesso anon a profiles |
| 7d48c74 | security: prepara revogacao RPC interna e permissoes de pauta |
| 94c3461 | security: prepara escopo RLS da operacao sem abrir integracoes |
| fd2a058 | fix: unifica denominadores e elimina duplicacao no painel diario |
| 3fb806f | fix: mantem cards concluidos visiveis no Quadro |
| 30182a9 | fix: lista avisos ativos e restringe snapshot gerencial da pauta |
| 3fcfd70 | test: cobre autorizacao administrativa e habilita verificacao da branch |
| 23b3dd2 | fix: registra decisoes publicas com autoria de cliente |
| cbb954d | docs: preserva privilegios de funcoes no snapshot do schema |
| 45b34a9 | security: restringe discovery Meta a service role ou Acesso Total |
| 8f1807c | docs: consolida auditoria e roteiro de aprovacao das migrations |
| e2d638a | security: prepara cadastro de Auth sem administrador automatico |
| 27dc701 | chore: sincroniza manifest e checksum portavel sem alterar baseline |
| 40c180f | docs: identifica o commit de nome publicado na branch |
| 70d896f | docs: entrega achados validacoes commits e bloqueio do preview |

## Cadastro público desligado em 06/10 às 12h

Willian informou que desligou **Allow new users to sign up** em 06/10/2026 às
12h, horário de São Paulo. Alteração feita pelo usuário, não por esta execução;
a configuração ativa não foi consultada novamente nesta conferência.

A tela `app/dashboard/equipe/EquipeView.tsx` chama `createTeamMemberAction` de
`lib/team-access-actions.ts`. A action usa `auth.admin.createUser` no servidor,
com senha temporária e `email_confirm: true`. O SDK envia POST `/admin/users`,
não `/signup`. O mesmo caminho administrativo já existe na main `47b0c264`.
Na branch, a action exige sessão/perfil/equipe ativos e Acesso Total, cria os
registros de perfil/equipe com o acesso escolhido e exige troca de senha.
Não envia convite por e-mail nesse fluxo.

A action separada `inviteMemberAction`, em `lib/actions.ts`, usa
`auth.admin.inviteUserByEmail` e exige Acesso Total na branch. Ela não é chamada
pela tela atual de equipe. O cliente administrativo usa a service role somente
no servidor. Nenhuma chamada `auth.signUp` foi encontrada em app/lib.

Conclusão por inspeção do código e do Auth: desligar o cadastro público não
bloqueia a criação administrativa em uso nem os convites da API admin. O
handler `adminUserCreate` não aplica `DisableSignup`; os convites são previstos
para o modo sem cadastro público. Isso não certifica SMTP, redirect de convite
ou funcionamento ponta a ponta da instância. Não criamos usuários nem enviamos
convites de teste, respeitando a restrição de escrita no banco.

O bloqueio de signup reduz a entrada pública, mas não corrige autoelevação de
usuários existentes em profiles nem RPCs internas expostas. As migrations
continuam necessárias; `handle_new_user` continua disparando também na criação
administrativa. A migration 0003 mantém o cadastro seguro e a action em uso
aplica o acesso escolhido explicitamente depois da criação do Auth.

Fontes verificadas:
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://github.com/supabase/auth/blob/master/internal/api/admin.go
- https://supabase.github.io/auth/ (DISABLE_SIGNUP e convites)

Vercel: exclusivamente deploy de preview, nunca produção. Nenhum deploy foi
solicitado neste acréscimo; bloqueio do preview anterior continua pendente.

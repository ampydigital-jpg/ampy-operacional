# Eyxo: mapa do projeto

Levantamento em 06/10/2026. Nome do produto: Eyxo. Agência: Ampy Digital.
Identificações técnicas permanecem `ampy-operacional`.

## Branches e publicação

| Referência | Estado inicial desta tarefa |
| --- | --- |
| `main` | `47b0c264`: código de agosto `9e082b0` com a identificação Eyxo. Produção `dpl_227V6FAEERPFddNLk7rVr2KmSH1Y`. |
| `stabilization/v10-canonical` | `5ce9ed53`: melhorias da agenda, modais, quadro e projetos; baseline local V10, testes, lockfile e migrations 0001/0002. Não mesclada na main. |
| `eyxo/organizacao` | Criada de `5ce9ed53`, com cherry-pick de `47b0c264` em `d0aa8c6`. Destino exclusivo de organização e preview. |
| Supabase | `epzrrsaibqdcaafkvwmm`, produção compartilhada por operação, tráfego e comercial. Recebeu alterações de setembro/outubro fora do repositório. Consultas apenas nesta tarefa. |

### Deploys cancelados da V10

Os deploys `dpl_E9fG7UiKNUiDeuqJxa2GPjuh8CTk` (`6cd154b`),
`dpl_6PKi5srpg7DSYebkGrNydvFackrK` (`feed9e0`) e
`dpl_mDzediLvyrnojavxwETpJieRAPDN` (`5ce9ed5`) estão `CANCELED`.
A API retorna `errorLink` para **Ignored Build Step**, e início/fim coincidem.
O último não possui logs de build. Evidência: cancelamento pela regra de ignorar build;
não há evidência de falha de compilação. O texto exato do comando configurado não foi
obtido, portanto não atribuímos a causa a um comando específico. Configuração não alterada.

## Telas e rotas

| Rota | Função |
| --- | --- |
| `/` | Redireciona conforme a sessão para login/painel. |
| `/login` | Login Supabase por e-mail e senha; encaminha troca obrigatória de senha. |
| `/dashboard` | Painel geral com demandas, etapas, agendas, atrasos e gráficos. |
| `/dashboard/meu-dia` | Fila diária do usuário. |
| `/dashboard/minha-semana` | Demandas/agendas semanais do usuário. |
| `/dashboard/semana-equipe` | Visão semanal da equipe. |
| `/dashboard/mes` | Visão mensal da operação. |
| `/dashboard/clientes` | Cadastro, contratos, identidade, serviços e ciclos dos clientes. |
| `/dashboard/demandas` | Lista canônica; criação contextual por pauta/quadro/avulsa. |
| `/dashboard/demandas/[id]` | Detalhe da demanda: no início havia `view.tsx`, sem `page.tsx`. Links existentes exigem corrigir a rota. |
| `/dashboard/demandas/comunicacao` | Lista de contextos de comunicação de demandas. |
| `/dashboard/demandas/[workItemId]/comunicacao` | Mensagens e menções vinculadas a uma demanda. Unificar nome do segmento dinâmico na correção. |
| `/dashboard/pautas` | Pautas mensais, clientes participantes, metas, distribuição e conclusão explícita. |
| `/dashboard/quadro` | Quadros, colunas, distribuições multiquadro e progresso operacional. |
| `/dashboard/kanban` | Visão alternativa antiga do quadro; manter compatibilidade enquanto houver referências. |
| `/dashboard/projetos` | Projetos, etapas, status personalizados e conclusão. |
| `/dashboard/agenda` | Agenda interna de sete dias, recorrência, confirmação e conclusão. Não publica no Google Calendar por esta tela. |
| `/dashboard/avisos` | Central canônica de avisos, alertas e pendências. |
| `/dashboard/alertas` | Redirecionamento de compatibilidade para avisos. |
| `/dashboard/chat` | Comunicação geral, menções, cliente/demanda/aprovação/aviso/Drive. |
| `/dashboard/comunicacao` | Redirecionamento para chat. |
| `/dashboard/equipe` | Administração de equipe e acessos; exige Acesso Total. |
| `/dashboard/minha-conta` | Nome de exibição, avatar e senha do usuário atual. |
| `/dashboard/configuracoes` | Organização, integrações e arquivo de clientes; Acesso Total. |
| `/dashboard/relatorios` | Relatório operacional manual com serviços/cadastro e impressão; não é o relatório automatizado de tráfego. |
| `/dashboard/feed-preview` | Documentos de aprovação, grade e seleção de cliente. |
| `/dashboard/feed-preview/[boardId]` | Edição da grade, arquivos, status, legenda e programação. |
| `/dashboard/clientes/feed-preview` | Entrada alternativa de aprovação por cliente. |
| `/aprovacao/[clientId]` | Aprovação antiga baseada em `feed_posts`. |
| `/api/aprovacao` | Atualização do feed antigo; atualmente sem sessão/status explícitos. |
| `/aprovar/[token]` | Aprovação pública por token do documento; exceção intencional ao login, limitada ao token. |
| `/dashboard/trafego` | Página informativa; ainda não lê indicadores Meta. Integração do backend já existe. |
| `/dashboard/social` | Página informativa; não é um calendário editorial integrado. |

## Banco por área

Todas as tabelas listadas estão em `public` e têm RLS habilitada. Isso, isoladamente,
não garante autorização correta. Nenhum registro foi exportado como seed.

| Área | Tabelas e finalidade |
| --- | --- |
| Operação: identidade | `profiles`, `team_members`, `team_access_audit`: perfil, acesso/área e auditoria de acessos. |
| Operação: clientes | `clients`, `service_catalog`, `client_services`: contratos, catálogo e serviços/ciclos. |
| Operação: demandas | `work_items`, `work_item_comments`, `work_item_history`, `work_item_checklists`, `approvals`, `blockers`, `resource_links`, `audit_logs`: demanda, histórico e vínculos. |
| Operação: projetos | `projects`, `project_steps`, `project_step_statuses`. |
| Operação: pautas | `pautas`, `pauta_members`, `pauta_events`. |
| Operação: quadros | `boards`, `board_columns`, `work_item_board_assignments`, `work_item_board_assignment_events`. |
| Operação: agenda | `calendar_events`, `calendar_event_history`, `work_item_schedule_requirements`. |
| Operação: comunicação | `avisos`, `internal_messages`, `internal_message_mentions`, `chat_messages` (legado). |
| Operação: aprovações | `feed_boards`, `feed_board_items`, `feed_board_item_assets`, `feed_board_events`; `feed_posts` (legado). |
| Tráfego: Meta | `meta_ad_accounts`, `meta_campaigns`, `meta_adsets`, `meta_ads`, `meta_ad_creatives`, `meta_insights_daily`, `meta_period_insights`, `meta_sync_runs`. |
| Tráfego: relatórios | `traffic_report_settings`, `traffic_report_clients`, `traffic_report_deliveries`. |
| Tráfego: gestor | `trafego_config`, `trafego_contas`, `trafego_metas`, `trafego_execucoes`, `trafego_acoes`, `trafego_alertas`: regras, metas, execuções, ações reversíveis e alertas. Acrescentadas em outubro. |
| Comercial | `comercial_leads`, `comercial_reunioes`, `comercial_mensagens`, `comercial_formularios`: qualificação, reunião R1, conversa e formulário. |
| Alfredo | `comercial_config`: prompt/regras/agenda. Usa as mesmas tabelas comerciais; não há uma segunda base de leads. |
| Cadastro transversal | `ampy_agentes`: catálogo das automações, sistemas, funções e responsáveis. Não publicar valores de segredos ou credenciais. |

## Integrações e fronteiras

- GitHub → Vercel: push dispara build. Main é produção; branch nova deve usar apenas preview.
- Supabase Auth: login e sessão; Data API com RLS; cliente administrativo somente no servidor.
- Storage: `feed-preview`, `client-logos`, `team-avatars`, públicos e com limites de tamanho/tipo.
- Google Drive: links operacionais; backend de relatórios usa Drive/Slides/PDF via automação.
- Meta Ads: discovery/sync/períodos/criativos; métricas e relatórios no Supabase. Não somar tipos de resultado diferentes.
- n8n: orquestração externa de tráfego/comercial. Não consultamos nem alteramos a configuração do n8n.
- Alfredo: agente comercial, lembretes e resumo; formulário Tally, WhatsApp, agenda Google/Meet no backend. Interface Eyxo não expõe todos esses recursos.
- Edge Functions: `meta-discover-ad-accounts`, `meta-sync`, `meta-period-sync`, `traffic-weekly`, `comercial-agente`, `comercial-lembretes`, `comercial-resumo` e possíveis funções novas a conferir. Funções sem JWT possuem checagens próprias de segredo; não invocadas nesta tarefa.
- `appampy.dev` tem camada Cloudflare Access observada na auditoria. Login e dados reais não foram usados nos testes desta tarefa.

## Diferenças entre código e banco

A baseline da V10 foi capturada em agosto com 36 tabelas de operação.
O banco atual também contém Meta, relatórios, comercial/Alfredo, catálogo de agentes
e gestor de tráfego. O histórico de setembro/outubro será versionado separadamente:
SQL histórico já aplicado não pode ser confundido com migrations pendentes.
Migrations que continham limpeza de dados de teste não serão executadas nem convertidas
em limpeza automática. Referências e exclusões de dados/segredos devem constar no inventário.

A main não tinha lockfile. A V10 já tem `package-lock.json`, ainda com Next 14.1.0.
A V10 contém 0001 (remoção de distribuição concluída) e 0002 (segurança de base),
ainda exigindo avaliação de compatibilidade com as mudanças posteriores do banco.

## Backlog a verificar na etapa 4

| Item | Situação ao iniciar |
| --- | --- |
| Agenda usa prazo inicial em vez do final | Investigar seletores e agrupamento; preservar data final como referência de entrega. |
| Comunicação mostra avisos resolvidos e omite ativo | Investigar consulta/filtro de `avisos`. |
| Cards concluídos invisíveis no Quadro | Investigar consulta de distribuições e filtro no workspace. |
| Denominador dos dashboards | Investigar população do período, cards de referência e status cancelado/arquivado. |
| Cliente administrativo nas ações | Enumerar todas as ações; autenticar usuário ativo e autorizar alvo/ação. Aprovação pública continua limitada por token. |
| Perfil permite autopromoção | `profiles_update_own` + UPDATE geral em profiles, sem trigger protetor. Preparar migration, não executar. |

## Regras desta execução

Nenhum push/merge na main, nenhuma mudança de banco/dados/políticas, nenhuma mudança
de variável/configuração da Vercel. Arquivos SQL são propostas ou histórico explicitamente
classificado. Dados `[V10 TEST]` e `[QA CLAUDE]` serão somente inventariados. Preview
compartilha a configuração existente: testes nunca enviam formulários de escrita em produção.

# Limpeza

Removidos por ausência de importações e rota efetiva:

- `app/login/login_page.tsx`: duplicata; login em uso é `app/login/page.tsx`.
- `app/dashboard/chat/ChatView.tsx`: substituído pela página atual.
- `app/dashboard/alertas/AlertasView.tsx`: rota redireciona para avisos.
- `app/dashboard/projetos/ProjetosView.tsx`: substituído por ProjectsWorkspace.
- `app/dashboard/feed-preview/FeedPreviewView.tsx`: substituído por FeedPreviewHome.

`app/dashboard/clientes/feed-preview/FeedPreviewView.tsx` continua em uso.
Rotas antigas com referências foram preservadas. Nenhum dado apagado.
`[V10 TEST]` e `[QA CLAUDE]` não existem no banco consultado; não há
limpeza de dados de teste pendente.

A rota de detalhe recebeu page.tsx; comunicação usa o mesmo segmento `[id]`.
Textos distinguem integrações existentes no backend de painéis ainda informativos.
O lockfile já estava presente na stabilization e foi preservado.

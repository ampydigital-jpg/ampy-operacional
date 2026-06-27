# Ampy Digital — Gerenciador Operacional

Sistema operacional interno da Ampy Digital.
Construído com Next.js 14, TypeScript e Supabase.

---

## Como colocar no ar — passo a passo

### ETAPA 1 — Criar conta no Supabase (banco de dados)

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em "New Project"
3. Escolha um nome: `ampy-digital`
4. Defina uma senha forte para o banco (guarde em lugar seguro)
5. Selecione a região: South America (São Paulo)
6. Clique em "Create new project" e aguarde ~2 minutos

### ETAPA 2 — Criar o banco de dados

1. No painel do Supabase, clique em "SQL Editor" no menu lateral
2. Clique em "New query"
3. Copie todo o conteúdo do arquivo `supabase-schema.sql`
4. Cole no editor e clique em "Run" (ou pressione Ctrl+Enter)
5. Você verá "Success. No rows returned" — isso é correto

### ETAPA 3 — Pegar as credenciais do Supabase

1. No menu lateral do Supabase, clique em "Settings" → "API"
2. Copie:
   - **Project URL** → será o NEXT_PUBLIC_SUPABASE_URL
   - **anon public** → será o NEXT_PUBLIC_SUPABASE_ANON_KEY
   - **service_role** → será o SUPABASE_SERVICE_ROLE_KEY (nunca exponha este)

### ETAPA 4 — Criar conta na Vercel (hospedagem)

1. Acesse https://vercel.com e crie uma conta gratuita
2. Conecte sua conta do GitHub (necessário para fazer o deploy)

### ETAPA 5 — Subir o código no GitHub

No terminal do seu computador:

```bash
# Entre na pasta do projeto
cd ampy-digital

# Instale as dependências (só na primeira vez)
npm install

# Inicie o Git
git init
git add .
git commit -m "inicial: ampy digital gerenciador operacional"

# Crie um repositório no GitHub (em github.com → New repository)
# Nome sugerido: ampy-digital-gerenciador
# Marque como PRIVADO

# Conecte e suba o código
git remote add origin https://github.com/SEU_USUARIO/ampy-digital-gerenciador.git
git branch -M main
git push -u origin main
```

### ETAPA 6 — Fazer o deploy na Vercel

1. Na Vercel, clique em "Add New Project"
2. Selecione o repositório `ampy-digital-gerenciador`
3. Clique em "Import"
4. Em "Environment Variables", adicione as variáveis:

```
NEXT_PUBLIC_SUPABASE_URL        = (cole o Project URL do Supabase)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (cole o anon public do Supabase)
SUPABASE_SERVICE_ROLE_KEY       = (cole o service_role do Supabase)
NEXT_PUBLIC_APP_URL             = https://seu-dominio.vercel.app
```

5. Clique em "Deploy"
6. Aguarde ~2 minutos — seu sistema estará online

### ETAPA 7 — Criar o primeiro usuário administrador

1. No Supabase, vá em "Authentication" → "Users"
2. Clique em "Add user" → "Create new user"
3. Preencha email e senha
4. Clique em "Create User"
5. Acesse o sistema pelo link da Vercel e faça login

### ETAPA 8 — Configurar o usuário como administrador

No SQL Editor do Supabase, execute:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'seu@email.com.br';
```

---

## Desenvolvimento local

Para rodar na sua máquina:

```bash
# Copie o arquivo de variáveis
cp .env.example .env.local

# Edite o .env.local com suas credenciais do Supabase
# (abra com qualquer editor de texto)

# Instale as dependências
npm install

# Inicie o servidor de desenvolvimento
npm run dev

# Acesse em: http://localhost:3000
```

---

## Estrutura do projeto

```
ampy-digital/
├── app/
│   ├── layout.tsx              # Layout raiz
│   ├── page.tsx                # Redireciona para /dashboard
│   ├── globals.css             # Estilos globais
│   ├── login/
│   │   └── page.tsx            # Tela de login
│   └── dashboard/
│       ├── layout.tsx          # Layout com sidebar
│       ├── page.tsx            # Dashboard principal
│       ├── clientes/page.tsx   # Lista de clientes
│       └── demandas/page.tsx   # Lista de demandas
├── components/
│   └── ui/
│       └── Sidebar.tsx         # Menu lateral
├── lib/
│   └── supabase/
│       ├── client.ts           # Cliente browser
│       └── server.ts           # Cliente servidor
├── types/
│   └── index.ts                # Tipos TypeScript
├── middleware.ts               # Autenticação automática
├── supabase-schema.sql         # Schema completo do banco
├── .env.example                # Template de variáveis
├── .gitignore                  # Arquivos ignorados pelo Git
├── next.config.js
├── tsconfig.json
└── package.json
```

---

## Tecnologias

- **Next.js 14** — framework React com App Router
- **TypeScript** — tipagem estática
- **Supabase** — banco PostgreSQL + autenticação + RLS
- **Vercel** — hospedagem e deploy automático

---

## Custos

| Serviço | Plano gratuito | Observação |
|---------|---------------|------------|
| Supabase | Gratuito até 500MB e 50k usuários | Suficiente para o MVP |
| Vercel | Gratuito para uso interno | Sem limite de deploys |
| GitHub | Gratuito (privado) | Repositório privado |
| **Total** | **R$ 0/mês** | No MVP |

---

## Próximas fases

Após validar o MVP:

1. **Drive OAuth** — conexão real com Google Drive
2. **Calendar OAuth** — criação de eventos no Google Calendar  
3. **Kanban interativo** — drag and drop de demandas
4. **Notificações** — alertas em tempo real via Supabase Realtime
5. **Google Workspace** — contas corporativas da equipe

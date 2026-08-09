# Gerenciador de Demandas Ã¢â‚¬â€ Processo de Release V10

## 1. Ambientes

### Desenvolvimento

- Branch: `stabilization/v10-canonical`
- Next.js local.
- Supabase local.
- Dados exclusivamente sinteticos.
- `.env.local` nunca versionado.

### Producao

- Branch: `main`
- Vercel Production existente.
- Supabase Production existente.
- Dados reais permanecem somente em producao.

---

## 2. Baseline

A V10 parte do estado estrutural atual de producao.

Baseline versionado:

`supabase/v10/baseline/public-schema.sql`

Esse arquivo representa o ponto inicial do ambiente local V10.

Ele NAO e uma migration de producao.

Ele NAO deve ser aplicado sobre o banco de producao existente.

---

## 3. Migrations historicas

A pasta:

`supabase/migrations`

esta congelada.

Ela contem 38 SQLs historicos.

Esses arquivos NAO formam uma cadeia segura de bootstrap de banco vazio e NAO devem ser reproduzidos sequencialmente.

Nenhuma nova migration V10 entra nessa pasta.

---

## 4. Migrations novas

Toda alteracao estrutural da V10 deve entrar em:

`supabase/v10/migrations`

Formato:

`0001_nome.sql`
`0002_nome.sql`
`0003_nome.sql`

Cada migration deve ser:

- pequena;
- ordenada;
- forward;
- testada primeiro localmente;
- preferencialmente aditiva;
- compativel com o codigo anterior durante a promocao.

---

## 5. Estrategia de release

A promocao usa:

EXPAND -> VALIDATE LOCAL -> PREPARE DB -> DEPLOY -> VALIDATE -> CONTRACT

### EXPAND

Criar estruturas novas sem destruir imediatamente estruturas antigas.

### VALIDATE LOCAL

Executar:

`scripts\v10\check.ps1`

O release nao avanca se houver FAIL.

### PREPARE DB

Antes de tocar producao:

1. confirmar branch/commit;
2. listar exatamente as migrations V10 pendentes;
3. executar diagnostico read-only;
4. registrar contagens esperadas;
5. preparar rollback ou estrategia de reversao;
6. aplicar somente migrations novas V10;
7. validar contagens e invariantes.

Nunca:

- `supabase db reset --linked`;
- replay das 38 migrations;
- seed sintetico em producao;
- baseline V10 sobre producao;
- migration destrutiva sem diagnostico e reversao.

### DEPLOY

Somente depois do banco estar compativel:

1. promover codigo aprovado para `main`;
2. Vercel faz Production;
3. validar o SHA exato implantado.

### VALIDATE

Executar smoke test de producao sobre:

- login;
- Demandas;
- Pautas;
- Quadros;
- Projetos;
- Agenda;
- Aprovacoes;
- Avisos;
- dashboards.

### CONTRACT

Remocoes, drops e limpeza de legado somente depois da V10 estar comprovadamente estavel em producao.

---

## 6. Rollback

### Codigo

Preferir revert do commit de release ou retorno ao commit anterior aprovado.

### Banco

Migrations V10 devem ser desenhadas para que o codigo anterior continue funcionando quando possivel.

Nao depender de rollback destrutivo imediato.

Alteracoes irreversiveis em dados reais exigem backup e plano especifico antes da execucao.

---

## 7. Dados reais

O ambiente V10 local usa somente dados sinteticos.

Quando uma migration futura precisar alterar linhas reais:

1. query diagnostica;
2. contagem esperada;
3. dry-run;
4. backup/reversao;
5. migration;
6. verificacao pos-migration.

---

## 8. Gate unico

Antes de qualquer commit candidato a release:

`scripts\v10\check.ps1`

Resultado necessario:

`V10 CHECK Ã¢â‚¬â€ PASS`

Sem PASS, nao promover.
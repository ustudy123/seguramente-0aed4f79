# Plano: Ambientes Supabase (Produção + Staging/Testes)

## Objetivo
Permitir que o projeto aponte para dois bancos independentes: um para **produção/real** (clientes) e outro para **staging/testes** (dados fictícios), sem hard-coded URLs ou chaves no código.

## Decisão de arquitetura
Usar **dois projetos Supabase independentes** dentro da mesma conta/organização. O frontend carrega a URL, anon key e project ID via variáveis de ambiente do Vite. O `config.toml` continua apontando para o projeto de produção por padrão; para deploy de edge functions no staging, o Supabase CLI é chamado com `--project-ref` ou variável `SUPABASE_PROJECT_ID`.

---

## Passos

### 1. Refatorar referências hard-coded no frontend
Substituir todas as URLs e project refs fixos por variáveis de ambiente:

- `src/integrations/supabase/client.ts`
- `src/lib/supabasePublic.ts`
- `src/hooks/useChatIA.ts`
- `src/hooks/useEpiFiscalIA.ts`
- `src/components/atestados/AtestadoForm.tsx`
- `src/pages/FeriasAssinatura.tsx`
- `src/pages/ExperienciaAssinatura.tsx`
- `src/pages/PdiAssinatura.tsx`
- `src/pages/QuestionarioPsicossocial.tsx`
- `src/pages/admin/QADashboard.tsx`
- `src/components/experiencia/ExperienciaDocGenerator.tsx`

Criar um helper central (`src/lib/supabaseFunctions.ts`) para montar URLs de edge functions no padrão `${VITE_SUPABASE_URL}/functions/v1/{function-name}`, evitando duplicação.

### 2. Organizar arquivos de ambiente
- `.env.example` — template com chaves vazias/comentadas para desenvolvedores.
- `.env.production` — aponta para o projeto atual (`diayjpsrcerycycyaxst`).
- `.env.staging` — aponta para o novo projeto de staging (placeholder).
- `.env` — continua sendo o arquivo local padrão; documentar que deve ser copiado de `.env.staging` ou `.env.production`.

Adicionar `.env.production` e `.env.staging` no `.gitignore` se ainda não estiverem (`.env` já deve estar).

### 3. Criar script de seed para ambiente de testes
Criar SQL/migration ou edge function para popular o staging com:

- Tenant fictício (`YourEyes Teste`).
- Usuário admin de teste (`teste@youreyes.dev` / senha segura).
- Empresa, filial, departamento e cargo de exemplo.
- Colaborador fictício e usuário base.
- Dados mínimos para validar login, dashboard e alguns módulos sem dados reais.

Isso garante que o staging seja "usável" assim que criado.

### 4. Sincronizar estrutura do banco entre ambientes
- Todos os migrations atuais em `supabase/migrations/` serão aplicados no projeto staging recém-criado.
- Documentar fluxo: após criar o projeto staging, rodar `supabase db reset` ou aplicar migrations via dashboard SQL Editor.
- Adicionar hook/documentação para que, ao criar novas migrations, sejam aplicadas nos dois ambientes (produção e staging).

### 5. Ajustar edge functions para múltiplos ambientes
- Confirmar que as edge functions usam `Deno.env.get("SUPABASE_URL")` e `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` (já padrão do Supabase).
- Documentar como fazer deploy seletivo:
  - Produção: `supabase functions deploy` (padrão via `config.toml`).
  - Staging: `supabase functions deploy --project-ref <staging-project-id>`.
- Criar/atualizar `scripts` no `package.json` opcionais: `deploy:staging` e `deploy:prod`.

### 6. Configurar build do Lovable por ambiente
- O Lovable preview usa o `.env` padrão do repositório. Para o preview apontar para staging, `.env` local deve conter as credenciais de staging.
- Para publicação em produção, o build do Lovable deve usar `.env.production`. Documentar como alternar na plataforma Lovable.
- Atualizar `VITE_APP_URL` por ambiente (preview vs publicado).

### 7. Documentar setup e operação
Criar `docs/ambientes-supabase.md` com:

- Como criar o segundo projeto no Supabase.
- Como obter URL e anon key do novo projeto.
- Como copiar/enviar variáveis para Lovable.
- Como aplicar migrations no staging.
- Como rodar seed.
- Como fazer deploy de edge functions em cada ambiente.
- Recomendação de não usar dados reais no staging.

### 8. Verificação
- Build local com `bun run build` sem erros de tipos ou variáveis não definidas.
- Testar login e carregamento do dashboard apontando para staging.
- Confirmar que nenhum arquivo possui mais `diayjpsrcerycycyaxst` hard-coded.
- Validação via `rg -n "diayjpsrcerycycyaxst" src/` retornando vazio.

---

## O que o usuário precisa fazer fora do Lovable
1. Criar um novo projeto no Supabase (pode ser na mesma conta).
2. Copiar o `Project URL` e `anon public` key do novo projeto.
3. Inserir esses valores no `.env.staging` e no painel de variáveis de ambiente do Lovable para o preview.
4. Aplicar as migrations no novo projeto e rodar o seed.

---

## Entregáveis
- Código frontend 100% parametrizado por ambiente.
- Arquivos `.env.example`, `.env.production`, `.env.staging`.
- Seed SQL para staging.
- Scripts/documentação de deploy e migração.
- Build validado sem hard-coded references.

## Não está no escopo deste plano
- Replicação automática de dados de produção para staging (módulo futuro).
- CI/CD automatizado entre ambientes (GitHub Actions etc.).
- Backup/restore agendado.

## Technical details
- **Variáveis necessárias**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`, `SUPABASE_URL` (backend/build), `SUPABASE_PUBLISHABLE_KEY` (backend/build).
- **Helper de functions**: `getSupabaseFunctionUrl(name)` retornando string baseada em `VITE_SUPABASE_URL`.
- **Supabase CLI**: `supabase functions deploy --project-ref <staging-id>` para staging; `supabase functions deploy` para produção.
- **Config.toml**: mantém `project_id = "diayjpsrcerycycyaxst"` (produção); staging é atingido via CLI flags.

## Nota de segurança
- A chave `anon` pode ir no frontend (é pública).
- A `service_role` NUNCA deve ser armazenada no `.env` do frontend; só usada em edge functions via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.
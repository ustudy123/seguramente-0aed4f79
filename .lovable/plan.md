# Conectar um segundo projeto Supabase (staging/testes) sem afetar a produção

## Resumo do funcionamento

O projeto já está preparado para **dois ambientes independentes** usando variáveis de ambiente do Vite. Nada no código-fonte precisa mudar — a mesma aplicação é compilada apontando para projetos Supabase diferentes através de `.env` distintos.

O ambiente atual (`.env`) aponta para produção. Um segundo arquivo, `.env.staging`, foi criado com placeholders. A conexão com o novo Supabase acontece apenas trocando/gerando o build com o arquivo correto. O banco de dados de produção não é tocado.

## Mecanismo de isolamento

```text
┌─────────────────┐      .env.production       ┌──────────────────────┐
│  Código-fonte   │  ───────────────────────>  │  Supabase Produção   │
│  (mesmo repo)   │      build:production      │  (diayjpsrceryc...)  │
└─────────────────┘                            └──────────────────────┘
         │
         │  .env.staging
         │  build:staging
         ▼
        ┌──────────────────────┐
        │  Supabase Staging      │
        │  (novo projeto)        │
        └──────────────────────┘
```

- Cada projeto Supabase é um banco de dados PostgreSQL **totalmente isolado**.
- Você pode ter quantos projetos quiser na mesma conta Supabase.
- O editor da Lovable continua conectado ao projeto atual (produção). O staging é usado via build local ou, se quiser, publicado em outro host/domínio.

## Passo a passo para conectar o novo ambiente

### 1. Criar o novo projeto Supabase

No dashboard do Supabase, criar um projeto novo (ex.: `youreyes-staging`). Anotar:

- Project URL
- Anon/public key
- Project ref

### 2. Preencher `.env.staging` no repositório

Substituir os placeholders no arquivo já existente:

```env
SUPABASE_URL="https://<novo-project-ref>.supabase.co"
VITE_SUPABASE_URL="https://<novo-project-ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY="<novo-anon-key>"
VITE_SUPABASE_PUBLISHABLE_KEY="<novo-anon-key>"
VITE_SUPABASE_PROJECT_ID="<novo-project-ref>"
VITE_APP_URL="https://<url-onde-staging-ficara>"
```

Não alterar `.env` neste momento — ele continua apontando para produção, então o editor/preview continuam inalterados.

### 3. Replicar o banco (schema)

Com a Supabase CLI, linkar o novo projeto e aplicar todas as migrations:

```bash
supabase link --project-ref <novo-project-ref>
supabase db push
```

Isso cria as 706 migrations no staging. Não é viável fazer pelo SQL Editor manualmente.

### 4. Deployar as Edge Functions

```bash
supabase functions deploy --project-ref <novo-project-ref>
```

São 71 funções. As mesmas do repositório vão para o novo projeto.

### 5. Recadastrar os secrets

Secrets não migram automaticamente. Configurar em `Project Settings > Edge Functions > Secrets` do novo projeto:

- `LOVABLE_API_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `APP_URL` / `SITE_URL` (apontar para URL de staging)
- `WHATSAPI_BASE_URL` / `WHATSAPI_TOKEN`
- `MERCADOPAGO_ACCESS_TOKEN`
- `CONSULTACRM_KEY`

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente.

### 6. Criar os buckets de Storage

Executar no SQL Editor do projeto staging:

```sql
-- conteúdo de supabase/seeds/staging_buckets.sql
```

Isso cria os 22 buckets com as mesmas permissões de produção. As policies de `storage.objects` já vêm nas migrations.

### 7. Popular dados de teste

Criar um usuário administrador no staging (`Authentication > Users`) e rodar o seed:

```sql
SET LOCAL seed.user_id = '<uuid-do-admin-criado>';
\i supabase/seeds/staging.sql
```

O seed cria tenant, empresa, departamentos, cargos, 20 colaboradores fictícios e contexto de IA.

### 8. Validar o staging

Buildar e rodar apontando para o novo banco:

```bash
npm run build:staging
npm run preview
```

Checklist de validação:

- Login com o admin do staging.
- Empresa carrega e seletor de empresa funciona.
- Módulo Ponto: marcação, apuração e banco de horas.
- Geração de PDF.
- Chamada de IA (Gerar Função com IA).
- Upload de documento.

### 9. (Opcional) Publicar o staging em domínio próprio

A Lovable publica um único build por projeto (hoje, produção). Para ter `teste.youreyes.com.br` ou similar, hospedar o resultado de `npm run build:staging` em um serviço estático (Vercel, Netlify, Cloudflare Pages) apontando para o domínio de teste.

## Como alternar sem afetar a produção

### Desenvolvimento local

```bash
# Staging
cp .env.staging .env
npm run dev

# Produção (padrão)
cp .env.production .env
npm run dev
```

### Build direcionado

```bash
npm run build:staging      # gera dist apontando para staging
npm run build:production # gera dist apontando para produção
```

A troca é só no arquivo `.env` durante o build. Não muda código, não mexe no banco de produção e não quebra a conexão atual do editor.

## Próxima decisão

- O staging será usado apenas localmente/preview interno, ou você quer publicá-lo em um domínio de teste (ex.: `teste.youreyes.com.br`)?
- Se for publicar, escolher o host (Vercel, Netlify, Cloudflare Pages) para configurar o deploy automático a partir de `npm run build:staging`.

# Ambientes YourEyes

Este projeto suporta múltiplos ambientes Supabase independentes: **produção** e **staging**. Cada ambiente possui seu próprio arquivo `.env` e os URLs/keys são injetados no build via Vite.

## Arquivos de ambiente

| Arquivo | Propósito | Deve estar no Git? |
|---|---|---|
| `.env` | Ambiente ativo local/preview. Inicia com produção. | Não (já contém secrets de projeto) |
| `.env.example` | Template para novos desenvolvedores. | Sim |
| `.env.production` | Configuração do projeto Supabase de produção atual. | Não |
| `.env.staging` | Configuração do projeto Supabase de staging/testes. | Não |

> **Nota:** `.gitignore` protege os arquivos `.env`, `.env.production`, `.env.staging` e `.env.local`. O arquivo `.env` atual já está versionado com os dados de produção; considere removê-lo do controle de versão no futuro se a política de segurança exigir.

## Como alternar entre ambientes

### Para desenvolvimento local

Copie o arquivo do ambiente desejado para `.env`:

```bash
# Staging
cp .env.staging .env

# Produção (padrão)
cp .env.production .env
```

Depois inicie o servidor:

```bash
npm run dev
```

### Para build manual

```bash
# Staging
npm run build:staging

# Produção
npm run build:production
```

## Criar o projeto Supabase de staging

Roteiro completo, na ordem. Nenhum arquivo da aplicação precisa ser alterado — o trabalho é de infraestrutura.

### 1. Criar o projeto

No dashboard do Supabase, crie um novo projeto (ex.: `youreyes-staging`). Anote **Project URL**, **anon/public key** e o **project ref**.

### 2. Preencher `.env.staging`

Substitua os placeholders `<staging-project-id>` e `<staging-anon-key>` pelos valores reais. `VITE_APP_URL` deve apontar para a URL onde o staging será acessado.

### 3. Replicar o schema (706 migrations)

```bash
supabase link --project-ref <staging-project-id>
supabase db push
```

> Rodar as migrations manualmente no SQL Editor não é viável nesse volume — use a CLI.

### 4. Deployar as Edge Functions (71 funções)

```bash
supabase functions deploy --project-ref <staging-project-id>
```

### 5. Recadastrar os secrets

Secrets **não** são copiados entre projetos. Configure em `Project Settings > Edge Functions > Secrets`:

| Secret | Uso |
|---|---|
| `LOVABLE_API_KEY` | Lovable AI Gateway (geração de conteúdo, análises) |
| `OPENAI_API_KEY` | Extrações e análises com GPT-4o |
| `RESEND_API_KEY` | Envio de e-mails transacionais |
| `EMAIL_FROM` | Remetente dos e-mails |
| `APP_URL` / `SITE_URL` | Links públicos (assinaturas, convites) — apontar para a URL de staging |
| `WHATSAPI_BASE_URL` / `WHATSAPI_TOKEN` | OTP e ponto via WhatsApp |
| `MERCADOPAGO_ACCESS_TOKEN` | Cobrança/assinaturas |
| `CONSULTACRM_KEY` | Consulta de conselhos profissionais |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pela plataforma.

> Em staging, use chaves de teste/sandbox sempre que o provedor oferecer (Mercado Pago, WhatsApp), para não disparar cobranças ou mensagens reais.

### 6. Criar os buckets de Storage

Execute `supabase/seeds/staging_buckets.sql` no SQL Editor do staging. Ele cria os 22 buckets com a mesma visibilidade e limites de produção (atestados, documentos, esocial-certificados, ponto-selfies, trilha-conteudo etc.). As policies de `storage.objects` já vêm nas migrations.

### 7. Popular dados de teste

Crie um usuário administrador no staging (Authentication > Users) e execute o seed no SQL Editor:

```sql
-- Substitua o UUID abaixo pelo user_id do administrador criado em auth.users
SET LOCAL seed.user_id = '00000000-0000-0000-0000-000000000000';
\i supabase/seeds/staging.sql
```

O seed cria:

- Um tenant `Empresa Staging LTDA` (plano `enterprise`).
- Uma empresa matriz com CNPJ fictício.
- 4 departamentos: Administrativo, RH, Operações e Tecnologia.
- 4 cargos associados.
- 20 colaboradores fictícios com CPFs seqüenciais.
- Contexto de IA (`ai_context`) para testes de geração de funções.

### 8. Validar

- [ ] Login com o usuário admin.
- [ ] Empresa ativa carrega e o seletor de empresa funciona.
- [ ] Módulo Ponto: marcação, apuração e banco de horas.
- [ ] Geração de um PDF (Cartão Ponto ou Manual de Função).
- [ ] Uma chamada de IA (Gerar Função com IA) — valida secret + Edge Function.
- [ ] Upload de um documento — valida bucket + policies.

## Verificação de ambiente

Para garantir que nenhum valor de produção está hard-coded no código, execute:

```bash
rg -n "diayjpsrcerycycyaxst" src/ || echo "Nenhuma referência hard-coded encontrada em src/"
```

Resultado esperado: nenhuma correspondência em `src/`. Os únicos arquivos com valores fixos devem ser `.env`, `.env.production` e `supabase/config.toml`.

## Checklist antes de publicar

- [ ] `.env` está com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretos para o ambiente desejado.
- [ ] Migrations estão aplicadas no projeto.
- [ ] Edge Functions estão deployadas e secrets configuradas.
- [ ] Buckets de Storage criados.
- [ ] Se for staging, execute `npm run build:staging` e confirme que aponta para o staging.
- [ ] Nenhuma URL/key de produção foi commitada por engano.

## Dúvidas comuns

**Posso ter dois bancos na mesma conta Supabase?**
Sim, cada projeto Supabase é um banco isolado. Você pode ter quantos projetos quiser na mesma conta, respeitando os limites do plano. Não é preciso criar outra conta.

**É preciso duas contas Lovable?**
Não. A Lovable conecta um projeto Supabase por vez — o editor continua apontando para produção. O staging é usado via build local (`npm run build:staging`) ou alternando temporariamente a conexão do Supabase nas configurações do projeto.

**Como publico o staging em um domínio próprio?**
A Lovable publica um único build por projeto (hoje, produção). Para um `teste.youreyes.com.br`, hospede o resultado de `npm run build:staging` em um host estático (Vercel, Netlify, Cloudflare Pages) apontando para o domínio de teste.

**E o `supabase/config.toml`?**
Ele mantém o `project_id` de produção como padrão. Quando for trabalhar localmente no staging via CLI, use `supabase link --project-ref <staging-project-id>` para sobrescrever temporariamente.

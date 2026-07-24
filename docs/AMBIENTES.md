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

1. No dashboard do Supabase, crie um novo projeto em uma organização separada.
2. Copie **Project URL** e **anon/public key** (Project Settings > API) para `.env.staging`.
3. Atualize `VITE_SUPABASE_PROJECT_ID` com o identificador do novo projeto.

### Sincronizar estrutura do banco

Aplique todas as migrations existentes no projeto de staging:

```bash
# Usando CLI do Supabase (se configurada localmente)
supabase link --project-ref <staging-project-id>
supabase db push
```

Ou execute manualmente os arquivos em `supabase/migrations/` no SQL Editor do novo projeto.

### Popular dados de teste

Após criar a estrutura e um usuário administrador no novo projeto, execute o seed no SQL Editor do staging:

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

### Edge Functions no staging

Deploye as Edge Functions no ambiente de staging:

```bash
supabase functions deploy --project-ref <staging-project-id>
```

Configure os mesmos secrets de produção no staging em `Project Settings > Edge Functions > Secrets`.

## Verificação de ambiente

Para garantir que nenhum valor de produção está hard-coded no código, execute:

```bash
rg -n "diayjpsrcerycycyaxst" src/ || echo "Nenhuma referência hard-coded encontrada em src/"
```

Resultado esperado: nenhuma correspondência em `src/` (apenas fallbacks removidos). Os únicos arquivos com valores fixos devem ser `.env`, `.env.production` e `supabase/config.toml`.

## Checklist antes de publicar

- [ ] `.env` está com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretos para o ambiente desejado.
- [ ] Migrations estão aplicadas no projeto.
- [ ] Edge Functions estão deployadas e secrets configuradas.
- [ ] Se for staging, execute `npm run build:staging` e confirme que aponta para o staging.
- [ ] Nenhuma URL/key de produção foi commitada por engano.

## Dúvidas comuns

**Posso ter dois bancos na mesma conta Supabase?**
Sim, cada projeto Supabase é um banco isolado. Você pode ter quantos projetos quiser na mesma conta, respeitando os limites do plano.

**É preciso duas contas Lovable?**
Não obrigatoriamente. A Lovable pode conectar um projeto por vez. Para testar staging no editor, você precisa alternar a conexão do Supabase nas configurações do projeto. O código compilado, no entanto, aponta para o ambiente escolhido no `.env` do build.

**E o `supabase/config.toml`?**
Ele mantém o `project_id` de produção como padrão. Quando for trabalhar localmente no staging via CLI, use `supabase link --project-ref <staging-project-id>` para sobrescrever temporariamente.

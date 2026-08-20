# Ambientes YourEyes

Este projeto suporta três ambientes Supabase independentes: **produção**, **teste**
(staging) e **homologação**. Cada um tem seu próprio arquivo `.env`, e as URLs/chaves
são injetadas no build pelo Vite conforme o `--mode`.

| | TESTE (staging) | HOMOLOGAÇÃO | PRODUÇÃO |
|---|---|---|---|
| Como recebe mudança | esteira automática, a cada merge | **o mesmo script colado à mão** | script colado à mão |
| Estrutura | a do repositório | **cópia fiel da produção**, drift incluído | a real |
| Dados | fictícios | fictícios | reais |
| Responde a | "a mudança funciona?" | **"o script aplica na estrutura real?"** | — |

A homologação existe por causa de uma diferença que custou caro duas vezes: o teste
recebe tudo automaticamente e a produção só recebe o que é colado, então os dois se
afastam. Um script de entrega já abortou na produção por uma coluna que existia no
teste, e uma rotina de QA quebrou por funções auxiliares que nunca chegaram lá. A
homologação é onde o script encontra a estrutura real **antes** de a produção
encontrá-lo.

## Arquivos de ambiente

| Arquivo | Propósito | Está no Git? |
|---|---|---|
| `.env` | Ambiente ativo local/preview (produção por padrão). | Sim |
| `.env.example` | Template para novos desenvolvedores. | Sim |
| `.env.production` | Configuração do projeto Supabase de produção. | Sim |
| `.env.staging` | Configuração do projeto Supabase de teste. | Sim |
| `.env.homologacao` | Configuração do projeto Supabase de homologação. | Sim |

> **Sobre segurança:** esses arquivos estão **versionados de propósito** e só podem conter valores públicos — URL do projeto e chave anon/publishable (a mesma que qualquer navegador recebe). **Nunca** coloque neles `service_role`, senhas ou tokens privados; secrets vivem em `Project Settings > Edge Functions > Secrets`. Para sobrescritas locais privadas use `.env.local` / `.env.staging.local`, que o `.gitignore` ignora (regra `*.local`).

## Como alternar entre ambientes

### Para desenvolvimento local

Não copie arquivos: o Vite carrega o `.env.<modo>` automaticamente pelo `--mode`, sem tocar no `.env` (que é versionado e deve continuar apontando para produção).

```bash
# Produção (padrão)
npm run dev

# Teste (staging)
npm run dev:staging

# Homologação
npm run dev:homologacao
```

### Para build manual

```bash
# Teste (staging)
npm run build:staging

# Homologação
npm run build:homologacao

# Produção
npm run build:production
```

> Os scripts usam apenas `--mode`: nenhum deles sobrescreve o `.env`.

## Criar a homologação

Roteiro completo, na ordem. Só o passo 1 depende do painel do Supabase; o resto é
linha de comando e cópia de arquivo.

### 1. Criar o projeto

No painel do Supabase, crie um projeto novo (sugestão de nome: `youreyes-homologacao`).
Anote **Project URL**, **anon/public key** e o **project ref**.

> Escolha a mesma região da produção. Diferença de região muda latência e, em
> alguns casos, comportamento de fuso em função de data — e a graça da
> homologação é justamente não ter diferença nenhuma.

### 2. Preencher `.env.homologacao`

Substitua os três placeholders pelos valores reais. O arquivo já está no
repositório com os avisos.

Há uma trava no `vite.config.ts`: se a URL apontar para o projeto de produção, o
build de qualquer modo que não seja `production` **não nasce**, com mensagem
explicando. Publicar um ambiente de teste sobre o banco real é o acidente que ela
existe para impedir.

### 3. Copiar a ESTRUTURA da produção — e só a estrutura

Este é o passo que diferencia a homologação do teste. Ela **não** nasce das
migrations: nasce de um retrato da produção, com o drift que a produção tem.

**Por que este passo sai do SQL Editor.** O retrato da estrutura tem cerca de
2,4 MB e 68 mil linhas. Não é algo que se cole numa tela — precisa de terminal.
É o único passo do processo que exige isso, e é uma vez só.

#### Antes de começar

Você vai precisar de:

- **Node instalado** (já tem, é o que roda o projeto). Isso basta: o Supabase CLI
  é chamado com `npx`, sem instalar nada permanente.
- **A senha do banco de cada projeto**. No painel do Supabase:
  **Project Settings → Database → Database password**. Se não souber, use
  *Reset database password* — trocar a senha do banco não derruba a aplicação,
  que usa a chave anon, não a senha.
- **A connection string de cada projeto**: no painel, botão **Connect**, no topo.
  Copie a que o painel oferecer; se sua internet for só IPv4, prefira a opção
  **Session pooler** (a conexão direta do Supabase é IPv6 e falha em muitas redes
  domésticas — se der "could not translate host name" ou "network unreachable",
  é isso).

#### Os comandos

Abra o terminal numa pasta qualquer e rode, na ordem:

```bash
# 1. Entrar na sua conta Supabase (abre o navegador para autorizar)
npx supabase login

# 2. Tirar o retrato da estrutura da PRODUÇÃO — só o schema public, sem dados
npx supabase db dump \
  --db-url "<connection string da PRODUÇÃO>" \
  --schema public \
  -f estrutura_producao.sql
```

Confira que o arquivo nasceu com tamanho de megabytes:

```bash
ls -lh estrutura_producao.sql
```

Agora a restauração na homologação. O jeito sem instalar mais nada é usar o
próprio CLI, numa pasta descartável:

```bash
# 3. Pasta temporária com um projeto Supabase vazio
mkdir /tmp/homolog && cd /tmp/homolog
npx supabase init

# 4. O retrato vira a única migration desta pasta
mkdir -p supabase/migrations
cp <caminho>/estrutura_producao.sql \
   supabase/migrations/00000000000000_estrutura_producao.sql

# 5. Apontar para a HOMOLOGAÇÃO e aplicar
npx supabase link --project-ref fgsblefvdabgdouipigz
npx supabase db push
```

> Se você já tiver o `psql` instalado, o passo 3 a 5 vira um comando só:
> `psql "<connection string da HOMOLOGAÇÃO>" -f estrutura_producao.sql`

#### O que esperar

**Alguns erros são normais** e não significam fracasso. Um retrato de banco
restaurado em projeto novo costuma reclamar de coisas que o Supabase já criou
sozinho (extensões, papéis, permissões) ou de objetos que dependem de schemas
gerenciados por ele. Guarde a saída inteira do comando: o que interessa é o que
falhou, não o que reclamou.

Se aparecerem erros, mande a saída — as lacunas se fecham com um script pequeno,
e é justamente para isso que o retrato existe.

#### Como saber que deu certo

Rode na **homologação** os mesmos scripts de conferência que você rodou na
produção:

- `docs/script_divergencia_producao_parte1.sql`
- `docs/script_divergencia_producao_parte2.sql`

**O resultado tem que ser igual ao da produção** — as mesmas tabelas faltando, as
mesmas colunas, o mesmo motor de QA incompleto. Igualdade aqui não é defeito: é a
prova de que a cópia é fiel. Se der diferente, compare os dois resultados; a
diferença é o que a restauração não trouxe.

### 4. Semear dados fictícios

Use os mesmos padrões do teste: `Empresa Homologação LTDA`, CPFs da faixa
900.000.0XX com dígito verificador válido (o sistema valida DV). O volume não
precisa ser grande — a homologação não é ambiente de carga.

### 5. A partir daqui, só o gesto manual

**Nunca rode `supabase db push` na homologação.** Ela deixaria de ser cópia da
produção e viraria um segundo ambiente de teste — inútil, porque já existe um.

Daqui em diante ela recebe exatamente o que a produção recebe: o script colado no
SQL Editor. Na mesma ordem, com o mesmo conteúdo.

## O fluxo de entrega com três ambientes

1. **Desenvolver** → merge na `main` → a esteira aplica no **teste**.
2. **Validar no teste**: a mudança funciona?
3. **Colar o script na HOMOLOGAÇÃO**: ele aplica na estrutura real? A conferência
   volta toda `ok`?
4. Só então **colar na produção**.

O passo 3 é o que muda. Ele custa dois minutos e responde à única pergunta que o
teste não consegue responder — porque o teste tem a estrutura do repositório, e a
produção tem a dela.

Se o script abortar no passo 3, você descobriu de graça o que teria descoberto na
produção com a operação parada.

## Manter a homologação em dia

A homologação envelhece igual à produção — e pelo mesmo motivo, se alguém colar um
script só na produção e esquecer dela.

- **Sempre que colar na produção, cole na homologação primeiro.** É a regra que
  mantém as duas iguais sem nenhum trabalho extra.
- **A cada trimestre, ou depois de qualquer trabalho manual feito direto na
  produção**, refaça o passo 3 (novo retrato da estrutura). É rápido e zera a
  distância.
- **Confira quando desconfiar:** os scripts
  `docs/script_divergencia_producao_parte*.sql` comparam qualquer ambiente com o
  repositório. Rodando os mesmos na produção e na homologação, a diferença entre
  os dois resultados é exatamente o quanto elas se afastaram.

## Rodar a homologação localmente

```bash
npm run dev:homologacao      # sobe apontando para o banco de homologação
npm run build:homologacao    # gera o build de homologação
```

A versão do build sai carimbada — `1.0.0-homolog.<data>` na homologação e
`1.0.0-teste.<data>` no teste —, então um print de tela já diz de onde veio.

Enquanto não houver host próprio para a homologação, ela roda local. Não é
limitação séria: o que se valida ali é o **script**, no SQL Editor, não a tela.

## Criar o projeto Supabase de staging

Roteiro completo, na ordem. Nenhum arquivo da aplicação precisa ser alterado — o trabalho é de infraestrutura.

### 1. Criar o projeto

No dashboard do Supabase, crie um novo projeto (ex.: `youreyes-staging`). Anote **Project URL**, **anon/public key** e o **project ref**.

### 2. Preencher `.env.staging`

Substitua os placeholders `<staging-project-id>` e `<staging-anon-key>` pelos valores reais. `VITE_APP_URL` deve apontar para a URL onde o staging será acessado.

### 3. Replicar o schema (todas as migrations do repositório)

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

No SQL Editor (que não entende comandos do psql como `\i`): abra o arquivo `supabase/seeds/staging.sql`, cole o conteúdo inteiro no editor, ajuste o UUID do administrador no topo e execute.

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

## Automação (GitHub Actions)

O workflow `.github/workflows/staging.yml` mantém o staging atualizado sozinho: a cada mudança mesclada na `main`, ele aplica as migrations novas no projeto de staging, reimplanta as Edge Functions e — se os secrets do Netlify estiverem configurados — publica o site de teste. Ninguém precisa de CLI local para manter o ambiente.

Secrets (Settings > Secrets and variables > Actions do repositório):

| Secret | Para quê | Obrigatório |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token pessoal do Supabase (Account > Access Tokens) | Sim |
| `SUPABASE_DB_PASSWORD` | Senha do banco do projeto de staging | Sim |
O site de teste é publicado no **GitHub Pages** do próprio repositório — https://ustudy123.github.io/seguramente-0aed4f79/ — sem contas nem secrets adicionais. Ele aponta para o banco de STAGING (login com os usuários fictícios).

O workflow tem trava contra apontar para a produção e pode ser disparado manualmente na aba Actions (`workflow_dispatch`).

## Verificação de ambiente

Para garantir que nenhum valor de produção está hard-coded onde não deve, verifique o `src/` **e as migrations** (era nas migrations que o problema estava):

```bash
rg -n "diayjpsrcerycycyaxst" src/ supabase/migrations/
```

Resultado esperado: nenhuma ocorrência em `src/`; nas migrations, apenas as duas ocorrências **neutralizadas** e o script de entrega:

- `20260702174019_…` — reparo de dados de produção com **guarda de ambiente**: em banco sem o tenant de produção, o bloco sai sem fazer nada (as URLs restantes são dados históricos de selfie, não chamadas);
- `20260803100000_…` e `20260810100000_…` — o dispatch dos agentes lê URL e chave da tabela `app_config`; a URL fixa não existe mais no corpo da função.

Os únicos arquivos com valores fixos legítimos são `.env`, `.env.production` e `supabase/config.toml`.

### Agentes YourEyes no staging (`app_config`)

O disparador dos agentes (roda a cada minuto) só chama a Edge Function se `app_config` tiver `supabase_url` e `supabase_anon_key`. **Num ambiente recém-criado ele não chama ninguém** — proteção para o staging nunca acionar a produção. Para ativar os agentes no staging, insira os valores DO STAGING:

```sql
INSERT INTO public.app_config (chave, valor) VALUES
  ('supabase_url', 'https://<staging-project-id>.supabase.co'),
  ('supabase_anon_key', '<staging-anon-key>')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();
```

Em produção, os valores são semeados pelo script `docs/script_app_config_producao.sql`.

### Agendar os Testes de tela (Cypress) — `github_dispatch_token`

A aba "Testes Cypress" do painel de QA tem "Rodar automaticamente", igual ao Motor. Mas o Cypress roda na esteira do GitHub, não no banco: no horário marcado, o `pg_cron` do ambiente pede à esteira que rode (`workflow_dispatch`). Isso exige um token do GitHub em `app_config`. **Sem o token, o horário fica salvo mas nada é disparado** — mesma proteção de ambiente dos agentes.

O token é um *fine-grained PAT* com permissão **Actions: Read and write** neste repositório. Crie em GitHub → Settings → Developer settings → Fine-grained tokens. Guarde-o no ambiente que deve disparar (normalmente o staging):

```sql
INSERT INTO public.app_config (chave, valor) VALUES
  ('github_dispatch_token', '<cole-o-token-aqui>')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now();
```

Opcionalmente, `github_dispatch_repo` (padrão `ustudy123/seguramente-0aed4f79`), `github_dispatch_workflow` (padrão `staging.yml`) e `github_dispatch_ref` (padrão `main`) sobrescrevem os alvos. **Nunca versione o token** — ele vive só no `app_config` do ambiente. O schema/funções são instalados pela migration `20260814120000_qa_agendamento_e2e_esteira.sql` (staging) e pelo script `docs/script_qa_agendamento_e2e.sql` (produção).

## Checklist antes de publicar

- [ ] `.env` está com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretos para o ambiente desejado.
- [ ] Migrations estão aplicadas no projeto.
- [ ] Edge Functions estão deployadas e secrets configuradas.
- [ ] Buckets de Storage criados.
- [ ] Se for staging, execute `npm run build:staging` e confirme no build gerado que a URL é a do staging.
- [ ] `app_config` do ambiente aponta para o próprio ambiente (agentes).
- [ ] Nenhum secret privado (service_role, senhas) foi commitado — os arquivos `.env*` versionados só carregam URL e chave publishable.

## Dúvidas comuns

**Posso ter dois bancos na mesma conta Supabase?**
Sim, cada projeto Supabase é um banco isolado. Você pode ter quantos projetos quiser na mesma conta, respeitando os limites do plano. Não é preciso criar outra conta.

**É preciso duas contas Lovable?**
Não. A Lovable conecta um projeto Supabase por vez — o editor continua apontando para produção. O staging é usado via build local (`npm run build:staging`) ou alternando temporariamente a conexão do Supabase nas configurações do projeto.

**Como publico o staging em um domínio próprio?**
A Lovable publica um único build por projeto (hoje, produção). Para um `teste.youreyes.com.br`, hospede o resultado de `npm run build:staging` em um host estático (Vercel, Netlify, Cloudflare Pages) apontando para o domínio de teste.

**E o `supabase/config.toml`?**
Ele mantém o `project_id` de produção como padrão. Quando for trabalhar localmente no staging via CLI, use `supabase link --project-ref <staging-project-id>` para sobrescrever temporariamente.

## Conferir se a produção está alinhada com o repositório

O ambiente de teste recebe **toda** mudança automaticamente pela esteira; a
produção só recebe o que é colado no SQL Editor. A cada script não colado, os
dois se afastam — e a diferença só aparece quando algo quebra na hora errada.
Já aconteceu duas vezes: um script de entrega abortou por causa de uma coluna
que existia no teste e não na produção, e a rotina de QA `FERIAS-017` quebrou
porque duas funções auxiliares nunca foram entregues.

Para medir essa distância antes que ela cobre o preço, existem duas consultas
**somente leitura** para colar no SQL Editor da produção:

| Arquivo | Compara |
|---|---|
| `docs/script_divergencia_producao_parte1.sql` | tabelas, colunas e tipos (enums) |
| `docs/script_divergencia_producao_parte2.sql` | funções, gatilhos e políticas de segurança |

Elas listam **só as diferenças**, nos dois sentidos:

- **só no repositório** → falta aplicar na produção;
- **só na produção** → objeto criado direto no banco que ninguém trouxe de volta
  para o código (precedentes: `feriados`, `feriado_comportamento`);
- **difere** → o conjunto mudou; a coluna `detalhe` mostra o que a produção tem
  hoje, para comparação.

Em ambiente alinhado o resultado é uma linha só, a de resumo.

> **Os arquivos envelhecem.** Cada um carrega uma fotografia do repositório na
> data em que foi gerado. Depois de novas migrations, precisa regerar — é rápido:
> extrai-se o inventário de uma réplica com todas as migrations aplicadas.

Vale rodar antes de uma entrega grande e depois de um período sem colar scripts.

# YourEyes — regras da casa para sessões do Claude Code

Plataforma SaaS de RH/SST (ponto eletrônico, saúde ocupacional, psicossocial,
admissões, financeiro). Stack: Vite + React 18 + TypeScript + shadcn/ui +
TanStack Query; Supabase (PostgreSQL com RLS, Edge Functions); as telas de
produção são publicadas pelo Lovable.

## Os dois ambientes — decore isto antes de qualquer coisa

| | PRODUÇÃO | STAGING (testes) |
|---|---|---|
| Projeto Supabase | `diayjpsrcerycycyaxst` | `bmehdgthciuvdbvutsdv` |
| Telas | seguramente.lovable.app (via Publicar no Lovable) | https://ustudy123.github.io/seguramente-0aed4f79/ |
| Dados | reais, protegidos por LGPD | fictícios (Empresa Staging LTDA, CPFs 900000xxx) |

**Fluxo obrigatório:** desenvolver → mesclar na `main` → o workflow
`.github/workflows/staging.yml` aplica sozinho no STAGING (migrations +
functions + site de teste) → humano valida no staging → só então produção.

**A produção NUNCA é alterada por esta esteira.** Ela só muda por dois gestos
manuais do usuário: (1) colar um script de entrega no SQL Editor de produção;
(2) clicar Publicar no Lovable. Nunca peça nem simule outros caminhos.
O Lovable publica as telas a partir da `main` — merge aqui já deixa o código
pronto para o próximo Publicar.

**Nunca** coloque dados reais (CPFs, nomes, atestados) no staging, em seeds,
em PDFs de devolutiva ou em documentos que circulam. Dados de saúde são
sensíveis (LGPD art. 11). CPFs fictícios da casa: faixa 900.000.0XX com
dígito verificador válido (o sistema valida DV).

## Mudanças de banco: migration + script de entrega

Toda mudança de banco vira DUAS entregas:
1. **Migration** em `supabase/migrations/` — é o que o robô aplica no staging;
2. **Script de entrega** em `docs/script_*.sql` — versão para o usuário colar
   no SQL Editor de produção (o Lovable NÃO roda migrations em produção).

Regras dos scripts de entrega (aprendidas a caro preço):
- O SQL Editor roda o arquivo inteiro em UMA transação e NÃO mantém sessão
  entre execuções: nada de tabelas temporárias entre statements — use CTEs
  `WITH x AS MATERIALIZED (...)` autossuficientes em cada statement.
- Nunca `RAISE EXCEPTION` solto (aborta tudo): blocos `DO` com
  `EXCEPTION WHEN OTHERS THEN RAISE NOTICE` por item.
- Idempotente sempre (rodar duas vezes não pode quebrar nem duplicar).
- Termina com UMA conferência `SELECT` — o editor só mostra o último
  resultado. Inclua colunas de erro (ex.: `erro_tecnico`) quando houver.
- Existe statement timeout: updates linha a linha com função por registro
  estouram tempo em tabelas grandes — prefira UPDATE com JOIN/CTE.
- DDL em tabela movimentada: `SET lock_timeout = '10s'`; nunca crie triggers
  em DUAS tabelas movimentadas na mesma transação (deadlock real já ocorrido)
  — divida em scripts parte1/parte2.
- `auth.uid()` é NULL no SQL Editor; simule usuário com
  `set_config('request.jwt.claims', json_build_object('sub', uid, 'role','authenticated')::text, true)`
  (transação-local).

Regras das migrations:
- Carimbo (timestamp do nome) ÚNICO — carimbos duplicados quebram o registro
  do CLI. Confira antes de criar.
- NUNCA URL/chave de projeto no código (nem produção nem staging). Config por
  ambiente vive na tabela `app_config` (`supabase_url`, `supabase_anon_key`);
  sem valores, rotinas de disparo não chamam ninguém (proteção de ambiente).
- Seed/reparo com dados específicos de produção: embrulhe em bloco
  `DO $prodseed$` com `EXCEPTION WHEN foreign_key_violation OR not_null_violation
  OR raise_exception THEN RAISE NOTICE ... $prodseed$` — em banco novo pula,
  em produção roda igual (padrão já usado em 33 migrations).
- Objeto criado fora das migrations em produção: traga para o repositório com
  `IF NOT EXISTS` (precedentes: `feriados`, `ponto_diario.tipo_dia`).
- Extensões base (pgcrypto, pg_trgm, pg_cron, pg_net) já garantidas em
  `20260118212300_extensoes_base.sql` — não recriar. `digest`/`gen_random_bytes`
  têm atalhos em `public` porque o db push não enxerga o schema `extensions`.

## Pegadinhas conhecidas do schema (não redescobrir do jeito difícil)

- `perfil_permissoes.escopo` é ENUM `perfil_escopo_tipo` SEM o valor
  `'empresa'` (tem `empresa_inteira`, `proprio_usuario`, ...). Compare sempre
  como texto: `COALESCE(pp.escopo::text,'') <> 'proprio_usuario'`. Um literal
  inválido contra enum quebra em EXECUÇÃO, não na criação da função.
- `admissoes.status` (enum `admissao_status`): colaborador ativo =
  `'concluido'` (não existe `'ativo'`). Painéis filtram também por
  `empresa_id` — registros sem vínculo ficam invisíveis.
- Papéis: `user_roles` + `has_minimum_role(uid, role)`; tipos de usuário
  (`usuarios_base.tipo_usuario`) mapeiam via `src/lib/userRoleMap.ts`
  (colaborador → 'user').
- Camada de acesso por perfil: função `perfil_permite_modulo(tenant, VARIADIC
  modulos)` + políticas RESTRICTIVE `perfil_restringe_leitura_*` em 11 tabelas
  sensíveis. Tabela sensível nova PRECISA da política (a rotina de QA
  PERFIL-003 acusa) ou de exceção documentada dentro da própria rotina.

## QA

Motor em `qa_*`: casos em `qa_casos_teste` (código único, ex.: PERFIL-004),
rotinas `qa_caso_<x>()` que devolvem `qa_retorno` (situacao ∈ passou | falhou |
nao_implementado | erro + `erro_tecnico`), executadas por
`qa_rodar_bateria('manual', '<path do módulo>')`. Rotinas são somente leitura
(simulação por claims em transação). Ao mexer em área coberta, rode a bateria
da família no staging e inclua-a na conferência do script de entrega.

### Testes de tela (Cypress) — documentação vem antes do teste

Regra da casa: **todo teste de tela nasce de um caso documentado**. A
Documentação de testes (`qa_casos_teste`) é a fonte da verdade; cada caso tem
`nivel` `'api'` (roda no motor SQL) ou `'e2e'` (roda no browser, via Cypress).
O Cypress só implementa casos de nível `e2e` **já documentados** — nunca o
contrário. Consequências práticas:
- **Não invente teste de tela** sem um caso `e2e` documentado. Módulo sem
  documentação `e2e` fica sem teste de tela (e sem problema).
- Ao **documentar** casos `e2e` novos para um módulo, aí sim adicione os `it()`
  correspondentes em `cypress/e2e/<modulo>.cy.ts`.
- A ligação caso ↔ `it()` vive em `qa_cobertura_e2e (codigo, spec, teste)`, onde
  `teste` é o **título exato** do `it()`. Renomear um `it()` sem atualizar a
  ponte quebra a ligação.
- **Guarda automática** (reprova a esteira): o passo `npm run qa:cobertura-e2e`
  (`scripts/verificar-cobertura-e2e.mjs`) lê os casos `e2e` da função read-only
  `qa-cobertura-e2e` (fechada por `QA_E2E_TOKEN`) e cruza com os `it()` reais.
  Falha a corrida se houver `it()` sem caso documentado (inventado); avisa (sem
  reprovar) sobre casos `e2e` documentados ainda sem teste e pontes quebradas.

## Como fechar uma entrega (obrigatório)

Ao terminar qualquer implementação, encerre a resposta com:
1. o link do site de teste — https://ustudy123.github.io/seguramente-0aed4f79/ ;
2. o que exatamente o usuário deve abrir/clicar lá para conferir (tela, caminho
   no menu, o que deve aparecer) e, se for banco, a conferência SQL para o
   SQL Editor do projeto de TESTE;
3. o aviso de que a produção segue intacta.

Então PARE e espere. Só depois de um "aprovado" explícito entregue o passo de
produção (script para o SQL Editor de produção e/ou "requer Publicar no
Lovable"). Nunca antecipe o passo de produção sem aprovação, e nunca sugira
que o usuário aplique algo na produção sem ter conferido no teste antes.

## Convenções de trabalho

- Branch própria por sessão (`claude/...`), PR para `main`, merge após testar.
  O merge dispara a esteira do staging automaticamente. (Nas respostas ao
  usuário, evite o jargão: fale em "registrar a mudança no projeto" e
  "ambiente de teste", não em branch/PR/merge/staging.)
- Antes de mexer em migrations, `git pull` — outras sessões e o Lovable também
  escrevem na `main`.
- Respostas e PDFs de devolutiva para o usuário: didáticos, em português,
  para leitor de RH não-técnico; nunca transcrever dados pessoais reais.
- `docs/AMBIENTES.md` documenta a infraestrutura dos ambientes; o manual da
  equipe está em PDF fora do repositório.
- Teste de mudanças de banco antes do merge: monte réplica local (PostgreSQL,
  stubs de `auth`/`storage`/`cron`/`net`) e rode as migrations — as 744
  atravessam um banco vazio sem erro; mantenha assim.

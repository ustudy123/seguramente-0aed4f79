# Relatório de Testes Automatizados — Seguramente / YourEyes

**Agente de QA · Cobertura de 3 blocos do sistema**

| | |
|---|---|
| **Data** | 18 de julho de 2026 |
| **Responsável** | Alexandre (uStudy) |
| **Ambiente** | Cercado isolado — nenhum dado de cliente foi criado, alterado ou lido |
| **Cobertura** | 122 casos executáveis · 16 módulos |
| **Resultado** | 115 comportamentos confirmados · **7 pontos de atenção** · 1 correção já aplicada |

---

## 1. Resumo executivo

O agente de QA exercita as regras de negócio do sistema diretamente no banco de dados, dentro de um ambiente sintético isolado. Cada teste cria dados fictícios, verifica o comportamento e desfaz tudo. Nenhum dado real é tocado.

Foram executados **122 casos de teste** cobrindo três blocos do sistema, mais os fluxos de admissão, atestado e EPI. A grande maioria passou — o que significa que as regras estão implementadas e protegidas no banco. Foram encontrados **7 pontos de atenção**, mais 1 problema que já foi corrigido durante os trabalhos.

### O padrão dos achados

Os 7 pontos têm todos a mesma natureza: **regras que são validadas apenas na interface (front-end) e não existem no banco de dados.**

Isso significa que a regra protege o usuário que usa a tela normalmente, mas **não protege** contra dados que entrem por outros caminhos: importação de planilha, chamadas de API, scripts de migração, correções manuais ou integrações futuras. Nesses casos, o banco aceita o dado inconsistente silenciosamente.

Nenhum achado é falha de segurança ou vazamento de dados. Todos os testes de isolamento entre clientes (multi-tenant) passaram — inclusive os mais críticos. O que se recomenda é **defesa em profundidade**: replicar no banco as validações que hoje só existem no front.

### A descoberta mais relevante

Ao testar módulos equivalentes, ficou comprovado — com evidência lado a lado — que **a equipe conhece as boas práticas e as aplicou em alguns módulos, mas não as replicou de forma consistente**. Ver a seção 3.

Isso muda a natureza do trabalho de correção: não é preciso projetar soluções novas. As soluções já existem no próprio sistema; falta espalhá-las. Ver seção 3 para os três casos comprovados.

---

## 2. Os pontos de atenção

Ordenados por prioridade sugerida. Cada item traz: onde está, o risco concreto, o caso de teste que comprova e a correção sugerida.

---

### 2.1 — [ALTA] CPF inválido é aceito pelo banco

| | |
|---|---|
| **Onde** | Tabela `usuarios_base`, coluna `cpf` |
| **Caso de teste** | `COLAB-021` |
| **Situação** | A validação de CPF (cálculo dos dígitos verificadores) existe **apenas no front-end**, em TypeScript — em `useImportacaoPlanilha.ts` e `VerificacaoCPF.tsx`. **Não há nenhuma função equivalente no banco de dados.** |

**Como reproduzir:** cadastrar um colaborador com CPF `111.111.111-11` (formato correto, dígitos verificadores inválidos) via importação ou API.

**Risco concreto:**
- **eSocial** — a Receita rejeita eventos com CPF inválido. Cada rejeição gera retrabalho e risco de multa por atraso.
- **Relatórios legais de SST** — o trabalhador aparece com identificação inválida em PPRA, PCMSO, laudos.
- **Identificação da pessoa** — CPF é a chave legal do trabalhador; um valor inválido compromete todo o histórico ligado a ele.

**Correção sugerida:** como não existe validação no banco, é preciso criar a função e depois aplicá-la como trigger. O SQL abaixo replica a lógica que já está no front.

```sql
-- 1) função de validação (mesma lógica do front, em PL/pgSQL)
CREATE OR REPLACE FUNCTION public.cpf_e_valido(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n text; s int := 0; d1 int; d2 int; i int;
BEGIN
  IF p_cpf IS NULL THEN RETURN true; END IF;        -- nulo é ausente, não inválido
  n := regexp_replace(p_cpf, '[^0-9]', '', 'g');
  IF length(n) <> 11 THEN RETURN false; END IF;
  IF n ~ '^(\d)\1{10}$' THEN RETURN false; END IF;  -- 111.111.111-11 e afins
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(n,i,1)::int * (11 - i); END LOOP;
  d1 := 11 - (s % 11); IF d1 >= 10 THEN d1 := 0; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(n,i,1)::int * (12 - i); END LOOP;
  d2 := 11 - (s % 11); IF d2 >= 10 THEN d2 := 0; END IF;
  RETURN d1 = substr(n,10,1)::int AND d2 = substr(n,11,1)::int;
END $$;

-- 2) trigger que aplica a validação na gravação
CREATE OR REPLACE FUNCTION public.trg_validar_cpf_usuarios_base()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.cpf_e_valido(NEW.cpf) THEN
    RAISE EXCEPTION 'CPF inválido: %', NEW.cpf
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_cpf_antes_de_gravar
  BEFORE INSERT OR UPDATE OF cpf ON public.usuarios_base
  FOR EACH ROW EXECUTE FUNCTION public.trg_validar_cpf_usuarios_base();
```

> A função `cpf_e_valido` acima foi testada contra: CPF válido com e sem pontuação (aceita), sequências repetidas, dígito verificador incorreto, string curta e zeros (rejeita), e nulo (aceita, por ser ausência e não erro).

> **Antes de aplicar:** verificar se já existem CPFs inválidos na base. A trigger só vale daí em diante; os registros existentes precisam de limpeza à parte, senão qualquer edição futura naquelas fichas passará a falhar.
> ```sql
> SELECT id, nome_completo, cpf FROM public.usuarios_base
> WHERE cpf IS NOT NULL AND NOT public.cpf_e_valido(cpf);
> ```

---

### 2.2 — [ALTA] E-mail de colaborador pode ser duplicado

| | |
|---|---|
| **Onde** | Tabela `usuarios_base`, coluna `email_principal` |
| **Caso de teste** | `COLAB-023` |
| **Situação** | A coluna é `TEXT`, sem restrição de unicidade. Dois colaboradores do mesmo cliente podem ter o mesmo e-mail. |

**Como reproduzir:** cadastrar dois colaboradores diferentes com o mesmo e-mail. Ambos são aceitos.

**Risco concreto:**
- **Login ambíguo** — o e-mail é usado como identificador de acesso. Com dois cadastros no mesmo e-mail, o sistema não sabe qual pessoa autenticar.
- **Convites** — um convite enviado para aquele e-mail pode vincular a pessoa errada.
- **Identidade** — duas fichas disputando a mesma identidade de acesso.

**Correção sugerida:** índice único por cliente, ignorando nulos e diferenças de maiúsculas.

```sql
CREATE UNIQUE INDEX CONCURRENTLY usuarios_base_email_tenant_uidx
  ON public.usuarios_base (tenant_id, lower(email_principal))
  WHERE email_principal IS NOT NULL AND email_principal <> '';
```

> **Antes de aplicar:** listar duplicatas existentes — o índice falhará se houver alguma.
> ```sql
> SELECT tenant_id, lower(email_principal) AS email, count(*), array_agg(id)
> FROM public.usuarios_base
> WHERE email_principal IS NOT NULL AND email_principal <> ''
> GROUP BY 1, 2 HAVING count(*) > 1;
> ```

---

### 2.3 — [ALTA] Documentos vencidos continuam marcados como válidos

| | |
|---|---|
| **Onde** | Tabela `documentos`, colunas `status` e `data_validade` |
| **Caso de teste** | `DOC-041` |
| **Situação** | Não há trigger nem rotina agendada que recalcule o `status` quando a `data_validade` passa. O status é definido manualmente e nunca muda sozinho. |

**Como reproduzir:** guardar um documento com data de validade no ano passado. O status permanece `valido`.

**Risco concreto:**
- **Falsa conformidade** — em uma fiscalização, o sistema exibe documentos vencidos como válidos. O gestor acredita estar em dia quando não está.
- **ASO, certificados e laudos** — os documentos de SST que mais têm prazo são exatamente os que ficam sem controle automático.
- **Não há aviso ativo** — foi verificado que **não existe rotina agendada** no banco varrendo documentos por vencimento. Se há algum alerta hoje, ele é calculado no front quando alguém abre a tela.

**Correção sugerida:** replicar a lógica que **já existe** em `terceiro_documentos`.

```sql
-- 1) fechar a lista de status (ver também o item 2.4)
-- 2) recalcular o status pela data, na gravação:
CREATE OR REPLACE FUNCTION public.trg_documento_status_por_validade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_validade IS NOT NULL THEN
    NEW.status := CASE
      WHEN NEW.data_validade < CURRENT_DATE                     THEN 'vencido'
      WHEN NEW.data_validade <= CURRENT_DATE + INTERVAL '30 day' THEN 'a_vencer'
      ELSE 'valido'
    END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER documento_status_por_validade
  BEFORE INSERT OR UPDATE OF data_validade ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_documento_status_por_validade();
```

> **A trigger sozinha não basta.** Ela recalcula na gravação; um documento parado no acervo vence sem ninguém mexer nele. Para isso é preciso uma rotina diária (`pg_cron`), no mesmo padrão dos jobs que o sistema já usa:
> ```sql
> -- exemplo de rotina diária de reclassificação
> UPDATE public.documentos SET status = 'vencido'
> WHERE data_validade < CURRENT_DATE AND status <> 'vencido';
> ```

---

### 2.4 — [MÉDIA] Status de documento aceita qualquer texto

| | |
|---|---|
| **Onde** | Tabela `documentos`, coluna `status` |
| **Caso de teste** | `DOC-042` |
| **Situação** | A coluna é `TEXT` com default `'valido'`, sem enum e sem `CHECK`. Qualquer texto é aceito. |

**Como reproduzir:** gravar um documento com `status = 'abacaxi'`. É aceito.

**Risco concreto:**
- **Documento some dos filtros** — um status desconhecido não aparece em nenhum agrupamento por situação. O documento fica invisível nas telas que filtram por status.
- **Relatórios incompletos** — totalizadores por situação não somam o que deveriam.
- Combinado com o item 2.3, agrava o problema: o status é o campo que deveria indicar validade, e ele não tem nem lista fechada nem cálculo automático.

**Correção sugerida:** fechar a lista de valores, seguindo o padrão de `terceiro_documentos`.

```sql
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_status_valido
  CHECK (status IN ('valido', 'a_vencer', 'vencido', 'pendente'));
```

> **Antes de aplicar:** verificar que valores existem hoje na base.
> ```sql
> SELECT status, count(*) FROM public.documentos GROUP BY status ORDER BY 2 DESC;
> ```

---

### 2.5 — [MÉDIA] CNPJ de empresa terceira pode ser duplicado

| | |
|---|---|
| **Onde** | Tabela `terceiros`, coluna `cnpj` |
| **Caso de teste** | `TER-020` |
| **Situação** | A coluna é `NOT NULL`, mas sem restrição de unicidade. A mesma empresa prestadora pode ser cadastrada duas vezes no mesmo cliente. |

**Como reproduzir:** cadastrar dois terceiros com o mesmo CNPJ. Ambos são aceitos.

**Risco concreto:**
- **Controle de acesso furado** — se um cadastro está bloqueado e o outro liberado, os trabalhadores da mesma empresa podem entrar pelo cadastro liberado.
- **Documentação dividida** — certidões e documentos ficam divididos entre dois cadastros; nenhum dos dois parece completo.
- **Treinamentos de SST** — o controle de quem está treinado se fragmenta.

**Correção sugerida:** índice único por cliente, sobre o CNPJ normalizado — mesmo padrão já usado com sucesso em `empresa_cadastro`.

```sql
CREATE UNIQUE INDEX CONCURRENTLY terceiros_cnpj_tenant_uidx
  ON public.terceiros (tenant_id, regexp_replace(cnpj, '[^0-9]', '', 'g'));
```

> **Antes de aplicar:** listar duplicatas.
> ```sql
> SELECT tenant_id, regexp_replace(cnpj,'[^0-9]','','g') AS cnpj_limpo,
>        count(*), array_agg(razao_social)
> FROM public.terceiros GROUP BY 1,2 HAVING count(*) > 1;
> ```

---

### 2.6 — [MÉDIA] Progresso de meta aceita valores impossíveis

| | |
|---|---|
| **Onde** | Tabelas `metas` e `meta_okrs`, coluna `progresso` |
| **Caso de teste** | `META-012` |
| **Situação** | A coluna é `INTEGER` sem `CHECK` de faixa. Aceita 150, −20, qualquer número. |

**Como reproduzir:** gravar uma meta com `progresso = 150`. É aceita.

**Risco concreto:**
- **Barras de progresso quebradas** — a barra passa de 100% na tela.
- **Médias distorcidas** — o percentual médio de atingimento fica errado, e a distorção é silenciosa: ninguém percebe que o número está inflado.
- **Avaliação de desempenho** — se metas alimentam avaliação, um progresso inflado beneficia indevidamente.

**Correção sugerida:**

```sql
ALTER TABLE public.metas
  ADD CONSTRAINT metas_progresso_faixa CHECK (progresso BETWEEN 0 AND 100);

ALTER TABLE public.meta_okrs
  ADD CONSTRAINT meta_okrs_progresso_faixa CHECK (progresso BETWEEN 0 AND 100);
```

> **Este `CHECK` já existe em `plano_acoes`** — é exatamente a mesma linha. Ver seção 3.
> Antes de aplicar, verificar se há valores fora da faixa:
> ```sql
> SELECT id, titulo, progresso FROM public.metas WHERE progresso NOT BETWEEN 0 AND 100;
> ```

---

### 2.7 — [BAIXA] Faixa salarial de cargo pode ser invertida

| | |
|---|---|
| **Onde** | Tabela `cargos`, colunas `faixa_salarial_min` e `faixa_salarial_max` |
| **Caso de teste** | `CARGO-012` |
| **Situação** | Não há verificação de coerência entre mínimo e máximo. |

**Como reproduzir:** cadastrar um cargo com mínimo R$ 8.000 e máximo R$ 3.000. É aceito.

**Risco concreto:** relatórios de faixa salarial ficam incoerentes; cálculos que assumem `min <= max` produzem resultados errados. Impacto operacional menor que os anteriores, mas de correção trivial.

**Correção sugerida:**

```sql
ALTER TABLE public.cargos
  ADD CONSTRAINT cargos_faixa_salarial_coerente
  CHECK (faixa_salarial_min IS NULL
      OR faixa_salarial_max IS NULL
      OR faixa_salarial_min <= faixa_salarial_max);
```

---

### 2.8 — [RESOLVIDO] Duplicação de vínculo de colaborador

| | |
|---|---|
| **Onde** | Tabela `usuario_vinculos` |
| **Status** | **Corrigido em 15/07/2026** |

A mesma pessoa podia ter mais de um vínculo vigente na mesma empresa, com o mesmo tipo. Foi criado o índice único `usuario_vinculos_vigente_uidx` (chave: empresa + pessoa + tipo, apenas para status vigentes) e **133 vínculos duplicados** foram revogados.

**Casos que guardam esta correção:** `COLAB-025`, `COLAB-026`, `COLAB-027`, `COLAB-028`, `COLAB-029`. Eles rodam a cada bateria e falharão imediatamente se a proteção for removida ou alterada — inclusive verificando que a regra continua **precisa** (barra o segundo vínculo na mesma empresa, mas permite vínculos em empresas diferentes e papéis diferentes na mesma empresa).

---

## 3. A descoberta central: as boas práticas existem, mas não foram replicadas

Este é o achado mais útil para priorização, e só apareceu porque módulos equivalentes foram testados lado a lado.

Em **três casos comprovados**, a mesma regra de negócio está implementada corretamente em um módulo e ausente em outro:

| Regra | Onde **está** implementada | Onde **falta** | Evidência |
|---|---|---|---|
| Progresso limitado a 0–100 | `plano_acoes` — `CHECK (progresso BETWEEN 0 AND 100)` | `metas`, `meta_okrs` | `ACAO-013` passa · `META-012` falha |
| Status de documento com lista fechada + cálculo automático de validade | `terceiro_documentos` — enum `terceiro_doc_status` + trigger por data | `documentos` (módulo geral) | `DOC-041` e `DOC-042` falham |
| CNPJ único por cliente | `empresa_cadastro` — trigger `prevent_duplicate_active_cnpj` | `terceiros` | `EMP-020` passa · `TER-020` falha |

### Por que isso importa

**A equipe não precisa projetar soluções novas.** Para cada um desses pontos, existe uma implementação funcionando no próprio sistema, testada e aprovada. A correção é replicar o padrão, não inventá-lo.

O caso mais didático é o do progresso: `ACAO-013` e `META-012` testam exatamente a mesma coisa — gravar progresso 150. Em Plano de Ação o banco recusa; em Metas, aceita. É a mesma linha de SQL, presente num lugar e ausente no outro.

**Recomendação de processo:** ao criar uma nova tabela com campos de percentual, status, documento ou CNPJ, verificar como o campo equivalente é protegido nas tabelas que já existem, e replicar. Uma revisão rápida de checklist evitaria a maior parte destes achados.

---

## 4. O que foi verificado e está correto

Nem todo teste procura defeito. Estes comportamentos foram confirmados funcionando — e vale registrar, porque dão segurança sobre o que já está sólido.

### 4.1 Isolamento entre clientes (multi-tenant) — o mais crítico

**Verificado nos 14 módulos que possuem caso de isolamento dedicado, sem exceção.** Dados de um cliente são invisíveis para outro: colaboradores, empresas, departamentos, cargos, estabelecimentos, terceiros, organograma, identidade, SWOT, Oceano Azul, metas, ações, documentos e dados fiscais do Hub.

Nenhum vazamento foi encontrado. Esta é a proteção mais importante do sistema e ela está de pé.

### 4.2 Integridade de CNPJ de empresa

- Não permite dois CNPJs ativos iguais na criação (`EMP-020`)
- Também bloqueia na **edição** — não dá para burlar criando inativa e depois ativando (`EMP-021`)
- **Normaliza a pontuação** — `11.222.333/0001-44` e `11222333000144` são reconhecidos como o mesmo número (`EMP-013`)

### 4.3 Conformidade legal (NR-04 e NR-05)

- Grau de risco aceita apenas 1 a 4, conforme a NR-04 (`EMP-010`)
- Situação de SESMT restrita aos valores válidos (`EMP-011`)
- Situação de CIPA restrita aos valores válidos (`EMP-012`)
- Obras aceitam e preservam o CNO (`EST-002`)

### 4.4 Relações entre tabelas — bem modeladas e com lógica coerente

Este conjunto merece destaque, porque as regras são **diferentes entre si e cada uma pelo motivo certo**:

| Ação | Resultado | Por quê | Caso |
|---|---|---|---|
| Apagar departamento | Cargos **sobrevivem**, desassociados | Cargos podem ser realocados | `DEP-013` |
| Apagar empresa | Filiais **sobrevivem**, desassociadas | Locais podem ser realocados | `EST-013` |
| Apagar nó do organograma | Filhos são **promovidos**, não destruídos | Remover um nível de gerência não pode apagar a equipe | `ORG-013` |
| Apagar terceiro | Trabalhadores **são apagados** | Trabalhador de terceirizada não existe sem a empresa | `TER-013` |
| Apagar meta | Key results **são apagados** | KR sem meta é métrica sem objetivo | `META-013` |
| Apagar pasta **com documento** | **Bloqueado** | Protege contra perda de acervo | `DOC-014` |

A variedade não é inconsistência — é modelagem pensada. Cada relação segue a lógica do negócio.

### 4.5 Plano de Ação — o módulo mais bem protegido

Passou em todos os 9 casos. É a referência de como o restante do sistema poderia ser:

- Faixa GUT restrita a 1–5 nos três fatores (`ACAO-011`)
- Pontuação GUT **calculada pelo banco** (coluna `GENERATED`) — impossível digitar um valor errado (`ACAO-003`)
- Progresso limitado a 0–100 (`ACAO-013`)
- Tipo restrito a corretiva / preventiva / melhoria (`ACAO-012`)

### 4.6 Documentos — a premissa de arquivamento está sustentada

A premissa do sistema (todo arquivo enviado ou gerado vai para a pasta certa; o assinado é guardado) tem base sólida no banco:

- Documento fica vinculado à sua pasta (`DOC-002`)
- Documento revisado gera **nova versão**, preservando a original — a versão assinada não sobrescreve nada (`DOC-030`)
- Pastas são hierárquicas (`DOC-003`)
- O banco **impede** apagar pasta que ainda contém documento (`DOC-014`)

### 4.7 Hub Contábil — primeira validação da história do módulo

O Hub estava construído (18 tabelas, várias telas) mas **nunca havia sido exercitado**. Estes foram os primeiros testes reais. Resultado: **9 de 9 passaram**.

- Cadastro de contabilidade parceira
- Competências mensais com fluxo de status controlado (7 estados)
- Guias de imposto com tipos restritos (INSS, FGTS, IRRF, DARF e outros)
- Unicidade de competência por cliente — não dá para abrir o mesmo mês duas vezes

A fundação do módulo está sólida.

---

## 5. Cobertura

### Por bloco

| Bloco | Módulos | Casos | Achados |
|---|---|---|---|
| Estrutura Organizacional | 7 | 59 | 4 |
| Planejamento & Gestão | 5 | 39 | 1 |
| Documentos & Governança | 2 | 21 | 2 |
| Fluxos preservados (admissão, atestado, EPI) | 3 | 3 | — |
| **Total** | **17** | **122** | **7** |

> Os três **fluxos preservados** vêm do agente de QA anterior, que testava admissão, atestado e EPI escrevendo diretamente nas tabelas de clientes reais. Os testes foram reescritos para rodar dentro do ambiente cercado, mantendo o que era verificado e trocando a forma de verificar.

### Por módulo

| Módulo | Casos | Achados |
|---|---|---|
| Colaboradores | 16 | 2 — CPF inválido, e-mail duplicado |
| Empresa | 10 | — |
| Departamentos | 6 | — |
| Cargos | 5 | 1 — faixa salarial invertida |
| Estabelecimentos / Obras | 8 | — |
| Prestadores / Terceiros | 8 | 1 — CNPJ duplicado |
| Organograma | 6 | — |
| Identidade Estratégica | 7 | — |
| Planejamento Estratégico (SWOT) | 7 | — |
| Planejamento Estratégico (Oceano Azul) | 8 | — |
| Metas / OKRs | 8 | 1 — progresso fora de 0–100 |
| Plano de Ação | 9 | — |
| Documentos | 12 | 2 — validade não recalcula, status livre |
| Hub Contábil | 9 | — |
| Admissão | 1 | — |
| Atestados | 1 | — |
| EPI | 1 | — |

---

## 6. Limites desta cobertura

Registrado com franqueza, para que ninguém conclua mais do que os testes provam.

**O que este agente testa:** as regras que vivem no banco de dados — constraints, triggers, relações entre tabelas, isolamento entre clientes, enums e verificações de faixa.

**O que ele NÃO testa:**

| Área | Por quê | Onde seria coberto |
|---|---|---|
| Comportamento das telas | O agente opera no banco, não na interface | Testes de interface (Cypress) |
| Upload de arquivo ao storage | O envio ao Supabase Storage acontece fora do banco. O agente testa o **registro** do documento, não o arquivo subindo | Cypress + testes de integração |
| Se cada tela respeita a premissa de arquivamento | Provado que o banco sustenta a premissa; não que toda tela de upload a utiliza | Cypress |
| Notificações e alertas | Verificado que **não existe** rotina agendada no banco para validade de documentos; se há aviso, é calculado no front | Cypress |
| Permissões por perfil de usuário | Testes rodam com privilégio elevado no ambiente cercado | Testes de RLS por papel |
| Tabelas secundárias | Cobertas as tabelas centrais de cada módulo. Ficaram de fora: comentários, histórico, anexos, apontamento de horas, templates e check-ins de OKR | Ampliação futura, se o risco justificar |

**Blocos ainda não cobertos:** Pessoas & Cultura, Desenvolvimento & Performance, Jornada & Rotina, Saúde & Segurança.

---

## 7. Priorização sugerida

Uma ordem de trabalho possível, considerando risco e esforço:

**Primeira leva — risco legal e de conformidade**
1. CPF inválido (2.1) — impacto direto em eSocial
2. Documentos vencidos como válidos (2.3) — falsa conformidade em fiscalização
3. E-mail duplicado (2.2) — ambiguidade de acesso

**Segunda leva — integridade de dados**
4. Status de documento com lista fechada (2.4) — complementa o item 2.3, aplicar junto
5. CNPJ de terceiro duplicado (2.5) — controle de acesso de terceirizados
6. Progresso de meta fora de faixa (2.6) — correção de uma linha, padrão já existe

**Terceira leva — polimento**
7. Faixa salarial invertida (2.7) — correção trivial

> **Observação:** todas as correções sugeridas neste relatório trazem, junto, uma consulta para verificar dados existentes antes de aplicar. Constraints e índices únicos **falham na criação** se a base já contiver registros que os violem. A verificação prévia não é opcional.

---

## 8. Sobre o agente de testes

**Segurança**
- Executa em ambiente cercado — um cliente sintético marcado como ambiente de teste
- Há uma trava no próprio banco que **bloqueia qualquer escrita fora do cercado**
- Cada teste é desfeito automaticamente ao final; nada é persistido
- Nenhum dado de cliente real é criado, alterado ou lido

**Confiabilidade**
- Determinístico — mesmo resultado a cada execução; não usa IA para decidir
- Cada caso verifica uma regra específica e reporta o passo exato em que falhou

**Operação**
- Executado pela tela `/admin/qa/runner`, com acesso restrito a superadmin
- Pode rodar de forma agendada, com horário configurável por dia da semana
- Relatórios exportáveis em PDF, planilha (CSV) e versão para impressão

**Documentação dos casos**
Cada um dos casos traz: objetivo (a regra e por que ela importa), pré-condições, passo a passo com os dados exatos e o caminho na tela, critério de aprovação, e o impacto no negócio se falhar — com correção sugerida.

---

## 9. Como ler os resultados

Os pontos de atenção deste relatório aparecem como casos que **falham** na bateria. Isso é o comportamento desejado: o teste falha justamente para sinalizar que o banco aceita algo que não deveria.

Conforme as correções forem aplicadas, esses casos passarão a verde. E, mais importante: **eles permanecerão rodando**, avisando imediatamente se alguma proteção for removida no futuro — como já acontece com os cinco casos que guardam a correção de vínculos duplicados.

---

*Relatório gerado a partir dos resultados de execução do agente de QA. Todos os achados foram reproduzidos e verificados em banco antes de serem reportados.*

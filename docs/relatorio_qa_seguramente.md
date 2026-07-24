# Relatório de Testes Automatizados — Seguramente / YourEyes

**Agente de QA · Segunda edição**

| | |
|---|---|
| **Data** | 18 de julho de 2026 |
| **Responsável** | Alexandre (uStudy) |
| **Ambiente** | Cercado isolado — nenhum dado de cliente foi criado, alterado ou lido |
| **Cobertura** | 165 casos executáveis · 17 módulos · 30 tabelas |
| **Resultado** | 141 comportamentos confirmados · **24 pontos de atenção** · 1 correção já aplicada |

> **O que mudou desde a primeira edição:** a cobertura passou de 122 para 165 casos e os achados de 7 para 24. O aumento não veio de o sistema piorar — veio de olharmos onde não tínhamos olhado. Duas coisas provocaram isso: as especificações de teste trazidas pelo Alexandre (cotas PcD e cadastro de metas), que expuseram áreas inteiras sem cobertura, e uma auditoria que comparou as tabelas de cada módulo com as efetivamente testadas.
>
> **E a natureza dos achados mudou.** A primeira edição descrevia um padrão único: regras validadas no front, ausentes no banco. Isso continua sendo a maioria. Mas agora há também **um defeito que impede o uso do sistema** e **três pontos que afetam folha de pagamento**.

---

## 1. Como ler este relatório

São 24 pontos de atenção, mas **13 correções resolvem todos**. Vários achados compartilham a mesma causa e a mesma solução — um `CHECK` de lista fechada resolve cinco de uma vez, uma trigger de cálculo resolve três.

Por isso este relatório está organizado **por correção**, não por achado. A seção 4 é a pauta de trabalho.

**Distribuição por gravidade:** 2 críticos · 9 altos · 9 médios · 4 baixos.

---

## 2. Os dois pontos críticos

### 2.1 Não é possível registrar treinamento de terceiro sem data de validade

**Este não é "falta uma validação". É funcionalidade quebrada.**

| | |
|---|---|
| **Caso** | `TTRE-011` |
| **Onde** | Função `atualizar_status_terceiro_doc()`, aplicada em `terceiro_treinamentos` |
| **Efeito** | Erro de banco ao salvar. O usuário não consegue concluir o cadastro. |

**A causa.** Uma função só serve duas tabelas:

- `terceiro_documentos` — tem a coluna `arquivo_url`
- `terceiro_treinamentos` — tem `certificado_url`, **não tem** `arquivo_url`

A versão original da função não acessava `arquivo_url`. Uma alteração posterior (migration de 14/02, 05:24) passou a acessar — mas apenas dentro do ramo `data_validade IS NULL`:

```sql
IF NEW.data_validade IS NULL THEN
    IF NEW.arquivo_url IS NOT NULL THEN   -- quebra em treinamentos
      NEW.status := 'valido';
    ELSE
      NEW.status := 'pendente';
    END IF;
ELSIF ...
```

Como o acesso é condicional, o defeito ficou **latente por cinco meses**: treinamento **com** validade funciona; **sem** validade quebra. E treinamentos sem prazo são legítimos — integração, ordem de serviço, orientação interna.

**Correção sugerida:** função própria para treinamentos, usando o campo que existe lá.

```sql
CREATE OR REPLACE FUNCTION public.atualizar_status_terceiro_treinamento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.data_validade IS NULL THEN
    NEW.status := CASE WHEN NEW.certificado_url IS NOT NULL
                       THEN 'valido' ELSE 'pendente' END;
  ELSIF NEW.data_validade < CURRENT_DATE THEN
    NEW.status := 'vencido';
  ELSIF NEW.data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN
    NEW.status := 'a_vencer';
  ELSE
    NEW.status := 'valido';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS auto_status_terceiro_treinamentos ON public.terceiro_treinamentos;
CREATE TRIGGER auto_status_terceiro_treinamentos
  BEFORE INSERT OR UPDATE ON public.terceiro_treinamentos
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_status_terceiro_treinamento();
```

---

### 2.2 O campo que documenta a proibição de cumular adicionais aceita "ambos"

| | |
|---|---|
| **Caso** | `COND-011` |
| **Onde** | `colaborador_condicoes_especiais.adicional_aplicado` |
| **Regra** | Art. 193 §2º da CLT: insalubridade e periculosidade não se acumulam; aplica-se o mais vantajoso |

O campo existe justamente para registrar **qual** adicional prevaleceu. Os únicos valores possíveis seriam `insalubridade`, `periculosidade` ou `nenhum`. Sendo `TEXT` sem restrição, aceita `ambos` — o valor que a lei veda.

**Contexto importante:** a lógica de cálculo no front (`src/lib/folha/adicionais.ts`) **está correta**. Ela calcula os dois valores, aplica o maior e grava uma fundamentação legal citando ambos e a base normativa. O caso `COND-003` confirma que funciona.

O problema é o caminho alternativo: a própria tabela prevê `origem = 'importacao_sst'`, ou seja, há entrada de dados que não passa pela tela.

**Correção:** ver grupo 2 da seção 4.

---

## 3. O que os testes confirmaram funcionando

Vale registrar, porque dá base para confiar no que está construído.

### 3.1 Isolamento entre clientes

**Verificado em todos os módulos com caso dedicado, sem uma única falha.** Colaboradores, empresas, departamentos, cargos, estabelecimentos, terceiros, documentos de terceiros, organograma, identidade, SWOT, Oceano Azul, metas, ações, documentos, obrigações, condições especiais e dados fiscais do Hub.

É a proteção mais crítica do sistema e ela está sólida.

### 3.2 Validade automática de documentos de terceiros

Confirmado por execução nas quatro faixas: validade distante → `valido`; dentro de 60 dias → `a_vencer`; vencida → `vencido`; sem data → `pendente`. E o mais importante: **funciona também na edição** — renovar um documento vencido faz o status voltar a `valido` sozinho (`TDOC-005`).

**Esta é a referência para corrigir o achado do módulo geral de documentos.** A solução não precisa ser projetada; ela existe, funciona e está testada.

### 3.3 A regra de prevalência dos adicionais

`COND-003`: colaborador enquadrado nas duas condições (insalubridade R$ 607,20, periculosidade R$ 900,00) recebe **apenas R$ 900,00**. Sem cumulatividade, conforme o art. 193 §2º.

### 3.4 Proteções contra perda de dados

O banco impede exclusões que destruiriam informação:

| Ação | Resultado | Caso |
|---|---|---|
| Apagar pasta com documento dentro | **Bloqueado** | `DOC-014` |
| Apagar cargo com enquadramento de insalubridade | **Bloqueado** | `COND-013` |
| Apagar departamento | Cargos sobrevivem desassociados | `DEP-013` |
| Apagar empresa | Filiais sobrevivem | `EST-013` |
| Apagar nó do organograma | Filhos promovidos | `ORG-013` |
| Apagar meta estratégica | Metas desdobradas sobrevivem | `META-032` |
| Apagar ação vinculada a obrigação | Obrigação sobrevive sem vínculo | `OBRG-013` |

As regras variam, e cada uma pelo motivo certo. Onde o filho não existe sem o pai (item de SWOT, tarefa de ação, trabalhador de terceirizada), há cascata. Onde tem valor próprio, há preservação.

### 3.5 Conformidade legal e integração

- Grau de risco restrito a 1–4 conforme a NR-04 (`EMP-010`)
- SESMT e CIPA com valores fechados conforme a NR-05 (`EMP-011`, `EMP-012`)
- CNPJ único por empresa ativa, com normalização de pontuação, valendo também na edição (`EMP-013`, `EMP-020`, `EMP-021`)
- Obrigação não conforme se liga à ação criada para resolvê-la (`OBRG-002`)
- Treinamento de NR vencido é reconhecido automaticamente (`TTRE-001`)

### 3.6 Módulos que passaram integralmente

**Plano de Ação** (9 casos) — o mais protegido: GUT restrito a 1–5, pontuação calculada pelo próprio banco, progresso limitado a 0–100, tipo com lista fechada.

**Hub Contábil** (9 casos) — módulo construído mas nunca exercitado antes destes testes. A fundação está sólida.

**Departamentos, Estabelecimentos, Organograma, Identidade Estratégica, SWOT, Oceano Azul** — cobertura completa das tabelas, sem achados.

---

## 4. Pauta de correções

13 correções resolvem os 24 achados. Ordenadas por prioridade.

> **Aviso que vale para todas:** constraints e índices únicos **falham na criação** se a base já contiver registros que os violem. Cada correção abaixo traz a consulta de verificação prévia. Ela não é opcional.

---

### Correção 1 — Trigger de treinamentos [CRÍTICA]
**Resolve:** `TTRE-011` · **SQL na seção 2.1**

Sem ela, ninguém registra treinamento sem data de validade. É a única correção que destrava uma funcionalidade impedida.

---

### Correção 2 — Domínios com lista fechada [CRÍTICA/ALTA]
**Resolve:** `COND-011`, `COND-010`, `DOC-042`, `OBRG-020`, `EMP-033` (5 achados)

Cinco campos guardam valores de uma lista conhecida, mas aceitam qualquer texto. Em todos, os valores válidos estão documentados apenas em comentário no código.

```sql
-- 2a) o campo que documenta o art. 193 §2º (crítico)
ALTER TABLE public.colaborador_condicoes_especiais
  ADD CONSTRAINT adicional_aplicado_valido
  CHECK (adicional_aplicado IS NULL
      OR adicional_aplicado IN ('insalubridade','periculosidade','nenhum'));

-- 2b) grau de insalubridade conforme a NR-15
ALTER TABLE public.colaborador_condicoes_especiais
  ADD CONSTRAINT insalubridade_grau_nr15
  CHECK (insalubridade_grau IS NULL
      OR insalubridade_grau IN ('minimo','medio','maximo'));

-- 2c) status de documento (ver também a correção 6)
ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_status_valido
  CHECK (status IN ('valido','a_vencer','vencido','pendente'));

-- 2d) categoria de obrigação
ALTER TABLE public.empresa_obrigacoes
  ADD CONSTRAINT obrigacoes_categoria_valida
  CHECK (categoria IN ('legal','sst','estrategica','financeira'));

-- 2e) percentual de cota conforme a Lei 8.213/91
ALTER TABLE public.empresa_cadastro
  ADD CONSTRAINT pcd_percentual_legal
  CHECK (pcd_percentual_exigido IN (0, 2, 3, 4, 5));
```

**Verificação prévia:**
```sql
SELECT 'adicional' AS campo, adicional_aplicado AS valor, count(*)
  FROM public.colaborador_condicoes_especiais GROUP BY 2
UNION ALL SELECT 'grau', insalubridade_grau, count(*)
  FROM public.colaborador_condicoes_especiais GROUP BY 2
UNION ALL SELECT 'doc_status', status, count(*) FROM public.documentos GROUP BY 2
UNION ALL SELECT 'categoria', categoria, count(*) FROM public.empresa_obrigacoes GROUP BY 2
UNION ALL SELECT 'pcd_pct', pcd_percentual_exigido::text, count(*)
  FROM public.empresa_cadastro GROUP BY 2;
```

> **Sobre o `COND-010`:** o efeito é silencioso. Um grau fora da NR-15 resulta em percentual **zero** no cálculo — o colaborador aparece enquadrado em insalubridade e recebe adicional de R$ 0,00, sem que nada acuse.
>
> **Sobre o `OBRG-020`:** o painel de conformidade agrupa por categoria. Uma obrigação gravada como `juridico` em vez de `legal` cria um grupo à parte — quem abrir "legal" não a vê. A pendência não some do banco, some da visão. Avaliar também a `subcategoria`, que tende a crescer com o tempo.

---

### Correção 3 — Cálculo de cota PcD no banco [ALTA]
**Resolve:** `EMP-031`, `EMP-032`, `EMP-035` (3 achados)

O cálculo da cota está implementado **e correto** no front (`EmpresaObrigacoesInclusao.tsx`), com as faixas da Lei 8.213/91 e arredondamento para cima. Mas nada garante coerência no banco: é possível gravar 1.200 empregados com 2%, ou cota exigida 10 quando o cálculo dá 15.

E o mais grave (`EMP-035`): **mudar o total de empregados não recalcula a cota**. Uma empresa que cresce de 199 para 201 muda de faixa (2% → 3%) e passa a dever 7 PcDs em vez de 4 — mas o cadastro continua mostrando 4. Fica irregular sem saber.

```sql
CREATE OR REPLACE FUNCTION public.calcular_cota_pcd()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_pct numeric;
BEGIN
  v_pct := CASE
    WHEN COALESCE(NEW.total_colaboradores,0) < 100  THEN 0
    WHEN NEW.total_colaboradores <= 200             THEN 2
    WHEN NEW.total_colaboradores <= 500             THEN 3
    WHEN NEW.total_colaboradores <= 1000            THEN 4
    ELSE 5
  END;
  NEW.pcd_obrigatoria        := v_pct > 0;
  NEW.pcd_percentual_exigido := v_pct;
  NEW.pcd_quantidade_exigida := CEIL(COALESCE(NEW.total_colaboradores,0) * v_pct / 100.0);
  RETURN NEW;
END $$;

CREATE TRIGGER cota_pcd_recalcula
  BEFORE INSERT OR UPDATE OF total_colaboradores ON public.empresa_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.calcular_cota_pcd();
```

> **Decisão necessária antes de aplicar:** esta trigger torna `pcd_percentual_exigido` e `pcd_quantidade_exigida` campos **derivados** — o valor informado manualmente passa a ser sobrescrito. É o comportamento correto para uma cota definida em lei, mas muda a natureza dos campos. Confirmar com o time.
>
> **Limite conhecido:** a trigger corrige a coerência interna, mas `total_colaboradores` continua sendo um número digitado, não a contagem real de vínculos. Ver seção 5.

---

### Correção 4 — Faixas invertidas [MÉDIA]
**Resolve:** `CARGO-012`, `EMP-041`, `MCFG-021` (3 achados)

Três lugares onde um mínimo pode ser maior que um máximo. Mesmo padrão, mesma solução.

```sql
ALTER TABLE public.cargos
  ADD CONSTRAINT cargos_faixa_salarial_coerente
  CHECK (faixa_salarial_min IS NULL OR faixa_salarial_max IS NULL
      OR faixa_salarial_min <= faixa_salarial_max);

ALTER TABLE public.empresa_cadastro
  ADD CONSTRAINT aprendiz_faixa_coerente
  CHECK (aprendiz_quantidade_minima <= aprendiz_quantidade_maxima);

ALTER TABLE public.metas_configuracao
  ADD CONSTRAINT escala_coerente
  CHECK (escala_min < escala_max);
```

---

### Correção 5 — Valores negativos [ALTA]
**Resolve:** `EMP-034`, `COND-012` (2 achados)

```sql
ALTER TABLE public.empresa_cadastro
  ADD CONSTRAINT cotas_nao_negativas
  CHECK (total_colaboradores >= 0
     AND pcd_quantidade_atual >= 0 AND pcd_quantidade_exigida >= 0
     AND aprendiz_quantidade_atual >= 0);

ALTER TABLE public.colaborador_condicoes_especiais
  ADD CONSTRAINT adicionais_nao_negativos
  CHECK (insalubridade_valor_calculado >= 0
     AND periculosidade_valor_calculado >= 0
     AND adicional_valor_aplicado >= 0);
```

> O `COND-012` tem gravidade diferente dos demais casos de não-negatividade: esse campo alimenta folha. Um valor negativo vira desconto no salário do colaborador, não apenas um relatório errado.

---

### Correção 6 — Validade automática de documentos [ALTA]
**Resolve:** `DOC-041` (1 achado)

Um documento vencido há um ano continua com status `valido` no módulo geral. Em fiscalização, o sistema exibe conformidade que não existe.

**A solução já existe e está testada** — é o comportamento de `terceiro_documentos`, confirmado pelos casos `TDOC-001` a `TDOC-005`.

```sql
-- aplicar junto com a correção 2c (lista fechada de status)
CREATE OR REPLACE FUNCTION public.trg_documento_status_por_validade()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.data_validade IS NOT NULL THEN
    NEW.status := CASE
      WHEN NEW.data_validade < CURRENT_DATE                      THEN 'vencido'
      WHEN NEW.data_validade <= CURRENT_DATE + INTERVAL '60 days' THEN 'a_vencer'
      ELSE 'valido'
    END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER documento_status_por_validade
  BEFORE INSERT OR UPDATE OF data_validade ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_documento_status_por_validade();
```

> **A trigger sozinha não basta.** Ela recalcula na gravação; um documento parado no acervo vence sem ninguém tocá-lo. É preciso também uma rotina diária, no padrão dos jobs que o sistema já usa:
> ```sql
> UPDATE public.documentos SET status = 'vencido'
> WHERE data_validade < CURRENT_DATE AND status <> 'vencido';
> ```
> Foi verificado que **não existe hoje** nenhuma rotina agendada varrendo documentos por vencimento. Se há algum alerta, ele é calculado no front quando alguém abre a tela.

---

### Correção 7 — Unicidades faltando [ALTA/MÉDIA]
**Resolve:** `COLAB-023`, `TER-020`, `MIND-020` (3 achados)

```sql
-- e-mail de colaborador (ALTA: é identificador de acesso)
CREATE UNIQUE INDEX CONCURRENTLY usuarios_base_email_tenant_uidx
  ON public.usuarios_base (tenant_id, lower(email_principal))
  WHERE email_principal IS NOT NULL AND email_principal <> '';

-- CNPJ de empresa terceira (MÉDIA)
CREATE UNIQUE INDEX CONCURRENTLY terceiros_cnpj_tenant_uidx
  ON public.terceiros (tenant_id, regexp_replace(cnpj, '[^0-9]', '', 'g'));

-- nome de indicador no catálogo (BAIXA — avaliar se é desejável)
CREATE UNIQUE INDEX CONCURRENTLY metas_indicadores_nome_uidx
  ON public.metas_indicadores (tenant_id, lower(nome)) WHERE ativo;
```

**Verificação prévia:**
```sql
SELECT tenant_id, lower(email_principal), count(*) FROM public.usuarios_base
 WHERE email_principal IS NOT NULL AND email_principal <> ''
 GROUP BY 1,2 HAVING count(*) > 1;

SELECT tenant_id, regexp_replace(cnpj,'[^0-9]','','g'), count(*)
 FROM public.terceiros GROUP BY 1,2 HAVING count(*) > 1;
```

> **`TER-020` tem um efeito específico:** com o mesmo terceiro cadastrado duas vezes, um cadastro pode estar bloqueado e o outro liberado. Os trabalhadores entram pelo cadastro liberado.

---

### Correção 8 — Validação de CPF [ALTA]
**Resolve:** `COLAB-021` (1 achado)

A validação de dígitos verificadores existe **apenas no front**, em TypeScript. Não há função equivalente no banco — é preciso criá-la.

```sql
CREATE OR REPLACE FUNCTION public.cpf_e_valido(p_cpf text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n text; s int := 0; d1 int; d2 int; i int;
BEGIN
  IF p_cpf IS NULL THEN RETURN true; END IF;        -- nulo é ausente, não inválido
  n := regexp_replace(p_cpf, '[^0-9]', '', 'g');
  IF length(n) <> 11 THEN RETURN false; END IF;
  IF n ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..9 LOOP s := s + substr(n,i,1)::int * (11 - i); END LOOP;
  d1 := 11 - (s % 11); IF d1 >= 10 THEN d1 := 0; END IF;
  s := 0;
  FOR i IN 1..10 LOOP s := s + substr(n,i,1)::int * (12 - i); END LOOP;
  d2 := 11 - (s % 11); IF d2 >= 10 THEN d2 := 0; END IF;
  RETURN d1 = substr(n,10,1)::int AND d2 = substr(n,11,1)::int;
END $$;

CREATE OR REPLACE FUNCTION public.trg_validar_cpf_usuarios_base()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT public.cpf_e_valido(NEW.cpf) THEN
    RAISE EXCEPTION 'CPF inválido: %', NEW.cpf USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER validar_cpf_antes_de_gravar
  BEFORE INSERT OR UPDATE OF cpf ON public.usuarios_base
  FOR EACH ROW EXECUTE FUNCTION public.trg_validar_cpf_usuarios_base();
```

> A função foi testada contra: CPF válido com e sem pontuação (aceita); sequências repetidas, dígito verificador incorreto, string curta e zeros (rejeita); nulo (aceita).
>
> **Verificação prévia obrigatória** — registros existentes com CPF inválido passarão a falhar em qualquer edição futura:
> ```sql
> SELECT id, nome_completo, cpf FROM public.usuarios_base
>  WHERE cpf IS NOT NULL AND NOT public.cpf_e_valido(cpf);
> ```

---

### Correção 9 — Faixa de progresso [MÉDIA]
**Resolve:** `META-012` (1 achado)

```sql
ALTER TABLE public.metas
  ADD CONSTRAINT metas_progresso_faixa CHECK (progresso BETWEEN 0 AND 100);
ALTER TABLE public.meta_okrs
  ADD CONSTRAINT meta_okrs_progresso_faixa CHECK (progresso BETWEEN 0 AND 100);
```

> Este `CHECK` **já existe** em `plano_acoes` — é exatamente a mesma linha. Ver seção 6.

---

### Correção 10 — Coerência de datas [MÉDIA]
**Resolve:** `META-034` (1 achado)

```sql
ALTER TABLE public.metas
  ADD CONSTRAINT metas_periodo_coerente
  CHECK (data_inicio IS NULL OR data_fim IS NULL OR data_inicio <= data_fim);
```

---

### Correção 11 — Texto composto só de espaços [MÉDIA]
**Resolve:** `META-035` (1 achado)

`NOT NULL` impede o nulo, mas não impede `"   "` — que é vazio na prática e dribla a obrigatoriedade.

```sql
ALTER TABLE public.metas
  ADD CONSTRAINT metas_titulo_nao_vazio CHECK (length(trim(titulo)) > 0);
```

> Vale avaliar o mesmo padrão nos demais campos de nome obrigatórios do sistema.

---

### Correção 12 — Coerência entre baseline, alvo e direção [MÉDIA]
**Resolve:** `META-033` (1 achado)

Com direção `maior_melhor`, um alvo menor que o baseline faz a meta nascer atingida. Mas a regra **depende da direção** — com `menor_melhor`, baseline maior que o alvo é o esperado.

Por isso não cabe um `CHECK` simples. As opções são validar no front (mais simples) ou por trigger que considere a direção. Recomenda-se avaliar se o ganho justifica o acoplamento.

---

### Correção 13 — Parametrização aplicada no banco [DECISÃO DE PRODUTO]
**Resolve:** `MCFG-030` (1 achado)

A tabela `metas_configuracao` permite que **cada cliente defina suas próprias regras**: quais níveis de meta existem, se o vínculo com objetivo estratégico é obrigatório, se o indicador é obrigatório, como funciona a aprovação. É uma funcionalidade sofisticada.

Mas ela é **lida apenas pelo front**. Um cliente que configurou "exigir objetivo estratégico" pode receber metas sem objetivo por importação ou API.

**Não há uma correção óbvia.** Validar parametrização no banco cria acoplamento entre tabelas. A alternativa é garantir que todo caminho de entrada passe pela mesma camada de validação da aplicação. É decisão de arquitetura, e por isso está listada por último — precisa de discussão, não de um `ALTER TABLE`.

---

## 5. O que os testes não alcançam

Registrado para que ninguém conclua mais do que os testes provam.

**O que este agente testa:** regras que vivem no banco — constraints, triggers, relações entre tabelas, isolamento entre clientes, enums e faixas.

**O que não testa:**

| Área | Por quê | Onde seria coberto |
|---|---|---|
| Comportamento das telas | O agente opera no banco | Cypress |
| Upload ao storage | Acontece fora do banco; o agente testa o registro, não o arquivo subindo | Cypress |
| Cálculos que vivem no front | Cota PcD, adicionais de insalubridade — a lógica está em TypeScript | Testes unitários |
| Notificações e alertas | Não há rotina agendada no banco para validade de documentos | Cypress |
| Permissões por perfil | Os testes rodam com privilégio elevado no cercado | Testes de RLS por papel |

### Duas lacunas estruturais que os testes revelaram

**1. `total_colaboradores` e `pcd_quantidade_atual` são digitados, não contados.** O sistema não sabe quantos colaboradores a empresa tem nem quem são os PcDs — sabe apenas o que alguém informou. Por isso os cenários de recálculo automático por admissão/demissão, contagem de PcDs com laudo válido e distinção de reabilitados do INSS não se aplicam hoje. Estão registrados como especificação nos casos `EMP-050` a `EMP-054`.

**2. O módulo Metas tem 12 tabelas; os testes cobrem 4.** Ficaram de fora `metas_checkins`, `metas_evidencias`, `meta_acoes`, `meta_acao_tempo`, `meta_aem`, `meta_historico`, `metas_workflow_log` e `pdi_metas`. O Hub Contábil tem 18 tabelas e os testes cobrem 3. Detalhamento na auditoria de cobertura.

---

## 6. Um padrão que atravessa quase tudo

Em quatro casos comprovados, a mesma regra está implementada corretamente em um módulo e ausente em outro:

| Regra | Onde **está** | Onde **falta** | Evidência |
|---|---|---|---|
| Progresso limitado a 0–100 | `plano_acoes` | `metas`, `meta_okrs` | `ACAO-013` passa · `META-012` falha |
| Validade de documento automática | `terceiro_documentos` | `documentos` | `TDOC-003` passa · `DOC-041` falha |
| CNPJ único por cliente | `empresa_cadastro` | `terceiros` | `EMP-020` passa · `TER-020` falha |
| Domínio de status fechado | `terceiro_documentos` (enum) | `documentos`, `empresa_obrigacoes` | `TDOC-004` passa · `DOC-042`, `OBRG-020` falham |

**A equipe não precisa projetar soluções novas.** Para cada um desses pontos existe uma implementação funcionando no próprio sistema, testada e aprovada. A correção é replicar o padrão.

O caso mais direto: `ACAO-013` e `META-012` testam exatamente a mesma coisa — gravar progresso 150. Em Plano de Ação o banco recusa; em Metas, aceita. É a mesma linha de SQL, presente num lugar e ausente no outro.

**Sugestão de processo:** ao criar tabela com campo de percentual, status, documento com validade ou CNPJ, verificar como o equivalente é protegido nas tabelas existentes e replicar. Uma revisão de checklist evitaria a maior parte destes achados.

---

## 7. Cobertura

| Bloco | Módulos | Casos | Achados |
|---|---|---|---|
| Estrutura Organizacional | 7 | 91 | 13 |
| Planejamento & Gestão | 5 | 55 | 7 |
| Documentos & Governança | 2 | 21 | 2 |
| Fluxos preservados (admissão, atestado, EPI) | 3 | 3 | — |
| **Total** | **17** | **165** | **24** |

### Por módulo

| Módulo | Casos | Achados |
|---|---|---|
| Colaboradores | 24 | 4 — CPF, e-mail, grau NR-15, adicional negativo |
| Empresa | 26 | 7 — cotas (5), obrigações (1), aprendiz (1) |
| Departamentos | 6 | — |
| Cargos | 5 | 1 — faixa salarial |
| Estabelecimentos / Obras | 8 | — |
| Prestadores / Terceiros | 19 | 2 — CNPJ duplicado, **bug da trigger** |
| Organograma | 6 | — |
| Identidade Estratégica | 7 | — |
| Planejamento Estratégico | 15 | — |
| Metas / OKRs | 24 | 7 |
| Plano de Ação | 9 | — |
| Documentos | 12 | 2 |
| Hub Contábil | 9 | — |
| Admissão · Atestados · EPI | 3 | — |

---

## 8. Sobre o agente

**Segurança.** Executa em ambiente cercado — um cliente sintético marcado como teste. Há trava no próprio banco que bloqueia qualquer escrita fora do cercado. Cada teste é desfeito ao final; nada é persistido. Nenhum dado de cliente real é criado, alterado ou lido.

**Confiabilidade.** Determinístico — mesmo resultado a cada execução, sem IA decidindo. Cada caso reporta o passo exato em que falhou e grava a mensagem técnica do erro.

**Operação.** Tela `/admin/qa/runner`, acesso restrito a superadmin. Pode rodar agendado, com horário configurável por dia da semana. Relatórios exportáveis em PDF, planilha e versão para impressão.

**Documentação dos casos.** Cada caso traz objetivo (a regra e por que importa), pré-condições, passo a passo com dados exatos e caminho na tela, critério de aprovação, e impacto no negócio se falhar com correção sugerida.

---

## 9. Como ler os resultados

Os achados aparecem como casos que **falham** na bateria. É o comportamento desejado: o teste falha para sinalizar que o banco aceita algo que não deveria.

Conforme as correções forem aplicadas, esses casos passam a verde. E permanecem rodando — avisando imediatamente se alguma proteção for removida no futuro, como já acontece com os cinco casos que guardam a correção de vínculos duplicados.

Há ainda cinco casos com status **rascunho** (`EMP-050` a `EMP-054`) que descrevem comportamento que o sistema não tem. Aparecem como "sem rotina", de propósito: são especificação do que falta construir, e viram testes quando a funcionalidade existir.

---

*Todos os achados foram reproduzidos e verificados em banco antes de reportados. Os SQLs de correção foram testados.*

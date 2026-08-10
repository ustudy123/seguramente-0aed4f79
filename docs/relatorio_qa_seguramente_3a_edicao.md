# Relatório de Testes Automatizados — Seguramente / YourEyes

**Agente de QA · Terceira edição**

| | |
|---|---|
| **Data** | 8 de agosto de 2026 |
| **Responsável** | Alexandre (uStudy) |
| **Ambiente** | Cercado isolado — nenhum dado de cliente foi criado, alterado ou lido pelos testes |
| **Cobertura desta leva** | +71 casos documentados · +56 rotinas executáveis · 5 módulos revisados (Empresas, Metas, Hub Contábil, Plano de Ação, Ponto) |
| **Resultado** | **22 achados novos confirmados em execução** · 12 reincidentes · 3 boas notícias estruturais · 4 frentes de higiene interna do QA |

> **O que mudou desde a segunda edição:** a fila da auditoria de cobertura foi
> fechada. Os três módulos apontados como maiores lacunas (Metas, Hub Contábil,
> Plano de Ação) ganharam casos e rotinas para as tabelas que nunca tinham sido
> testadas, o módulo Empresas foi revisado tela a tela, e as seis frentes de
> correção de agosto do Ponto (materialização de faltas, um dia por data,
> fechamento por empresa, RN23, espelho-resumo, origem da marcação) ganharam
> os casos que faltavam para não regredirem em silêncio.
>
> **E o padrão da segunda edição se confirmou em escala:** a maioria dos
> achados novos é a mesma doença — regra que vive no front (ou em lugar
> nenhum) e não no banco. A novidade é que agora há também **incoerências
> estruturais entre tenants** (vínculos que cruzam clientes) e **um defeito
> de desenho** em que um estado previsto no contrato da tabela é inalcançável
> na prática.

---

## 1. Como ler este relatório

São 22 achados novos, mas — como na edição anterior — **poucas correções
resolvem todos**: a pauta da seção 4 tem 9 remédios, e vários fecham três ou
quatro achados de uma vez (um gatilho de coerência de tenant fecha três; um
par de CHECKs de data fecha quatro).

Cada achado foi **confirmado por execução real da bateria** no cercado — não é
leitura de código. A mensagem completa de cada falha (com o remédio sugerido)
está gravada no campo `obtido` de `qa_resultados` e visível no runner de QA.

**Nada foi corrigido nesta leva.** A decisão da casa foi: os testes apontam,
o desenvolvimento decide e corrige. Este relatório é a pauta.

---

## 2. Os três achados mais sérios

### 2.1 Certidão irregular vira "válida" sozinha (Hub Contábil · CERT-011)

O CHECK de `hub_certidoes.status` admite `irregular` — certidão com pendência
apontada pelo órgão, mesmo dentro da validade. Mas o trigger
`atualizar_status_certidao` **sobrescreve o status em todo insert e update**,
sem exceção: gravar `irregular` com validade futura volta como `valida`.
O estado existe no contrato e é **inalcançável na prática** — e uma certidão
irregular exibida como válida é exatamente o que o fiscal aponta.

**Correção sugerida:** o trigger preservar o `irregular` informado (derivar
apenas entre `valida`/`a_vencer`/`vencida` quando ninguém marcou
irregularidade).

### 2.2 Aprovação de meta sem rastro (Metas · MWKF-011)

O registro da trilha de aprovação (`metas_workflow_log`) é feito pelo front,
num insert separado e **sem checagem de erro**. Um update direto em
`workflow_status` (API, integração, SQL) ativa a meta **sem nenhuma linha de
trilha** — a meta aparece aprovada sem que exista registro de quem aprovou.

**Correção sugerida:** trigger `AFTER UPDATE OF workflow_status` gravando o
log — o modelo já existe na casa: o Hub Contábil faz exatamente isso para
processos (confirmado por PROC-002, que passou).

### 2.3 Vínculos que cruzam clientes (três módulos)

Três rotinas confirmaram que FKs sem coerência de tenant permitem amarrar
dados de clientes diferentes:

| Caso | O que entrou |
|---|---|
| MCHK-011 | Check-in do cliente B no histórico de meta do cliente A |
| PROC-011 | Processo do cliente A vinculado à contabilidade parceira do cliente B |
| FER-004 *(aguarda reexecução)* | Unidade do cliente A presa à tabela de feriados do cliente B |

A RLS esconde a linha de quem não deve ver, mas o dado fantasma fica lá — e
no caso dos feriados, alimentaria a apuração de ponto com o calendário errado.

**Correção sugerida:** gatilho de coerência comparando o tenant das duas
pontas do vínculo (mesmo remédio nos três lugares).

---

## 3. Todos os achados novos, por módulo

### Metas (6)

| Caso | Achado |
|---|---|
| MWKF-011 | Mudança de workflow por fora da tela não deixa trilha (§2.2) |
| MCHK-002 | Check-in por API não atualiza a meta — histórico marca 100%, meta segue em 40% |
| MCHK-010 | Check-in de 250% (e de −30%) aceito — `progresso_novo` sem CHECK |
| MCHK-011 | Check-in cruzando tenants (§2.3) |
| MPAR-011 | Peso de participante −1 e 0 aceitos — inverte/anula a média ponderada |
| MEVD-010 | Evidência sem nenhum conteúdo aceita — infla a contagem de comprovação |

### Hub Contábil (6)

| Caso | Achado |
|---|---|
| CERT-011 | Estado `irregular` inalcançável (§2.1) |
| CERT-010 | Certidão emitida DEPOIS de vencer aceita — sem CHECK entre as datas |
| PCHK-010 | Processo conclui com item obrigatório do checklist aberto |
| PDOC-010 | Cadeia de versões de documento cruza processos (`versao_anterior_id` sem checagem) |
| PROC-010 | Prazo do processo anterior à data de referência — SLA nasce estourado |
| PROC-011 | Contabilidade de outro cliente (§2.3) |

### Plano de Ação (5)

| Caso | Achado |
|---|---|
| PLTF-010 | Dependência circular A↔B aceita — as duas tarefas travam para sempre |
| PLTF-011 | Tarefa dependendo de tarefa de OUTRA ação — acoplamento invisível |
| PLEV-010 | Evidência da ação A "comprovando" tarefa da ação B |
| PLTM-010 | Apontamento com fim antes do início e duração −60 — tempo negativo reduz o esforço somado |
| PLTP-010 | Template `{}` aceito — não há o que instanciar |

### Ponto (1 novo + resultado das frentes de agosto)

| Caso | Resultado |
|---|---|
| PONTO-341 | **Achado novo não previsto:** origem `X` é recusada, mas origem NULA entrou *(a rotina foi refinada para distinguir recusa de normalização; aguarda reexecução)* |
| PONTO-290/292/293 | ✅ Materialização de faltas: cria o dia, é idempotente, diagnóstico funciona |
| PONTO-340 | ✅ Batida nasce `O`; ajuste é rotulado `A` |
| PONTO-300/301/310/311 | *Aguardam reexecução* (rotina corrigida — o defeito era da rotina, não do sistema) |

### Empresas (4 aguardam primeira execução)

EMP-070/071 (CPF duplicado em empresa PF — o trigger de duplicidade só olha
CNPJ), FER-001..005 (tabela de feriados da unidade) e TAC-001/003 (vigência do
TAC): rotinas instaladas em 08/08, aguardando a primeira bateria.

### Reincidentes (12) — já conhecidos, seguem abertos

ADM-002 (CPF duplicado em admissões, sem índice único) · ADM-101/102/103
(**24 documentos de admissão sem pasta/dono em produção**; 3 admissões
concluídas com documentos avulsos) · COLAB-021 (CPF inválido aceito pelo
banco — parcialmente mitigado: já existe validação de dígito em parte do
fluxo, ver §5) · DESL-002 (desligamento sobrescrito sem trilha) · DESL-065
(**1 desligamento sem exame demissional** — NR-07 7.5.11) · DOC-030 (versões
duplicadas) · PERFIL-003 (tabelas sensíveis sem a camada de perfil) ·
PONTO-251 (**7 links de marcação ativos sem expiração**) · PONTO-252 (nenhuma
trava contra auto-aprovação de ajuste) · PONTO-253 (nenhum parâmetro de
retenção — LGPD art. 16) · PONTO-270 (3–5 tabelas de ponto sem a trava do
cercado — a lista vem diminuindo entre execuções).

---

## 4. A pauta de trabalho — 9 correções fecham os 22 achados novos

| # | Correção | Fecha |
|---|---|---|
| 1 | Gatilho de coerência de tenant (padrão único, aplicado em 3 vínculos) | MCHK-011, PROC-011, FER-004 |
| 2 | CHECKs de coerência de datas: `data_emissao <= data_validade`, `data_limite >= data_referencia`, `fim >= inicio` + `duracao >= 0` | CERT-010, PROC-010, PLTM-010, TAC-003 |
| 3 | CHECKs de faixa: `progresso BETWEEN 0 AND 100` (metas **e** checkins), `peso > 0` | MCHK-010, MPAR-011 (+ META-012 da 2ª edição) |
| 4 | Trigger de trilha em `metas.workflow_status` (modelo: o do Hub) | MWKF-011 |
| 5 | Trigger de derivação em `metas_checkins` → meta (modelo: o do Plano de Ação) | MCHK-002 |
| 6 | Trigger do status da certidão preservar `irregular` | CERT-011 |
| 7 | Confinamento de cadeias: versão anterior no mesmo processo; dependência na mesma ação (com checagem de ciclo); evidência com tarefa da própria ação | PDOC-010, PLTF-010, PLTF-011, PLEV-010 |
| 8 | Trava de conclusão pelo checklist obrigatório (Hub) | PCHK-010 |
| 9 | Contrato mínimo nos JSONB: evidência exige um campo de conteúdo; template exige `titulo`; origem da marcação sem nulo | MEVD-010, PLTP-010, PONTO-341 |
| — | Unicidade de CPF (admissões + empresas PF) — reincidente da 2ª edição, agora com os casos EMP-070/071 prontos para validar a correção | ADM-002, EMP-070/071 |

Os reincidentes do Ponto (251/252/253/270) e o saneamento dos dados de
produção (ADM-101/102/103, DESL-065) mantêm as recomendações da 2ª edição.

---

## 5. As boas notícias — o que a execução confirmou funcionando

1. **A automação de cota PcD entrou e funciona.** EMP-031/032/033, que
   falhavam na 2ª edição ("o banco aceita qualquer número"), agora passam com
   a mensagem *"AUTOCORRIGIDO pelo banco"* — percentual e quantidade são
   corrigidos para a faixa da Lei 8.213/91, e EMP-035 confirma o recálculo
   automático ao mudar de faixa. Três achados da edição anterior: fechados.

2. **As seis frentes de agosto do Ponto estão de pé** (nas partes já
   reexecutadas): a materialização de faltas cria o dia, ignora o futuro, é
   idempotente e tem diagnóstico; a origem da marcação nasce `O` e o ajuste
   não se disfarça de original.

3. **Onde o banco protege, os testes agora vigiam a proteção**: código
   sequencial e trilha automática do processo (Hub), motor de progresso do
   Plano de Ação, derivação de status da certidão, token único de assinatura,
   UNIQUE de participante — todos confirmados por execução e protegidos
   contra regressão.

4. **Validação de CPF no banco existe em parte do fluxo** — descoberta pelos
   erros das rotinas antigas (fixtures `999...` recusadas por "dígito
   verificador não confere"). É proteção nova posterior às rotinas; o
   COLAB-021 continua aberto onde a validação ainda não alcança.

---

## 6. Higiene interna do QA (não é defeito do sistema)

A primeira execução em escala expôs dívidas das próprias rotinas — já em
tratamento, sem tocar em funcionalidade:

1. **CPFs fixos `999...` sem dígito válido** em rotinas antigas (ADM, DESL,
   COLAB-010/033, EMP-024/025/060, PORTE-005): passam a usar o gerador
   `qa_cpf()` (dígito verificador correto).
2. **Enums divergentes do schema real**: ADM-111 usa `'rejeitado'`
   (não existe em `admissao_status`) e PERFIL-004 usa `'empresa'` (não existe
   em `perfil_escopo_tipo`) — ambos já documentados como pegadinha no
   CLAUDE.md.
3. **COLAB-011/023** esbarram na constraint `usuarios_base_colaborador_exige_cpf`
   (proteção nova, posterior às rotinas) — fixtures a atualizar.
4. **TTRE-010** (`record "new" has no field "arquivo_url"`) **não é higiene: é
   o defeito crítico 2.1 da 2ª edição confirmado em execução** — a função de
   status de documentos aplicada a `terceiro_treinamentos`, que não tem a
   coluna. Segue como o item mais antigo da pauta de correção.

---

## 7. Pendências para a 4ª edição

- Reexecutar **Ponto** (PONTO-300/301/310/311 com a rotina corrigida;
  PONTO-341 refinado) e **Empresas** (EMP-070/071, FER-001..005, TAC-001/003,
  primeira execução) e incorporar os resultados;
- 2ª leva de rotinas do Ponto (PONTO-291, 312, 320-322, 330-331 — exigem
  cenário completo de apuração com atestado, feriado e competência);
- 2ª leva do Hub (calendário, catálogo de documentos, templates de checklist);
- Cobertura pendente da auditoria fora da fila principal:
  `colaborador_condicoes_especiais` (adicional CLT art. 193) e
  `terceiro_treinamentos` (rotina executável do TTRE-011);
- Modernização das rotinas antigas (seção 6).

---

*Relatório produzido a partir da execução real das baterias de QA no cercado
isolado, em 08/08/2026. As mensagens completas de cada resultado estão em
`qa_resultados` e no runner de QA (SuperAdmin → QA).*

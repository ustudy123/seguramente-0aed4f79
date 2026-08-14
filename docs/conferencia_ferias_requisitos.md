# Conferência — Módulo Férias × Análise de Requisitos (YE-DP-FERIAS-001)

Documento conferido: *YourEyes — Módulo Férias, Análise de Requisitos Funcionais e
Não Funcionais*, 24 páginas, data-base agosto/2026.
Conferência feita em: 14/08/2026.

---

## Como esta conferência foi feita

Três fontes cruzadas, nesta ordem:

1. **Leitura integral do documento** — as 30 seções, 10 requisitos funcionais
   (RF-001..010), 12 não funcionais (RNF-001..012), 12 regras de negócio
   (RN-001..012), 12 critérios de aceite (CA-001..012) e os 12 cenários de teste.
2. **Leitura do código e do banco** — 1 tela com 10 abas, 13 componentes,
   8 hooks, 6 bibliotecas de regra/cálculo, 9 tabelas e 8 funções de banco.
3. **Execução da bateria de QA do próprio sistema** — a família `FERIAS` do motor
   `qa_*` tem **46 casos, todos com rotina**, e foi construída a partir *deste
   mesmo documento* (a migration `20260812180000` cita YE-DP-FERIAS-001 nome por
   nome). Resultado da execução: **6 passaram, 40 falharam**.

> **Ressalva de ambiente.** A bateria foi executada numa réplica local com as 780
> migrations aplicadas — o esquema é idêntico ao do ambiente de teste, mas os
> dados não são. As verificações da família FERIAS são quase todas de estrutura e
> de regra ("o banco aceitou X?"), então o resultado é representativo; ainda assim,
> a execução que vale para registro é a do ambiente de teste:
> `SELECT public.qa_rodar_bateria('manual', 'jornada-rotina/ferias');`
>
> Também encontrei **um falso negativo** na bateria (FERIAS-017, vínculo familiar):
> a rotina procura por *nome de coluna* e o recurso existe como *tabela própria*.
> Está apontado adiante e precisa de correção na rotina, não no produto.

---

## Placar

| | Itens |
|---|---|
| ✅ Implementado conforme o documento | 9 |
| 🟡 Implementado parcialmente | 11 |
| ❌ Ausente | 12 |
| ⚠️ Implementado divergindo do documento | 3 |

O módulo **existe e é substancial** — não é um esqueleto. O que falta é
concentrado em três frentes: cálculo com médias, férias coletivas e eSocial.

---

## O achado que explica quase todas as falhas

**As regras legais estão na tela, não no banco.**

Existe um motor de regras de verdade em `src/lib/feriasRegras.ts`, que avalia uma
programação contra os arts. 130, 133, 134 (caput, §1º e §3º), 135, 136 §1º, 137,
143 §1º e 145, classificando cada violação em *bloqueio*, *alerta* ou
*informativo*. É bem-feito e cobre boa parte do documento.

Só que ele roda **no navegador**. O banco aceita tudo:

| Caso | O que o banco aceitou |
|---|---|
| FERIAS-001 | direito de 30 dias com 8 faltas (o art. 130 manda 24) |
| FERIAS-011 | fracionamento 10+10+10 — nenhum período atinge os 14 dias |
| FERIAS-012 | período de 3 dias, abaixo do piso de 5 |
| FERIAS-013 | solicitação de 42 dias com saldo de 30 |
| FERIAS-014 | férias começando na véspera de feriado |
| FERIAS-020 | programação com o período concessivo já vencido |
| FERIAS-041 | abono de 15 dias num direito de 30 (o teto é 10) |
| FERIAS-056 | férias aprovadas pelo próprio solicitante |

Isso importa porque o sistema tem **três portas de entrada** para esses dados: a
tela de programação, a **importação em massa** (`ImportarFeriasModal`) e a API do
Supabase. Só a primeira passa pelo motor de regras. Uma planilha importada com
fracionamento inválido entra sem resistência.

O documento é explícito nesse ponto — RNF-001 pede cálculo determinístico e
RNF-003 pede log imutável de aprovações. Validação que mora só na interface não
atende nenhum dos dois.

**Correção estrutural sugerida:** trazer as regras de bloqueio para o banco, como
*triggers* e *constraints*, mantendo a tela como camada de conversa com o usuário
(explicação, alerta, sugestão). A tela orienta; o banco garante.

---

## Item a item

### RF-001 — Período aquisitivo e saldo de dias 🟡

**O que existe.** Tabela `ferias_periodos_aquisitivos` com período, dias de
direito, dias gozados e saldo. Função `ferias_dias_por_faltas_clt(faltas)` com a
escala do art. 130 **correta** (≤5→30, ≤14→24, ≤23→18, ≤32→12, >32→0).
`ferias_faltas_do_ponto()` busca as faltas no módulo Ponto, com precedência sobre
a carga manual, e registra a origem em `fonte_faltas`.
`ferias_recalcular_periodo()` e `ferias_recalcular_empresa()` reprocessam.
Há ainda um método alternativo `proporcional_avos` (1/12 por mês), configurável
por empresa.

Confirmado pela bateria: FERIAS-002 (as oito fronteiras da escala caem no degrau
certo), FERIAS-005 (falta justificada não conta — art. 131) e FERIAS-006 (a
punição é a redução da faixa, nunca o desconto dos dias de gozo — art. 130 §1º).

**O que falta.**
- Nada obriga o dado gravado a passar pela função (FERIAS-001).
- **Art. 133 não existe** (FERIAS-003): o recálculo não consulta Afastamentos, e
  nenhuma rotina encerra e reinicia o aquisitivo por auxílio-doença acima de
  6 meses ou licença remunerada acima de 30 dias. O documento classifica isso
  como [OLC] — obrigação legal confirmada.
- **Prescrição (art. 149 / CF art. 7º XXIX) não existe** (FERIAS-008): nenhum
  campo ou função marca o prazo de 5 anos.
- **Múltiplos vínculos quebram** (FERIAS-091): a chave única do período é
  `(tenant, CPF, início)` e ignora a empresa — a coluna `empresa_id` existe na
  tabela mas fica de fora da restrição. Dois contratos do mesmo CPF admitidos na
  mesma época colidem, e o segundo não abre período. O documento exige controle
  segregado por vínculo (seção 9 e cenário de teste "múltiplos vínculos").

### RF-002 — Programação, solicitação e aprovação 🟡

**O que existe.** Aba Programação com P1/P2/P3 e abono, tabela
`ferias_programacao` com os três subperíodos, e o motor de regras já descrito,
que valida 14+5+5, teto do saldo, limite concessivo, abono ≤ 1/3, véspera de
feriado e vínculo familiar. Estados do ciclo completos (FERIAS-050: nove estados
no enum, valor inventado é recusado). Fila de validação, timeline e calendário.

**O que falta.**
- Nenhuma das regras é imposta pelo banco (bloco anterior).
- **Autoaprovação não é vedada** (FERIAS-056): o banco aceita
  `aprovado_por = colaborador_id`. O documento é taxativo na seção 6 e no cenário
  de teste "permissões insuficientes".
- **Não há portal do colaborador.** A jornada 7.1 do documento descreve o
  colaborador consultando saldo e solicitando férias e abono. Hoje a solicitação
  nasce na tela de RH (`/ferias`, rota administrativa). O colaborador só participa
  na assinatura do aviso, por link externo.
- **Cancelamento não devolve os dias** (FERIAS-051) e **alteração de data
  confirmada não exige justificativa** (FERIAS-052).

### RF-003 — Aviso de férias (30 dias) 🟡

**O que existe.** Geração do aviso em PDF (`gerarAvisoFeriasPDF`), fluxo completo
de assinatura eletrônica por link com token e expiração
(`ferias_assinatura_links`, página pública `FeriasAssinatura`), IP da assinatura
registrado, arquivamento no módulo Documentos (`documento_arquivado_id`) e um
gatilho que lança os dias no Ponto quando o aviso é assinado
(`registrar_ferias_no_ponto`). A antecedência de 30 dias é avaliada pelo motor de
regras na programação.

**O que falta.**
- **Ninguém vigia o relógio do art. 135** (FERIAS-030): o campo `aviso_gerado`
  existe e nenhuma função o preenche ou monitora.
- **Aviso sem ciência não trava a concessão** (FERIAS-055): a solicitação avança
  para *em gozo* e *concluído* com a assinatura pendente. O documento exige o
  contrário no cenário "documento inválido".

### RF-004 — Cálculo da remuneração e médias ⚠️ 🟡

**O que existe.** Há cálculo, e ele não é pouco: `calcularFerias()` em
`src/lib/folha/calculos.ts` apura férias, **1/3 constitucional**, abono, 1/3 do
abono, INSS, IRRF e FGTS, com multiplicador para férias em dobro; grava em
`folha_ferias_calculo` com `memoria_calculo` em JSON. Há também
`src/lib/feriasFinanceiro.ts`, que calcula provisão por competência, desembolso
por caixa e **passivo em dobro do art. 137**, com encargos parametrizáveis por
empresa (INSS patronal, RAT/FAP, terceiros, FGTS e dispensa do Simples) — e que
declara, no próprio cabeçalho, ser uma estimativa gerencial, não fechamento
fiscal.

**O que falta e o que diverge.**
- **A média do art. 142 é um campo de entrada, não um motor** (FERIAS-033).
  `mediaVariaveis` chega como parâmetro, com padrão zero. Não há apuração das
  rubricas variáveis (horas extras habituais, adicionais, comissões) nem alerta
  de rubrica faltante. Quem recebe variável habitual e não tiver a média digitada
  à mão recebe **a menos**. É o RF-004 e o RNF-001 do documento, e é o achado de
  maior impacto financeiro desta conferência.
- **Os campos de valor da solicitação são preenchíveis à mão** (`valor_ferias`,
  `valor_terco`, `valor_abono`, `valor_total_bruto`), sem passar por motor algum.
- ⚠️ **Divergência a validar — INSS sobre o terço.** O código exclui o 1/3 da
  base do INSS ("sem 1/3 segundo jurisprudência mais recente"). O documento
  aponta o **STF Tema 985**, que decidiu pela incidência da contribuição
  previdenciária **patronal** sobre o terço de férias gozadas, com modulação a
  partir de 15/09/2020. São coisas distintas (contribuição do empregado ×
  patronal), mas o documento marca o tema como [VAL] e pede confirmação contábil.
  **Precisa de decisão do contador, por escrito, antes de qualquer fechamento.**
- ⚠️ **Divergência a validar — IRRF sobre o abono.** O código inclui o abono
  pecuniário e o 1/3 do abono na base do IRRF. O documento afirma a natureza
  indenizatória de ambos (arts. 143/144), também com marca [VAL].
- **Encargos não são apurados por rotina de banco** (FERIAS-034): os parâmetros
  existem em `ferias_config`, o cálculo vive na tela.
- **Não há memória versionada** no sentido do RNF-008 (reproduzir o cálculo a
  partir da versão dos parâmetros vigentes na data do fato gerador).

### RF-005 — Abono pecuniário e adiantamento do 13º 🟡

**O que existe.** Campos `abono_vender`, `abono_dias`, `adiantar_13` na
programação; `dias_abono`, `valor_abono` na solicitação; regra do teto de 1/3 no
motor da tela; cálculo do abono e do 1/3 do abono na folha.

**O que falta.**
- **O prazo do art. 143 não é verificado** (FERIAS-042): abono pedido depois do
  limite de 15 dias antes do fim do aquisitivo é aceito.
- **O teto não é imposto pelo banco** (FERIAS-041): 15 dias num direito de 30 passa.
- **A data do pedido de abono não é guardada** (FERIAS-040) — sem ela, não há como
  provar a tempestividade.
- **`adiantar_13` não faz nada** (FERIAS-035): o campo existe e nenhuma função o lê.

### RF-006 — Pagamento no prazo e recibo 🟡

**O que existe.** Recibo em PDF e em HTML (`gerarReciboFeriasPDF`,
`gerarReciboFeriasHTML`); campo `prazo_legal` e `data_pagamento` em
`folha_ferias_calculo`; regra do art. 145 (D-2) no motor da tela; integração com
o Financeiro (`registro_financeiro_id` na solicitação) e cálculo de desembolso
por caixa.

**O que falta.** Nenhum relógio no banco vigia o D-2 (FERIAS-032), e não há alerta
automático de pagamento a vencer — a seção 14 pede aviso em D-3/D-2.

### RF-007 — Férias coletivas ❌

**Ausente por completo** (FERIAS-060/061/062): não há estrutura nem fluxo. Uma
empresa que pare em dezembro precisa lançar férias individuais uma a uma, sem os
comunicados obrigatórios ao órgão do Ministério do Trabalho e ao sindicato com
15 dias de antecedência (art. 139, §§2º-3º), sem o controle de até 2 períodos por
ano com mínimo de 10 dias, e sem o tratamento dos empregados com menos de 12
meses (art. 140).

### RF-008 — Integração com o eSocial ❌

**Ausente para férias** (FERIAS-080/081/082). A infraestrutura existe e funciona
— `esocial_certificados`, `esocial_transmissoes`, `afastamentos_esocial` —, mas é
usada **só pelos afastamentos**. A concessão de férias não gera **S-2230 com
motivo 15**, e não há S-1200 nem S-1210 (`detPgtoFer`). Sem o evento, o gozo não
existe oficialmente para o governo.

Um ponto extra da bateria: `esocial_transmissoes` **não tem restrição de
unicidade**, então o mesmo evento pode ser transmitido duas vezes — o documento
pede anti-duplicidade explicitamente na seção 13.

### RF-009 — Alertas de vencimento e dobro 🟡

**O que existe.** A aba Inteligência mostra risco por setor, contagem de vencidos
e a vencer em 90 dias, um índice de risco e o aviso sobre o art. 137. A aba
Financeiro projeta o passivo em dobro. A solicitação tem ligação com o Plano de
Ação (`acao_preventiva`, `acao_preventiva_id`).

**O que falta.**
- **Nada é automático.** Não existe rotina agendada: a função
  `atualizar_status_ferias_automatico()` (aprovado → em gozo → concluído) existe
  e **não está no agendador**. Não há job diário de vencimentos, nem os disparos
  D-90/60/30 da seção 14, nem notificações.
- **A dobra não é materializada** (FERIAS-021/022): o passivo aparece na tela de
  quem for olhar, e não vira valor, alerta nem ação.

### RF-010 — Simulador e reabertura de cálculo ❌

Não há simulador para o colaborador nem fluxo de reabertura com dupla aprovação,
motivo e estorno (FERIAS-054). Alteração retroativa é justamente o cenário de
teste que o documento destaca.

---

## Requisitos não funcionais

| ID | Tema | Situação |
|---|---|---|
| RNF-001 | Cálculo determinístico com memória | 🟡 há memória JSON na folha; a média é entrada manual |
| RNF-002 | Parâmetros versionados com vigência | 🟡 encargos parametrizáveis por empresa; **sem vigência** — tabelas de INSS/IRRF fixas no código como `TABELA_INSS_2025` |
| RNF-003 | Log imutável (append-only) | 🟡 `ferias_historico` com gatilho registrando antes/depois; não é imutável nem exige justificativa |
| RNF-004 | Segurança e segregação | 🟡 multiempresa ok; **ver LGPD abaixo** |
| RNF-005 | Privacidade / acesso do colaborador aos próprios dados | ❌ ver abaixo |
| RNF-006 | Motor de datas confiável | 🟡 existe na tela (concessivo, 30 dias, D-2); nada no servidor |
| RNF-007 | Interoperabilidade eSocial/Folha | 🟡 Folha sim, eSocial não |
| RNF-008 | Auditabilidade / reprodutibilidade | ❌ não há versão de parâmetro guardada com o cálculo |
| RNF-009 | Escalabilidade | ✅ recálculo em lote por empresa existe |
| RNF-010 | Usabilidade | ✅ interface rica, explicativa, com base legal citada na tela |
| RNF-011 | Retenção | 🟡 documentos arquivados; sem política de prazo |
| RNF-012 | Contingência / fila de reprocessamento | ❌ |

### O ponto de LGPD que merece atenção

As três tabelas centrais — `ferias_periodos_aquisitivos`, `ferias_programacao` e
`ferias_solicitacoes` — liberam leitura para **qualquer usuário autenticado com
vínculo à empresa**. E `ferias_solicitacoes` guarda `salario_base`,
`valor_ferias`, `valor_terco` e `valor_total_bruto`.

Na prática: um colaborador comum com acesso ao sistema enxerga o salário e os
valores de férias dos colegas.

O documento diz o oposto em dois lugares: a matriz da seção 6 restringe o
colaborador a "só próprios dados", e a seção 22 exige minimização e controle de
acesso do colaborador aos próprios dados.

Agrava o quadro que **Férias ficou de fora da camada de perfil no banco** — as
políticas restritivas criadas pelo parecer de perfis de acesso cobrem 13 tabelas
sensíveis (atestados, psicossocial, saúde, documentos) e nenhuma delas é de
férias. Pela regra da própria casa (rotina de QA PERFIL-003), tabela sensível
nova precisa da política ou de exceção documentada.

**É a correção de menor esforço e maior efeito desta lista.**

---

## Integrações (seção 17)

| Módulo | Documento pede | Situação |
|---|---|---|
| Cadastro / Contrato | base do aquisitivo | ✅ |
| Ponto / Jornada | faltas do art. 130 | ✅ `ferias_faltas_do_ponto` + lançamento dos dias no ponto ao assinar |
| Afastamentos | art. 133 e sobreposição | ❌ FERIAS-003 e FERIAS-024 |
| Folha de Pagamento | rubricas, 1/3, abono, encargos | 🟡 cálculo existe; médias não |
| Financeiro de Pessoas | liberação e fluxo de caixa | ✅ |
| 13º salário | adiantamento na 1ª parcela | ❌ campo existe, sem uso |
| eSocial | S-2230 / S-1200 / S-1210 | ❌ |
| Documentos / Assinatura | aviso e recibo assinados | ✅ |
| Plano de Ação | ações preventivas | 🟡 ligação existe, geração automática não |
| Notificações / Calendário | alertas e prazos | 🟡 calendário sim, notificações não |
| Hub Contábil | conciliação de encargos | 🟡 estimativa exportável |
| Portal do Colaborador | solicitar, simular, dar ciência | 🟡 só a ciência |
| Indicadores / Auditoria | KPIs e trilha | 🟡 |
| Desligamento | vencidas e proporcionais na rescisão | ❌ FERIAS-090 |
| Instrumentos Coletivos | parametrização por CCT/ACT | ❌ |

---

## O que o sistema tem além do documento

Vale registrar, porque não aparece na especificação e já está pronto:

- **Aba Cultura** — mensagem pré-férias e check-in de retorno
  (`mensagem_pre_ferias`, `checkin_retorno_respostas`).
- **INR no momento da solicitação** — `inr_nivel_momento` e `inr_score_momento`
  guardam o índice de risco psicossocial de quem entrou de férias.
- **Evidência NR-1** — exportação que liga férias à gestão de riscos
  psicossociais.
- **Vínculo familiar** — tabela e tela próprias, atendendo o art. 136 §1º.
  *(É o falso negativo FERIAS-017: o recurso existe; a rotina de QA procura no
  lugar errado e precisa ser corrigida.)*
- **Importação em massa** de períodos, com recálculo por empresa.
- **Aba Governança** e **relatório por setor**.

---

## Prioridades sugeridas

Ordenadas por risco × esforço, não pela ordem do documento.

**1. Fechar o acesso aos dados de férias** — camada de perfil e restrição do
colaborador aos próprios dados. É exposição de salário acontecendo agora, é
LGPD, e é a correção mais barata da lista.

**2. Levar as regras de bloqueio para o banco** — art. 130 (dias derivados das
faltas), teto do saldo, fracionamento 14+5+5, teto do abono, autoaprovação
vedada, chave do período por vínculo. Fecha de uma vez oito falhas da bateria e
protege as três portas de entrada.

**3. Motor de médias do art. 142** — é o maior risco financeiro: hoje quem tem
variável habitual pode estar recebendo férias a menos, e sem memória não há como
auditar. Exige antes a definição, por cliente, de quais rubricas integram a base
(seção 30 do documento, marcada [VAL/DAE]).

**4. Relógios e rotina diária** — agendar o que já existe
(`atualizar_status_ferias_automatico`), materializar a dobra do art. 137 no dia
seguinte ao vencimento e ligar os alertas D-90/60/30, D-2 do pagamento e do aviso
de 30 dias.

**5. Art. 133 (perda e reinício do aquisitivo)** — depende da integração com
Afastamentos, que já existe e é usada por outros módulos.

**6. eSocial de férias** — aproveitar a infraestrutura dos afastamentos, começando
pelo S-2230 motivo 15, com restrição de unicidade em `esocial_transmissoes`.

**7. Férias coletivas** — bloco maior; o documento já o coloca na Evolução 2.

**8. Validação contábil por escrito** dos dois pontos tributários divergentes
(INSS sobre o terço; IRRF sobre o abono). Não é desenvolvimento, é decisão — e
sem ela o motor de cálculo não deve ser fechado.

---

## Para reproduzir esta conferência

No SQL Editor do ambiente de **teste**:

```sql
-- roda os 46 casos da família Férias
SELECT public.qa_rodar_bateria('manual', 'jornada-rotina/ferias');

-- lê o resultado da última execução
SELECT c.codigo, r.situacao, COALESCE(r.erro_tecnico, r.obtido) AS detalhe
FROM public.qa_resultados r
JOIN public.qa_casos_teste c ON c.id = r.caso_id
JOIN public.qa_execucoes e ON e.id = r.execucao_id
WHERE e.id = (
  SELECT id FROM public.qa_execucoes
  WHERE modulo_path = 'jornada-rotina/ferias'
  ORDER BY iniciada_em DESC LIMIT 1
)
ORDER BY c.codigo;
```

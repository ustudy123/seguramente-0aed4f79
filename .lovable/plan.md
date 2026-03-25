

# Plano: Planilha QA + Análise de Gaps — Módulo EPI

## 1. Gerar planilha XLSX de testes QA

Criar um arquivo Excel em `/mnt/documents/` com os 48 casos de teste organizados nas seguintes colunas:

| Coluna | Conteúdo |
|--------|----------|
| ID | CT-01 a CT-48 |
| Requisito | Regra de negócio vinculada |
| Caso de Teste | Título descritivo |
| Pré-condição | Estado necessário antes da execução |
| Passos | Passos numerados |
| Resultado Esperado | Comportamento correto |
| Prioridade | Alta / Média / Baixa |
| Severidade | Crítica / Alta / Média / Baixa |
| Base Normativa | NR-06 / CLT / NR-15 |
| Status Implementação | ✅ Implementado / ⚠️ Parcial / ❌ Não implementado |
| Observação de Gap | Detalhe técnico do que falta |

A planilha terá formatação profissional com cores por prioridade/severidade e uma aba resumo com contadores.

---

## 2. Análise de Gaps — Resultado da investigação do código

Aqui está o cruzamento dos 48 CTs com o estado atual do código:

### ✅ Implementado (funcional no código atual)

| CT | Funcionalidade |
|----|----------------|
| CT-01 | Cadastro de EPI com nome, categoria, CA, marca, fabricante, validade, estoque mínimo, periodicidade |
| CT-04/05 | Categorias padrão e campo livre no cadastro |
| CT-06 | Entrada manual de estoque (com local, subtipo, histórico) |
| CT-07 | Importação de XML NF-e (`ImportacaoNFForm`) |
| CT-08 | Local em dois níveis (Empresa/Obra + Almoxarifado via `useEpiLocais`) |
| CT-09 | Entrega com colaborador, EPI, quantidade, motivo, assinatura digital (wizard completo) |
| CT-10 | Assinatura digital armazenada (`SignatureCapture` + `assinatura_url`) |
| CT-11 | Trilha de auditoria (IP, user-agent, `signed_at`) |
| CT-14/15/16 | Devolução com destino (Estoque/Manutenção/Descarte) |
| CT-18 | Alerta de CA vencido (`EpiAlertasTab` — tipo "critico") |
| CT-19 | Alerta de estoque abaixo do mínimo |
| CT-20 | Alerta de EPI próximo do vencimento |
| CT-21 | Alerta de atraso de troca (periodicidade) |
| CT-22 | Saldo por local (`SaldoLocalDashboard`) |
| CT-23 | Transferência entre locais (`TransferenciaEstoqueForm`) |
| CT-24 | Matriz de proteção por função (`MatrizProtecaoTab` + `MatrizEpiConfig`) |
| CT-25 | Identificação de colaborador sem EPI obrigatório (cruzamento matriz × entregas) |
| CT-27 | Histórico de movimentações (`EpiMovimentacoes`) |
| CT-28 | Auditoria IA (`EpiFiscalIATab`) |
| CT-29 | Comprovante imprimível (`EpiEntregaRecibo` com PDF) |
| CT-30 | Rastreabilidade ponta a ponta (movimentações encadeadas) |
| CT-48 | Alerta preventivo para EPI próximo do vencimento (sem bloqueio) |

### ⚠️ Parcialmente implementado

| CT | O que falta |
|----|-------------|
| CT-02 | CA é campo no formulário mas **não é obrigatório** (schema Zod aceita vazio) — precisa tornar required |
| CT-03 | Validade do CA aceita qualquer data, **sem validação de formato/consistência** |
| CT-12 | O form filtra `episDisponiveis` por `quantidade_estoque > 0`, mas **não valida se quantidade solicitada ≤ saldo** no submit |
| CT-17 | Devolução tem campo observação mas **não exige preenchimento obrigatório** |
| CT-26 | Matriz existe mas o **assistente de entrega não sugere automaticamente** EPIs pela função do colaborador selecionado |
| CT-31 | Cruzamento matriz × entregas existe, mas **não há relatório exportável** de gaps por função |
| CT-33 | Fornecimento gratuito é implícito — **não há campo explícito** confirmando gratuidade no comprovante |

### ❌ Não implementado

| CT | Gap crítico |
|----|-------------|
| CT-13 | **Bloqueio de entrega com CA vencido** — o sistema alerta na aba Alertas mas **não bloqueia** o formulário de entrega |
| CT-32 | **Bloqueio de entrega de EPI irregular** (sem CA ou sem rastreabilidade) — não existe validação no submit |
| CT-34 | Periodicidade cadastrada e alertada, mas **sem fluxo automatizado** de substituição |
| CT-36 | **Unicidade de CA** — nenhuma validação de duplicidade no cadastro |
| CT-37 | **Entrada com quantidade zero/negativa** — schema Zod valida `min(1)` ✅ (na verdade implementado) |
| CT-38 | **Entrega com quantidade zero** — schema Zod valida `min(1)` ✅ (implementado) |
| CT-39 | **Entrega para colaborador inativo** — sem validação de status do colaborador |
| CT-40 | **Devolução de item sem entrega ativa** — sem validação explícita |
| CT-41 | **Devolução de danificado para estoque** — sem bloqueio por condição do item |
| CT-42 | Alteração manual de saldo — sem proteção (existe `AjustarEstoqueModal` que gera movimentação, parcialmente ok) |
| CT-43 | Estoque mínimo não configurado — sem tratamento/alerta específico |
| CT-44 | Função sem matriz — sem alerta administrativo |
| CT-45 | XML inválido — tratamento de erro básico, sem validação robusta |
| CT-46 | Assinatura interrompida — **sem rollback** se wizard falhar no meio |
| CT-47 | **Concorrência** — sem controle otimista de saldo (race condition possível) |

---

## 3. Implementação

Vou gerar a planilha XLSX usando openpyxl com:
- **Aba "Casos de Teste"**: todos os 48 CTs com as 11 colunas
- **Aba "Resumo"**: contadores por status, prioridade e severidade
- **Aba "Gaps Stakeholders"**: as 10 perguntas para stakeholders
- **Aba "Riscos"**: os 6 riscos com mitigação
- Formatação condicional por prioridade (vermelho/amarelo/verde)


# Repensando o Módulo Ponto Eletrônico

Mantemos o que já funciona (link externo, selfie, geolocalização, auditoria, ajustes, configurações REP-C/REP-P) e reorganizamos em torno de uma **regra central**:

> A escala define o planejado. O ponto registra o realizado. O motor de regras compara e classifica como Regular, Atenção ou Risco Trabalhista.

## 1. Nova arquitetura de Escalas (cadastro flexível)

Hoje as escalas são limitadas. Vamos transformar em um cadastro completo, multi-tipo:

**Tipos suportados** (campo `tipo_escala`):
- `5x2`, `6x1`, `seg_sabado`, `12x36`, `personalizada`, `flexivel`, `por_ciclo`, `por_turnos`

**Campos por escala** (tabela `ponto_escalas` — adicionar colunas):
- Carga horária diária / semanal / mensal prevista
- Dias trabalhados / dias de folga (JSON por dia da semana com horários)
- Janela flexível (entrada mín/máx) quando `flexivel`
- Intervalo previsto (minutos)
- Regras: tolerância, banco de horas, hora extra, feriado, domingo, adicional noturno
- Vínculo: `acordo_individual_id`, `cct_act_id` (texto/url do documento)

**Editor visual de escala** com preview semanal (grade de 7 dias × horários).

## 2. Motor de Regras (validador automático)

Nova função SQL `public.validar_marcacao_ponto(marcacao_id)` que roda após cada inserção/edição e popula `ponto_alertas` + classificação `verde/amarelo/vermelho`.

**Validações automáticas** (as 20 regras do documento):
- Jornada > 8h ordinárias / > 44h semanais / > 2h extras dia
- Interjornada < 11h
- Intrajornada (15min se 4-6h, 1h se >6h)
- DSR 24h consecutivas
- 12x36 sem 36h de descanso → **alerta crítico**
- Trabalho noturno (22h-05h, hora reduzida 52'30")
- Domingo/feriado sem regra configurada
- Tolerância > 10min/dia
- Janela flexível desrespeitada
- Banco de horas vencido
- Marcação faltante / pendente justificativa / pendente aprovação

## 3. Classificação Verde / Amarelo / Vermelho

Substituir os badges atuais por **semáforo CLT** em todas as listagens (espelho + dashboard):

- 🟢 **Regular**: jornada ok, intervalos ok
- 🟡 **Atenção**: hora extra dentro do limite, marcação manual, pequena divergência → exige justificativa
- 🔴 **Risco Trabalhista**: viola CLT → bloqueia fechamento sem ação corretiva, gera Ação 5W2H automaticamente (padrão do projeto)

## 4. Banco de Horas configurável

Nova tabela `ponto_banco_horas_config` por escala/empresa:
- Tipo (semanal, mensal, individual, ACT)
- Prazo de compensação, limites positivo/negativo
- Forma de compensação / pagamento ao vencer
- Vínculo com acordo

Job diário `ponto-banco-horas-vencimento` (edge function) gera alerta vermelho quando vencer.

## 5. Adicional Noturno e Hora Extra automáticos

Cálculo em SQL ao consolidar o dia:
- Decompõe marcação em janelas diurnas/noturnas
- Aplica hora reduzida 52'30"
- Calcula adicional noturno (% configurável, padrão 20%)
- Separa HE 50%/100% conforme dia (útil/domingo/feriado)
- Roteamento: pagamento ou banco de horas

## 6. Ponto por Exceção (modalidade)

Nova opção em `ponto_configuracao.modo_apuracao`:
- `padrao` (toda marcação)
- `por_excecao` (registra apenas atraso, falta, HE, ausência)
- Exige acordo vinculado e ciência do colaborador (campo `ciencia_aceita_em`)

## 7. Reorganização das Abas (UI)

Estrutura atual: Espelho · Escalas · Ajustes · Banco de Horas · Fechamento · Config · Alertas
Nova estrutura mais funcional:

```text
Visão Geral  →  KPIs + semáforo do dia + alertas vermelhos no topo
Espelho      →  marcações + classificação + justificativa inline
Escalas      →  cadastro multi-tipo com editor visual + atribuições
Apuração     →  HE, banco horas, adicional noturno, DSR, fechamento mensal
Ajustes      →  pendências (já filtrado por empresa)
Auditoria    →  trilha completa antes/depois, origem, IP, geo
Configurações→  modo registro, tolerâncias, modo apuração, acordos
```

## 8. O que se mantém (sem mexer)
- Link externo `/ponto/:token` com selfie + geo
- WhatsApp OTP
- REP-C / REP-P
- Solicitação de ajuste pelo colaborador
- Filtragem por empresa ativa nos ajustes/escalas (já corrigido)
- ConfirmDialog para destrutivos

## Detalhes técnicos

**Migrations necessárias:**
1. Adicionar colunas em `ponto_escalas` (tipo, cargas, janela flexível, regras JSON, vínculo acordo)
2. Criar `ponto_banco_horas_config`
3. Criar `ponto_acordos` (individual/ACT/CCT com upload de documento)
4. Adicionar `classificacao_clt` (verde/amarelo/vermelho) em `ponto_marcacoes` e `ponto_dia_consolidado`
5. Função `public.validar_marcacao_ponto()` + trigger AFTER INSERT/UPDATE em `ponto_marcacoes`
6. Função `public.consolidar_dia_ponto(colaborador_id, data)` para fechar o dia com HE/noturno/banco
7. Adicionar `modo_apuracao`, `permite_ponto_excecao` em `ponto_configuracao`

**Frontend (componentes novos):**
- `EscalaEditor.tsx` (editor visual semanal, multi-tipo)
- `MotorRegrasIndicator.tsx` (semáforo verde/amarelo/vermelho)
- `BancoHorasConfig.tsx`
- `AcordosManager.tsx` (acordo individual / CCT / ACT)
- `AuditoriaTab.tsx` (nova aba)
- `VisaoGeralTab.tsx` (nova aba KPI)

**Não muda:**
- `PontoExterno.tsx` (link público) — apenas passa a receber classificação
- `useGeolocation`, `PontoSelfieCapture`, `SolicitarAjusteModal`

## Entrega faseada

Para evitar regressão, sugiro entregar em 3 fases:

**Fase 1 (esta) — Fundação**: migrations + motor de regras + classificação CLT + reorganização das abas + EscalaEditor multi-tipo
**Fase 2** — Banco de horas, adicional noturno automático, acordos
**Fase 3** — Ponto por exceção, auditoria avançada, relatórios de risco

Confirma esse caminho? Posso já iniciar pela Fase 1 ao aprovar.

---

## Status de Entrega

- **Fase 1 (concluída)**: Migrations base (escalas flexíveis, acordos, banco de horas config, classificação CLT verde/amarelo/vermelho), reorganização de abas em 7 grupos.
- **Fase 2 (concluída)**: 
  - UI de Acordos (`PontoAcordosTab` em Compliance > Acordos)
  - UI de Configuração de Banco de Horas por escala (`PontoBancoHorasConfigTab` em Apuração > Config BH)
  - Função SQL `calcular_he_adicional_noturno_dia` que aplica CCT vigente (ou padrão CLT) e calcula HE 50%/100% e adicional noturno com hora ficta 52'30".
- **Fase 3 (pendente)**: Modo "Ponto por Exceção", auditoria avançada, relatórios de risco trabalhista, trigger automático no consolidado diário.

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Loader2, Play, RefreshCw, ShieldCheck, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEpiFiscalIA } from "@/hooks/useEpiFiscalIA";
import ReactMarkdown from "react-markdown";

const RELATORIO_DEMO = `## 📋 Relatório de Auditoria Fiscal — EPIs

**Data da análise:** ${new Date().toLocaleDateString("pt-BR")}
**Período avaliado:** Últimos 6 meses
**Total de colaboradores analisados:** 87
**Total de entregas no período:** 342

---

### 1. 🔴 Padrões Suspeitos (Gravidade Máxima)

#### 1.1 Frequência Anormal de Substituições
- **Carlos Eduardo Souza** (Operador de Produção, Depto. Fabricação): **12 substituições** de Luvas de Segurança em 6 meses (média da função: 3). Motivos declarados: 8× "Desgaste", 3× "Perda", 1× "Dano". *Recomendação: investigar condições do posto de trabalho ou uso inadequado.*
- **Ana Paula Ferreira** (Técnica de Manutenção, Depto. Manutenção): **7 substituições** de Óculos de Proteção em 4 meses (média: 2). Todos por "Dano". *Padrão atípico que merece atenção.*

#### 1.2 Extravios Recorrentes
- **Total de extravios no período:** 9 ocorrências
- **Concentração:** 5 dos 9 extravios (55%) são do Depto. Logística
- **Colaboradores reincidentes:**
  - Pedro Lima: 3 extravios (Colete Refletivo ×2, Botina ×1)
  - Marcos Oliveira: 2 extravios (Protetor Auricular ×2)
- 🔴 *Risco: extravios recorrentes sem investigação geram passivo em caso de fiscalização*

---

### 2. ⚖️ Riscos de Conformidade (NR-6, NR-9)

#### 2.1 CAs Vencidos em Uso
| EPI | CA | Vencimento | Entregas Ativas | Risco |
|---|---|---|---|---|
| Capacete de Segurança | CA 38.245 | 25/12/2025 | 23 colaboradores | 🔴 Crítico |
| Luvas de Segurança | CA 41.102 | 28/01/2026 | 14 colaboradores | 🔴 Crítico |

> ⚠️ **Impacto jurídico:** EPIs com CA vencido são considerados como "EPI não fornecido" pela fiscalização. As 37 entregas ativas com CAs vencidos expõem a empresa a **auto de infração e responsabilidade civil solidária** em caso de acidente.

#### 2.2 Funções sem EPI Obrigatório
- **Eletricistas (4 colaboradores):** Sem registro de entrega de Luva Isolante (obrigatória pela NR-10)
- **Soldadores (2 colaboradores):** Sem registro de Avental de Raspa e Perneira
- **Operadores de Empilhadeira (3 colaboradores):** Sem entrega de Protetor Auricular tipo concha

#### 2.3 EPIs sem Troca dentro da Vida Útil
- **18 colaboradores** com Botinas de Segurança entregues há mais de 14 meses (vida útil recomendada: 12 meses)
- **7 colaboradores** com Respiradores Semi-Faciais há mais de 13 meses (vida útil: 12 meses)

---

### 3. 📊 Anomalias Operacionais

#### 3.1 Pico de Consumo
- **Dezembro/2025:** 78 entregas (média mensal: 47). Aumento de **66%** sem registro de admissões proporcionais.
- Hipóteses: final de ano com pressão por conformidade OU substituições em massa atrasadas.

#### 3.2 Desequilíbrio por Departamento
| Departamento | Colaboradores | Entregas | Média/Colaborador |
|---|---|---|---|
| Fabricação | 32 | 156 | 4.9 |
| Manutenção | 18 | 89 | 4.9 |
| Logística | 22 | 72 | 3.3 |
| Administrativo | 15 | 25 | 1.7 |

- Fabricação e Manutenção têm consumo 48% acima da média geral (3.3). Avaliar se é proporcional ao risco ou se há desperdício.

#### 3.3 Estoque Crítico
- **Protetor Auricular:** 0 unidades (mínimo: 10) — 🔴 **Zerado**
- **Colete Refletivo:** 3 unidades (mínimo: 10) — 🟠 Crítico
- **Cinto de Segurança:** 2 unidades (mínimo: 5) — 🟠 Crítico
- *Risco operacional: impossibilidade de atender novas admissões ou substituições emergenciais*

---

### 4. ✅ Resumo Executivo — 3 Ações Prioritárias

| # | Ação | Severidade | Prazo |
|---|---|---|---|
| 1 | **Renovar CAs vencidos** (CA 38.245 e CA 41.102) e substituir imediatamente os 37 EPIs em uso com CA inválido | 🔴 Crítico | Imediato |
| 2 | **Regularizar entregas obrigatórias** para Eletricistas, Soldadores e Operadores de Empilhadeira conforme NR-10 e NR-6 | 🔴 Crítico | 7 dias |
| 3 | **Investigar padrão de extravios** no Depto. Logística e frequência anormal de substituições de Carlos Eduardo Souza | 🟠 Alto | 15 dias |

---

*Relatório gerado por IA Fiscal Interno — Seguramente. Os dados acima são baseados nos registros do sistema e devem ser validados pelo responsável de SST.*`;

export function EpiFiscalIATab() {
  const { analise, isLoading, error, executarAnalise } = useEpiFiscalIA();
  const [showDemo, setShowDemo] = useState(false);

  const displayContent = analise || (showDemo ? RELATORIO_DEMO : "");
  const isDemo = !analise && showDemo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              IA Fiscal Interno — Análise de Padrões
            </CardTitle>
            <div className="flex items-center gap-2">
              {!analise && !isLoading && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDemo(!showDemo)}
                  className="gap-2"
                >
                  <Eye className="w-4 h-4" />
                  {showDemo ? "Ocultar Demo" : "Ver Exemplo"}
                </Button>
              )}
              <Button
                onClick={executarAnalise}
                disabled={isLoading}
                className="gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando...
                  </>
                ) : analise ? (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Reanalisar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Executar Análise
                  </>
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A IA analisa padrões de entrega, consumo, extravios e conformidade dos EPIs para identificar anomalias e riscos jurídicos.
          </p>
        </CardHeader>
      </Card>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20"
        >
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {/* Result */}
      {(displayContent || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="w-5 h-5 text-primary" />
                Relatório de Análise Fiscal
                {isLoading && (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
                {isDemo && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Demonstração
                  </Badge>
                )}
              </CardTitle>
              {isDemo && (
                <p className="text-xs text-muted-foreground">
                  Este é um relatório fictício para demonstração. Clique em "Executar Análise" para gerar um relatório real com os dados da empresa.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{displayContent || "Aguardando resposta da IA..."}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {!displayContent && !isLoading && !error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Análise Fiscal Inteligente</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Execute a análise para que a IA identifique padrões suspeitos, anomalias de consumo, riscos de conformidade e recomendações de ação baseadas nos dados reais de EPIs da empresa.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">🔍 Padrões</p>
                  <p className="text-xs text-muted-foreground mt-1">Frequência anormal de substituições e perdas</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">⚖️ Conformidade</p>
                  <p className="text-xs text-muted-foreground mt-1">CAs vencidos, EPIs sem entrega para funções obrigatórias</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">📊 Anomalias</p>
                  <p className="text-xs text-muted-foreground mt-1">Picos de consumo e desgaste acelerado</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

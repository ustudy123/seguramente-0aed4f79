import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Play, RefreshCw, ShieldCheck, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEpiFiscalIA } from "@/hooks/useEpiFiscalIA";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

const RELATORIO_DEMO = `## 📋 Relatório de Auditoria Inteligente — EPIs

**Data da análise:** ${new Date().toLocaleDateString("pt-BR")}
**Período avaliado:** Últimos 6 meses
**Total de colaboradores analisados:** 87
**Total de entregas no período:** 342

---

### 1. 🔴 Padrões Suspeitos (Gravidade Máxima)

#### 1.1 Frequência Anormal de Substituições
- **Carlos Eduardo Souza** (Operador de Produção): **12 substituições** de Luvas de Segurança em 6 meses (média: 3). *Recomendação: investigar condições do posto.*
- **Ana Paula Ferreira** (Técnica de Manutenção): **7 substituições** de Óculos de Proteção em 4 meses (média: 2). Todos por "Dano".

#### 1.2 Extravios Recorrentes
- **Total de extravios no período:** 9 ocorrências
- **Concentração:** 55% no Depto. Logística

---

### 2. ⚖️ Riscos de Conformidade (NR-6, NR-9)

#### 2.1 CAs Vencidos em Uso
| EPI | CA | Vencimento | Entregas Ativas | Risco |
|---|---|---|---|---|
| Capacete de Segurança | CA 38.245 | 25/12/2025 | 23 colaboradores | 🔴 Crítico |

#### 2.2 Funções sem EPI Obrigatório
- **Eletricistas:** Sem Luva Isolante (NR-10)
- **Soldadores:** Sem Avental de Raspa e Perneira

---

### 3. ✅ Resumo Executivo — 3 Ações Prioritárias

| # | Ação | Severidade | Prazo |
|---|---|---|---|
| 1 | Renovar CAs vencidos | 🔴 Crítico | Imediato |
| 2 | Regularizar entregas obrigatórias | 🔴 Crítico | 7 dias |
| 3 | Investigar padrão de extravios | 🟠 Alto | 15 dias |

*Relatório gerado por Auditoria Inteligente — Seguramente.*`;

export function EpiFiscalIATab() {
  const { analise, isLoading, error, executarAnalise } = useEpiFiscalIA();
  const [showDemo, setShowDemo] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const displayContent = analise || (showDemo ? RELATORIO_DEMO : "");
  const isDemo = !analise && showDemo;

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    toast.info("Gerando PDF...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 20;
      }

      pdf.save(`auditoria-inteligente-epi-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF baixado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar o PDF");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              Auditoria Inteligente — Análise de Padrões
            </CardTitle>
            <div className="flex items-center gap-2">
              {displayContent && !isLoading && (
                <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
                  <FileDown className="w-4 h-4" />
                  Baixar PDF
                </Button>
              )}
              {!analise && !isLoading && (
                <Button variant="outline" size="sm" onClick={() => setShowDemo(!showDemo)} className="gap-2">
                  <Eye className="w-4 h-4" />
                  {showDemo ? "Ocultar Demo" : "Ver Exemplo"}
                </Button>
              )}
              <Button onClick={executarAnalise} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
                ) : analise ? (
                  <><RefreshCw className="w-4 h-4" /> Reanalisar</>
                ) : (
                  <><Play className="w-4 h-4" /> Executar Análise</>
                )}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            A IA analisa padrões de entrega, consumo, extravios e conformidade dos EPIs para identificar anomalias e riscos jurídicos.
          </p>
        </CardHeader>
      </Card>

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-destructive/10 text-destructive p-4 rounded-lg border border-destructive/20">
          <p className="text-sm font-medium">{error}</p>
        </motion.div>
      )}

      {(displayContent || isLoading) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Relatório de Auditoria Inteligente
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {isDemo && <Badge variant="outline" className="ml-2 text-xs">Demonstração</Badge>}
              </CardTitle>
              {isDemo && (
                <p className="text-xs text-muted-foreground">
                  Relatório fictício para demonstração. Clique em "Executar Análise" para gerar com dados reais.
                </p>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[600px]">
                <div ref={contentRef} className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{displayContent || "Aguardando resposta da IA..."}</ReactMarkdown>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!displayContent && !isLoading && !error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <ShieldCheck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Auditoria Inteligente</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto mb-6">
                Execute a análise para que a IA identifique padrões suspeitos, anomalias de consumo, riscos de conformidade e recomendações de ação.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">🔍 Padrões</p>
                  <p className="text-xs text-muted-foreground mt-1">Frequência anormal de substituições e perdas</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs font-medium">⚖️ Conformidade</p>
                  <p className="text-xs text-muted-foreground mt-1">CAs vencidos, EPIs sem entrega obrigatória</p>
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

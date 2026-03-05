import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, Play, RefreshCw, ShieldCheck, Eye, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEpiFiscalIA } from "@/hooks/useEpiFiscalIA";
import { useEmpresaCadastro } from "@/hooks/useEmpresaCadastro";
import { AuditoriaAcoesSection } from "./AuditoriaAcoesSection";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { format } from "date-fns";


export function EpiFiscalIATab() {
  const { analise, isLoading, error, executarAnalise } = useEpiFiscalIA();
  const { empresas } = useEmpresaCadastro();
  const contentRef = useRef<HTMLDivElement>(null);

  const displayContent = analise || "";

  const empresa = empresas?.[0];

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
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;

      // Company header
      const nomeEmpresa = empresa?.razao_social || empresa?.nome_fantasia || "Empresa";
      const cnpj = empresa?.cnpj || "";
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(nomeEmpresa, margin, 15);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      if (cnpj) pdf.text(`CNPJ: ${cnpj}`, margin, 21);
      pdf.text(`Relatório gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, margin, cnpj ? 26 : 21);
      pdf.setDrawColor(200);
      pdf.line(margin, cnpj ? 29 : 24, pageWidth - margin, cnpj ? 29 : 24);

      const headerHeight = cnpj ? 33 : 28;

      const imgData = canvas.toDataURL("image/png");
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let yPosition = headerHeight;
      const contentHeight = pageHeight - margin - headerHeight;

      // First page
      if (imgHeight <= contentHeight) {
        pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
      } else {
        // Multi-page: slice the image
        let sourceY = 0;
        const ratio = canvas.width / imgWidth;
        let firstPage = true;

        while (sourceY < canvas.height) {
          const availableHeight = firstPage ? contentHeight : pageHeight - margin * 2;
          const sliceHeight = availableHeight * ratio;
          const actualSlice = Math.min(sliceHeight, canvas.height - sourceY);

          // Create a canvas slice
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = actualSlice;
          const ctx = sliceCanvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(canvas, 0, sourceY, canvas.width, actualSlice, 0, 0, canvas.width, actualSlice);
            const sliceData = sliceCanvas.toDataURL("image/png");
            const sliceImgHeight = (actualSlice * imgWidth) / canvas.width;

            if (!firstPage) pdf.addPage();
            pdf.addImage(sliceData, "PNG", margin, firstPage ? yPosition : margin, imgWidth, sliceImgHeight);
          }

          sourceY += actualSlice;
          firstPage = false;
        }
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
              <div
                ref={contentRef}
                className="prose prose-sm dark:prose-invert max-w-none
                  prose-headings:text-foreground prose-h2:text-lg prose-h2:border-b prose-h2:pb-2 prose-h2:mb-4
                  prose-h3:text-base prose-h3:mt-6 prose-h4:text-sm
                  prose-table:text-sm prose-th:bg-muted/50 prose-th:px-3 prose-th:py-2
                  prose-td:px-3 prose-td:py-2 prose-td:border-b
                  prose-li:my-0.5 prose-p:my-2
                  prose-strong:text-foreground
                  [&_table]:rounded-lg [&_table]:overflow-hidden [&_table]:border
                  [&_hr]:my-6 [&_hr]:border-border"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {displayContent || "Aguardando resposta da IA..."}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Ações sugeridas pela IA */}
      {displayContent && !isLoading && (
        <AuditoriaAcoesSection analise={displayContent} />
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

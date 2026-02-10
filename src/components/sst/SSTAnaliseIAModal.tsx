import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Brain, Save, Download, FileText, Building2, User, Calendar } from "lucide-react";
import { SSTDocumento, useSSTDocumentos } from "@/hooks/useSSTDocumentos";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento: SSTDocumento | null;
}

export function SSTAnaliseIAModal({ open, onOpenChange, documento }: Props) {
  const { updateAnaliseIA } = useSSTDocumentos();
  const [resultado, setResultado] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const iniciarAnalise = async () => {
    if (!documento) return;
    setResultado("");
    setIsAnalyzing(true);
    setIsDone(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sst-analise`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            documento_tipo: documento.tipo,
            documento_nome: documento.arquivo_nome || documento.tipo,
            empresa_emissora: documento.empresa_emissora || "",
            profissional_responsavel: documento.profissional_responsavel || "",
            arquivo_url: documento.arquivo_url || "",
            action: "analise",
          }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("Sem resposta do servidor");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              setResultado(fullText);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setIsDone(true);
      setIsAnalyzing(false);
    } catch (err: any) {
      setIsAnalyzing(false);
      toast.error("Erro na análise: " + err.message);
    }
  };

  const salvarAnalise = async () => {
    if (!documento || !resultado) return;
    await updateAnaliseIA.mutateAsync({
      id: documento.id,
      analise_ia: { resultado, data: new Date().toISOString() },
      analise_ia_status: "concluida",
    });
    toast.success("Análise salva com sucesso!");
  };

  const exportarPDF = useCallback(async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 800,
      });

      const imgWidth = 190;
      const pageHeight = 277;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");

      let heightLeft = imgHeight;
      let position = 10;

      // Header on first page
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text("RELATÓRIO DE CONFORMIDADE SST", 10, 8);
      pdf.text(format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR }), 160, 8);

      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `Relatorio_SST_${documento?.tipo || "analise"}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      pdf.save(fileName);
      toast.success("PDF exportado com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao exportar PDF: " + err.message);
    } finally {
      setIsExporting(false);
    }
  }, [documento]);

  const hasExistingAnalysis = documento?.analise_ia?.resultado;
  const displayContent = resultado || (hasExistingAnalysis ? documento.analise_ia.resultado : "");

  const ReportHeader = () => (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-8 py-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                Relatório de Conformidade SST
              </h2>
              <p className="text-sm text-muted-foreground">
                Auditoria técnica baseada nas Normas Regulamentadoras
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Documento:</span>
              <span className="font-medium text-foreground truncate max-w-[200px]">{documento?.tipo}</span>
            </div>
            {documento?.empresa_emissora && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Empresa:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">{documento.empresa_emissora}</span>
              </div>
            )}
            {documento?.profissional_responsavel && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Responsável:</span>
                <span className="font-medium text-foreground">{documento.profissional_responsavel}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium text-foreground">{format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          </div>
        </div>
      </div>
      {documento?.arquivo_nome && (
        <div className="mt-3">
          <Badge variant="outline" className="text-xs font-mono bg-background/50">
            {documento.arquivo_nome}
          </Badge>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        <ReportHeader />

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {!displayContent && !isAnalyzing && (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center py-12 max-w-md">
                <div className="p-4 bg-primary/10 rounded-2xl w-fit mx-auto mb-6">
                  <Brain className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Análise de Conformidade SST</h3>
                <p className="text-muted-foreground text-sm mb-2">
                  A IA irá auditar o documento completo identificando:
                </p>
                <ul className="text-xs text-muted-foreground text-left space-y-1 mb-6 mx-auto max-w-xs">
                  <li>• Inventário completo de riscos por categoria</li>
                  <li>• Conformidade por Norma Regulamentadora</li>
                  <li>• Alertas críticos, técnicos e de atenção</li>
                  <li>• Mapeamento de eventos eSocial</li>
                  <li>• Recomendações técnicas e prazos</li>
                </ul>
                <Button onClick={iniciarAnalise} size="lg">
                  <Brain className="w-4 h-4 mr-2" />
                  Iniciar Auditoria Técnica
                </Button>
              </div>
            </div>
          )}

          {(isAnalyzing || displayContent) && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1">
                <div ref={reportRef} className="px-8 py-6">
                  <div className="sst-report prose prose-sm max-w-none dark:prose-invert
                    prose-headings:text-foreground prose-headings:font-bold
                    prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:mb-4
                    prose-h2:text-lg prose-h2:text-primary prose-h2:border-l-4 prose-h2:border-primary prose-h2:pl-3 prose-h2:py-1 prose-h2:mt-8 prose-h2:mb-4
                    prose-h3:text-base prose-h3:text-foreground/90 prose-h3:mt-6 prose-h3:mb-3
                    prose-p:text-foreground/80 prose-p:leading-relaxed
                    prose-strong:text-foreground
                    prose-li:text-foreground/80
                    prose-table:border prose-table:border-border prose-table:rounded-lg prose-table:overflow-hidden
                    prose-th:bg-muted prose-th:text-foreground prose-th:font-semibold prose-th:text-xs prose-th:uppercase prose-th:tracking-wider prose-th:px-3 prose-th:py-2.5 prose-th:border prose-th:border-border prose-th:text-left
                    prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border prose-td:text-sm prose-td:align-top
                    prose-tr:even:bg-muted/30
                  ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
                    {isAnalyzing && (
                      <div className="flex items-center gap-3 mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Analisando documento...</p>
                          <p className="text-xs text-muted-foreground">Auditoria técnica conforme Normas Regulamentadoras em andamento</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              <Separator />
              <div className="px-6 py-3 flex-shrink-0 flex items-center justify-between bg-muted/30">
                <div className="flex items-center gap-2">
                  {hasExistingAnalysis && !resultado && (
                    <p className="text-xs text-muted-foreground">Análise salva em {documento?.analise_ia?.data ? format(new Date(documento.analise_ia.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ""}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {displayContent && !isAnalyzing && (
                    <Button onClick={exportarPDF} variant="outline" size="sm" disabled={isExporting}>
                      {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                      Baixar PDF
                    </Button>
                  )}
                  {hasExistingAnalysis && !resultado && (
                    <Button onClick={iniciarAnalise} variant="outline" size="sm">
                      <Brain className="w-4 h-4 mr-2" />
                      Nova Análise
                    </Button>
                  )}
                  {isDone && resultado && (
                    <Button onClick={salvarAnalise} disabled={updateAnaliseIA.isPending} size="sm">
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Relatório
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { generatePdfFromHtml, normalizeManualHtml } from "@/utils/generatePdfFromHtml";
import { EnviarManualAssinaturaDialog } from "./EnviarManualAssinaturaDialog";

interface ManualFuncaoModalProps {
  open: boolean;
  onClose: () => void;
  html: string;
  loading: boolean;
  titulo?: string;
  onPdfGenerated?: (blob: Blob, filename: string) => Promise<void> | void;
  cargoId?: string | null;
  cargoNome?: string | null;
}

export function ManualFuncaoModal({ open, onClose, html, loading, titulo, onPdfGenerated, cargoId, cargoNome }: ManualFuncaoModalProps) {
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const normalizedHtml = useMemo(() => normalizeManualHtml(html), [html]);

  const handleGeneratePdf = async () => {
    setPdfLoading(true);
    try {
      const { blob, filename, pdf } = await generatePdfFromHtml({
        html: normalizedHtml,
        filenamePrefix: titulo || "manual-funcao",
      });

      pdf.save(filename);
      await onPdfGenerated?.(blob, filename);
      toast.success("PDF gerado com sucesso!");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      toast.error("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([normalizedHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manual-funcoes.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              {titulo || "Manual de Funções e Competências"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!loading && normalizedHtml && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={pdfLoading}
                  >
                    {pdfLoading ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4 mr-1" />
                    )}
                    {pdfLoading ? "Gerando PDF..." : "Baixar PDF"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadHtml}>
                    <Download className="w-4 h-4 mr-1" /> Baixar HTML
                  </Button>
                  {cargoId && cargoNome && (
                    <Button size="sm" onClick={() => setEnviarOpen(true)}>
                      <Send className="w-4 h-4 mr-1" /> Enviar para Assinatura
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">Gerando Manual...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA está elaborando o documento. Isso pode levar até 1 minuto.
                </p>
              </div>
            </div>
          ) : normalizedHtml ? (
            <iframe
              srcDoc={normalizedHtml}
              className="w-full h-full border-0"
              title="Manual de Funções"
              sandbox="allow-same-origin allow-popups allow-scripts"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhum conteúdo gerado.
            </div>
          )}
        </div>
      </DialogContent>
      {cargoId && cargoNome && (
        <EnviarManualAssinaturaDialog
          open={enviarOpen}
          onClose={() => setEnviarOpen(false)}
          cargoId={cargoId}
          cargoNome={cargoNome}
          manualHtml={normalizedHtml}
          manualTitulo={titulo || "Manual da Função"}
        />
      )}
    </Dialog>
  );
}

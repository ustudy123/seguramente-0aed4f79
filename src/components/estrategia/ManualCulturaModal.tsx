import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { generatePdfFromHtml } from "@/utils/generatePdfFromHtml";

interface ManualCulturaModalProps {
  open: boolean;
  onClose: () => void;
  html: string;
  loading: boolean;
  onPdfGenerated?: (blob: Blob, filename: string) => Promise<void> | void;
}

export function ManualCulturaModal({ open, onClose, html, loading, onPdfGenerated }: ManualCulturaModalProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleGeneratePdf = async () => {
    setPdfLoading(true);
    try {
      const { blob, filename, pdf } = await generatePdfFromHtml({
        html,
        filenamePrefix: "manual-cultura",
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
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "manual-cultura-organizacional.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Manual de Cultura Organizacional</DialogTitle>
            <div className="flex items-center gap-2">
              {!loading && html && (
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
                    {pdfLoading ? "Renderizando páginas..." : "Baixar PDF"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownloadHtml}>
                    <Download className="w-4 h-4 mr-1" /> Baixar HTML
                  </Button>
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
                <p className="text-lg font-medium text-foreground">Gerando seu Manual de Cultura...</p>
                <p className="text-sm text-muted-foreground mt-1">A IA está elaborando um documento completo e profissional. Isso pode levar até 1 minuto.</p>
              </div>
            </div>
          ) : html ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              title="Manual de Cultura"
              sandbox="allow-same-origin allow-popups allow-scripts"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Nenhum conteúdo gerado.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

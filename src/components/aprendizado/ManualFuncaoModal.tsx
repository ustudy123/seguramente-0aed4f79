import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

interface ManualFuncaoModalProps {
  open: boolean;
  onClose: () => void;
  html: string;
  loading: boolean;
  titulo?: string;
  onPdfGenerated?: (blob: Blob, filename: string) => void;
}

export function ManualFuncaoModal({ open, onClose, html, loading, titulo, onPdfGenerated }: ManualFuncaoModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleGeneratePdf = async () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;

    setPdfLoading(true);
    try {
      const body = iframe.contentDocument.body;
      // Temporarily make body visible for html2canvas
      const clone = body.cloneNode(true) as HTMLElement;
      clone.style.width = "794px"; // A4 width at 96dpi
      clone.style.position = "absolute";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.background = "white";
      document.body.appendChild(clone);

      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        width: 794,
        windowWidth: 794,
      });

      document.body.removeChild(clone);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;
      let page = 1;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = -(pdfHeight * page);
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
        page++;
      }

      // Add page numbers
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Página ${i}/${totalPages}`, pdfWidth - 25, pdfHeight - 5);
      }

      const filename = `manual-funcao-${Date.now()}.pdf`;
      
      // Save locally
      pdf.save(filename);

      // Also provide blob for archiving
      if (onPdfGenerated) {
        const blob = pdf.output("blob");
        onPdfGenerated(blob, filename);
      }

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
                    {pdfLoading ? "Gerando PDF..." : "Baixar PDF"}
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
                <p className="text-lg font-medium text-foreground">Gerando Manual...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  A IA está elaborando o documento. Isso pode levar até 1 minuto.
                </p>
              </div>
            </div>
          ) : html ? (
            <iframe
              ref={iframeRef}
              srcDoc={html}
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
    </Dialog>
  );
}

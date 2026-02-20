import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Printer } from "lucide-react";

interface ManualFuncaoModalProps {
  open: boolean;
  onClose: () => void;
  html: string;
  loading: boolean;
  titulo?: string;
}

export function ManualFuncaoModal({ open, onClose, html, loading, titulo }: ManualFuncaoModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.print();
  };

  const handleDownload = () => {
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
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-1" /> Imprimir / PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
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

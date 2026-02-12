import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Printer, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Pdi, PdiCheckin, PdiFeedback } from "@/types/pdi";

interface PdiDocumentoModalProps {
  open: boolean;
  onClose: () => void;
  pdi: Pdi;
  checkins: PdiCheckin[];
  feedbacks: PdiFeedback[];
}

export function PdiDocumentoModal({ open, onClose, pdi, checkins, feedbacks }: PdiDocumentoModalProps) {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setHtml("");
    try {
      const payload = {
        pdi: {
          ...pdi,
          checkins,
          feedbacks,
        },
      };

      const { data, error } = await supabase.functions.invoke("ai-pdi-documento", { body: payload });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setHtml(data.html || "");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar documento");
    } finally {
      setLoading(false);
    }
  };

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
    a.download = `pdi-${pdi.colaborador_nome.replace(/\s+/g, "-").toLowerCase()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-generate on open
  useEffect(() => {
    if (open && !html && !loading) {
      handleGenerate();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Documento PDI — {pdi.colaborador_nome}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {!loading && html && (
                <>
                  <Button variant="outline" size="sm" onClick={handleGenerate}>
                    🔄 Regenerar
                  </Button>
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
                <p className="text-lg font-medium text-foreground">Gerando documento do PDI...</p>
                <p className="text-sm text-muted-foreground mt-1">A IA está elaborando um documento completo e profissional. Isso pode levar até 1 minuto.</p>
              </div>
            </div>
          ) : html ? (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              className="w-full h-full border-0"
              title="Documento PDI"
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

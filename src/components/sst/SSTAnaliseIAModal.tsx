import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, Save } from "lucide-react";
import { SSTDocumento, useSSTDocumentos } from "@/hooks/useSSTDocumentos";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

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

  // Show previous analysis or start new
  const hasExistingAnalysis = documento?.analise_ia?.resultado;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Relatório de Conformidade SST — {documento?.tipo}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-xs">{documento?.arquivo_nome}</Badge>
            {documento?.profissional_responsavel && (
              <Badge variant="secondary" className="text-xs">{documento.profissional_responsavel}</Badge>
            )}
            {documento?.empresa_emissora && (
              <Badge variant="secondary" className="text-xs">{documento.empresa_emissora}</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {!resultado && !isAnalyzing && hasExistingAnalysis && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{documento.analise_ia.resultado}</ReactMarkdown>
                </div>
              </ScrollArea>
              <div className="px-6 py-4 border-t flex-shrink-0 flex justify-between items-center">
                <p className="text-xs text-muted-foreground">Análise anterior salva</p>
                <Button onClick={iniciarAnalise} variant="outline" size="sm">
                  <Brain className="w-4 h-4 mr-2" />
                  Gerar Nova Análise
                </Button>
              </div>
            </div>
          )}

          {!resultado && !isAnalyzing && !hasExistingAnalysis && (
            <div className="flex-1 flex items-center justify-center px-6">
              <div className="text-center py-8">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">
                  Análise de conformidade baseada nas Normas Regulamentadoras (NRs)
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  A IA irá auditar o documento identificando riscos, medidas de controle, obrigações legais e gerar alertas de conformidade.
                </p>
                <Button onClick={iniciarAnalise}>
                  <Brain className="w-4 h-4 mr-2" />
                  Iniciar Análise de Conformidade
                </Button>
              </div>
            </div>
          )}

          {(isAnalyzing || resultado) && (
            <div className="flex flex-col flex-1 min-h-0">
              <ScrollArea className="flex-1 px-6 py-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{resultado}</ReactMarkdown>
                  {isAnalyzing && (
                    <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">Analisando documento conforme NRs...</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {isDone && resultado && (
                <div className="px-6 py-4 border-t flex-shrink-0 flex justify-end">
                  <Button onClick={salvarAnalise} disabled={updateAnaliseIA.isPending}>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Relatório
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

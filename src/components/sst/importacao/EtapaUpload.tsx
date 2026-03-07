import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import { ImportacaoState } from "./ImportacaoInteligente";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/** Envia o arquivo para a edge function sst-pdf-extract e retorna o texto extraído */
async function extractTextViaEdgeFunction(file: File): Promise<{ texto: string; chars: number; palavras: number; qualidade: string }> {
  const { data: { session } } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append("file", file);

  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sst-pdf-extract`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: formData,
    }
  );

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${resp.status} na extração do arquivo`);
  }

  return resp.json();
}

interface Props {
  state: ImportacaoState;
  updateState: (partial: Partial<ImportacaoState>) => void;
}

export function EtapaUpload({ state, updateState }: Props) {
  const [processando, setProcessando] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`Arquivo muito grande. Máximo ${MAX_SIZE_MB}MB.`);
      return;
    }

    updateState({ arquivo: file });
  }, [updateState]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    maxFiles: 1,
    disabled: processando,
  });

  const [qualidadeExtracao, setQualidadeExtracao] = useState<string | null>(null);

  const handleAvancar = async () => {
    if (!state.arquivo) return;
    setProcessando(true);
    updateState({ processando: true, erro: null });
    
    try {
      toast.info("Enviando arquivo para extração inteligente...");
      const result = await extractTextViaEdgeFunction(state.arquivo);
      setQualidadeExtracao(result.qualidade);
      toast.success(`Texto extraído: ${result.palavras.toLocaleString("pt-BR")} palavras`);
      updateState({ textoExtraido: result.texto, etapa: 2, processando: false });
    } catch (err: any) {
      updateState({ erro: err.message, processando: false });
      toast.error("Erro ao extrair arquivo: " + err.message);
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              isDragActive
                ? "border-primary bg-primary/5"
                : state.arquivo
                ? "border-primary/40 bg-primary/5"
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
            }`}
          >
            <input {...getInputProps()} />
            {state.arquivo ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{state.arquivo.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(state.arquivo.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">Arquivo selecionado</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); updateState({ arquivo: null }); }}
                  >
                    <X className="w-4 h-4 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-3 bg-muted rounded-xl">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">
                    {isDragActive ? "Solte o arquivo aqui" : "Arraste ou clique para selecionar"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">PDF, DOCX ou DOC — máximo {MAX_SIZE_MB}MB</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formatos e avisos */}
      <Card className="border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Melhor resultado com PDFs nativos (texto selecionável).</strong> A extração agora é feita 
            server-side com suporte a múltiplos formatos. PDFs digitalizados (imagens) podem ter qualidade reduzida.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleAvancar}
          disabled={!state.arquivo || processando}
          size="lg"
        >
          {processando ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Extraindo texto...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2" />Avançar — Classificar</>
          )}
        </Button>
      </div>
    </div>
  );
}

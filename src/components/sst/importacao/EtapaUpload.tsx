import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, X, AlertCircle, Loader2 } from "lucide-react";
import { ImportacaoState } from "./ImportacaoInteligente";
import { toast } from "sonner";

const MAX_SIZE_MB = 20;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Simple PDF text extractor using browser's PDF.js if available, else just use filename as hint
async function extractTextFromFile(file: File): Promise<string> {
  // For PDF: read as ArrayBuffer and try to extract text via basic parsing
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    try {
      // Try to read the PDF and extract readable text (basic approach for text-based PDFs)
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let text = "";
      
      // Extract ASCII strings from PDF content (basic text extraction)
      const decoder = new TextDecoder("latin1");
      const rawText = decoder.decode(uint8Array);
      
      // Extract text between BT and ET markers (PDF text blocks)
      const btEtRegex = /BT\s*([\s\S]*?)\s*ET/g;
      const tjRegex = /\(([^)]{3,})\)\s*T[jJ]/g;
      const tdRegex = /\[([^\]]{10,})\]\s*TJ/g;
      
      let match;
      while ((match = btEtRegex.exec(rawText)) !== null) {
        const block = match[1];
        let tjMatch;
        while ((tjMatch = tjRegex.exec(block)) !== null) {
          const extracted = tjMatch[1].replace(/\\(\d{3})/g, (_, oct) =>
            String.fromCharCode(parseInt(oct, 8))
          ).replace(/\\\\/g, "\\").replace(/\\n/g, "\n").replace(/\\r/g, "");
          if (extracted.trim().length > 0) text += extracted + " ";
        }
      }
      
      // Fallback: extract readable strings >= 4 chars
      if (text.trim().length < 100) {
        const readable = rawText.match(/[A-Za-zÀ-ÿ0-9\s.,;:()[\]{}!?@#$%&*+=\-_/\\'"]{4,}/g) || [];
        text = readable
          .filter(s => s.trim().length >= 4 && /[A-Za-zÀ-ÿ]/.test(s))
          .join(" ")
          .substring(0, 25000);
      } else {
        text = text.substring(0, 25000);
      }
      
      return text || `[Arquivo PDF: ${file.name}]`;
    } catch {
      return `[Arquivo PDF: ${file.name}]`;
    }
  }

  // For DOCX/DOC: try reading as text
  if (file.name.endsWith(".docx") || file.name.endsWith(".doc")) {
    try {
      const text = await file.text();
      return text.substring(0, 25000);
    } catch {
      return `[Arquivo Word: ${file.name}]`;
    }
  }

  // Fallback: try reading as plain text
  try {
    const text = await file.text();
    return text.substring(0, 25000);
  } catch {
    return `[Arquivo: ${file.name}]`;
  }
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

  const handleAvancar = async () => {
    if (!state.arquivo) return;
    setProcessando(true);
    updateState({ processando: true, erro: null });
    
    try {
      toast.info("Lendo arquivo...");
      const texto = await extractTextFromFile(state.arquivo);
      updateState({ textoExtraido: texto, etapa: 2, processando: false });
    } catch (err: any) {
      updateState({ erro: err.message, processando: false });
      toast.error("Erro ao ler arquivo: " + err.message);
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
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="py-3 px-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Melhor resultado com PDFs nativos (texto selecionável).</strong> PDFs digitalizados (imagens) 
            têm extração limitada — nesses casos, o sistema usará o nome e metadados do arquivo para auxiliar na classificação.
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
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Lendo arquivo...</>
          ) : (
            <>Avançar — Classificar</>
          )}
        </Button>
      </div>
    </div>
  );
}

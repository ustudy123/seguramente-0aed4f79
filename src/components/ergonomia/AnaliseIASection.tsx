import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Brain, 
  Upload, 
  FileText, 
  Image, 
  Video, 
  Mic, 
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Download,
  X
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAnaliseIA, AnaliseResultado } from "@/hooks/useAnaliseIA";

interface EvidenciaUpload {
  id: string;
  file: File;
  tipo: 'documento' | 'foto' | 'video' | 'audio';
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error';
  progress: number;
  preview?: string;
}

export function AnaliseIASection() {
  const [evidencias, setEvidencias] = useState<EvidenciaUpload[]>([]);
  const [contexto, setContexto] = useState("");
  const { isAnalyzing, resultado, analisarArquivo, limparResultado } = useAnaliseIA();

  const getTipoFromMime = (mimeType: string): EvidenciaUpload['tipo'] => {
    if (mimeType.startsWith('image/')) return 'foto';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'documento';
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const novasEvidencias: EvidenciaUpload[] = acceptedFiles.map(file => {
      const tipo = getTipoFromMime(file.type);
      return {
        id: crypto.randomUUID(),
        file,
        tipo,
        status: 'pending' as const,
        progress: 0,
        preview: tipo === 'foto' ? URL.createObjectURL(file) : undefined,
      };
    });
    setEvidencias(prev => [...prev, ...novasEvidencias]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a'],
    },
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  const handleRemoveEvidencia = (id: string) => {
    setEvidencias(prev => {
      const ev = prev.find(e => e.id === id);
      if (ev?.preview) URL.revokeObjectURL(ev.preview);
      return prev.filter(e => e.id !== id);
    });
  };

  const handleAnalizar = async () => {
    if (evidencias.length === 0) {
      toast.error("Adicione pelo menos uma evidência para análise");
      return;
    }

    // Pegar apenas a primeira imagem para análise (limitação da API de visão)
    const imagemPrincipal = evidencias.find(e => e.tipo === 'foto');
    
    if (!imagemPrincipal) {
      toast.error("Adicione pelo menos uma imagem para análise visual");
      return;
    }

    // Atualizar status
    setEvidencias(prev => prev.map(e => 
      e.id === imagemPrincipal.id 
        ? { ...e, status: 'analyzing' as const } 
        : e
    ));

    const result = await analisarArquivo(imagemPrincipal.file, contexto || undefined);

    // Atualizar status final
    setEvidencias(prev => prev.map(e => 
      e.id === imagemPrincipal.id 
        ? { ...e, status: result ? 'done' : 'error' } 
        : e
    ));
  };

  const handleNovaAnalise = () => {
    evidencias.forEach(e => {
      if (e.preview) URL.revokeObjectURL(e.preview);
    });
    setEvidencias([]);
    setContexto("");
    limparResultado();
  };

  const TIPO_ICONS = {
    documento: FileText,
    foto: Image,
    video: Video,
    audio: Mic,
  };

  const EIXO_COLORS = {
    fisico: 'bg-blue-500/10 text-blue-600 border-blue-200',
    cognitivo: 'bg-purple-500/10 text-purple-600 border-purple-200',
    organizacional: 'bg-amber-500/10 text-amber-600 border-amber-200',
  };

  const SEVERIDADE_COLORS = {
    baixo: 'bg-success/10 text-success border-success/30',
    medio: 'bg-warning/10 text-warning border-warning/30',
    alto: 'bg-orange-500/10 text-orange-600 border-orange-200',
    critico: 'bg-destructive/10 text-destructive border-destructive/30',
  };

  return (
    <div className="space-y-4">
      {/* Upload de Evidências */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Análise Ergonômica por IA (AEP-IA)
            <Badge variant="secondary" className="ml-2">OpenAI GPT-4o</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie fotos do posto de trabalho para análise automática com IA. 
            A IA irá identificar riscos ergonômicos e cruzar com a NR-17.
          </p>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? "Solte os arquivos aqui..." : "Arraste fotos ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Imagens JPG, PNG, WebP (máx. 20MB)
            </p>
          </div>

          {/* Contexto adicional */}
          {evidencias.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Contexto adicional (opcional)</label>
              <Textarea 
                placeholder="Descreva o tipo de atividade, setor, queixas dos colaboradores..."
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}

          {/* Lista de Evidências */}
          {evidencias.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Evidências ({evidencias.length})</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {evidencias.map((evidencia) => {
                  const Icon = TIPO_ICONS[evidencia.tipo];
                  return (
                    <div 
                      key={evidencia.id}
                      className="relative group rounded-lg overflow-hidden bg-muted/50 border"
                    >
                      {evidencia.preview ? (
                        <img 
                          src={evidencia.preview} 
                          alt={evidencia.file.name}
                          className="w-full h-24 object-cover"
                        />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center">
                          <Icon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      
                      {/* Overlay de status */}
                      {evidencia.status === 'analyzing' && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      {evidencia.status === 'done' && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle2 className="h-5 w-5 text-success" />
                        </div>
                      )}
                      
                      {/* Botão remover */}
                      {evidencia.status === 'pending' && (
                        <button
                          onClick={() => handleRemoveEvidencia(evidencia.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      
                      <p className="text-xs truncate p-2">{evidencia.file.name}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Botão de Análise */}
          <Button 
            onClick={handleAnalizar}
            disabled={evidencias.length === 0 || isAnalyzing}
            className="w-full gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando com IA...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analisar com IA (GPT-4o Vision)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado da Análise */}
      {resultado && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" />
                  Resultado da AEP-IA
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-2" onClick={handleNovaAnalise}>
                    Nova Análise
                  </Button>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Exportar
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Resumo Geral */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm">{resultado.resumoGeral}</p>
              </div>

              {/* Conformidade Estimada */}
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Conformidade Estimada NR-17</span>
                  <span className={cn(
                    "text-2xl font-bold",
                    resultado.conformidadeEstimada >= 70 ? "text-success" :
                    resultado.conformidadeEstimada >= 40 ? "text-warning" : "text-destructive"
                  )}>
                    {resultado.conformidadeEstimada}%
                  </span>
                </div>
                <Progress value={resultado.conformidadeEstimada} className="h-2" />
              </div>

              {/* Riscos Identificados */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Riscos Identificados ({resultado.riscosIdentificados.length})
                </h4>
                <div className="space-y-2">
                  {resultado.riscosIdentificados.map((risco, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-background border">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{risco.tipo}</span>
                        <Badge variant="outline" className={cn("text-xs", EIXO_COLORS[risco.eixo])}>
                          {risco.eixo}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs", SEVERIDADE_COLORS[risco.severidade])}>
                          {risco.severidade}
                        </Badge>
                        {risco.itemNR17 && (
                          <Badge variant="secondary" className="text-xs">
                            NR-17 {risco.itemNR17}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{risco.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lacunas Normativas */}
              {resultado.lacunasNormativas.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Lacunas Normativas</h4>
                  <ul className="space-y-1">
                    {resultado.lacunasNormativas.map((lacuna, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-destructive">•</span>
                        {lacuna}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recomendações */}
              {resultado.recomendacoes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3">Recomendações</h4>
                  <ul className="space-y-1">
                    {resultado.recomendacoes.map((rec, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Aviso */}
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-warning">
                  <strong>Nota:</strong> Esta é uma análise preliminar gerada por IA (GPT-4o). 
                  Para validação legal, consulte um profissional habilitado.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

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
  Download
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EvidenciaUpload {
  id: string;
  file: File;
  tipo: 'documento' | 'foto' | 'video' | 'audio';
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error';
  progress: number;
}

interface AnaliseResultado {
  riscosIdentificados: Array<{
    tipo: string;
    eixo: 'fisico' | 'cognitivo' | 'organizacional';
    severidade: 'baixo' | 'medio' | 'alto' | 'critico';
    descricao: string;
  }>;
  lacunasNormativas: string[];
  recomendacoes: string[];
  conformidadeEstimada: number;
}

export function AnaliseIASection() {
  const [evidencias, setEvidencias] = useState<EvidenciaUpload[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analiseResultado, setAnaliseResultado] = useState<AnaliseResultado | null>(null);

  const getTipoFromMime = (mimeType: string): EvidenciaUpload['tipo'] => {
    if (mimeType.startsWith('image/')) return 'foto';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'documento';
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const novasEvidencias: EvidenciaUpload[] = acceptedFiles.map(file => ({
      id: crypto.randomUUID(),
      file,
      tipo: getTipoFromMime(file.type),
      status: 'pending',
      progress: 0,
    }));
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
  });

  const handleRemoveEvidencia = (id: string) => {
    setEvidencias(prev => prev.filter(e => e.id !== id));
  };

  const handleAnalizar = async () => {
    if (evidencias.length === 0) {
      toast.error("Adicione pelo menos uma evidência para análise");
      return;
    }

    setIsAnalyzing(true);
    
    // Simular upload e análise
    for (let i = 0; i < evidencias.length; i++) {
      setEvidencias(prev => prev.map((e, idx) => 
        idx === i ? { ...e, status: 'uploading', progress: 0 } : e
      ));
      
      // Simular progresso de upload
      for (let p = 0; p <= 100; p += 20) {
        await new Promise(r => setTimeout(r, 100));
        setEvidencias(prev => prev.map((e, idx) => 
          idx === i ? { ...e, progress: p } : e
        ));
      }
      
      setEvidencias(prev => prev.map((e, idx) => 
        idx === i ? { ...e, status: 'analyzing' } : e
      ));
      
      await new Promise(r => setTimeout(r, 500));
      
      setEvidencias(prev => prev.map((e, idx) => 
        idx === i ? { ...e, status: 'done' } : e
      ));
    }

    // Simular resultado da análise
    await new Promise(r => setTimeout(r, 1000));
    
    setAnaliseResultado({
      riscosIdentificados: [
        {
          tipo: 'Postura inadequada',
          eixo: 'fisico',
          severidade: 'alto',
          descricao: 'Identificada postura de flexão cervical prolongada em atividades de digitação.',
        },
        {
          tipo: 'Sobrecarga cognitiva',
          eixo: 'cognitivo',
          severidade: 'medio',
          descricao: 'Evidências de múltiplas interrupções e demandas simultâneas.',
        },
        {
          tipo: 'Ritmo intenso',
          eixo: 'organizacional',
          severidade: 'medio',
          descricao: 'Indicadores de pressão por prazos e metas elevadas.',
        },
      ],
      lacunasNormativas: [
        'Item 17.3.3 - Características do assento não atendem aos requisitos mínimos',
        'Item 17.6.2 - Não há evidência de pausas programadas',
        'Item 17.5.3 - Iluminação abaixo do recomendado',
      ],
      recomendacoes: [
        'Substituir cadeiras por modelos com suporte lombar adequado',
        'Implementar programa de pausas a cada 50 minutos',
        'Avaliar iluminação local com luxímetro',
        'Realizar treinamento de postura para colaboradores',
      ],
      conformidadeEstimada: 58,
    });

    setIsAnalyzing(false);
    toast.success("Análise Ergonômica Preliminar concluída!");
  };

  const TIPO_ICONS = {
    documento: FileText,
    foto: Image,
    video: Video,
    audio: Mic,
  };

  const EIXO_COLORS = {
    fisico: 'bg-blue-500/10 text-blue-600',
    cognitivo: 'bg-purple-500/10 text-purple-600',
    organizacional: 'bg-amber-500/10 text-amber-600',
  };

  const SEVERIDADE_COLORS = {
    baixo: 'bg-success/10 text-success',
    medio: 'bg-warning/10 text-warning',
    alto: 'bg-orange-500/10 text-orange-600',
    critico: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-4">
      {/* Upload de Evidências */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Análise Ergonômica por IA (AEP-IA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie documentos, fotos, vídeos ou áudios para análise automática. 
            A IA irá cruzar as evidências com a NR-17 e gerar uma análise preliminar.
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
              {isDragActive ? "Solte os arquivos aqui..." : "Arraste arquivos ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, Word, Imagens, Vídeos, Áudios (máx. 20MB cada)
            </p>
          </div>

          {/* Lista de Evidências */}
          {evidencias.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Evidências ({evidencias.length})</p>
              {evidencias.map((evidencia) => {
                const Icon = TIPO_ICONS[evidencia.tipo];
                return (
                  <div 
                    key={evidencia.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{evidencia.file.name}</p>
                      {evidencia.status === 'uploading' && (
                        <Progress value={evidencia.progress} className="h-1 mt-1" />
                      )}
                      {evidencia.status === 'analyzing' && (
                        <span className="text-xs text-primary flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Analisando...
                        </span>
                      )}
                      {evidencia.status === 'done' && (
                        <span className="text-xs text-success flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Concluído
                        </span>
                      )}
                    </div>
                    {evidencia.status === 'pending' && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleRemoveEvidencia(evidencia.id)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                );
              })}
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
                Analisando evidências...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Análise Ergonômica Preliminar
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultado da Análise */}
      {analiseResultado && (
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
                <Button size="sm" variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Conformidade Estimada */}
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Conformidade Estimada NR-17</span>
                  <span className="text-2xl font-bold text-primary">
                    {analiseResultado.conformidadeEstimada}%
                  </span>
                </div>
                <Progress value={analiseResultado.conformidadeEstimada} className="h-2" />
              </div>

              {/* Riscos Identificados */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Riscos Identificados ({analiseResultado.riscosIdentificados.length})
                </h4>
                <div className="space-y-2">
                  {analiseResultado.riscosIdentificados.map((risco, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-background border">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{risco.tipo}</span>
                        <Badge className={cn("text-xs", EIXO_COLORS[risco.eixo])}>
                          {risco.eixo}
                        </Badge>
                        <Badge className={cn("text-xs", SEVERIDADE_COLORS[risco.severidade])}>
                          {risco.severidade}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{risco.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lacunas Normativas */}
              <div>
                <h4 className="text-sm font-medium mb-3">Lacunas Normativas</h4>
                <ul className="space-y-1">
                  {analiseResultado.lacunasNormativas.map((lacuna, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-destructive">•</span>
                      {lacuna}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recomendações */}
              <div>
                <h4 className="text-sm font-medium mb-3">Recomendações</h4>
                <ul className="space-y-1">
                  {analiseResultado.recomendacoes.map((rec, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Aviso */}
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-warning">
                  <strong>Nota:</strong> Esta é uma análise preliminar gerada por IA. 
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

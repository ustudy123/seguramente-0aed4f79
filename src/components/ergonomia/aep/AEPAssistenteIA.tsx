import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Upload, 
  Camera, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Wand2,
  Video,
  Mic,
  MicOff,
  Square,
  Play,
  Pause,
  Trash2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAnaliseIA, AnaliseResultado } from "@/hooks/useAnaliseIA";
import { useVideoFrameExtractor } from "@/hooks/useVideoFrameExtractor";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import type { 
  AEPDescricaoAtividade, 
  AEPRiscosFisicos, 
  AEPRiscosCognitivos, 
  AEPAcaoRecomendada,
  NivelRisco,
  TipoAcao,
  PrioridadeAcao
} from "@/types/aep";

interface AEPAssistenteIAProps {
  currentStep: number;
  descricaoAtividade?: AEPDescricaoAtividade;
  riscosFisicos?: AEPRiscosFisicos;
  riscosCognitivos?: AEPRiscosCognitivos;
  acoesRecomendadas?: AEPAcaoRecomendada[];
  onUpdateDescricao?: (data: Partial<AEPDescricaoAtividade>) => void;
  onUpdateRiscosFisicos?: (data: Partial<AEPRiscosFisicos>) => void;
  onUpdateRiscosCognitivos?: (data: Partial<AEPRiscosCognitivos>) => void;
  onAddAcoes?: (acoes: AEPAcaoRecomendada[]) => void;
}

const STEP_CONTEXT: Record<number, { title: string; description: string }> = {
  1: { title: "Identificação", description: "Dados básicos da empresa e avaliação" },
  2: { title: "Descrição da Atividade", description: "A IA pode sugerir descrições baseadas em fotos, vídeos ou áudios" },
  3: { title: "Avaliação de Riscos", description: "A IA pode analisar mídias para identificar riscos físicos e cognitivos" },
  4: { title: "Síntese", description: "A IA pode avaliar a conformidade geral baseada nos riscos identificados" },
  5: { title: "Ações Recomendadas", description: "A IA pode sugerir ações corretivas baseadas nos riscos" },
  6: { title: "Assinaturas", description: "Etapa de conclusão manual" },
};

function mapSeveridadeToNivel(severidade: string): NivelRisco {
  switch (severidade) {
    case "critico": return "critico";
    case "alto": return "alto";
    case "medio": return "medio";
    default: return "baixo";
  }
}

function mapRiscoToTipoAcao(tipo: string): TipoAcao {
  const lower = tipo.toLowerCase();
  if (lower.includes("treinamento") || lower.includes("capacitação")) return "treinamento";
  if (lower.includes("organizacional") || lower.includes("gestão")) return "organizacional";
  if (lower.includes("administrativ")) return "administrativa";
  return "engenharia";
}

function mapSeveridadeToPrioridade(severidade: string): PrioridadeAcao {
  switch (severidade) {
    case "critico": return "urgente";
    case "alto": return "alta";
    case "medio": return "media";
    default: return "baixa";
  }
}

export function AEPAssistenteIA({
  currentStep,
  descricaoAtividade,
  riscosFisicos,
  riscosCognitivos,
  acoesRecomendadas,
  onUpdateDescricao,
  onUpdateRiscosFisicos,
  onUpdateRiscosCognitivos,
  onAddAcoes,
}: AEPAssistenteIAProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contexto, setContexto] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadType, setUploadType] = useState<"foto" | "video">("foto");
  const [videoFrames, setVideoFrames] = useState<string[] | null>(null);
  const [isAnalyzingWithAudio, setIsAnalyzingWithAudio] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  
  const { isAnalyzing, resultado, limparResultado } = useAnaliseIA();
  const { extractFrames, isExtracting, progress: extractionProgress } = useVideoFrameExtractor({
    maxFrames: 8,
    framesPerSecond: 2,
    maxDuration: 30,
  });
  const {
    isRecording,
    isPaused,
    formattedDuration,
    audioUrl,
    audioBlob,
    maxDuration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    getBase64: getAudioBase64,
  } = useAudioRecorder({ maxDuration: 120 });

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const onDropImage = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
        setUploadedFileName(file.name);
        setVideoFrames(null);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const onDropVideo = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setUploadedFileName(file.name);
      const result = await extractFrames(file);
      if (result) {
        setVideoFrames(result.frames);
        setUploadedImage(result.frames[0]); // Show first frame as preview
        toast.success(`${result.frameCount} frames extraídos de ${result.duration.toFixed(1)}s de vídeo`);
      }
    }
  }, [extractFrames]);

  const imageDropzone = useDropzone({
    onDrop: onDropImage,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const videoDropzone = useDropzone({
    onDrop: onDropVideo,
    accept: { 'video/*': ['.mp4', '.mov', '.webm', '.avi'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleAnalyze = async () => {
    const stepContext = STEP_CONTEXT[currentStep];
    let fullContext = `Etapa: ${stepContext.title}. ${contexto}`;
    
    setIsAnalyzingWithAudio(true);

    try {
      // Get audio transcription if available
      let audioTranscricao: string | undefined;
      if (audioBlob) {
        // For now, we'll include a note about the audio
        // In a full implementation, we'd send to Whisper API for transcription
        fullContext += "\n\n[Áudio gravado pelo avaliador - contexto verbal disponível]";
      }

      // Import supabase for function invocation
      const { supabase } = await import("@/integrations/supabase/client");

      if (videoFrames && videoFrames.length > 0) {
        // Analyze video frames
        const { data, error } = await supabase.functions.invoke("analyze-ergonomia", {
          body: {
            tipo: "video",
            conteudo: videoFrames,
            contexto: fullContext,
          },
        });

        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.error);
        
        toast.success("Análise de vídeo concluída!");
      } else if (uploadedImage) {
        // Analyze single image
        const { data, error } = await supabase.functions.invoke("analyze-ergonomia", {
          body: {
            tipo: "imagem",
            conteudo: uploadedImage,
            contexto: fullContext,
          },
        });

        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.error);
        
        toast.success("Análise de imagem concluída!");
      } else if (contexto.trim() || audioBlob) {
        // Text-only analysis
        const { data, error } = await supabase.functions.invoke("analyze-ergonomia", {
          body: {
            tipo: "texto",
            conteudo: contexto || "Análise baseada em contexto de áudio",
            contexto: fullContext,
          },
        });

        if (error) throw new Error(error.message);
        if (data.error) throw new Error(data.error);
        
        toast.success("Análise concluída!");
      } else {
        toast.error("Forneça uma imagem, vídeo, áudio ou descrição para análise");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro na análise";
      toast.error(message);
    } finally {
      setIsAnalyzingWithAudio(false);
    }
  };

  const handleApplyToDescricao = () => {
    if (!resultado || !onUpdateDescricao) return;
    
    const updates: Partial<AEPDescricaoAtividade> = {};
    
    if (resultado.resumoGeral) {
      updates.descricaoGeral = resultado.resumoGeral;
    }
    
    const posturaRisco = resultado.riscosIdentificados.find(r => 
      r.tipo.toLowerCase().includes("postura") || r.descricao.toLowerCase().includes("postura")
    );
    if (posturaRisco) {
      updates.posturasAdotadas = posturaRisco.descricao;
    }

    onUpdateDescricao(updates);
    toast.success("Sugestões aplicadas à descrição!");
  };

  const handleApplyToRiscos = () => {
    if (!resultado) return;

    const fisicos = resultado.riscosIdentificados.filter(r => r.eixo === "fisico");
    const cognitivos = resultado.riscosIdentificados.filter(r => 
      r.eixo === "cognitivo" || r.eixo === "organizacional"
    );

    if (onUpdateRiscosFisicos && fisicos.length > 0) {
      const updates: Partial<AEPRiscosFisicos> = {};
      
      fisicos.forEach(risco => {
        const tipo = risco.tipo.toLowerCase();
        if (tipo.includes("postura")) {
          updates.postura = { fator: "Postura", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        } else if (tipo.includes("repetiti")) {
          updates.movimentosRepetitivos = { fator: "Movimentos repetitivos", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        } else if (tipo.includes("força") || tipo.includes("forca")) {
          updates.forcaFisica = { fator: "Força física", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        } else if (tipo.includes("carga") || tipo.includes("levantamento")) {
          updates.levantamentoCargas = { fator: "Levantamento de cargas", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        }
      });
      
      onUpdateRiscosFisicos(updates);
    }

    if (onUpdateRiscosCognitivos && cognitivos.length > 0) {
      const updates: Partial<AEPRiscosCognitivos> = {};
      
      cognitivos.forEach(risco => {
        const tipo = risco.tipo.toLowerCase();
        if (tipo.includes("ritmo") || tipo.includes("tempo")) {
          updates.ritmoImposto = { fator: "Ritmo imposto", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        } else if (tipo.includes("pressão") || tipo.includes("meta")) {
          updates.pressaoTempoMetas = { fator: "Pressão por tempo / metas", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        } else if (tipo.includes("atenção") || tipo.includes("atencao")) {
          updates.atencaoContinua = { fator: "Atenção contínua", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        } else if (tipo.includes("sobrecarga") || tipo.includes("mental")) {
          updates.sobrecargaMental = { fator: "Sobrecarga mental", observacao: risco.descricao, nivelRisco: mapSeveridadeToNivel(risco.severidade) };
        }
      });
      
      onUpdateRiscosCognitivos(updates);
    }

    toast.success("Riscos aplicados ao formulário!");
  };

  const handleApplyAcoes = () => {
    if (!resultado || !onAddAcoes) return;

    const novasAcoes: AEPAcaoRecomendada[] = resultado.recomendacoes.map((rec, index) => ({
      id: crypto.randomUUID(),
      acao: rec,
      tipo: mapRiscoToTipoAcao(rec),
      prioridade: resultado.riscosIdentificados[index]
        ? mapSeveridadeToPrioridade(resultado.riscosIdentificados[index].severidade)
        : "media",
    }));

    onAddAcoes(novasAcoes);
    toast.success(`${novasAcoes.length} ações sugeridas adicionadas!`);
  };

  const clearUpload = () => {
    setUploadedImage(null);
    setUploadedFileName(null);
    setVideoFrames(null);
  };

  const toggleAudioPlayback = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlayingAudio) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlayingAudio(!isPlayingAudio);
  };

  const stepInfo = STEP_CONTEXT[currentStep];
  const showForStep = currentStep >= 2 && currentStep <= 5;

  if (!showForStep) return null;

  const isProcessing = isAnalyzing || isExtracting || isAnalyzingWithAudio;
  const hasMedia = uploadedImage || videoFrames || audioBlob;
  const canAnalyze = hasMedia || contexto.trim();

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4"
    >
      <div 
        className={cn(
          "border rounded-lg overflow-hidden transition-all",
          isExpanded ? "bg-primary/5 border-primary/30" : "bg-muted/30 border-border"
        )}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="text-left">
              <span className="text-sm font-medium">Assistente IA</span>
              <span className="text-xs text-muted-foreground ml-2">
                {stepInfo.description}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMedia && (
              <Badge variant="secondary" className="text-xs">
                {videoFrames ? `${videoFrames.length} frames` : audioBlob ? "Áudio" : "Foto"}
              </Badge>
            )}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t"
            >
              <div className="p-4 space-y-4">
                {/* Upload Tabs */}
                <Tabs value={uploadType} onValueChange={(v) => setUploadType(v as "foto" | "video")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="foto" className="gap-2">
                      <Camera className="h-4 w-4" />
                      Foto
                    </TabsTrigger>
                    <TabsTrigger value="video" className="gap-2">
                      <Video className="h-4 w-4" />
                      Vídeo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="foto" className="mt-3">
                    <div
                      {...imageDropzone.getRootProps()}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                        imageDropzone.isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                        uploadedImage && !videoFrames && "border-success bg-success/5"
                      )}
                    >
                      <input {...imageDropzone.getInputProps()} />
                      {uploadedImage && !videoFrames ? (
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="text-sm text-success">{uploadedFileName}</span>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              clearUpload();
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Arraste uma foto ou clique para selecionar
                          </p>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG, WebP (máx. 10MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="video" className="mt-3">
                    <div
                      {...videoDropzone.getRootProps()}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                        videoDropzone.isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                        videoFrames && "border-success bg-success/5"
                      )}
                    >
                      <input {...videoDropzone.getInputProps()} />
                      {isExtracting ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <p className="text-sm text-muted-foreground">
                            Extraindo frames... {extractionProgress}%
                          </p>
                          <Progress value={extractionProgress} className="h-2 w-48" />
                        </div>
                      ) : videoFrames ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span className="text-sm text-success">
                              {uploadedFileName} ({videoFrames.length} frames)
                            </span>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                clearUpload();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-1 overflow-x-auto pb-2">
                            {videoFrames.slice(0, 4).map((frame, i) => (
                              <img 
                                key={i} 
                                src={frame} 
                                alt={`Frame ${i + 1}`}
                                className="h-12 w-auto rounded border"
                              />
                            ))}
                            {videoFrames.length > 4 && (
                              <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center text-xs">
                                +{videoFrames.length - 4}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Video className="h-5 w-5 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Arraste um vídeo ou clique para selecionar
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MP4, MOV, WebM (máx. 30s, 50MB)
                          </p>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Audio Recording */}
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mic className="h-4 w-4" />
                    Gravação de Áudio (contexto verbal)
                  </label>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                    {!isRecording && !audioUrl ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={startRecording}
                        className="gap-2"
                      >
                        <Mic className="h-4 w-4 text-destructive" />
                        Iniciar Gravação
                      </Button>
                    ) : isRecording ? (
                      <>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                          <span className="text-sm font-mono">{formattedDuration}</span>
                          <span className="text-xs text-muted-foreground">
                            / {Math.floor(maxDuration / 60)}:00
                          </span>
                        </div>
                        {isPaused ? (
                          <Button variant="ghost" size="icon" onClick={resumeRecording}>
                            <Play className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={pauseRecording}>
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="destructive" size="icon" onClick={stopRecording}>
                          <Square className="h-4 w-4" />
                        </Button>
                      </>
                    ) : audioUrl ? (
                      <>
                        <audio 
                          ref={audioRef} 
                          src={audioUrl} 
                          onEnded={() => setIsPlayingAudio(false)}
                        />
                        <Button variant="ghost" size="icon" onClick={toggleAudioPlayback}>
                          {isPlayingAudio ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="text-sm flex-1">Áudio gravado ({formattedDuration})</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={clearRecording}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Grave observações verbais sobre o posto de trabalho (máx. 2 min)
                  </p>
                </div>

                {/* Context Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Contexto adicional (texto)
                  </label>
                  <Textarea
                    value={contexto}
                    onChange={(e) => setContexto(e.target.value)}
                    placeholder="Descreva o setor, função, queixas dos trabalhadores, ou outros detalhes relevantes..."
                    rows={2}
                  />
                </div>

                {/* Analyze Button */}
                <Button 
                  onClick={handleAnalyze}
                  disabled={isProcessing || !canAnalyze}
                  className="w-full gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isExtracting ? "Processando vídeo..." : "Analisando com IA..."}
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Analisar com IA
                    </>
                  )}
                </Button>

                {/* Results */}
                {resultado && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 pt-4 border-t"
                  >
                    {/* Conformidade */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Conformidade Estimada</span>
                        <span className={cn(
                          "text-sm font-bold",
                          resultado.conformidadeEstimada >= 70 ? "text-success" :
                          resultado.conformidadeEstimada >= 40 ? "text-warning" : "text-destructive"
                        )}>
                          {resultado.conformidadeEstimada}%
                        </span>
                      </div>
                      <Progress value={resultado.conformidadeEstimada} className="h-2" />
                    </div>

                    {/* Resumo */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm">{resultado.resumoGeral}</p>
                    </div>

                    {/* Riscos Identificados */}
                    {resultado.riscosIdentificados.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-warning" />
                          Riscos Identificados ({resultado.riscosIdentificados.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {resultado.riscosIdentificados.slice(0, 5).map((risco, i) => (
                            <Badge 
                              key={i}
                              variant={risco.severidade === "critico" || risco.severidade === "alto" ? "destructive" : "outline"}
                            >
                              {risco.tipo}
                            </Badge>
                          ))}
                          {resultado.riscosIdentificados.length > 5 && (
                            <Badge variant="secondary">
                              +{resultado.riscosIdentificados.length - 5} mais
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recomendações */}
                    {resultado.recomendacoes.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                          <Lightbulb className="h-4 w-4 text-primary" />
                          Recomendações ({resultado.recomendacoes.length})
                        </h4>
                        <ul className="text-sm text-muted-foreground space-y-1 pl-4">
                          {resultado.recomendacoes.slice(0, 3).map((rec, i) => (
                            <li key={i} className="list-disc">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Apply Buttons */}
                    <div className="flex flex-wrap gap-2 pt-2">
                      {currentStep === 2 && onUpdateDescricao && (
                        <Button size="sm" variant="outline" onClick={handleApplyToDescricao}>
                          Aplicar à Descrição
                        </Button>
                      )}
                      {currentStep === 3 && (onUpdateRiscosFisicos || onUpdateRiscosCognitivos) && (
                        <Button size="sm" variant="outline" onClick={handleApplyToRiscos}>
                          Aplicar aos Riscos
                        </Button>
                      )}
                      {currentStep === 5 && onAddAcoes && (
                        <Button size="sm" variant="outline" onClick={handleApplyAcoes}>
                          Adicionar Ações Sugeridas
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={limparResultado}>
                        Limpar Resultado
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

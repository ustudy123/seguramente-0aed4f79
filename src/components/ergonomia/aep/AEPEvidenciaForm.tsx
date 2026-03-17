import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Camera, 
  Video, 
  Mic, 
  Upload, 
  X, 
  Plus,
  Building2,
  Briefcase,
  User,
  Loader2,
  Square,
  Check
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { useDepartamentos, useCargos } from "@/hooks/useCadastros";
import { useColaboradores } from "@/hooks/useColaboradores";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useVideoFrameExtractor } from "@/hooks/useVideoFrameExtractor";
import { EvidenciaAEP } from "@/types/aep-multi";
import { toast } from "sonner";

import { SituacaoTrabalho } from "@/types/aep-multi";

interface AEPEvidenciaFormProps {
  situacoes: SituacaoTrabalho[];
  onAddEvidencia: (evidencia: Omit<EvidenciaAEP, 'id' | 'createdAt' | 'analisadaPorIA'>) => string;
}

export function AEPEvidenciaForm({
  situacoes,
  onAddEvidencia
}: AEPEvidenciaFormProps) {
  const { departamentos } = useDepartamentos();
  const { cargos } = useCargos();
  const { colaboradores } = useColaboradores();
  
  // Form state — setor/função locked to situacoes list
  const [situacaoId, setSituacaoId] = useState("");
  const [colaboradorId, setColaboradorId] = useState("");
  const [contextoTexto, setContextoTexto] = useState("");
  const [arquivo, setArquivo] = useState<{ base64: string; tipo: 'foto' | 'video' } | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  
  // Audio recording
  const { 
    isRecording, 
    audioBlob, 
    startRecording, 
    stopRecording, 
    clearRecording 
  } = useAudioRecorder();
  
  const { extractFrames } = useVideoFrameExtractor({ maxFrames: 4, framesPerSecond: 2 });

  const situacaoSelecionada = situacoes.find(s => s.id === situacaoId);
  const setorId = situacaoSelecionada?.setorId || "";
  const setorNome = situacaoSelecionada?.setorNome || "";
  const funcaoId = situacaoSelecionada?.funcaoId || "";
  const funcaoNome = situacaoSelecionada?.funcaoNome || "";

  const colaboradoresDisponiveis = colaboradores.filter(c => 
    c.departamento === departamentos.find(d => d.id === setorId)?.nome
  );

  const colaboradorNome = colaboradores.find(c => c.id === colaboradorId)?.nome_completo;

  // File upload
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast.error("Apenas fotos e vídeos são aceitos");
      return;
    }

    if (isVideo) {
      setIsProcessingVideo(true);
      try {
        const result = await extractFrames(file);
        if (result) {
          setVideoFrames(result.frames);
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setArquivo({
            base64: reader.result as string,
            tipo: 'video'
          });
          setIsProcessingVideo(false);
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Erro ao processar vídeo:", error);
        toast.error("Erro ao processar vídeo");
        setIsProcessingVideo(false);
      }
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setArquivo({
          base64: reader.result as string,
          tipo: 'foto'
        });
        setVideoFrames([]);
      };
      reader.readAsDataURL(file);
    }
  }, [extractFrames]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false
  });

  // Clear form
  const clearForm = () => {
    setArquivo(null);
    setVideoFrames([]);
    setContextoTexto("");
    setColaboradorId("");
    clearRecording();
  };

  // Submit
  const handleSubmit = async () => {
    if (!setorId || !funcaoId) {
      toast.error("Selecione o setor e a função");
      return;
    }

    if (!arquivo && !audioBlob && !contextoTexto) {
      toast.error("Adicione pelo menos uma evidência (foto, vídeo, áudio ou descrição)");
      return;
    }

    let audioBase64: string | undefined;
    if (audioBlob) {
      audioBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(audioBlob);
      });
    }

    const evidencia: Omit<EvidenciaAEP, 'id' | 'createdAt' | 'analisadaPorIA'> = {
      setorId,
      setorNome,
      funcaoId,
      funcaoNome,
      colaboradorId: colaboradorId || undefined,
      colaboradorNome,
      tipo: arquivo?.tipo || 'audio',
      arquivoBase64: arquivo?.base64 || '',
      videoFrames: arquivo?.tipo === 'video' ? videoFrames : undefined,
      contextoTexto: contextoTexto || undefined,
      audioBase64
    };

    onAddEvidencia(evidencia);
    clearForm();
    toast.success("Evidência adicionada!");
  };

  const canSubmit = situacaoId && (arquivo || audioBlob || contextoTexto);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Adicionar Evidência
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seleção de contexto */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Situação de Trabalho */}
          <div className="space-y-2 md:col-span-1">
            <Label className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              Situação de Trabalho *
            </Label>
            <Select value={situacaoId} onValueChange={(v) => { setSituacaoId(v); setColaboradorId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a situação" />
              </SelectTrigger>
              <SelectContent>
                {situacoes.length === 0 ? (
                  <SelectItem value="_none" disabled>Nenhuma situação cadastrada</SelectItem>
                ) : (
                  situacoes.map(sit => (
                    <SelectItem key={sit.id} value={sit.id}>
                      {sit.setorNome} › {sit.funcaoNome}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Colaborador (opcional) */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              Colaborador
              <Badge variant="outline" className="ml-1 text-xs">opcional</Badge>
            </Label>
            <Select value={colaboradorId || "_nenhum"} onValueChange={(v) => setColaboradorId(v === "_nenhum" ? "" : v)} disabled={!setorId}>
              <SelectTrigger>
                <SelectValue placeholder="Qualquer colaborador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_nenhum">Não especificado</SelectItem>
                {colaboradoresDisponiveis.map(colab => (
                  <SelectItem key={colab.id} value={colab.id}>
                    {colab.nome_completo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Upload de mídia */}
        <div className="space-y-2">
          <Label>Foto ou Vídeo</Label>
          
          {arquivo ? (
            <div className="relative">
              {arquivo.tipo === 'foto' ? (
                <div className="relative rounded-lg overflow-hidden border">
                  <img 
                    src={arquivo.base64} 
                    alt="Preview" 
                    className="w-full max-h-[200px] object-contain bg-muted"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => setArquivo(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium">Vídeo carregado</span>
                      <Badge variant="secondary">{videoFrames.length} frames</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setArquivo(null); setVideoFrames([]); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {videoFrames.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {videoFrames.slice(0, 4).map((frame, idx) => (
                        <img 
                          key={idx}
                          src={frame}
                          alt={`Frame ${idx + 1}`}
                          className="h-16 w-auto rounded border"
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isProcessingVideo ? (
            <div className="flex items-center justify-center gap-2 p-8 border-2 border-dashed rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Processando vídeo...</span>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={`flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                isDragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <input {...getInputProps()} />
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <Camera className="h-5 w-5 text-primary" />
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Video className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  {isDragActive ? "Solte o arquivo aqui" : "Arraste uma foto ou vídeo"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ou clique para selecionar (máx. 50MB)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Gravação de áudio */}
        <div className="space-y-2">
          <Label>Contexto em Áudio</Label>
          <div className="flex items-center gap-3">
            {!audioBlob ? (
              <Button
                variant={isRecording ? "destructive" : "outline"}
                className="gap-2"
                onClick={isRecording ? stopRecording : startRecording}
              >
                {isRecording ? (
                  <>
                    <Square className="h-4 w-4" />
                    Parar Gravação
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    Gravar Áudio
                  </>
                )}
              </Button>
            ) : (
              <div className="flex items-center gap-3 flex-1">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success/10 text-success">
                  <Check className="h-4 w-4" />
                  <span className="text-sm">Áudio gravado</span>
                </div>
                <audio 
                  src={URL.createObjectURL(audioBlob)} 
                  controls 
                  className="h-8 flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearRecording}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            
            {isRecording && (
              <div className="flex items-center gap-2 text-destructive animate-pulse">
                <div className="h-2 w-2 rounded-full bg-destructive" />
                <span className="text-sm">Gravando...</span>
              </div>
            )}
          </div>
        </div>

        {/* Contexto em texto */}
        <div className="space-y-2">
          <Label htmlFor="contexto">Descrição Adicional</Label>
          <Textarea
            id="contexto"
            placeholder="Descreva observações sobre o posto de trabalho, atividades, comportamentos observados..."
            value={contextoTexto}
            onChange={e => setContextoTexto(e.target.value)}
            rows={3}
          />
        </div>

        {/* Botão de adicionar */}
        <div className="flex justify-end pt-2">
          <Button 
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar Evidência
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

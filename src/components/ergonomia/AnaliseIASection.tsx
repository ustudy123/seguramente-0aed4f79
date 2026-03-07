import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Brain,
  Upload,
  FileText,
  Image,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  Download,
  X,
  ClipboardList,
  Plus,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAnaliseIA, type AnaliseResultado } from "@/hooks/useAnaliseIA";
import { usePlanoAcao } from "@/hooks/usePlanoAcao";
import { useErgonomiaAnalises } from "@/hooks/useErgonomiaAnalises";

interface EvidenciaUpload {
  id: string;
  file: File;
  tipo: "documento" | "foto" | "video";
  status: "pending" | "analyzing" | "done" | "error";
  preview?: string;
}

interface PostoTrabalho {
  setor: string;
  cargo: string;
  atividade: string;
}

export function AnaliseIASection() {
  const [evidencias, setEvidencias] = useState<EvidenciaUpload[]>([]);
  const [contexto, setContexto] = useState("");
  const [posto, setPosto] = useState<PostoTrabalho>({ setor: "", cargo: "", atividade: "" });
  const [createdAcoes, setCreatedAcoes] = useState<Set<number>>(new Set());
  const [savedToBase, setSavedToBase] = useState(false);

  const { isAnalyzing, resultado, analisarArquivo, limparResultado } = useAnaliseIA();
  const { createAcao } = usePlanoAcao();
  const { salvarAnalise, isSalvando } = useErgonomiaAnalises();
  const navigate = useNavigate();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const novas: EvidenciaUpload[] = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      tipo: file.type.startsWith("image/") ? "foto" : file.type.startsWith("video/") ? "video" : "documento",
      status: "pending",
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setEvidencias((prev) => [...prev, ...novas]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
      "application/pdf": [".pdf"],
    },
    maxSize: 20 * 1024 * 1024,
  });

  const handleAnalizar = async () => {
    const imagem = evidencias.find((e) => e.tipo === "foto");
    if (!imagem) {
      toast.error("Adicione pelo menos uma foto do posto de trabalho");
      return;
    }

    setEvidencias((prev) =>
      prev.map((e) => (e.id === imagem.id ? { ...e, status: "analyzing" } : e))
    );

    const result = await analisarArquivo(
      imagem.file,
      [
        posto.setor && `Setor: ${posto.setor}`,
        posto.cargo && `Cargo: ${posto.cargo}`,
        posto.atividade && `Atividade: ${posto.atividade}`,
        contexto,
      ]
        .filter(Boolean)
        .join(". ") || undefined
    );

    setEvidencias((prev) =>
      prev.map((e) =>
        e.id === imagem.id ? { ...e, status: result ? "done" : "error" } : e
      )
    );

    if (result) {
      setSavedToBase(false);
    }
  };

  const handleSalvarNaBase = async () => {
    if (!resultado) return;
    if (!posto.setor || !posto.cargo) {
      toast.error("Informe o setor e o cargo para salvar na base ergonômica");
      return;
    }

    const classificacao =
      resultado.conformidadeEstimada < 40
        ? "alto"
        : resultado.conformidadeEstimada < 70
        ? "moderado"
        : "baixo";

    await salvarAnalise({
      setor: posto.setor,
      cargo: posto.cargo,
      atividade: posto.atividade || undefined,
      tipo_analise: "ia",
      riscos_identificados: resultado.riscosIdentificados.map((r) => ({
        tipo: r.tipo,
        eixo: r.eixo,
        severidade: r.severidade,
        descricao: r.descricao,
        itemNR17: r.itemNR17,
      })),
      recomendacoes: resultado.recomendacoes,
      lacunas_normativas: resultado.lacunasNormativas,
      conformidade_estimada: resultado.conformidadeEstimada,
      resumo_geral: resultado.resumoGeral,
      classificacao_risco: classificacao as "baixo" | "moderado" | "alto",
      contexto_adicional: contexto || undefined,
      transcricao_audio: resultado.transcricaoAudio,
    });

    setSavedToBase(true);
  };

  const handleNovaAnalise = () => {
    evidencias.forEach((e) => {
      if (e.preview) URL.revokeObjectURL(e.preview);
    });
    setEvidencias([]);
    setContexto("");
    setCreatedAcoes(new Set());
    setSavedToBase(false);
    limparResultado();
  };

  const handleCriarAcao = async (recomendacao: string, index: number) => {
    try {
      await createAcao({
        titulo:
          recomendacao.length > 100 ? recomendacao.substring(0, 100) + "..." : recomendacao,
        descricao: recomendacao,
        porque: "Recomendação identificada pela análise ergonômica AEP-IA para adequação à NR-17",
        origem_modulo: "ergonomia",
        origem_descricao: "Análise AEP-IA",
        prioridade: "medio",
        tipo: "corretiva",
        exige_evidencia: true,
      });
      setCreatedAcoes((prev) => new Set([...prev, index]));
      toast.success("Ação criada com sucesso!", {
        action: {
          label: "Ver Plano de Ação",
          onClick: () => navigate("/plano-acao"),
        },
      });
    } catch {
      toast.error("Erro ao criar ação");
    }
  };

  const EIXO_COLORS = {
    fisico: "bg-blue-500/10 text-blue-600 border-blue-200",
    cognitivo: "bg-purple-500/10 text-purple-600 border-purple-200",
    organizacional: "bg-amber-500/10 text-amber-600 border-amber-200",
  };

  const SEVERIDADE_COLORS = {
    baixo: "bg-success/10 text-success border-success/30",
    medio: "bg-warning/10 text-warning border-warning/30",
    alto: "bg-orange-500/10 text-orange-600 border-orange-200",
    critico: "bg-destructive/10 text-destructive border-destructive/30",
  };

  return (
    <div className="space-y-4">
      {/* Formulário do posto */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Análise Ergonômica por IA (AEP-IA)
            <Badge variant="secondary" className="ml-2">
              OpenAI GPT-4o
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Envie fotos do posto de trabalho. A análise será salva permanentemente na base
            ergonômica da empresa.
          </p>

          {/* Identificação do posto */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Setor *</Label>
              <Input
                placeholder="Ex: Produção"
                value={posto.setor}
                onChange={(e) => setPosto((p) => ({ ...p, setor: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cargo *</Label>
              <Input
                placeholder="Ex: Operador de Máquinas"
                value={posto.cargo}
                onChange={(e) => setPosto((p) => ({ ...p, cargo: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Atividade</Label>
              <Input
                placeholder="Ex: Montagem de peças"
                value={posto.atividade}
                onChange={(e) => setPosto((p) => ({ ...p, atividade: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? "Solte as fotos aqui..." : "Arraste fotos ou clique para selecionar"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Imagens JPG, PNG, WebP (máx. 20MB)
            </p>
          </div>

          {/* Contexto */}
          {evidencias.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Contexto adicional (opcional)</Label>
              <Textarea
                placeholder="Descreva queixas, condições especiais, histórico..."
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
                className="min-h-[70px]"
              />
            </div>
          )}

          {/* Preview das fotos */}
          {evidencias.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {evidencias.map((ev) => (
                <div key={ev.id} className="relative rounded-lg overflow-hidden bg-muted/50 border">
                  {ev.preview ? (
                    <img
                      src={ev.preview}
                      alt={ev.file.name}
                      className="w-full h-20 object-cover"
                    />
                  ) : (
                    <div className="w-full h-20 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {ev.status === "analyzing" && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                  {ev.status === "done" && (
                    <div className="absolute top-1 right-1">
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </div>
                  )}
                  {ev.status === "pending" && (
                    <button
                      onClick={() =>
                        setEvidencias((prev) => {
                          const e = prev.find((x) => x.id === ev.id);
                          if (e?.preview) URL.revokeObjectURL(e.preview);
                          return prev.filter((x) => x.id !== ev.id);
                        })
                      }
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-background/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

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

      {/* Resultado */}
      {resultado && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-5 w-5 text-primary" />
                  Resultado da AEP-IA
                </div>
                <div className="flex gap-2">
                  {!savedToBase ? (
                    <Button
                      size="sm"
                      className="gap-2"
                      onClick={handleSalvarNaBase}
                      disabled={isSalvando}
                    >
                      {isSalvando ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Salvar na Base Ergonômica
                    </Button>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      Salvo na base
                    </Badge>
                  )}
                  <Button size="sm" variant="outline" onClick={handleNovaAnalise}>
                    Nova Análise
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Resumo */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm">{resultado.resumoGeral}</p>
              </div>

              {/* Conformidade */}
              <div className="p-4 rounded-lg bg-background border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Conformidade Estimada NR-17</span>
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      resultado.conformidadeEstimada >= 70
                        ? "text-success"
                        : resultado.conformidadeEstimada >= 40
                        ? "text-warning"
                        : "text-destructive"
                    )}
                  >
                    {resultado.conformidadeEstimada}%
                  </span>
                </div>
                <Progress value={resultado.conformidadeEstimada} className="h-2" />
              </div>

              {/* Riscos */}
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
                        <Badge
                          variant="outline"
                          className={cn("text-xs", EIXO_COLORS[risco.eixo])}
                        >
                          {risco.eixo}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", SEVERIDADE_COLORS[risco.severidade])}
                        >
                          {risco.severidade}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{risco.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recomendações */}
              {resultado.recomendacoes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Recomendações ({resultado.recomendacoes.length})
                    </h4>
                    {resultado.recomendacoes.some((_, idx) => !createdAcoes.has(idx)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-2 text-xs"
                        onClick={() => {
                          resultado.recomendacoes.forEach((rec, idx) => {
                            if (!createdAcoes.has(idx)) handleCriarAcao(rec, idx);
                          });
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Criar todas as ações
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <TooltipProvider>
                      {resultado.recomendacoes.map((rec, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background border group"
                        >
                          <div className="flex items-start gap-2 flex-1">
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                            <span className="text-sm text-muted-foreground">{rec}</span>
                          </div>
                          {createdAcoes.has(idx) ? (
                            <Badge variant="secondary" className="shrink-0 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Criada
                            </Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="shrink-0 gap-1.5 opacity-70 group-hover:opacity-100"
                                  onClick={() => handleCriarAcao(rec, idx)}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  <span className="hidden md:inline">Criar Ação</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Transformar em ação 5W2H</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ))}
                    </TooltipProvider>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                <p className="text-sm text-warning">
                  <strong>Nota:</strong> Análise preliminar por IA. Para validação legal,
                  consulte um profissional habilitado (Ergonomista/CREFITO).
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

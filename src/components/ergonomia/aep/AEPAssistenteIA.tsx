import { useState, useCallback } from "react";
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
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAnaliseIA, AnaliseResultado, RiscoIdentificado } from "@/hooks/useAnaliseIA";
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
  2: { title: "Descrição da Atividade", description: "A IA pode sugerir descrições baseadas em fotos ou informações do setor" },
  3: { title: "Avaliação de Riscos", description: "A IA pode analisar imagens para identificar riscos físicos e cognitivos" },
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
  
  const { isAnalyzing, resultado, analisarImagem, analisarTexto, limparResultado } = useAnaliseIA();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedImage(reader.result as string);
        setUploadedFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleAnalyze = async () => {
    const stepContext = STEP_CONTEXT[currentStep];
    const fullContext = `Etapa: ${stepContext.title}. ${contexto}`;

    if (uploadedImage) {
      await analisarImagem(uploadedImage, fullContext);
    } else if (contexto.trim()) {
      await analisarTexto(contexto, fullContext);
    } else {
      toast.error("Forneça uma imagem ou descrição para análise");
    }
  };

  const handleApplyToDescricao = () => {
    if (!resultado || !onUpdateDescricao) return;
    
    const updates: Partial<AEPDescricaoAtividade> = {};
    
    // Gerar descrição baseada nos riscos identificados
    if (resultado.resumoGeral) {
      updates.descricaoGeral = resultado.resumoGeral;
    }
    
    // Extrair informações de postura dos riscos físicos
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

  const stepInfo = STEP_CONTEXT[currentStep];
  const showForStep = currentStep >= 2 && currentStep <= 5;

  if (!showForStep) return null;

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
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
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
                {/* Upload Area */}
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                    uploadedImage && "border-success bg-success/5"
                  )}
                >
                  <input {...getInputProps()} />
                  {uploadedImage ? (
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="text-sm text-success">{uploadedFileName}</span>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadedImage(null);
                          setUploadedFileName(null);
                        }}
                      >
                        Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex gap-2">
                        <Upload className="h-5 w-5 text-muted-foreground" />
                        <Camera className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Arraste uma foto do posto de trabalho ou clique para selecionar
                      </p>
                    </div>
                  )}
                </div>

                {/* Context Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Contexto adicional (opcional)
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
                  disabled={isAnalyzing || (!uploadedImage && !contexto.trim())}
                  className="w-full gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analisando com IA...
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

import { useState } from "react";
import {
  Sparkles, ChevronRight, ChevronLeft, Send, Save,
  AlertTriangle, Flame, Battery, FileText,
  BookOpen, Target, User, Briefcase,
  Calendar, CheckCircle2, TrendingUp, Loader2,
} from "lucide-react";
import { GerarPdiModal } from "./GerarPdiModal";
import { EvidenciasPanel } from "./EvidenciasPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAvaliacoes } from "@/hooks/useAvaliacoes";
import { useAvaliacaoEvidencias } from "@/hooks/useAvaliacaoEvidencias";
import type { AvaliacaoResposta, NotasCriterios, Categoria, Criterio } from "@/types/avaliacao";

// =========================================================
// DIMENSÕES FIXAS (fallback quando template não tem dimensões)
// =========================================================
const DIMENSOES_PADRAO = [
  {
    id: "entrega", nome: "Entrega e Qualidade", descricao: "Performance técnica e resultados",
    icon: Target, color: "text-primary", bgColor: "bg-primary/10",
    criterios: [
      { id: "e1", nome: "Qualidade da entrega", descricao: "Nível de qualidade das entregas realizadas", categoria: "entrega", peso: 1 },
      { id: "e2", nome: "Cumprimento de prazos", descricao: "Pontualidade na entrega das demandas", categoria: "entrega", peso: 1 },
      { id: "e3", nome: "Padrão técnico", descricao: "Domínio técnico demonstrado no trabalho", categoria: "entrega", peso: 1 },
      { id: "e4", nome: "Retrabalho / erros", descricao: "Frequência de correções necessárias (inverso)", categoria: "entrega", peso: 1 },
    ],
  },
  {
    id: "competencias", nome: "Competências", descricao: "Função e comportamento",
    icon: Briefcase, color: "text-info", bgColor: "bg-info/10",
    criterios: [
      { id: "c1", nome: "Competências técnicas", descricao: "Domínio do conhecimento técnico da função", categoria: "competencias", peso: 1 },
      { id: "c2", nome: "Competências comportamentais", descricao: "Soft skills e relações interpessoais", categoria: "competencias", peso: 1 },
      { id: "c3", nome: "Aderência a POPs/manuais", descricao: "Seguimento de procedimentos padronizados", categoria: "competencias", peso: 1 },
    ],
  },
  {
    id: "evolucao", nome: "Evolução e Aprendizado", descricao: "Desenvolvimento contínuo",
    icon: BookOpen, color: "text-success", bgColor: "bg-success/10",
    criterios: [
      { id: "ev1", nome: "Adesão a trilhas", descricao: "Participação em treinamentos e capacitações", categoria: "evolucao", peso: 1 },
      { id: "ev2", nome: "Progresso em PDI", descricao: "Evolução nas metas de desenvolvimento individual", categoria: "evolucao", peso: 1 },
      { id: "ev3", nome: "Conclusão de onboarding", descricao: "Integração completa quando aplicável", categoria: "evolucao", peso: 1 },
    ],
  },
  {
    id: "contexto", nome: "Contexto de Trabalho", descricao: "Ergonomia cognitiva + risco humano",
    icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/10",
    criterios: [
      { id: "cx1", nome: "Sobrecarga percebida", descricao: "Nível de carga de trabalho adequado", categoria: "contexto", peso: 1 },
      { id: "cx2", nome: "Clareza de papel", descricao: "Compreensão clara das responsabilidades", categoria: "contexto", peso: 1 },
      { id: "cx3", nome: "Autonomia", descricao: "Grau de autonomia para decisões operacionais", categoria: "contexto", peso: 1 },
      { id: "cx4", nome: "Pausas e jornada", descricao: "Adequação da jornada e intervalos", categoria: "contexto", peso: 1 },
    ],
  },
];

const ESCALA_LABELS: Record<number, string> = {
  1: "Insuficiente",
  2: "Em Desenvolvimento",
  3: "Atende",
  4: "Supera",
  5: "Excepcional",
};

function EscalaRating({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <Tooltip key={n}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange(n)}
              className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                n === value
                  ? "bg-primary text-primary-foreground shadow-md scale-110"
                  : "bg-muted hover:bg-muted-foreground/10 text-muted-foreground"
              }`}
            >
              {n}
            </button>
          </TooltipTrigger>
          <TooltipContent>{ESCALA_LABELS[n] || n}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function RiscoIndicator({ nivel, label, icon: Icon }: { nivel: string | null; label: string; icon: typeof Flame }) {
  if (!nivel) return null;
  const colors: Record<string, string> = {
    baixo: "bg-success/10 text-success",
    moderado: "bg-warning/10 text-warning",
    alto: "bg-destructive/10 text-destructive",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${colors[nivel] || "bg-muted"}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}: {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
    </div>
  );
}

// =========================================================
// COMPONENTE PRINCIPAL
// =========================================================
interface AvaliacaoFormularioProps {
  resposta?: AvaliacaoResposta;
  onConcluir?: () => void;
}

export function AvaliacaoFormulario({ resposta, onConcluir }: AvaliacaoFormularioProps) {
  const { updateResposta, submitResposta, isSubmittingResposta } = useAvaliacoes();
  const { data: evidencias } = useAvaliacaoEvidencias(
    resposta?.avaliado_id || null,
    resposta?.ciclo?.data_inicio,
    resposta?.ciclo?.data_fim,
  );

  // Derivar dimensões do template ou usar padrão
  const template = resposta?.ciclo?.template;
  const criteriosTemplate = (template?.criterios as unknown as Criterio[]) || [];
  const categoriasTemplate = (template?.categorias as unknown as Categoria[]) || [];

  const dimensoes = categoriasTemplate.length > 0
    ? categoriasTemplate.map(cat => {
        const DimIcon = DIMENSOES_PADRAO.find(d => d.id === cat.id)?.icon || Target;
        const dimColor = DIMENSOES_PADRAO.find(d => d.id === cat.id)?.color || "text-primary";
        const dimBg = DIMENSOES_PADRAO.find(d => d.id === cat.id)?.bgColor || "bg-primary/10";
        return {
          id: cat.id,
          nome: cat.nome,
          descricao: cat.descricao || "",
          icon: DimIcon,
          color: dimColor,
          bgColor: dimBg,
          criterios: criteriosTemplate.filter(c => c.categoria === cat.id),
        };
      })
    : DIMENSOES_PADRAO;

  const escalaMin = template?.escala_min || 1;
  const escalaMax = template?.escala_max || 5;

  const [currentStep, setCurrentStep] = useState(0);
  const [notas, setNotas] = useState<Record<string, number>>(() => {
    return (resposta?.notas_criterios as NotasCriterios) || {};
  });
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [resumo, setResumo] = useState(resposta?.comentario_geral || "");
  const [pontosFortes, setPontosFortes] = useState(resposta?.pontos_fortes || "");
  const [areasDesenvolvimento, setAreasDesenvolvimento] = useState(resposta?.areas_desenvolvimento || "");
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showGerarPdi, setShowGerarPdi] = useState(false);
  const [avaliacaoConcluida, setAvaliacaoConcluida] = useState(false);

  const isLastStep = currentStep === dimensoes.length;
  const totalCriterios = dimensoes.reduce((acc, d) => acc + d.criterios.length, 0);
  const criteriosPreenchidos = Object.keys(notas).filter(k => notas[k] > 0).length;
  const progressoGeral = totalCriterios > 0 ? Math.round((criteriosPreenchidos / totalCriterios) * 100) : 0;

  const needsJustification = (criterioId: string) => {
    const nota = notas[criterioId];
    return nota === escalaMin || nota === escalaMax;
  };

  // Auto-save ao mudar de step
  const handleSave = async () => {
    if (!resposta?.id) return;
    setIsSaving(true);
    try {
      await updateResposta({
        id: resposta.id,
        notas_criterios: notas,
        comentario_geral: resumo,
        pontos_fortes: pontosFortes,
        areas_desenvolvimento: areasDesenvolvimento,
        status: "em_andamento",
        data_inicio: resposta.data_inicio || new Date().toISOString(),
      });
    } catch (e) {
      // silencioso — toast já exibido pelo hook
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStep = async () => {
    await handleSave();
    setCurrentStep(s => Math.min(s + 1, dimensoes.length));
  };

  const handlePrevStep = () => setCurrentStep(s => Math.max(s - 1, 0));

  const handleGenerateIA = async () => {
    if (!resposta) return;
    setIsGeneratingIA(true);
    try {
      const { data, error } = await import("@/integrations/supabase/client").then(m =>
        m.supabase.functions.invoke("avaliacao-ia-rascunho", {
          body: {
            colaboradorNome: resposta.avaliado_nome,
            notas,
            evidencias,
            dimensoes: dimensoes.map(d => ({ id: d.id, nome: d.nome, criterios: d.criterios })),
          },
        })
      );
      if (error) throw error;
      if (data?.pontos_fortes) setPontosFortes(data.pontos_fortes);
      if (data?.areas_desenvolvimento) setAreasDesenvolvimento(data.areas_desenvolvimento);
      if (data?.resumo) setResumo(data.resumo);
      toast.success("Rascunho gerado pela IA — revise e ajuste conforme necessário");
    } catch (e) {
      toast.error("Erro ao gerar rascunho. Tente novamente.");
    } finally {
      setIsGeneratingIA(false);
    }
  };

  const handleSubmit = async () => {
    if (!resposta?.id) return;
    // Verificar justificativas obrigatórias
    const faltandoJustificativa = dimensoes.flatMap(d => d.criterios).filter(c =>
      needsJustification(c.id) && !justificativas[c.id]?.trim()
    );
    if (faltandoJustificativa.length > 0) {
      toast.error(`Justificativa obrigatória para: ${faltandoJustificativa.map(c => c.nome).join(", ")}`);
      return;
    }
    await submitResposta({
      id: resposta.id,
      notas_criterios: notas,
      nota_geral: totalCriterios > 0
        ? Math.round((Object.values(notas).reduce((a, b) => a + b, 0) / Object.keys(notas).length) * 10) / 10
        : undefined,
      comentario_geral: resumo,
      pontos_fortes: pontosFortes,
      areas_desenvolvimento: areasDesenvolvimento,
    });
    // Após concluir, abrir modal para gerar PDI com IA
    setAvaliacaoConcluida(true);
    setShowGerarPdi(true);
  };

  // Se não há resposta selecionada, mostrar seletor de avaliações
  if (!resposta) {
    return <SeletorAvaliacao />;
  }

  const dimensaoAtual = dimensoes[currentStep];
  const risco = evidencias?.risco;

  return (
    <>
      {/* Modal Gerar PDI com IA */}
      {showGerarPdi && resposta && (
        <GerarPdiModal
          open={showGerarPdi}
          onOpenChange={(v) => {
            setShowGerarPdi(v);
            if (!v && avaliacaoConcluida) onConcluir?.();
          }}
          resposta={resposta}
          notas={notas}
          dimensoes={dimensoes.map(d => ({ id: d.id, nome: d.nome, criterios: d.criterios }))}
          colaboradorCargo={undefined}
          colaboradorDepartamento={undefined}
          onPdiGerado={() => {
            setShowGerarPdi(false);
            onConcluir?.();
          }}
        />
      )}
    <div className="space-y-4">
      {/* Alertas de Risco Humano */}
      {(risco?.burnout || risco?.boreout) && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Alertas de Risco Humano
                <Badge variant="outline" className="text-[10px]">⚠️ Não diagnóstico</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <RiscoIndicator nivel={risco.burnout} label="Burnout" icon={Flame} />
                <RiscoIndicator nivel={risco.boreout} label="Boreout" icon={Battery} />
              </div>
            </div>
            {risco.irp !== null && (
              <p className="text-xs text-muted-foreground mt-1">
                IRP Psicossocial: <strong>{risco.irp}</strong>
                {risco.campanha_nome && ` • Campanha: ${risco.campanha_nome}`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Layout: Formulário + Evidências */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Formulário */}
        <div className="lg:col-span-2 space-y-4">
          {/* Cabeçalho do colaborador */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{resposta.avaliado_nome}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{resposta.ciclo?.nome}</span>
                    <Badge variant="outline" className="capitalize">{resposta.tipo_avaliador}</Badge>
                  </div>
                </div>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-medium">{progressoGeral}%</span>
                </div>
                <Progress value={progressoGeral} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Tabs de dimensões */}
          <Card>
            <CardContent className="p-0">
              <div className="flex border-b overflow-x-auto">
                {dimensoes.map((dim, idx) => {
                  const DimIcon = dim.icon;
                  const dimNotas = dim.criterios.filter(c => notas[c.id] !== undefined && notas[c.id] > 0).length;
                  const isComplete = dimNotas === dim.criterios.length;
                  return (
                    <button key={dim.id} onClick={() => setCurrentStep(idx)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        currentStep === idx ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <DimIcon className={`h-4 w-4 ${currentStep === idx ? dim.color : ""}`} />
                      <span className="hidden sm:inline">{dim.nome}</span>
                      {isComplete && <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-success/20 text-success">✓</Badge>}
                      {!isComplete && dimNotas > 0 && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{dimNotas}/{dim.criterios.length}</Badge>}
                    </button>
                  );
                })}
                <button onClick={() => setCurrentStep(dimensoes.length)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    currentStep === dimensoes.length ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Resumo</span>
                </button>
              </div>

              <div className="p-6">
                {!isLastStep && dimensaoAtual && (
                  <div className="space-y-6">
                    <div className={`p-3 rounded-lg ${dimensaoAtual.bgColor}`}>
                      <h3 className={`font-semibold ${dimensaoAtual.color}`}>{dimensaoAtual.nome}</h3>
                      <p className="text-sm text-muted-foreground">{dimensaoAtual.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ⚠️ Notas {escalaMin} ou {escalaMax} exigem justificativa obrigatória
                      </p>
                    </div>

                    {dimensaoAtual.criterios.map(criterio => (
                      <div key={criterio.id} className="space-y-2">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div>
                            <Label className="font-medium">{criterio.nome}</Label>
                            {criterio.descricao && <p className="text-xs text-muted-foreground">{criterio.descricao}</p>}
                          </div>
                          <EscalaRating
                            value={notas[criterio.id] || 0}
                            onChange={v => setNotas(prev => ({ ...prev, [criterio.id]: v }))}
                            max={escalaMax}
                          />
                        </div>
                        {needsJustification(criterio.id) && (
                          <Textarea
                            placeholder={`Justifique a nota ${notas[criterio.id]} (obrigatório)...`}
                            value={justificativas[criterio.id] || ""}
                            onChange={e => setJustificativas(prev => ({ ...prev, [criterio.id]: e.target.value }))}
                            rows={2}
                            className="border-warning/40"
                          />
                        )}
                        <Separator />
                      </div>
                    ))}

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={handlePrevStep} disabled={currentStep === 0} className="gap-2">
                        <ChevronLeft className="h-4 w-4" /> Anterior
                      </Button>
                      <Button onClick={handleNextStep} className="gap-2">
                        Próximo <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {isLastStep && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Resumo Final</h3>
                        <p className="text-sm text-muted-foreground">Sintetize os pontos principais da avaliação</p>
                      </div>
                      <Button variant="outline" onClick={handleGenerateIA} disabled={isGeneratingIA} className="gap-2">
                        <Sparkles className="h-4 w-4" />
                        {isGeneratingIA ? "Gerando..." : "Gerar com IA"}
                      </Button>
                    </div>

                    {isGeneratingIA && (
                      <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analisando evidências e gerando rascunho...
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label>Pontos Fortes</Label>
                        <Textarea value={pontosFortes} onChange={e => setPontosFortes(e.target.value)} rows={3}
                          placeholder="Descreva os principais pontos fortes..." />
                      </div>
                      <div>
                        <Label>Áreas de Desenvolvimento</Label>
                        <Textarea value={areasDesenvolvimento} onChange={e => setAreasDesenvolvimento(e.target.value)} rows={3}
                          placeholder="Indique as áreas que precisam de desenvolvimento..." />
                      </div>
                      <div>
                        <Label>Resumo Geral</Label>
                        <Textarea value={resumo} onChange={e => setResumo(e.target.value)} rows={4}
                          placeholder="Resumo consolidado da avaliação..." />
                      </div>
                    </div>

                    {/* Resumo de notas */}
                    <div className="border rounded-lg p-4 space-y-2">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" /> Visão geral das notas
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {dimensoes.map(dim => {
                          const notasDim = dim.criterios.map(c => notas[c.id]).filter(Boolean);
                          const media = notasDim.length > 0 ? (notasDim.reduce((a, b) => a + b, 0) / notasDim.length).toFixed(1) : "—";
                          return (
                            <div key={dim.id} className="flex items-center justify-between text-sm p-2 bg-muted/40 rounded">
                              <span className="text-muted-foreground truncate">{dim.nome}</span>
                              <span className="font-bold ml-2">{media}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <Button variant="outline" onClick={handlePrevStep} className="gap-2">
                        <ChevronLeft className="h-4 w-4" /> Anterior
                      </Button>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSave} disabled={isSaving} className="gap-2">
                          <Save className="h-4 w-4" />
                          {isSaving ? "Salvando..." : "Salvar Rascunho"}
                        </Button>
                        <Button onClick={handleSubmit} disabled={isSubmittingResposta} className="gap-2">
                          <Send className="h-4 w-4" />
                          {isSubmittingResposta ? "Enviando..." : "Concluir Avaliação"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Painel lateral de evidências */}
        <div className="lg:col-span-1">
          <PainelEvidencias
            colaboradorId={resposta.avaliado_id}
            dataInicio={resposta.ciclo?.data_inicio}
            dataFim={resposta.ciclo?.data_fim}
          />
        </div>
      </div>
    </div>
    </>
  );
}

// =========================================================
// SELETOR DE AVALIAÇÕES (quando não há resposta pré-selecionada)
// =========================================================
function SeletorAvaliacao() {
  const { minhasAvaliacoes, isLoadingMinhasAvaliacoes } = useAvaliacoes();
  const [selected, setSelected] = useState<AvaliacaoResposta | null>(null);

  if (selected) {
    return <AvaliacaoFormulario resposta={selected} onConcluir={() => setSelected(null)} />;
  }

  if (isLoadingMinhasAvaliacoes) {
    return (
      <Card><CardContent className="p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
      </CardContent></Card>
    );
  }

  if (minhasAvaliacoes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-muted rounded-full"><CheckCircle2 className="h-8 w-8 text-muted-foreground" /></div>
            <div>
              <h3 className="font-semibold text-lg">Nenhuma avaliação pendente</h3>
              <p className="text-muted-foreground text-sm">Você não tem avaliações para responder no momento.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Selecione uma avaliação para responder</h2>
        <p className="text-sm text-muted-foreground">Você tem {minhasAvaliacoes.length} avaliação(ões) pendente(s)</p>
      </div>
      <div className="grid gap-3">
        {minhasAvaliacoes.map(av => (
          <Card key={av.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelected(av)}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="capitalize">{av.tipo_avaliador}</Badge>
                  <Badge variant={av.status === "pendente" ? "secondary" : "default"}>
                    {av.status === "pendente" ? "Não iniciada" : "Em andamento"}
                  </Badge>
                </div>
                <p className="font-semibold">Avaliar: {av.avaliado_nome}</p>
                <p className="text-sm text-muted-foreground">{av.ciclo?.nome}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

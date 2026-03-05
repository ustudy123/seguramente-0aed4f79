import { useState } from "react";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Send,
  Save,
  AlertTriangle,
  Flame,
  Battery,
  FileText,
  MessageSquare,
  BookOpen,
  Target,
  Clock,
  User,
  Building,
  Briefcase,
  Calendar,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

// Demo data for visualization
const demoColaborador = {
  nome: "Mariana Silva",
  funcao: "Analista de SST",
  setor: "Segurança do Trabalho",
  unidade: "Matriz - São Paulo",
  gestor: "Roberto Lima",
  tempoEmpresa: "2 anos e 4 meses",
  ciclo: "2026 – Semestre 1",
  foto: "/avatars/mariana-silva.jpg",
};

const DIMENSOES = [
  {
    id: "entrega",
    nome: "Entrega e Qualidade",
    descricao: "Performance técnica e resultados",
    icon: Target,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    criterios: [
      { id: "e1", nome: "Qualidade da entrega", descricao: "Nível de qualidade das entregas realizadas" },
      { id: "e2", nome: "Cumprimento de prazos", descricao: "Pontualidade na entrega das demandas" },
      { id: "e3", nome: "Padrão técnico", descricao: "Domínio técnico demonstrado no trabalho" },
      { id: "e4", nome: "Retrabalho / erros", descricao: "Frequência de correções necessárias (inverso)" },
    ],
  },
  {
    id: "competencias",
    nome: "Competências",
    descricao: "Função e comportamento",
    icon: Briefcase,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    criterios: [
      { id: "c1", nome: "Competências técnicas", descricao: "Domínio do conhecimento técnico da função" },
      { id: "c2", nome: "Competências comportamentais", descricao: "Soft skills e relações interpessoais" },
      { id: "c3", nome: "Aderência a POPs/manuais", descricao: "Seguimento de procedimentos padronizados" },
    ],
  },
  {
    id: "evolucao",
    nome: "Evolução e Aprendizado",
    descricao: "Desenvolvimento contínuo",
    icon: BookOpen,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    criterios: [
      { id: "ev1", nome: "Adesão a trilhas", descricao: "Participação em treinamentos e capacitações" },
      { id: "ev2", nome: "Progresso em PDI", descricao: "Evolução nas metas de desenvolvimento individual" },
      { id: "ev3", nome: "Conclusão de onboarding", descricao: "Integração completa quando aplicável" },
    ],
  },
  {
    id: "contexto",
    nome: "Contexto de Trabalho",
    descricao: "Ergonomia cognitiva + risco humano",
    icon: AlertTriangle,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    criterios: [
      { id: "cx1", nome: "Sobrecarga percebida", descricao: "Nível de carga de trabalho adequado" },
      { id: "cx2", nome: "Clareza de papel", descricao: "Compreensão clara das responsabilidades" },
      { id: "cx3", nome: "Autonomia", descricao: "Grau de autonomia para decisões operacionais" },
      { id: "cx4", nome: "Pausas e jornada", descricao: "Adequação da jornada e intervalos" },
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

const demoEvidencias = {
  feedbacks: [
    { tipo: "positivo", texto: "Excelente condução do DDS sobre riscos elétricos", data: "2026-01-15", autor: "Roberto Lima" },
    { tipo: "positivo", texto: "Proatividade na revisão do PPRA", data: "2025-12-10", autor: "Paulo Nascimento" },
    { tipo: "neutro", texto: "Alinhamento sobre o novo PGR", data: "2025-11-20", autor: "Roberto Lima" },
  ],
  metas: [
    { titulo: "Reduzir incidentes em 20%", progresso: 75, status: "em_andamento" },
    { titulo: "Implementar 3 POPs novos", progresso: 100, status: "concluida" },
  ],
  trilhas: [
    { nome: "NR-17 Ergonomia Cognitiva", concluida: true },
    { nome: "Gestão de Riscos Psicossociais", concluida: true },
    { nome: "Liderança em SST", concluida: false },
  ],
  ocorrencias: [] as { tipo: string; descricao: string }[],
  acoes: [
    { titulo: "Revisão AEP Setor Administrativo", status: "concluida" },
    { titulo: "Mapeamento de riscos NR-12", status: "em_andamento" },
  ],
};

const demoAlertasRisco = {
  burnout: "moderado" as const,
  boreout: "baixo" as const,
  psicossocial: { irp: 2.1, texto: "Setor com IRP dentro da normalidade" },
  ergonomia: { clareza: 85, complexidade: "média" },
};

function EscalaRating({
  value,
  onChange,
  max = 5,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
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
          <TooltipContent>{ESCALA_LABELS[n]}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function RiscoIndicator({ nivel, label, icon: Icon }: { nivel: string; label: string; icon: typeof Flame }) {
  const colors: Record<string, string> = {
    baixo: "bg-green-100 text-green-700",
    moderado: "bg-amber-100 text-amber-700",
    alto: "bg-red-100 text-red-700",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${colors[nivel] || "bg-muted"}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}: {nivel.charAt(0).toUpperCase() + nivel.slice(1)}
    </div>
  );
}

export function AvaliacaoFormulario() {
  const [currentStep, setCurrentStep] = useState(0);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [resumo, setResumo] = useState("");
  const [pontosFortes, setPontosFortes] = useState("");
  const [areasDesenvolvimento, setAreasDesenvolvimento] = useState("");
  const [isGeneratingIA, setIsGeneratingIA] = useState(false);
  const [evidenciaTab, setEvidenciaTab] = useState("feedbacks");

  const dimensaoAtual = DIMENSOES[currentStep];
  const isLastStep = currentStep === DIMENSOES.length;
  const totalCriterios = DIMENSOES.reduce((acc, d) => acc + d.criterios.length, 0);
  const criteriosPreenchidos = Object.keys(notas).length;
  const progressoGeral = Math.round((criteriosPreenchidos / totalCriterios) * 100);

  const needsJustification = (criterioId: string) => {
    const nota = notas[criterioId];
    return nota === 1 || nota === 5;
  };

  const handleGenerateIA = async () => {
    setIsGeneratingIA(true);
    await new Promise((r) => setTimeout(r, 2000));
    setPontosFortes(
      "Mariana demonstra domínio técnico sólido, especialmente na condução de análises ergonômicas e revisões de PGR. Destaca-se pela proatividade na implementação de POPs e pela adesão exemplar às trilhas de desenvolvimento."
    );
    setAreasDesenvolvimento(
      "Recomenda-se investir em competências de liderança para prepará-la para futuras responsabilidades de gestão. A sobrecarga percebida moderada sugere revisão da distribuição de demandas no setor."
    );
    setResumo(
      "Mariana apresenta desempenho acima da média, com entregas consistentes e evolução contínua. O contexto de trabalho está adequado, mas há sinais de sobrecarga que merecem atenção preventiva. Recomenda-se PDI focado em liderança e redistribuição parcial de atividades."
    );
    setIsGeneratingIA(false);
    toast.success("Rascunho gerado pela IA — revise e ajuste conforme necessário");
  };

  return (
    <div className="space-y-4">
      {/* Risk Alerts */}
      <Card className="border-amber-200 bg-amber-50/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Alertas de Risco Humano
            </div>
            <div className="flex flex-wrap gap-2">
              <RiscoIndicator nivel={demoAlertasRisco.burnout} label="Burnout" icon={Flame} />
              <RiscoIndicator nivel={demoAlertasRisco.boreout} label="Boreout" icon={Battery} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {demoAlertasRisco.psicossocial.texto} • Clareza de papéis: {demoAlertasRisco.ergonomia.clareza}% • Complexidade cognitiva: {demoAlertasRisco.ergonomia.complexidade}
          </p>
        </CardContent>
      </Card>

      {/* Main content: Form + Evidence sidebar */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                  <img src={demoColaborador.foto} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{demoColaborador.nome}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{demoColaborador.funcao}</span>
                    <span className="flex items-center gap-1"><Building className="h-3.5 w-3.5" />{demoColaborador.setor}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{demoColaborador.tempoEmpresa}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{demoColaborador.ciclo}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progresso da avaliação</span>
                  <span className="font-medium">{progressoGeral}%</span>
                </div>
                <Progress value={progressoGeral} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Dimension tabs */}
          <Card>
            <CardContent className="p-0">
              <div className="flex border-b overflow-x-auto">
                {DIMENSOES.map((dim, idx) => {
                  const DimIcon = dim.icon;
                  const dimNotas = dim.criterios.filter((c) => notas[c.id] !== undefined).length;
                  const isComplete = dimNotas === dim.criterios.length;
                  return (
                    <button
                      key={dim.id}
                      onClick={() => setCurrentStep(idx)}
                      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                        currentStep === idx
                          ? "border-primary text-primary"
                          : "border-transparent text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <DimIcon className={`h-4 w-4 ${currentStep === idx ? dim.color : ""}`} />
                      <span className="hidden sm:inline">{dim.nome}</span>
                      {isComplete && <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-green-100 text-green-700">✓</Badge>}
                      {!isComplete && dimNotas > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{dimNotas}/{dim.criterios.length}</Badge>
                      )}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentStep(DIMENSOES.length)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    currentStep === DIMENSOES.length
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Resumo Final</span>
                </button>
              </div>

              <div className="p-6">
                {!isLastStep && dimensaoAtual && (
                  <div className="space-y-6">
                    <div className={`p-3 rounded-lg ${dimensaoAtual.bgColor}`}>
                      <h3 className={`font-semibold ${dimensaoAtual.color}`}>{dimensaoAtual.nome}</h3>
                      <p className="text-sm text-muted-foreground">{dimensaoAtual.descricao}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        ⚠️ Notas 1 ou 5 exigem justificativa obrigatória
                      </p>
                    </div>

                    {dimensaoAtual.criterios.map((criterio) => (
                      <div key={criterio.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="font-medium">{criterio.nome}</Label>
                            <p className="text-xs text-muted-foreground">{criterio.descricao}</p>
                          </div>
                          <EscalaRating
                            value={notas[criterio.id] || 0}
                            onChange={(v) => setNotas((prev) => ({ ...prev, [criterio.id]: v }))}
                          />
                        </div>
                        {needsJustification(criterio.id) && (
                          <Textarea
                            placeholder={`Justifique a nota ${notas[criterio.id]} (obrigatório)...`}
                            value={justificativas[criterio.id] || ""}
                            onChange={(e) => setJustificativas((prev) => ({ ...prev, [criterio.id]: e.target.value }))}
                            rows={2}
                            className="border-amber-300"
                          />
                        )}
                        <Separator />
                      </div>
                    ))}
                  </div>
                )}

                {isLastStep && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Resumo Final</h3>
                        <p className="text-sm text-muted-foreground">Sintetize os pontos principais da avaliação</p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleGenerateIA}
                        disabled={isGeneratingIA}
                        className="gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        {isGeneratingIA ? "Gerando..." : "Gerar Rascunho IA"}
                      </Button>
                    </div>

                    {isGeneratingIA && (
                      <div className="p-4 bg-muted/50 rounded-lg text-center">
                        <div className="animate-pulse flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Sparkles className="h-4 w-4 animate-spin" />
                          Analisando evidências e gerando rascunho...
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div>
                        <Label>Pontos Fortes</Label>
                        <Textarea
                          value={pontosFortes}
                          onChange={(e) => setPontosFortes(e.target.value)}
                          rows={3}
                          placeholder="Descreva os principais pontos fortes do colaborador..."
                        />
                      </div>
                      <div>
                        <Label>Áreas de Desenvolvimento</Label>
                        <Textarea
                          value={areasDesenvolvimento}
                          onChange={(e) => setAreasDesenvolvimento(e.target.value)}
                          rows={3}
                          placeholder="Indique as áreas que precisam de desenvolvimento..."
                        />
                      </div>
                      <div>
                        <Label>Resumo Geral</Label>
                        <Textarea
                          value={resumo}
                          onChange={(e) => setResumo(e.target.value)}
                          rows={4}
                          placeholder="Resumo da avaliação, incluindo recomendações de PDI e trilhas..."
                        />
                      </div>
                      {(pontosFortes || areasDesenvolvimento || resumo) && (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="h-3 w-3" />
                          Assistido por IA — revise antes de enviar
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep((p) => Math.max(0, p - 1))}
                  disabled={currentStep === 0}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-1" onClick={() => toast.success("Rascunho salvo")}>
                    <Save className="h-4 w-4" />
                    Salvar Rascunho
                  </Button>
                  {isLastStep ? (
                    <Button className="gap-1" onClick={() => toast.success("Avaliação enviada com sucesso!")}>
                      <Send className="h-4 w-4" />
                      Enviar Avaliação
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setCurrentStep((p) => Math.min(DIMENSOES.length, p + 1))}
                      className="gap-1"
                    >
                      Próximo
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Post-evaluation actions */}
          {isLastStep && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ações Pós-Avaliação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Redirecionando para criação de PDI...")}>
                    <Target className="h-3.5 w-3.5" />
                    Gerar/Atualizar PDI
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Redirecionando para criar ação 5W2H...")}>
                    <FileText className="h-3.5 w-3.5" />
                    Criar Ação 5W2H
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Redirecionando para atribuir trilha...")}>
                    <BookOpen className="h-3.5 w-3.5" />
                    Atribuir Trilha
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Redirecionando para criar meta SMART...")}>
                    <Target className="h-3.5 w-3.5" />
                    Criar Meta SMART
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Todas as ações criadas terão origem rastreável: "Avaliação de Desempenho – {demoColaborador.ciclo}"
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Evidence sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Evidências do Período
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={evidenciaTab} onValueChange={setEvidenciaTab}>
                <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
                  <TabsTrigger value="feedbacks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2">
                    Feedbacks
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{demoEvidencias.feedbacks.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="metas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2">
                    Metas
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{demoEvidencias.metas.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="trilhas" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2">
                    Trilhas
                  </TabsTrigger>
                  <TabsTrigger value="acoes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs px-3 py-2">
                    Ações
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="feedbacks" className="p-3 space-y-2 mt-0">
                  {demoEvidencias.feedbacks.map((fb, i) => (
                    <div key={i} className="p-2.5 bg-muted/50 rounded-lg space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${
                            fb.tipo === "positivo" ? "bg-green-100 text-green-700" :
                            fb.tipo === "negativo" ? "bg-red-100 text-red-700" :
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {fb.tipo}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{fb.data}</span>
                      </div>
                      <p className="text-xs">{fb.texto}</p>
                      <p className="text-[10px] text-muted-foreground">por {fb.autor}</p>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    Anexar como evidência
                  </Button>
                </TabsContent>

                <TabsContent value="metas" className="p-3 space-y-2 mt-0">
                  {demoEvidencias.metas.map((m, i) => (
                    <div key={i} className="p-2.5 bg-muted/50 rounded-lg space-y-1.5">
                      <p className="text-xs font-medium">{m.titulo}</p>
                      <div className="flex items-center justify-between text-[10px]">
                        <Badge
                          variant="secondary"
                          className={m.status === "concluida" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}
                        >
                          {m.status === "concluida" ? "Concluída" : "Em andamento"}
                        </Badge>
                        <span>{m.progresso}%</span>
                      </div>
                      <Progress value={m.progresso} className="h-1" />
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="trilhas" className="p-3 space-y-2 mt-0">
                  {demoEvidencias.trilhas.map((t, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-xs">{t.nome}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${t.concluida ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}
                      >
                        {t.concluida ? "✓ Concluída" : "Pendente"}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="acoes" className="p-3 space-y-2 mt-0">
                  {demoEvidencias.acoes.map((a, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-xs">{a.titulo}</p>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${a.status === "concluida" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {a.status === "concluida" ? "Concluída" : "Em andamento"}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Psicossocial summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Indicadores Contextuais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">IRP Psicossocial (setor)</span>
                  <span className="font-medium">{demoAlertasRisco.psicossocial.irp}/4</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Clareza de papéis</span>
                  <span className="font-medium">{demoAlertasRisco.ergonomia.clareza}%</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Complexidade cognitiva</span>
                  <Badge variant="secondary" className="text-[10px]">{demoAlertasRisco.ergonomia.complexidade}</Badge>
                </div>
              </div>
              <Separator />
              <p className="text-[10px] text-muted-foreground">
                ⚠️ Estes indicadores são contextuais e não configuram diagnóstico clínico. Servem como sinalização para decisões de gestão.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Cog, Heart, BarChart3, Loader2, Expand, Trophy, TrendingUp, ShieldCheck, Wrench, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { IndicatorDetailModal, IndicatorType } from "./IndicatorDetailModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PilarSummary {
  id: number;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  scoreKey: "organizacao" | "condicoes" | "experiencia" | "governanca";
  color: string;
  bgColor: string;
  bgLight: string;
  indicatorType: IndicatorType;
  legenda: string;
  comoCalcula: string;
}

const pilares: PilarSummary[] = [
  {
    id: 1,
    title: "Organização do Trabalho",
    shortTitle: "Organização",
    icon: Brain,
    scoreKey: "organizacao",
    color: "text-primary",
    bgColor: "bg-primary",
    bgLight: "bg-primary/10",
    indicatorType: "organizacao",
    legenda: "Estrutura de cargos, departamentos e admissões.",
    comoCalcula: "Cargos definidos + departamentos + andamento de admissões.",
  },
  {
    id: 2,
    title: "Condições de Execução",
    shortTitle: "Condições",
    icon: Cog,
    scoreKey: "condicoes",
    color: "text-success",
    bgColor: "bg-success",
    bgLight: "bg-success/10",
    indicatorType: "condicoes",
    legenda: "Ambiente, EPIs e riscos ocupacionais.",
    comoCalcula: "NR-17 atendida (40%) + EPIs disponíveis (30%) + riscos mapeados (30%).",
  },
  {
    id: 3,
    title: "Experiência Humana",
    shortTitle: "Experiência",
    icon: Heart,
    scoreKey: "experiencia",
    color: "text-info",
    bgColor: "bg-info",
    bgLight: "bg-info/10",
    indicatorType: "experiencia",
    legenda: "Clima, escuta ativa e engajamento das pessoas.",
    comoCalcula: "Média dos sinais ativos: humor positivo, ouvidoria sem pendências e posts no feed.",
  },
  {
    id: 4,
    title: "Governança e Impacto",
    shortTitle: "Governança",
    icon: BarChart3,
    scoreKey: "governanca",
    color: "text-warning",
    bgColor: "bg-warning",
    bgLight: "bg-warning/10",
    indicatorType: "governanca",
    legenda: "Planos de ação, evidências e conformidade de terceiros.",
    comoCalcula: "Ações concluídas (40%) + evidências enviadas (30%) + terceiros conformes (30%).",
  },
];

export const PilaresSummaryLive = () => {
  const { data, isLoading } = useDashboardData();
  const [selectedIndicator, setSelectedIndicator] = useState<{
    type: IndicatorType;
    title: string;
    value: string | number;
  } | null>(null);

  const getScore = (key: PilarSummary["scoreKey"]) => {
    if (!data) return 0;
    return data[key].score;
  };

  const averageScore = data
    ? Math.round(
        (data.organizacao.score +
          data.condicoes.score +
          data.experiencia.score +
          data.governanca.score) /
          4
      )
    : 0;

  // Conta quantos pilares possuem dados significativos
  const pilaresComDados = data ? [
    data.organizacao.cargosDefinidos > 0 || data.organizacao.admissoesAndamento > 0,
    data.condicoes.itensNr17Total > 0 || data.condicoes.episDisponiveis > 0 || data.condicoes.riscosAtivos > 0,
    data.experiencia.humorTotal >= 3 || data.experiencia.ouvidoriaPendente > 0 || data.experiencia.feedPostsHoje > 0,
    data.governanca.acoesTotal > 0 || data.governanca.evidenciasEnviadas > 0 || data.governanca.terceirosAtivos > 0 || data.governanca.ptsBloqueadas > 0,
  ].filter(Boolean).length : 0;

  // Exige pelo menos 2 pilares com dados para mostrar o nível de maturidade
  const hasData = pilaresComDados >= 2;

  const getOverallLabel = (score: number) => {
    if (!hasData) return null;
    if (score >= 80) return { label: "Cultura Saudável", icon: Trophy, color: "text-success", bgColor: "bg-success/10" };
    if (score >= 60) return { label: "Estratégico", icon: TrendingUp, color: "text-primary", bgColor: "bg-primary/10" };
    if (score >= 40) return { label: "Preventivo", icon: ShieldCheck, color: "text-info", bgColor: "bg-info/10" };
    if (score >= 20) return { label: "Corretivo", icon: Wrench, color: "text-warning", bgColor: "bg-warning/10" };
    return { label: "Reativo", icon: AlertTriangle, color: "text-destructive", bgColor: "bg-destructive/10" };
  };

  const overall = getOverallLabel(averageScore);

  const handlePilarClick = (pilar: PilarSummary) => {
    const score = getScore(pilar.scoreKey);
    setSelectedIndicator({
      type: pilar.indicatorType,
      title: pilar.title,
      value: `${score}%`,
    });
  };

  const getPilarHasData = (key: PilarSummary["scoreKey"]) => {
    if (!data) return false;
    const p = data[key] as any;
    if (key === "organizacao") return p.cargosDefinidos > 0 || p.departamentos > 0 || p.admissoesAndamento > 0;
    if (key === "condicoes") return p.itensNr17Total > 0 || p.episDisponiveis > 0 || p.riscosAtivos > 0;
    if (key === "experiencia") return p.humorTotal > 0 || p.ouvidoriaPendente > 0 || p.feedPostsHoje > 0;
    if (key === "governanca") return p.acoesTotal > 0 || p.evidenciasEnviadas > 0 || p.terceirosAtivos > 0;
    return false;
  };

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 shadow-sm">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-card rounded-xl border border-border shadow-sm overflow-hidden"
      >
        {/* Header com gradiente sutil */}
        <div className="border-b border-border bg-muted/30 px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">
                Governança do Trabalho Humano
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Visão integrada dos 4 pilares estratégicos
              </p>
            </div>
            <div className="flex items-center gap-4">
              {overall && (
                <div className={cn("flex items-center gap-2 rounded-lg px-4 py-2.5", overall.bgColor)}>
                  <overall.icon className={cn("w-5 h-5", overall.color)} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Nível</p>
                    <p className={cn("text-sm font-bold -mt-0.5", overall.color)}>{overall.label}</p>
                  </div>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-muted/60 rounded-lg px-4 py-2.5 text-center min-w-[72px] cursor-help">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Score</p>
                    <p className="text-2xl font-extrabold text-foreground -mt-0.5 tabular-nums">{averageScore}%</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-center">
                  <p className="text-xs">Média ponderada dos 4 pilares estratégicos (Organização, Condições, Experiência e Governança). Quanto maior, mais madura a gestão do trabalho.</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Pilares Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {pilares.map((pilar, index) => {
            const score = getScore(pilar.scoreKey);
            const pilarHasData = getPilarHasData(pilar.scoreKey);
            return (
              <motion.button
                key={pilar.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => handlePilarClick(pilar)}
                className="group relative px-5 py-5 text-left hover:bg-muted/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* Expand hint */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Expand className="w-3.5 h-3.5 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-2.5 mb-4">
                  <div className={cn("p-2 rounded-lg", pilar.bgLight)}>
                    <pilar.icon className={cn("w-4 h-4", pilar.color)} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {pilar.shortTitle}
                  </span>
                </div>

                <div className="mb-1.5">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Maturidade</span>
                    <span className={cn("text-xl font-extrabold tabular-nums", pilarHasData ? pilar.color : "text-muted-foreground")}>
                      {pilarHasData ? `${score}%` : "—"}
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pilarHasData ? Math.max(score, 2) : 0}%` }}
                      transition={{ duration: 0.7, delay: 0.2 + index * 0.08 }}
                      className={cn("h-full rounded-full", pilar.bgColor)}
                    />
                  </div>
                </div>

                {/* Legenda explicativa */}
                <div className="mt-3 pt-3 border-t border-border/60 space-y-1">
                  <p className="text-[11px] leading-snug text-foreground/80">
                    {pilar.legenda}
                  </p>
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    <span className="font-semibold">Como é calculado:</span> {pilar.comoCalcula}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Detail Modal */}
      {selectedIndicator && (
        <IndicatorDetailModal
          open={!!selectedIndicator}
          onOpenChange={(open) => !open && setSelectedIndicator(null)}
          indicator={selectedIndicator.type}
          title={selectedIndicator.title}
          currentValue={selectedIndicator.value}
        />
      )}
    </>
  );
};

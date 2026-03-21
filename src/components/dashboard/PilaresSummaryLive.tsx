import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Cog, Heart, BarChart3, Loader2, Expand, Trophy, TrendingUp, ShieldCheck, Wrench, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/hooks/useDashboardData";
import { IndicatorDetailModal, IndicatorType } from "./IndicatorDetailModal";

interface PilarSummary {
  id: number;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  scoreKey: "organizacao" | "condicoes" | "experiencia" | "governanca";
  color: string;
  bgColor: string;
  indicatorType: IndicatorType;
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
    indicatorType: "organizacao",
  },
  {
    id: 2,
    title: "Condições de Execução",
    shortTitle: "Condições",
    icon: Cog,
    scoreKey: "condicoes",
    color: "text-success",
    bgColor: "bg-success",
    indicatorType: "condicoes",
  },
  {
    id: 3,
    title: "Experiência Humana",
    shortTitle: "Experiência",
    icon: Heart,
    scoreKey: "experiencia",
    color: "text-info",
    bgColor: "bg-info",
    indicatorType: "experiencia",
  },
  {
    id: 4,
    title: "Governança e Impacto",
    shortTitle: "Governança",
    icon: BarChart3,
    scoreKey: "governanca",
    color: "text-warning",
    bgColor: "bg-warning",
    indicatorType: "governanca",
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

  const getOverallLabel = (score: number) => {
    if (score >= 80) return { label: "Cultura Saudável", icon: Trophy, color: "text-success" };
    if (score >= 60) return { label: "Estratégico", icon: TrendingUp, color: "text-primary" };
    if (score >= 40) return { label: "Preventivo", icon: ShieldCheck, color: "text-info" };
    if (score >= 20) return { label: "Corretivo", icon: Wrench, color: "text-warning" };
    return { label: "Reativo", icon: AlertTriangle, color: "text-destructive" };
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

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-6 shadow-sm"
      >
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Governança do Trabalho Humano
            </h2>
            <p className="text-sm text-muted-foreground">
              Visão integrada dos 4 pilares estratégicos • Clique para detalhes
            </p>
          </div>
          <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
            <overall.icon className={cn("w-6 h-6", overall.color)} />
            <div>
              <p className="text-xs text-muted-foreground">Nível de Maturidade</p>
              <p className="font-bold text-foreground">{overall.label}</p>
            </div>
            <div className="ml-4 pl-4 border-l border-border">
              <p className="text-xs text-muted-foreground">Score Geral</p>
              <p className="text-2xl font-bold text-foreground">{averageScore}%</p>
            </div>
          </div>
        </div>

        {/* Pilares Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {pilares.map((pilar, index) => {
            const score = getScore(pilar.scoreKey);
            return (
              <motion.div
                key={pilar.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handlePilarClick(pilar)}
                className="group relative bg-card rounded-lg p-4 border border-border shadow-sm hover:shadow-lg transition-all cursor-pointer"
              >
                {/* Expand hint */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Expand className="w-4 h-4 text-muted-foreground" />
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("p-1.5 rounded-lg", pilar.bgColor)}>
                    <pilar.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {pilar.shortTitle}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Maturidade</span>
                    <span className={cn("text-lg font-bold", pilar.color)}>
                      {score}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                      className={cn("h-full rounded-full", pilar.bgColor)}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-1">
                  {pilar.title}
                </p>
              </motion.div>
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

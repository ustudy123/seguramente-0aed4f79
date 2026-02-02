import { motion } from "framer-motion";
import { Brain, Cog, Heart, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PilarSummary {
  id: number;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  score: number;
  color: string;
  bgColor: string;
}

const pilares: PilarSummary[] = [
  {
    id: 1,
    title: "Organização do Trabalho",
    shortTitle: "Organização",
    icon: Brain,
    score: 45,
    color: "text-[hsl(215,50%,23%)]",
    bgColor: "bg-[hsl(215,50%,23%)]",
  },
  {
    id: 2,
    title: "Condições de Execução",
    shortTitle: "Condições",
    icon: Cog,
    score: 70,
    color: "text-[hsl(145,55%,45%)]",
    bgColor: "bg-[hsl(145,55%,45%)]",
  },
  {
    id: 3,
    title: "Experiência Humana",
    shortTitle: "Experiência",
    icon: Heart,
    score: 40,
    color: "text-[hsl(280,55%,55%)]",
    bgColor: "bg-[hsl(280,55%,55%)]",
  },
  {
    id: 4,
    title: "Governança e Impacto",
    shortTitle: "Governança",
    icon: BarChart3,
    score: 35,
    color: "text-[hsl(38,92%,50%)]",
    bgColor: "bg-[hsl(38,92%,50%)]",
  },
];

export const PilaresSummary = () => {
  const averageScore = Math.round(
    pilares.reduce((acc, p) => acc + p.score, 0) / pilares.length
  );

  const getOverallLabel = (score: number) => {
    if (score >= 80) return { label: "Cultura Saudável", emoji: "🏆" };
    if (score >= 60) return { label: "Estratégico", emoji: "📈" };
    if (score >= 40) return { label: "Preventivo", emoji: "🛡️" };
    if (score >= 20) return { label: "Corretivo", emoji: "🔧" };
    return { label: "Reativo", emoji: "⚠️" };
  };

  const overall = getOverallLabel(averageScore);

  return (
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
            Visão integrada dos 4 pilares estratégicos
          </p>
        </div>
        <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
          <span className="text-2xl">{overall.emoji}</span>
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
        {pilares.map((pilar, index) => (
          <motion.div
            key={pilar.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1 }}
            className="group relative bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
          >
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
                  {pilar.score}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pilar.score}%` }}
                  transition={{ duration: 0.6, delay: 0.2 + index * 0.1 }}
                  className={cn("h-full rounded-full", pilar.bgColor)}
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-1">
              {pilar.title}
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

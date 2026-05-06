import { motion } from "framer-motion";
import { 
  Target, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { PlanoAcaoStats as StatsType, AcaoStatus } from "@/types/planoAcao";

interface PlanoAcaoStatsProps {
  stats: StatsType | undefined;
  isLoading: boolean;
  activeStatFilter?: string | null;
  onStatClick?: (key: string) => void;
}

const statCards = [
  {
    key: "total",
    label: "Total de Ações",
    icon: Target,
    iconColor: "text-indigo-50",
    gradient: "from-indigo-500 via-violet-500 to-purple-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(99,102,241,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(99,102,241,0.75)]",
    ring: "ring-indigo-300/60",
  },
  {
    key: "pendentes",
    label: "Pendentes",
    icon: Clock,
    iconColor: "text-amber-50",
    gradient: "from-amber-400 via-orange-500 to-orange-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(249,115,22,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(249,115,22,0.75)]",
    ring: "ring-amber-300/60",
  },
  {
    key: "em_andamento",
    label: "Em Andamento",
    icon: Activity,
    iconColor: "text-sky-50",
    gradient: "from-sky-500 via-blue-500 to-cyan-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(14,165,233,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(14,165,233,0.75)]",
    ring: "ring-sky-300/60",
  },
  {
    key: "atrasadas",
    label: "Atrasadas",
    icon: AlertTriangle,
    iconColor: "text-rose-50",
    gradient: "from-rose-500 via-red-500 to-pink-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(244,63,94,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(244,63,94,0.75)]",
    ring: "ring-rose-300/60",
  },
  {
    key: "concluidas",
    label: "Concluídas",
    icon: CheckCircle2,
    iconColor: "text-emerald-50",
    gradient: "from-emerald-500 via-green-500 to-teal-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(16,185,129,0.75)]",
    ring: "ring-emerald-300/60",
  },
];

export function PlanoAcaoStats({ stats, isLoading, activeStatFilter, onStatClick }: PlanoAcaoStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((_, idx) => (
          <Skeleton key={idx} className="h-24" />
        ))}
      </div>
    );
  }

  const taxaConclusao = stats?.total 
    ? Math.round((stats.concluidas / stats.total) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          const value = stats?.[card.key as keyof StatsType] ?? 0;
          const isActive = activeStatFilter === card.key;
          
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card 
                className={cn(
                  "hover:shadow-md transition-all cursor-pointer",
                  isActive && "ring-2 ring-primary shadow-md"
                )}
                onClick={() => onStatClick?.(card.key)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", card.bgColor)}>
                      <Icon className={cn("h-5 w-5", card.color)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{value as number}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Índice de Execução</span>
            </div>
            <span className="text-sm font-bold text-primary">{taxaConclusao}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${taxaConclusao}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats?.concluidas || 0} de {stats?.total || 0} ações concluídas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

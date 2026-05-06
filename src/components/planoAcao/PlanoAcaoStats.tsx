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
import type { PlanoAcaoStats as StatsType } from "@/types/planoAcao";

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
    gradient: "from-indigo-500 via-violet-500 to-purple-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(99,102,241,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(99,102,241,0.85)]",
    ring: "ring-indigo-300/70",
  },
  {
    key: "pendentes",
    label: "Pendentes",
    icon: Clock,
    gradient: "from-amber-400 via-orange-500 to-orange-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(249,115,22,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(249,115,22,0.85)]",
    ring: "ring-amber-300/70",
  },
  {
    key: "em_andamento",
    label: "Em Andamento",
    icon: Activity,
    gradient: "from-sky-500 via-blue-500 to-cyan-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(14,165,233,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(14,165,233,0.85)]",
    ring: "ring-sky-300/70",
  },
  {
    key: "atrasadas",
    label: "Atrasadas",
    icon: AlertTriangle,
    gradient: "from-rose-500 via-red-500 to-pink-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(244,63,94,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(244,63,94,0.85)]",
    ring: "ring-rose-300/70",
  },
  {
    key: "concluidas",
    label: "Concluídas",
    icon: CheckCircle2,
    gradient: "from-emerald-500 via-green-500 to-teal-600",
    glow: "shadow-[0_8px_30px_-8px_rgba(16,185,129,0.55)]",
    glowHover: "hover:shadow-[0_18px_40px_-10px_rgba(16,185,129,0.85)]",
    ring: "ring-emerald-300/70",
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
              whileHover={{ y: -4, scale: 1.015 }}
              className="[perspective:1000px]"
            >
              <button
                type="button"
                onClick={() => onStatClick?.(card.key)}
                className={cn(
                  "group relative w-full overflow-hidden rounded-xl text-left text-white",
                  "bg-gradient-to-br",
                  card.gradient,
                  card.glow,
                  card.glowHover,
                  "transition-all duration-300 ease-out ring-1 ring-white/20",
                  isActive && `ring-2 ${card.ring} scale-[1.02]`,
                )}
              >
                {/* Glow blob */}
                <span className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/25 blur-2xl" />
                {/* Shine sweep */}
                <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[300%]" />

                <div className="relative p-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-white/20 backdrop-blur-md p-2.5 ring-1 ring-white/30 shadow-inner">
                      <Icon className="h-5 w-5 text-white drop-shadow" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none drop-shadow-sm">{value as number}</p>
                      <p className="text-xs text-white/90 mt-1 font-medium">{card.label}</p>
                    </div>
                  </div>
                </div>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 shadow-md">
        <span className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <CardContent className="relative py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/15 p-1.5 ring-1 ring-primary/20">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold">Índice de Execução</span>
            </div>
            <span className="text-sm font-bold text-primary">{taxaConclusao}%</span>
          </div>
          <div className="h-2.5 bg-muted/70 rounded-full overflow-hidden ring-1 ring-inset ring-border/40">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${taxaConclusao}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.55)]"
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

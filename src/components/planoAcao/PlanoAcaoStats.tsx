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
}

const statCards = [
  {
    key: "total",
    label: "Total de Ações",
    icon: Target,
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    key: "pendentes",
    label: "Pendentes",
    icon: Clock,
    color: "text-warning",
    bgColor: "bg-warning/10",
  },
  {
    key: "em_andamento",
    label: "Em Andamento",
    icon: Activity,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    key: "atrasadas",
    label: "Atrasadas",
    icon: AlertTriangle,
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
  {
    key: "concluidas",
    label: "Concluídas",
    icon: CheckCircle2,
    color: "text-success",
    bgColor: "bg-success/10",
  },
];

export function PlanoAcaoStats({ stats, isLoading }: PlanoAcaoStatsProps) {
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
          
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
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

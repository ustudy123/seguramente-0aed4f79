import { motion } from "framer-motion";
import { Target, TrendingUp, CheckCircle2, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PdiStatsProps {
  pdisAtivos: number;
  pdisConcluidos: number;
  totalMetas: number;
  metasConcluidas: number;
  progressoMedio: number;
}

export const PdiStats = ({ pdisAtivos, pdisConcluidos, totalMetas, metasConcluidas, progressoMedio }: PdiStatsProps) => {
  const stats = [
    { label: "PDIs Ativos", value: pdisAtivos, icon: Target, color: "text-primary" },
    { label: "PDIs Concluídos", value: pdisConcluidos, icon: CheckCircle2, color: "text-success" },
    { label: "Total de Metas", value: totalMetas, icon: BarChart3, color: "text-info" },
    { label: "Progresso Médio", value: `${progressoMedio}%`, icon: TrendingUp, color: "text-warning" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-muted ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

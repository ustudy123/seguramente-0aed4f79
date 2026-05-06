import { motion } from "framer-motion";
import { ClipboardCheck, AlertCircle, Target, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AvaliacoesStatsProps {
  ciclosAtivos: number | string;
  avaliacoesPendentes: number | string;
  metasAtivas: number | string;
  progressoMedio: number | string;
}

export const AvaliacoesStats = ({
  ciclosAtivos,
  avaliacoesPendentes,
  metasAtivas,
  progressoMedio,
}: AvaliacoesStatsProps) => {
  const stats = [
    {
      label: "Ciclos Ativos",
      value: ciclosAtivos,
      icon: ClipboardCheck,
      gradient: "from-primary via-primary/90 to-info",
      glow: "shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.6)]",
    },
    {
      label: "Avaliações Pendentes",
      value: avaliacoesPendentes,
      icon: AlertCircle,
      gradient: "from-amber-500 via-orange-500/90 to-rose-500",
      glow: "shadow-[0_10px_30px_-10px_hsl(25_95%_53%/0.6)]",
    },
    {
      label: "Metas em Andamento",
      value: metasAtivas,
      icon: Target,
      gradient: "from-sky-500 via-sky-500/90 to-indigo-500",
      glow: "shadow-[0_10px_30px_-10px_hsl(217_91%_60%/0.6)]",
    },
    {
      label: "Progresso Médio",
      value: typeof progressoMedio === "number" ? `${progressoMedio}%` : progressoMedio,
      icon: TrendingUp,
      gradient: "from-emerald-500 via-emerald-500/90 to-teal-500",
      glow: "shadow-[0_10px_30px_-10px_hsl(160_84%_39%/0.6)]",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 20, rotateX: -10 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 120 }}
          whileHover={{ y: -6, rotateX: 4, rotateY: -4, scale: 1.02 }}
          style={{ transformStyle: "preserve-3d", perspective: 1000 }}
        >
          <Card className={`relative overflow-hidden border-0 bg-gradient-to-br ${s.gradient} ${s.glow} text-white`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <CardContent className="relative p-5 flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 shadow-inner">
                <s.icon className="w-6 h-6 drop-shadow" />
              </div>
              <div>
                <p className="text-3xl font-bold drop-shadow-sm leading-none">{s.value}</p>
                <p className="text-xs text-white/90 mt-1.5 font-medium">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
};

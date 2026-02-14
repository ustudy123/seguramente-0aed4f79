import { motion } from "framer-motion";
import { MessageSquare, Clock, CheckCircle, Search, EyeOff } from "lucide-react";

interface OuvidoriaStatsProps {
  stats: {
    total: number;
    pendentes: number;
    emAnalise: number;
    respondidas: number;
    anonimas: number;
  };
}

export function OuvidoriaStats({ stats }: OuvidoriaStatsProps) {
  const cards = [
    {
      label: "Total",
      value: stats.total,
      icon: MessageSquare,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Pendentes",
      value: stats.pendentes,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Em Análise",
      value: stats.emAnalise,
      icon: Search,
      color: "text-info",
      bg: "bg-info/10",
    },
    {
      label: "Respondidas",
      value: stats.respondidas,
      icon: CheckCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Anônimas",
      value: stats.anonimas,
      icon: EyeOff,
      color: "text-muted-foreground",
      bg: "bg-muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-card rounded-xl border p-4"
          >
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <span className="text-2xl font-bold">{card.value}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">{card.label}</p>
          </motion.div>
        );
      })}
    </div>
  );
}

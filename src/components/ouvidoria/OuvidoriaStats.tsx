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
      color: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-100 dark:bg-yellow-900/30",
    },
    {
      label: "Em Análise",
      value: stats.emAnalise,
      icon: Search,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      label: "Respondidas",
      value: stats.respondidas,
      icon: CheckCircle,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-100 dark:bg-green-900/30",
    },
    {
      label: "Anônimas",
      value: stats.anonimas,
      icon: EyeOff,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-100 dark:bg-purple-900/30",
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

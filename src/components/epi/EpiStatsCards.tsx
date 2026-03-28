import { motion } from "framer-motion";
import { HardHat, Package, AlertTriangle, Users, Calendar, Archive } from "lucide-react";

interface EpiStatsCardsProps {
  stats: {
    totalEpis: number;
    totalTipos: number;
    entregasAtivas: number;
    estoqueBaixo: number;
    episVencidos: number;
    totalEstoque: number;
  };
  onCardClick?: (tab: string) => void;
}

export function EpiStatsCards({ stats, onCardClick }: EpiStatsCardsProps) {
  const items = [
    { label: "Total de EPIs", value: stats.totalEpis, icon: HardHat, color: "text-primary", bgColor: "bg-primary/10", tab: "estoque" },
    { label: "Itens em Estoque", value: stats.totalEstoque, icon: Package, color: "text-success", bgColor: "bg-success/10", tab: "estoque" },
    { label: "Entregas Ativas", value: stats.entregasAtivas, icon: Users, color: "text-info", bgColor: "bg-info/10", tab: "entregas" },
    { label: "Estoque Baixo", value: stats.estoqueBaixo, icon: AlertTriangle,
      color: stats.estoqueBaixo > 0 ? "text-warning" : "text-muted-foreground",
      bgColor: stats.estoqueBaixo > 0 ? "bg-warning/10" : "bg-muted/50", tab: "alertas" },
    { label: "EPIs Vencidos", value: stats.episVencidos, icon: Calendar,
      color: stats.episVencidos > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: stats.episVencidos > 0 ? "bg-destructive/10" : "bg-muted/50", tab: "alertas" },
    { label: "Tipos Cadastrados", value: stats.totalTipos, icon: Archive, color: "text-muted-foreground", bgColor: "bg-muted", tab: "estoque" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onCardClick?.(item.tab)}
          className="bg-card rounded-lg sm:rounded-xl border p-3 sm:p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`p-1.5 sm:p-2 rounded-lg ${item.bgColor}`}>
              <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{item.value}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{item.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

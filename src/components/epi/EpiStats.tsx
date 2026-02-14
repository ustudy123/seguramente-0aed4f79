import { motion } from "framer-motion";
import { HardHat, Package, AlertTriangle, Users, Calendar, Archive } from "lucide-react";

interface EpiStatsProps {
  stats: {
    totalEpis: number;
    totalTipos: number;
    entregasAtivas: number;
    estoqueBaixo: number;
    episVencidos: number;
    totalEstoque: number;
  };
}

export function EpiStats({ stats }: EpiStatsProps) {
  const items = [
    {
      label: "Total de EPIs",
      value: stats.totalEpis,
      icon: HardHat,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Itens em Estoque",
      value: stats.totalEstoque,
      icon: Package,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      label: "Entregas Ativas",
      value: stats.entregasAtivas,
      icon: Users,
      color: "text-info",
      bgColor: "bg-info/10",
    },
    {
      label: "Estoque Baixo",
      value: stats.estoqueBaixo,
      icon: AlertTriangle,
      color: stats.estoqueBaixo > 0 ? "text-warning" : "text-muted-foreground",
      bgColor: stats.estoqueBaixo > 0 ? "bg-warning/10" : "bg-muted/50",
    },
    {
      label: "EPIs Vencidos",
      value: stats.episVencidos,
      icon: Calendar,
      color: stats.episVencidos > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: stats.episVencidos > 0 ? "bg-destructive/10" : "bg-muted/50",
    },
    {
      label: "Tipos Cadastrados",
      value: stats.totalTipos,
      icon: Archive,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item, index) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="bg-card rounded-xl border p-4"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${item.bgColor}`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

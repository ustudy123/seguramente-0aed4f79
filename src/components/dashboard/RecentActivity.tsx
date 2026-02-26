import { motion } from "framer-motion";
import { 
  UserPlus, 
  Calendar, 
  FileCheck, 
  Clock, 
  Star,
  AlertCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

const activities = [
  {
    id: 1,
    type: "admission",
    icon: UserPlus,
    title: "Nova admissão",
    description: "Ana Carolina Silva foi admitida como Analista de RH",
    time: "Há 2 horas",
    color: "bg-success/10 text-success",
  },
  {
    id: 2,
    type: "vacation",
    icon: Calendar,
    title: "Férias aprovadas",
    description: "Carlos Mendes terá férias de 15/02 a 01/03",
    time: "Há 4 horas",
    color: "bg-info/10 text-info",
  },
  {
    id: 3,
    type: "document",
    icon: FileCheck,
    title: "Documento enviado",
    description: "Contrato de trabalho assinado por Paula Santos",
    time: "Há 5 horas",
    color: "bg-primary/10 text-primary",
  },
  {
    id: 4,
    type: "point",
    icon: Clock,
    title: "Ajuste de ponto",
    description: "João Pereira solicitou correção no dia 10/01",
    time: "Há 1 dia",
    color: "bg-warning/10 text-warning",
  },
  {
    id: 5,
    type: "evaluation",
    icon: Star,
    title: "Avaliação concluída",
    description: "Ciclo de avaliação Q4 finalizado para TI",
    time: "Há 2 dias",
    color: "bg-accent text-accent-foreground",
  },
  {
    id: 6,
    type: "alert",
    icon: AlertCircle,
    title: "Documento expirando",
    description: "ASO de 3 colaboradores vence em 7 dias",
    time: "Há 2 dias",
    color: "bg-destructive/10 text-destructive",
  },
];

export const RecentActivity = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Atividade Recente</h2>
        <button className="text-sm text-primary hover:underline">Ver todas</button>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span><strong>Demonstração</strong> — Dados ilustrativos. Suas atividades reais aparecerão aqui conforme você utilizar o sistema.</span>
        </div>
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
            className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className={cn("p-2 rounded-lg flex-shrink-0", activity.color)}>
              <activity.icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{activity.title}</p>
              <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">{activity.time}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

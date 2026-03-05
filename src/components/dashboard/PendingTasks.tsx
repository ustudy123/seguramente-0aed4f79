import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Clock, FileWarning, Calendar, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const tasks = [
  {
    id: 1,
    title: "Férias pendentes de aprovação",
    count: 0,
    icon: Calendar,
    path: "/ferias",
    priority: "high",
  },
  {
    id: 2,
    title: "Documentos vencendo",
    count: 0,
    icon: FileWarning,
    path: "/documentos",
    priority: "high",
  },
  {
    id: 3,
    title: "Ajustes de ponto",
    count: 0,
    icon: Clock,
    path: "/ponto",
    priority: "medium",
  },
  {
    id: 4,
    title: "Avaliações pendentes",
    count: 0,
    icon: AlertCircle,
    path: "/avaliacoes",
    priority: "low",
  },
  {
    id: 5,
    title: "Desligamentos em processo",
    count: 0,
    icon: UserX,
    path: "/colaboradores",
    priority: "medium",
  },
];

const priorityStyles = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

export const PendingTasks = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="bg-card rounded-xl border border-border p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Pendências</h2>
        <Badge variant="secondary" className="text-xs">
          {tasks.reduce((acc, task) => acc + task.count, 0)} total
        </Badge>
      </div>
      
      <div className="space-y-3">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
          >
            <Link
              to={task.path}
              className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 hover:border-primary/30 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  priorityStyles[task.priority]
                )}>
                  <task.icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium text-foreground">{task.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary"
                  className={cn("text-xs font-semibold", priorityStyles[task.priority])}
                >
                  {task.count}
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

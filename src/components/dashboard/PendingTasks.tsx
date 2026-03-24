import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, FileWarning, Calendar, UserX, AlertCircle, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const tasks = [
  {
    id: 1,
    title: "Férias pendentes",
    count: 0,
    icon: Calendar,
    path: "/ferias",
    priority: "high" as const,
  },
  {
    id: 2,
    title: "Documentos vencendo",
    count: 0,
    icon: FileWarning,
    path: "/documentos",
    priority: "high" as const,
  },
  {
    id: 3,
    title: "Ajustes de ponto",
    count: 0,
    icon: Clock,
    path: "/ponto",
    priority: "medium" as const,
  },
  {
    id: 4,
    title: "Avaliações pendentes",
    count: 0,
    icon: AlertCircle,
    path: "/avaliacoes",
    priority: "low" as const,
  },
  {
    id: 5,
    title: "Desligamentos",
    count: 0,
    icon: UserX,
    path: "/colaboradores",
    priority: "medium" as const,
  },
];

const priorityDot = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-info",
};

export const PendingTasks = () => {
  const total = tasks.reduce((acc, t) => acc + t.count, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="bg-card rounded-xl border border-border shadow-sm h-full"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Pendências</h2>
        </div>
        <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0.5">
          {total}
        </Badge>
      </div>

      <div className="divide-y divide-border">
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.4 + index * 0.04 }}
          >
            <Link
              to={task.path}
              className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("w-1.5 h-1.5 rounded-full", priorityDot[task.priority])} />
                <task.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground">{task.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  {task.count}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

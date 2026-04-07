import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Clock,
  FileWarning,
  Calendar,
  UserX,
  AlertCircle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { usePendencias, type PendenciaGroup } from "@/hooks/usePendencias";

const iconMap: Record<string, React.ElementType> = {
  ferias: Calendar,
  documentos: FileWarning,
  ajustes: Clock,
  avaliacoes: AlertCircle,
  desligamentos: UserX,
};

const priorityDot: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-info",
};

export const PendingTasks = () => {
  const { data: groups, isLoading } = usePendencias();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const tasks = groups || [];
  const total = tasks.reduce((acc, t) => acc + t.count, 0);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

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
          {isLoading ? "…" : total}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tasks.map((task, index) => {
            const Icon = iconMap[task.key] || AlertCircle;
            const isExpanded = expandedKey === task.key;
            const hasItems = task.count > 0;

            return (
              <motion.div
                key={task.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.04 }}
              >
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => hasItems && toggle(task.key)}
                  className={cn(
                    "flex items-center justify-between w-full px-6 py-3 transition-colors text-left",
                    hasItems
                      ? "hover:bg-muted/40 cursor-pointer"
                      : "cursor-default opacity-70"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-1.5 h-1.5 rounded-full", priorityDot[task.priority])} />
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{task.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold tabular-nums",
                        hasItems ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {task.count}
                    </span>
                    {hasItems &&
                      (isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      ))}
                  </div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && hasItems && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-muted/30 border-t border-border">
                        <ul className="divide-y divide-border/50 max-h-56 overflow-y-auto">
                          {task.items.map((item) => (
                            <li
                              key={item.id}
                              className="px-6 py-2.5 flex items-start gap-3"
                            >
                              <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {item.label}
                                </p>
                                {item.sublabel && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {item.sublabel}
                                  </p>
                                )}
                                <p className="text-xs text-primary/80 mt-0.5">
                                  → {item.acao}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>

                        {/* Link to module */}
                        <Link
                          to={task.path}
                          className="flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors border-t border-border/50"
                        >
                          Ver todas em {task.title.toLowerCase()}
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};

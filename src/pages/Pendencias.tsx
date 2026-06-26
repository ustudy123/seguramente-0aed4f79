import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePendencias, type PendenciaGroup } from "@/hooks/usePendencias";
import { useAuthContext } from "@/contexts/AuthContext";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  FileWarning, 
  Clock, 
  AlertCircle, 
  UserX,
  Info,
  ArrowRight,
  User,
  Users,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock3
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, React.ElementType> = {
  ferias: Calendar,
  documentos: FileWarning,
  ajustes: Clock,
  avaliacoes: AlertCircle,
  desligamentos: UserX,
  afastamentos: ShieldAlert,
};

const priorityDot: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-info",
};

const Pendencias = () => {
  const { data: groups, isLoading } = usePendencias();
  const { profile, roles, hasMinimumRole } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"todos" | "gestor" | "rh" | "colaborador">("todos");

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const tasks = groups || [];
  
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         task.items.some(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (activeTab === "todos") return true;
    
    // Simple mapping for demonstration purposes
    if (activeTab === "rh") {
      return ["documentos", "desligamentos", "ferias", "ajustes", "afastamentos"].includes(task.key);
    }
    if (activeTab === "gestor") {
      return ["ferias", "ajustes", "avaliacoes"].includes(task.key);
    }
    if (activeTab === "colaborador") {
      // Typically evaluations where the user is the evaluator
      return task.key === "avaliacoes";
    }
    
    return true;
  });

  const totalCount = filteredTasks.reduce((acc, t) => acc + t.count, 0);

  const tabs = [
    { id: "todos", label: "Tudo", icon: ClipboardList },
    { id: "colaborador", label: "Meu Perfil", icon: User },
    { id: "gestor", label: "Minha Equipe", icon: Users },
    { id: "rh", label: "Gestão / RH", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Central de Pendências
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todas as ações e providências necessárias por perfil de atuação.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Clock3 className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Urgentes</p>
            <h3 className="text-2xl font-bold">{tasks.filter(t => t.priority === 'high').reduce((acc, t) => acc + t.count, 0)}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Em Atenção</p>
            <h3 className="text-2xl font-bold">{tasks.filter(t => t.priority === 'medium').reduce((acc, t) => acc + t.count, 0)}</h3>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card p-5 rounded-xl border border-border shadow-sm flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total de Ações</p>
            <h3 className="text-2xl font-bold">{tasks.reduce((acc, t) => acc + t.count, 0)}</h3>
          </div>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {/* Filters and Tabs */}
        <div className="border-b border-border">
          <div className="p-4 md:p-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar pendências..." 
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <Button
                      key={tab.id}
                      variant={activeTab === tab.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setActiveTab(tab.id as any)}
                      className={cn(
                        "rounded-full gap-2 whitespace-nowrap",
                        activeTab === tab.id ? "shadow-md" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ClipboardList className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Nenhuma pendência encontrada</h3>
              <p className="text-muted-foreground max-w-xs mx-auto mt-1">
                Você está em dia com todas as suas obrigações e providências.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredTasks.map((task, index) => {
                const Icon = iconMap[task.key] || AlertCircle;
                const isExpanded = expandedKey === task.key;
                const hasItems = task.count > 0;

                return (
                  <motion.div
                    key={task.key}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    <button
                      type="button"
                      onClick={() => hasItems && toggle(task.key)}
                      className={cn(
                        "flex items-center justify-between w-full px-6 py-4 transition-colors text-left",
                        hasItems
                          ? "hover:bg-muted/40 cursor-pointer"
                          : "cursor-default opacity-70"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn("w-2 h-2 rounded-full", priorityDot[task.priority])} />
                        <div className="p-2 rounded-lg bg-muted flex items-center justify-center">
                          <Icon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <span className="text-base font-semibold text-foreground block">
                            {task.title}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {task.count} {task.count === 1 ? 'item pendente' : 'itens pendentes'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}
                          className={cn("hidden sm:inline-flex", task.priority === 'medium' && "bg-warning text-warning-foreground hover:bg-warning/80")}
                        >
                          {task.priority === 'high' ? 'Urgente' : task.priority === 'medium' ? 'Médio' : 'Baixo'}
                        </Badge>
                        {hasItems && (
                          isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {isExpanded && hasItems && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden bg-muted/20"
                        >
                          <div className="px-6 py-2 pb-6 border-t border-border/50">
                            <ul className="space-y-3 mt-4">
                              {task.items.map((item) => (
                                <li
                                  key={item.id}
                                  className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/5 flex items-center justify-center mt-1 shrink-0">
                                      <Info className="w-4 h-4 text-primary" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-foreground">
                                        {item.label}
                                      </p>
                                      {item.sublabel && (
                                        <p className="text-xs text-muted-foreground">
                                          {item.sublabel}
                                        </p>
                                      )}
                                      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                                        <ArrowRight className="w-3 h-3" />
                                        {item.acao}
                                      </div>
                                    </div>
                                  </div>
                                  <Button size="sm" asChild>
                                    <Link to={task.path}>Atuar agora</Link>
                                  </Button>
                                </li>
                              ))}
                            </ul>
                            
                            <div className="mt-6 text-center">
                              <Link
                                to={task.path}
                                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline transition-all"
                              >
                                Ver todas no módulo de {task.title.toLowerCase()}
                                <ArrowRight className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pendencias;

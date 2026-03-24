import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  UserPlus,
  Calendar,
  Clock,
  FileText,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const actions = [
  {
    title: "Novo Colaborador",
    description: "Cadastrar admissão",
    icon: UserPlus,
    path: "/admissao",
    color: "text-primary",
    bg: "bg-primary/8 hover:bg-primary/15 border-primary/10",
  },
  {
    title: "Registrar Ponto",
    description: "Marcação manual",
    icon: Clock,
    path: "/ponto",
    color: "text-info",
    bg: "bg-info/8 hover:bg-info/15 border-info/10",
  },
  {
    title: "Solicitar Férias",
    description: "Nova solicitação",
    icon: Calendar,
    path: "/ferias",
    color: "text-success",
    bg: "bg-success/8 hover:bg-success/15 border-success/10",
  },
  {
    title: "Nova Avaliação",
    description: "Iniciar ciclo",
    icon: Star,
    path: "/avaliacoes",
    color: "text-warning",
    bg: "bg-warning/8 hover:bg-warning/15 border-warning/10",
  },
  {
    title: "Documentos",
    description: "Upload de arquivos",
    icon: FileText,
    path: "/documentos",
    color: "text-muted-foreground",
    bg: "bg-muted/60 hover:bg-muted border-border",
  },
  {
    title: "Colaboradores",
    description: "Ver listagem",
    icon: Users,
    path: "/colaboradores",
    color: "text-accent-foreground",
    bg: "bg-accent/8 hover:bg-accent/15 border-accent/10",
  },
];

export const QuickActions = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="h-7 w-1 rounded-full bg-accent" />
        <h2 className="text-lg font-semibold text-foreground">Ações Rápidas</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {actions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 + index * 0.04 }}
          >
            <Link
              to={action.path}
              className={cn(
                "flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all duration-200 group",
                action.bg
              )}
            >
              <action.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", action.color)} />
              <div className="text-center">
                <p className="text-xs font-semibold text-foreground">{action.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{action.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

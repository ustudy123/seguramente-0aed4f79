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
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  {
    title: "Registrar Ponto",
    description: "Marcação manual",
    icon: Clock,
    path: "/ponto",
    color: "bg-info/10 text-info hover:bg-info/20",
  },
  {
    title: "Solicitar Férias",
    description: "Nova solicitação",
    icon: Calendar,
    path: "/ferias",
    color: "bg-success/10 text-success hover:bg-success/20",
  },
  {
    title: "Nova Avaliação",
    description: "Iniciar ciclo",
    icon: Star,
    path: "/avaliacoes",
    color: "bg-warning/10 text-warning hover:bg-warning/20",
  },
  {
    title: "Documentos",
    description: "Upload de arquivos",
    icon: FileText,
    path: "/documentos",
    color: "bg-muted text-muted-foreground hover:bg-muted/80",
  },
  {
    title: "Colaboradores",
    description: "Ver listagem",
    icon: Users,
    path: "/colaboradores",
    color: "bg-accent text-accent-foreground hover:bg-accent/80",
  },
];

export const QuickActions = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="bg-card rounded-xl border border-border p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action, index) => (
          <motion.div
            key={action.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
          >
            <Link
              to={action.path}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-200",
                action.color
              )}
            >
              <action.icon className="w-6 h-6" />
              <div className="text-center">
                <p className="text-sm font-medium">{action.title}</p>
                <p className="text-xs opacity-70">{action.description}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

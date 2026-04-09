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
    color: "text-blue-700",
    bg: "bg-blue-50 hover:bg-blue-100 border-blue-200",
  },
  {
    title: "Registrar Ponto",
    description: "Marcação manual",
    icon: Clock,
    path: "/ponto",
    color: "text-cyan-700",
    bg: "bg-cyan-50 hover:bg-cyan-100 border-cyan-200",
  },
  {
    title: "Solicitar Férias",
    description: "Nova solicitação",
    icon: Calendar,
    path: "/ferias",
    color: "text-emerald-700",
    bg: "bg-emerald-50 hover:bg-emerald-100 border-emerald-200",
  },
  {
    title: "Nova Avaliação",
    description: "Iniciar ciclo",
    icon: Star,
    path: "/avaliacoes",
    color: "text-amber-700",
    bg: "bg-amber-50 hover:bg-amber-100 border-amber-200",
  },
  {
    title: "Documentos",
    description: "Upload de arquivos",
    icon: FileText,
    path: "/documentos",
    color: "text-purple-700",
    bg: "bg-purple-50 hover:bg-purple-100 border-purple-200",
  },
  {
    title: "Colaboradores",
    description: "Ver listagem",
    icon: Users,
    path: "/colaboradores",
    color: "text-rose-700",
    bg: "bg-rose-50 hover:bg-rose-100 border-rose-200",
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

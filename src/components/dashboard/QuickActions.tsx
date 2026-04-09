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
    iconColor: "text-blue-600",
    gradient: "from-blue-50 via-blue-100/60 to-blue-50",
    shadowColor: "hover:shadow-blue-200/50",
  },
  {
    title: "Registrar Ponto",
    description: "Marcação manual",
    icon: Clock,
    path: "/ponto",
    iconColor: "text-cyan-600",
    gradient: "from-cyan-50 via-cyan-100/60 to-cyan-50",
    shadowColor: "hover:shadow-cyan-200/50",
  },
  {
    title: "Solicitar Férias",
    description: "Nova solicitação",
    icon: Calendar,
    path: "/ferias",
    iconColor: "text-emerald-600",
    gradient: "from-emerald-50 via-emerald-100/60 to-emerald-50",
    shadowColor: "hover:shadow-emerald-200/50",
  },
  {
    title: "Nova Avaliação",
    description: "Iniciar ciclo",
    icon: Star,
    path: "/avaliacoes",
    iconColor: "text-amber-600",
    gradient: "from-amber-50 via-amber-100/60 to-amber-50",
    shadowColor: "hover:shadow-amber-200/50",
  },
  {
    title: "Documentos",
    description: "Upload de arquivos",
    icon: FileText,
    path: "/documentos",
    iconColor: "text-purple-600",
    gradient: "from-purple-50 via-purple-100/60 to-purple-50",
    shadowColor: "hover:shadow-purple-200/50",
  },
  {
    title: "Colaboradores",
    description: "Ver listagem",
    icon: Users,
    path: "/colaboradores",
    iconColor: "text-rose-600",
    gradient: "from-rose-50 via-rose-100/60 to-rose-50",
    shadowColor: "hover:shadow-rose-200/50",
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
                "relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-white/60 transition-all duration-300 group",
                "bg-gradient-to-br shadow-sm hover:shadow-lg hover:-translate-y-0.5",
                action.gradient,
                action.shadowColor
              )}
            >
              <div className="absolute inset-0 rounded-2xl bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/70 shadow-sm group-hover:shadow-md transition-shadow">
                  <action.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", action.iconColor)} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-foreground">{action.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{action.description}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

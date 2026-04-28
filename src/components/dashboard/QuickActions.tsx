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
    iconColor: "text-white",
    gradient: "from-blue-500 to-blue-600",
    borderColor: "border-blue-400/30",
    iconBg: "bg-blue-400/30",
  },
  /* Action removed as per user request to use external links/PWA only */
  {
    title: "Solicitar Férias",
    description: "Nova solicitação",
    icon: Calendar,
    path: "/ferias",
    iconColor: "text-white",
    gradient: "from-emerald-500 to-green-600",
    borderColor: "border-emerald-400/30",
    iconBg: "bg-emerald-400/30",
  },
  {
    title: "Nova Avaliação",
    description: "Iniciar ciclo",
    icon: Star,
    path: "/avaliacoes",
    iconColor: "text-white",
    gradient: "from-amber-500 to-orange-600",
    borderColor: "border-amber-400/30",
    iconBg: "bg-amber-400/30",
  },
  {
    title: "Documentos",
    description: "Upload de arquivos",
    icon: FileText,
    path: "/documentos",
    iconColor: "text-white",
    gradient: "from-purple-500 to-violet-600",
    borderColor: "border-purple-400/30",
    iconBg: "bg-purple-400/30",
  },
  {
    title: "Colaboradores",
    description: "Ver listagem",
    icon: Users,
    path: "/colaboradores",
    iconColor: "text-white",
    gradient: "from-rose-500 to-pink-600",
    borderColor: "border-rose-400/30",
    iconBg: "bg-rose-400/30",
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
                "relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-300 group overflow-hidden",
                "bg-gradient-to-br shadow-md hover:shadow-xl hover:-translate-y-1",
                action.gradient,
                action.borderColor
              )}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col items-center gap-2.5">
                <div className={cn("p-2 rounded-xl transition-shadow", action.iconBg)}>
                  <action.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", action.iconColor)} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-white">{action.title}</p>
                  <p className="text-[10px] text-white/75 mt-0.5">{action.description}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

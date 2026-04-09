import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Users,
  UserPlus,
  ShieldAlert,
  FileWarning,
  Star,
  Target,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";

interface KPIItem {
  label: string;
  value: number;
  icon: React.ElementType;
  path: string;
  iconColor: string;
  gradient: string;
  shadowColor: string;
}

export const DashboardKPIs = () => {
  const { data, isLoading } = useDashboardKPIs();

  const kpis: KPIItem[] = [
    {
      label: "Colaboradores Ativos",
      value: data?.colaboradoresAtivos ?? 0,
      icon: Users,
      path: "/colaboradores",
      iconColor: "text-blue-600",
      gradient: "from-blue-50 via-blue-100/60 to-blue-50",
      shadowColor: "hover:shadow-blue-200/50",
    },
    {
      label: "Admissões Pendentes",
      value: data?.admissoesPendentes ?? 0,
      icon: UserPlus,
      path: "/admissao",
      iconColor: "text-cyan-600",
      gradient: "from-cyan-50 via-cyan-100/60 to-cyan-50",
      shadowColor: "hover:shadow-cyan-200/50",
    },
    {
      label: "EPIs Estoque Baixo",
      value: data?.episBaixoEstoque ?? 0,
      icon: ShieldAlert,
      path: "/epis",
      iconColor: "text-red-600",
      gradient: "from-red-50 via-red-100/60 to-red-50",
      shadowColor: "hover:shadow-red-200/50",
    },
    {
      label: "Documentos Pendentes",
      value: data?.documentosPendentes ?? 0,
      icon: FileWarning,
      path: "/documentos",
      iconColor: "text-amber-600",
      gradient: "from-amber-50 via-amber-100/60 to-amber-50",
      shadowColor: "hover:shadow-amber-200/50",
    },
    {
      label: "Avaliações Pendentes",
      value: data?.avaliacoesPendentes ?? 0,
      icon: Star,
      path: "/avaliacoes",
      iconColor: "text-purple-600",
      gradient: "from-purple-50 via-purple-100/60 to-purple-50",
      shadowColor: "hover:shadow-purple-200/50",
    },
    {
      label: "Metas Ativas",
      value: data?.metasAtivas ?? 0,
      icon: Target,
      path: "/metas",
      iconColor: "text-emerald-600",
      gradient: "from-emerald-50 via-emerald-100/60 to-emerald-50",
      shadowColor: "hover:shadow-emerald-200/50",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="h-7 w-1 rounded-full bg-primary" />
        <h2 className="text-lg font-semibold text-foreground">KPIs Operacionais</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.15 + index * 0.04 }}
          >
            <Link
              to={kpi.path}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border border-white/60 transition-all duration-300 group",
                "bg-gradient-to-br shadow-sm hover:shadow-lg hover:-translate-y-0.5",
                kpi.gradient,
                kpi.shadowColor
              )}
            >
              <div className="absolute inset-0 rounded-2xl bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <div className="p-2 rounded-xl bg-white/70 shadow-sm group-hover:shadow-md transition-shadow">
                    <kpi.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", kpi.iconColor)} />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {isLoading ? "—" : kpi.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

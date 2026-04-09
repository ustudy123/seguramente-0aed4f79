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
  borderColor: string;
  iconBg: string;
}

export const DashboardKPIs = () => {
  const { data, isLoading } = useDashboardKPIs();

  const kpis: KPIItem[] = [
    {
      label: "Colaboradores Ativos",
      value: data?.colaboradoresAtivos ?? 0,
      icon: Users,
      path: "/colaboradores",
      iconColor: "text-white",
      gradient: "from-blue-500 to-blue-600",
      borderColor: "border-blue-400/30",
      iconBg: "bg-blue-400/30",
    },
    {
      label: "Admissões Pendentes",
      value: data?.admissoesPendentes ?? 0,
      icon: UserPlus,
      path: "/admissao",
      iconColor: "text-white",
      gradient: "from-cyan-500 to-teal-600",
      borderColor: "border-cyan-400/30",
      iconBg: "bg-cyan-400/30",
    },
    {
      label: "EPIs Estoque Baixo",
      value: data?.episBaixoEstoque ?? 0,
      icon: ShieldAlert,
      path: "/epis",
      iconColor: "text-white",
      gradient: "from-red-500 to-rose-600",
      borderColor: "border-red-400/30",
      iconBg: "bg-red-400/30",
    },
    {
      label: "Documentos Pendentes",
      value: data?.documentosPendentes ?? 0,
      icon: FileWarning,
      path: "/documentos",
      iconColor: "text-white",
      gradient: "from-amber-500 to-orange-600",
      borderColor: "border-amber-400/30",
      iconBg: "bg-amber-400/30",
    },
    {
      label: "Avaliações Pendentes",
      value: data?.avaliacoesPendentes ?? 0,
      icon: Star,
      path: "/avaliacoes",
      iconColor: "text-white",
      gradient: "from-purple-500 to-violet-600",
      borderColor: "border-purple-400/30",
      iconBg: "bg-purple-400/30",
    },
    {
      label: "Metas Ativas",
      value: data?.metasAtivas ?? 0,
      icon: Target,
      path: "/metas",
      iconColor: "text-white",
      gradient: "from-emerald-500 to-green-600",
      borderColor: "border-emerald-400/30",
      iconBg: "bg-emerald-400/30",
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
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 group overflow-hidden",
                "bg-gradient-to-br shadow-md hover:shadow-xl hover:-translate-y-1",
                kpi.gradient,
                kpi.borderColor
              )}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col items-center gap-2">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                ) : (
                  <div className={cn("p-2 rounded-xl transition-shadow", kpi.iconBg)}>
                    <kpi.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", kpi.iconColor)} />
                  </div>
                )}
                <div className="text-center">
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {isLoading ? "—" : kpi.value}
                  </p>
                  <p className="text-[10px] text-white/80 mt-0.5 leading-tight">{kpi.label}</p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

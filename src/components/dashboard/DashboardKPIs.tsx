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
  color: string;
  bg: string;
}

export const DashboardKPIs = () => {
  const { data, isLoading } = useDashboardKPIs();

  const kpis: KPIItem[] = [
    {
      label: "Colaboradores Ativos",
      value: data?.colaboradoresAtivos ?? 0,
      icon: Users,
      path: "/colaboradores",
      color: "text-blue-700",
      bg: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    },
    {
      label: "Admissões Pendentes",
      value: data?.admissoesPendentes ?? 0,
      icon: UserPlus,
      path: "/admissao",
      color: "text-cyan-700",
      bg: "bg-cyan-50 border-cyan-200 hover:bg-cyan-100",
    },
    {
      label: "EPIs Estoque Baixo",
      value: data?.episBaixoEstoque ?? 0,
      icon: ShieldAlert,
      path: "/epis",
      color: "text-red-700",
      bg: "bg-red-50 border-red-200 hover:bg-red-100",
    },
    {
      label: "Documentos Pendentes",
      value: data?.documentosPendentes ?? 0,
      icon: FileWarning,
      path: "/documentos",
      color: "text-amber-700",
      bg: "bg-amber-50 border-amber-200 hover:bg-amber-100",
    },
    {
      label: "Avaliações Pendentes",
      value: data?.avaliacoesPendentes ?? 0,
      icon: Star,
      path: "/avaliacoes",
      color: "text-purple-700",
      bg: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    },
    {
      label: "Metas Ativas",
      value: data?.metasAtivas ?? 0,
      icon: Target,
      path: "/metas",
      color: "text-emerald-700",
      bg: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
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
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 group hover:shadow-md",
                kpi.bg
              )}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              ) : (
                <kpi.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", kpi.color)} />
              )}
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {isLoading ? "—" : kpi.value}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

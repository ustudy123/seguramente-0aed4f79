import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ShieldAlert,
  FileWarning,
  MessageSquareWarning,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";

interface Alerta {
  id: string;
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  path: string;
  severity: "high" | "medium";
}

export const AlertasCriticos = () => {
  const { data, isLoading } = useDashboardKPIs();

  const alertas: Alerta[] = [];

  if (data) {
    if (data.episBaixoEstoque > 0) {
      alertas.push({
        id: "epis",
        titulo: "EPIs com estoque baixo",
        descricao: `${data.episBaixoEstoque} item(ns) abaixo do mínimo`,
        icon: ShieldAlert,
        path: "/epis",
        severity: "high",
      });
    }
    if (data.documentosPendentes > 0) {
      alertas.push({
        id: "docs",
        titulo: "Documentos pendentes",
        descricao: `${data.documentosPendentes} documento(s) aguardando ação`,
        icon: FileWarning,
        path: "/documentos",
        severity: "medium",
      });
    }
    if (data.ouvidoriaPendente > 0) {
      alertas.push({
        id: "ouvidoria",
        titulo: "Ouvidoria pendente",
        descricao: `${data.ouvidoriaPendente} manifestação(ões) sem resposta`,
        icon: MessageSquareWarning,
        path: "/ouvidoria",
        severity: "high",
      });
    }
    if (data.riscosAtivos > 0) {
      alertas.push({
        id: "riscos",
        titulo: "Riscos ergonômicos ativos",
        descricao: `${data.riscosAtivos} risco(s) identificado(s)`,
        icon: AlertTriangle,
        path: "/ergonomia",
        severity: "medium",
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
      className="bg-card rounded-xl border border-border shadow-sm h-full"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="text-sm font-semibold text-foreground">Alertas Críticos</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : alertas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center px-6">
          <div className="p-3 rounded-full bg-success/10 mb-3">
            <CheckCircle2 className="w-6 h-6 text-success" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">Tudo em ordem!</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Nenhum alerta crítico no momento</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {alertas.map((alerta, index) => (
            <motion.div
              key={alerta.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 + index * 0.04 }}
            >
              <Link
                to={alerta.path}
                className="flex items-center gap-3 px-6 py-3.5 hover:bg-muted/40 transition-colors group"
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    alerta.severity === "high" ? "bg-destructive" : "bg-warning"
                  )}
                />
                <alerta.icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    alerta.severity === "high" ? "text-destructive" : "text-warning"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{alerta.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">{alerta.descricao}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

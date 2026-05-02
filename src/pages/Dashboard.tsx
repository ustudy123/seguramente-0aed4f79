import { motion } from "framer-motion";
import { PilaresSummaryLive } from "@/components/dashboard/PilaresSummaryLive";
import { DashboardKPIs } from "@/components/dashboard/DashboardKPIs";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AlertasCriticos } from "@/components/dashboard/AlertasCriticos";
import { PendingTasks } from "@/components/dashboard/PendingTasks";
import { CalendarDays } from "lucide-react";

const Dashboard = () => {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-8 pb-8">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Plataforma de Governança do Trabalho Humano
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/60 px-4 py-2 rounded-lg">
          <CalendarDays className="w-4 h-4" />
          <span className="capitalize">{today}</span>
        </div>
      </motion.div>

      {/* Pilares Summary - Visão Geral */}
      <PilaresSummaryLive />

      {/* KPIs Operacionais */}
      <DashboardKPIs />

      {/* Pendências */}
      <PendingTasks />

      {/* Alertas Críticos */}
      <AlertasCriticos />
    </div>
  );
};

export default Dashboard;

import { motion } from "framer-motion";
import { PilaresSummaryLive } from "@/components/dashboard/PilaresSummaryLive";
import { DashboardPilares } from "@/components/dashboard/DashboardPilares";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
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

      {/* Quick Actions */}
      <QuickActions />

      {/* Pilares Detail Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="h-7 w-1 rounded-full bg-primary" />
          <h2 className="text-lg font-semibold text-foreground">
            Detalhamento por Pilar
          </h2>
        </div>
        <DashboardPilares />
      </motion.div>

      {/* Activity and Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity />
        </div>
        <div>
          <PendingTasks />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

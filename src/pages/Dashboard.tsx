import { motion } from "framer-motion";
import { PilaresSummaryLive } from "@/components/dashboard/PilaresSummaryLive";
import { DashboardPilares } from "@/components/dashboard/DashboardPilares";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { PendingTasks } from "@/components/dashboard/PendingTasks";

const Dashboard = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Plataforma de Governança do Trabalho Humano
        </p>
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
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Detalhamento por Pilar
        </h2>
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

import { motion } from "framer-motion";
import { Users, UserPlus, UserMinus, Clock, Calendar, FileText, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { EmployeeChart } from "@/components/dashboard/EmployeeChart";
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
        <p className="text-muted-foreground">Visão geral do seu RH</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Colaboradores"
          value={198}
          change={4.2}
          icon={Users}
          variant="primary"
          delay={0.05}
        />
        <StatCard
          title="Admissões (Mês)"
          value={6}
          change={12}
          icon={UserPlus}
          variant="success"
          delay={0.1}
        />
        <StatCard
          title="Desligamentos (Mês)"
          value={2}
          change={-25}
          icon={UserMinus}
          variant="warning"
          delay={0.15}
        />
        <StatCard
          title="Turnover"
          value="3.2%"
          change={-8}
          icon={TrendingUp}
          variant="info"
          delay={0.2}
        />
      </div>

      {/* Quick Actions */}
      <QuickActions />

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EmployeeChart />
        </div>
        <div>
          <PendingTasks />
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  );
};

export default Dashboard;

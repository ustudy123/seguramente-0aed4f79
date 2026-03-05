import { motion } from "framer-motion";
import { Activity } from "lucide-react";

export const RecentActivity = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Atividade Recente</h2>
      </div>

      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Activity className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">Nenhuma atividade registrada ainda.</p>
      </div>
    </motion.div>
  );
};

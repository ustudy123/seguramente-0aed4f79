import { motion } from "framer-motion";
import { Activity, Inbox } from "lucide-react";

export const RecentActivity = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
      className="bg-card rounded-xl border border-border shadow-sm h-full"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Atividade Recente</h2>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center py-14 text-center px-6">
        <div className="p-3 rounded-full bg-muted/60 mb-3">
          <Inbox className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade registrada</p>
        <p className="text-xs text-muted-foreground/70 mt-1">As ações recentes aparecerão aqui</p>
      </div>
    </motion.div>
  );
};

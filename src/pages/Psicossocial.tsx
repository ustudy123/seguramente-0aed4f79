import { Brain } from "lucide-react";
import { motion } from "framer-motion";
import { PsicossocialDashboard } from "@/components/avaliacoes/psicossocial/PsicossocialDashboard";

export default function Psicossocial() {
  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Brain className="h-7 w-7 text-primary" />
          Gestão Psicossocial NR-01
        </h1>
        <p className="text-muted-foreground">
          Monitoramento contínuo de riscos psicossociais, campanhas de avaliação e indicadores organizacionais
        </p>
      </motion.div>

      <PsicossocialDashboard />
    </div>
  );
}

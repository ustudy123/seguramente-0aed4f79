import { useState } from "react";
import { Brain, HelpCircle } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PsicossocialDashboard } from "@/components/avaliacoes/psicossocial/PsicossocialDashboard";
import { GuiaRapidoPsicossocial } from "@/components/avaliacoes/psicossocial/GuiaRapidoPsicossocial";

export default function Psicossocial() {
  const [showGuia, setShowGuia] = useState(false);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Gestão Psicossocial NR-01
          </h1>
          <p className="text-muted-foreground">
            Monitoramento contínuo de riscos psicossociais, campanhas de avaliação e indicadores organizacionais
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowGuia(true)}
          className="gap-2 text-purple-700 border-purple-300 hover:bg-purple-50 self-start sm:self-auto"
        >
          <HelpCircle className="h-4 w-4" />
          Guia Rápido
        </Button>
      </motion.div>

      <PsicossocialDashboard />

      <GuiaRapidoPsicossocial open={showGuia} onOpenChange={setShowGuia} />
    </div>
  );
}
